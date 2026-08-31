import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: founder/admin access required.");
}

/** Founder-only queue of manual Binance Pay verifications + financial metrics. */
export const paymentQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select(
        "id,status,amount_cents,currency,merchant_trade_no,buyer_txid,provider,provider_tx_id,verification_note,verified_at,created_at,user_id,product_id,products(title,slug)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = (orders ?? []) as any[];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name")
      .in("id", Array.from(new Set(rows.map((o) => o.user_id))).slice(0, 100));
    const byUser = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const pendingCents = rows
      .filter((o) => o.status === "pending")
      .reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);
    const verifiedTodayCents = rows
      .filter((o) => o.status === "paid" && new Date(o.verified_at ?? o.created_at) >= startOfDay)
      .reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);
    const unresolvedTxids = rows.filter((o) => o.status === "pending" && Boolean(o.buyer_txid)).length;

    return {
      orders: rows.map((o) => ({
        id: o.id as string,
        status: o.status as string,
        amountCents: o.amount_cents as number,
        currency: o.currency as string,
        merchantTradeNo: o.merchant_trade_no as string | null,
        buyerTxid: o.buyer_txid as string | null,
        providerTxId: o.provider_tx_id as string | null,
        verificationNote: o.verification_note as string | null,
        createdAt: o.created_at as string,
        productTitle: o.products?.title ?? "Unknown product",
        productSlug: o.products?.slug ?? null,
        buyerEmail: o.profiles?.email ?? null,
        buyerName: o.profiles?.display_name ?? null,
      })),
      metrics: { pendingCents, verifiedTodayCents, unresolvedTxids },
    };
  });

/**
 * HUMAN-ONLY financial action. Reachable only from the founder command center;
 * no AI tool can call this path.
 */
export const verifyPaymentManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        decision: z.enum(["approve", "flag", "reject"]),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,product_id,status,amount_cents,currency,buyer_txid,merchant_trade_no")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { ok: false, message: "Order not found." };

    if (data.decision !== "approve") {
      const failureReason = data.decision === "flag" ? "invalid_txid" : "rejected_by_founder";
      await supabaseAdmin
        .from("orders")
        .update({
          status: data.decision === "flag" ? "pending" : "failed",
          failure_reason: failureReason,
          verification_note: data.note ?? failureReason,
          verified_by: userId,
        })
        .eq("id", order.id);
      await supabaseAdmin.from("ai_activity_logs").insert({
        agent_key: "FOUNDER",
        action: `payment_${data.decision}`,
        tool_name: "manual_payment_verification",
        input_summary: `order ${order.merchant_trade_no ?? order.id}`,
        risk_level: "high",
        result: data.decision,
      });
      return {
        ok: true,
        message: data.decision === "flag" ? "TxID flagged as invalid." : "Order rejected.",
      };
    }

    if (order.status === "paid") return { ok: false, message: "Order is already paid." };
    if (!order.buyer_txid) return { ok: false, message: "No buyer TxID submitted — cannot verify." };

    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        provider_tx_id: order.buyer_txid,
        provider_ref: order.buyer_txid,
        verified_at: new Date().toISOString(),
        verified_by: userId,
        verification_note: data.note ?? "Manually verified by founder in Binance app.",
        failure_reason: null,
      })
      .eq("id", order.id);

    const { data: existing } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("user_id", order.user_id)
      .eq("product_id", order.product_id)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("purchases").insert({
        user_id: order.user_id,
        product_id: order.product_id,
        order_id: order.id,
      });
    }

    await supabaseAdmin.from("ai_activity_logs").insert({
      agent_key: "FOUNDER",
      action: "payment_approved",
      tool_name: "manual_payment_verification",
      input_summary: `order ${order.merchant_trade_no ?? order.id} · ${order.buyer_txid}`,
      risk_level: "high",
      result: "paid",
    });
    await supabaseAdmin.from("ai_events").insert({
      type: "payment_verified",
      payload: { order_id: order.id, mode: "manual", amount_cents: order.amount_cents },
    });

    return { ok: true, message: "Payment verified — download released to buyer." };
  });

export const setPaymentMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mode: z.enum(["manual", "merchant_api"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("ai_settings")
      .update({ payment_mode: data.mode, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true, message: `Payment mode set to ${data.mode}.` };
  });
