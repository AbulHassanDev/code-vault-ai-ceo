import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<any, any, any>;

/**
 * Binance Pay webhook verification + fulfilment.
 *
 * SECURITY INVARIANTS (never relax these):
 * - An order becomes `paid` ONLY here, after an RSA signature check against the
 *   Binance Pay public certificate AND an exact amount/currency match.
 * - The AI has no tool that can write orders.status = 'paid'. Fulfilment is
 *   deterministic code, not a model decision.
 */

export type VerificationOutcome =
  | { ok: true; merchantTradeNo: string; transactionId: string | null; amountCents: number; currency: string }
  | { ok: false; reason: string };

export function isPaymentsConfigured(): boolean {
  return Boolean(process.env["BINANCE_PAY_PUBLIC_CERT"]);
}

function normalizeCert(raw: string): string {
  const value = raw.trim();
  if (value.includes("BEGIN")) return value.replace(/\\n/g, "\n");
  const body = value.replace(/\s+/g, "").replace(/\\n/g, "");
  return `-----BEGIN PUBLIC KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END PUBLIC KEY-----`;
}

/** RSA-SHA256 verification of the documented Binance Pay webhook payload. */
export async function verifyBinanceSignature(
  headers: Headers,
  rawBody: string,
): Promise<{ valid: boolean; reason?: string }> {
  const cert = process.env["BINANCE_PAY_PUBLIC_CERT"];
  if (!cert) return { valid: false, reason: "payments_not_configured" };

  const timestamp = headers.get("binancepay-timestamp");
  const nonce = headers.get("binancepay-nonce");
  const signature = headers.get("binancepay-signature");
  if (!timestamp || !nonce || !signature) return { valid: false, reason: "missing_signature_headers" };

  // Reject replays older than 5 minutes.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const { createVerify } = await import("node:crypto");
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`, "utf8");
    verifier.end();
    const valid = verifier.verify(normalizeCert(cert), signature, "base64");
    return valid ? { valid: true } : { valid: false, reason: "signature_mismatch" };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "verify_error" };
  }
}

/**
 * Marks an order paid and grants the purchase. Idempotent: a repeated webhook
 * for the same merchant trade number is a no-op.
 */
export async function fulfilVerifiedPayment(
  supabase: Db,
  input: { merchantTradeNo: string; transactionId: string | null; amountCents: number; currency: string },
): Promise<{ ok: boolean; message: string; amountMatched: boolean }> {
  const { data: order } = await supabase
    .from("orders")
    .select("id,user_id,product_id,amount_cents,currency,status")
    .eq("merchant_trade_no", input.merchantTradeNo)
    .maybeSingle();

  if (!order) return { ok: false, message: "unknown_merchant_trade_no", amountMatched: false };
  if (order.status === "paid") return { ok: true, message: "already_fulfilled", amountMatched: true };

  const amountMatched =
    order.amount_cents === input.amountCents &&
    String(order.currency).toUpperCase() === input.currency.toUpperCase();

  if (!amountMatched) {
    await supabase
      .from("orders")
      .update({ status: "failed", failure_reason: "amount_mismatch" })
      .eq("id", order.id);
    await supabase.from("ai_incidents").insert({
      severity: "critical",
      title: "Payment amount mismatch",
      description: `Order ${order.id} expected ${order.amount_cents} ${order.currency}, callback reported ${input.amountCents} ${input.currency}.`,
      source: "binance_pay_webhook",
      affected_system: "payments",
    });
    return { ok: false, message: "amount_mismatch", amountMatched: false };
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      provider: "binance_pay",
      provider_ref: input.transactionId,
      provider_tx_id: input.transactionId,
      verified_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq("id", order.id);

  await supabase.from("purchases").insert({
    user_id: order.user_id,
    product_id: order.product_id,
    order_id: order.id,
  });

  await supabase.from("ai_events").insert({
    type: "payment_verified",
    payload: { order_id: order.id, amount_cents: input.amountCents, currency: input.currency },
  });

  return { ok: true, message: "fulfilled", amountMatched: true };
}
