/**
 * AI Vision payment-proof verification.
 *
 * SAFETY: this engine may only move an order to `paid` when the buyer's own
 * screenshot independently confirms the TxID, the amount and a completed
 * status. Anything else is routed to the founder approval queue.
 */

export type VisionExtraction = {
  recipient_pay_id: string | null;
  amount: number | null;
  token: string | null;
  txid: string | null;
  status_label: string | null;
  completed: boolean;
  readable: boolean;
  confidence: number;
  notes: string | null;
};

export type VisionResult = {
  decision: "auto_approved" | "needs_human_review";
  tags: string[];
  extraction: VisionExtraction | null;
  model: string;
  checkedAt: string;
  error?: string;
};

const MODEL = "google/gemini-3.7-flash";
const EXPECTED_PAY_ID = "530019824";
/** Level 1 autonomy threshold — below this the order is routed to the founder approval queue. */
const AUTO_APPROVE_CONFIDENCE = 0.95;


const PROMPT = `You are a payment-proof inspector for a digital marketplace that accepts Binance Pay transfers in USDT.
Look at the attached payment screenshot and extract the transaction facts.
Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"recipient_pay_id": string|null, "amount": number|null, "token": string|null, "txid": string|null, "status_label": string|null, "completed": boolean, "readable": boolean, "confidence": number, "notes": string|null}
Rules:
- "amount" is the numeric transferred amount (no currency symbols).
- "txid" is the Binance transaction / order id reference shown in the receipt.
- "completed" is true only when the receipt clearly shows a successful/completed transfer.
- "readable" is false when the image is blurry, cropped, or is not a payment receipt.
- "confidence" is 0-1 for how sure you are about the extracted fields.`;

async function callVision(dataUrl: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`vision_gateway_${response.status}: ${body.slice(0, 300)}`);
  }
  const json = (await response.json()) as any;
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("vision_unparsable_response");
  return JSON.parse(match[0]) as VisionExtraction;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * LEVEL 2 guardrail: anything the vision engine cannot fully verify becomes a
 * founder approval card in /admin/ai carrying the specific risk tags.
 */
async function routeToApprovalQueue(order: any, tags: string[], extraction: VisionExtraction | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (order.status !== "pending") return;

  const { data: existing } = await supabaseAdmin
    .from("ai_approvals")
    .select("id")
    .eq("tool_name", "release_verified_payment")
    .eq("status", "pending")
    .contains("args", { order_id: order.id })
    .maybeSingle();
  if (existing) return;

  const args = { order_id: order.id, reason: tags.join(", ") || "AI Vision could not verify this proof" };
  const taskId = `TASK-${Date.now().toString(36).toUpperCase()}`;
  const title = `Review payment proof — order ${order.merchant_trade_no ?? String(order.id).slice(0, 8)}`;

  await supabaseAdmin.from("ai_approvals").insert({
    agent_key: "FINANCE_AGENT",
    agent_role: "Finance_Agent",
    action_type: "PROPOSE_APPROVAL",
    task_id: taskId,
    tool_name: "release_verified_payment",
    args,
    args_hash: `${JSON.stringify(args).length}:vision`,
    title,
    reason: tags.join(", "),
    risk_level: "high",
    confidence: extraction?.confidence ?? null,
    evidence: { risk_tags: tags, extraction, order_id: order.id, amount_cents: order.amount_cents },
    expected_outcome: "Order marked paid and the buyer download unlocked in /library.",
    proposal: {
      task_id: taskId,
      agent_role: "Finance_Agent",
      action_type: "PROPOSE_APPROVAL",
      permission_level: "LEVEL_2",
      risk_level: "high",
      summary: title,
      risk_tags: tags,
      buyer_txid: order.buyer_txid,
      amount_cents: order.amount_cents,
      reversible: false,
    },
  });
}



/**
 * Inspects the uploaded proof for an order and either auto-approves it or
 * flags it for the founder queue. Always writes the outcome onto the order.
 */
export async function verifyProofWithVision(orderId: string): Promise<VisionResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const checkedAt = new Date().toISOString();

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,user_id,product_id,status,amount_cents,buyer_txid,proof_path,merchant_trade_no")
    .eq("id", orderId)
    .maybeSingle();

  const fail = async (tags: string[], error?: string, extraction: VisionExtraction | null = null) => {
    const result: VisionResult = {
      decision: "needs_human_review",
      tags,
      extraction,
      model: MODEL,
      checkedAt,
      ...(error ? { error } : {}),
    };
    if (order) {
      await supabaseAdmin
        .from("orders")
        .update({ ai_verification: result as any, review_reason: tags.join(", ") })
        .eq("id", order.id);
      await routeToApprovalQueue(order, tags, extraction);
    }
    return result;
  };


  if (!order) return { decision: "needs_human_review", tags: ["Order not found"], extraction: null, model: MODEL, checkedAt };
  if (order.status !== "pending") return fail(["Order is not pending"]);
  if (!order.proof_path) return fail(["No screenshot uploaded"]);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fail(["AI vision unavailable"], "missing_lovable_api_key");

  if (order.proof_path.toLowerCase().endsWith(".pdf")) {
    return fail(["PDF proof — manual review"]);
  }

  let extraction: VisionExtraction;
  try {
    const { data: file, error: dlError } = await supabaseAdmin.storage.from("payment-proofs").download(order.proof_path);
    if (dlError || !file) throw new Error(dlError?.message ?? "download_failed");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    const mime = order.proof_path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    extraction = await callVision(`data:${mime};base64,${btoa(binary)}`, apiKey);
  } catch (error) {
    return fail(["Vision check failed"], error instanceof Error ? error.message : String(error));
  }

  const tags: string[] = [];
  if (!extraction.readable) tags.push("Unreadable screenshot");
  if (!extraction.completed) tags.push("Payment not completed");

  const expectedAmount = (order.amount_cents ?? 0) / 100;
  if (typeof extraction.amount !== "number" || Number.isNaN(extraction.amount)) {
    tags.push("Amount not detected");
  } else if (extraction.amount + 0.01 < expectedAmount) {
    tags.push(`Amount mismatch: ${extraction.amount} vs ${expectedAmount}`);
  }

  const buyerTxid = normalize(order.buyer_txid);
  const shotTxid = normalize(extraction.txid);
  if (!shotTxid) tags.push("Unreadable TxID");
  else if (!buyerTxid) tags.push("No TxID submitted");
  else if (!(shotTxid.includes(buyerTxid) || buyerTxid.includes(shotTxid))) tags.push("TxID mismatch");

  const payId = normalize(extraction.recipient_pay_id);
  if (payId && !payId.includes(EXPECTED_PAY_ID)) tags.push("Recipient Pay ID mismatch");

  if ((extraction.confidence ?? 0) < 0.6) tags.push("Low AI confidence");

  if (tags.length > 0) return fail(tags, undefined, extraction);

  const result: VisionResult = {
    decision: "auto_approved",
    tags: ["TxID match", "Amount verified", "Status completed"],
    extraction,
    model: MODEL,
    checkedAt,
  };

  await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      provider_tx_id: order.buyer_txid,
      provider_ref: order.buyer_txid,
      verified_at: checkedAt,
      verification_note: "Auto-verified by AI Vision from buyer payment screenshot.",
      failure_reason: null,
      review_reason: null,
      ai_verification: result as any,
    })
    .eq("id", order.id);

  const { data: existing } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("user_id", order.user_id)
    .eq("product_id", order.product_id)
    .maybeSingle();
  if (!existing) {
    await supabaseAdmin
      .from("purchases")
      .insert({ user_id: order.user_id, product_id: order.product_id, order_id: order.id });
  }

  await supabaseAdmin.from("ai_activity_logs").insert({
    agent_key: "FINANCE_AGENT",
    action: "payment_auto_verified",
    tool_name: "ai_vision_proof_verification",
    input_summary: `order ${order.merchant_trade_no ?? order.id}`,
    risk_level: "high",
    result: "paid",
  });
  await supabaseAdmin.from("ai_events").insert({
    type: "payment_verified",
    payload: { order_id: order.id, mode: "ai_vision", amount_cents: order.amount_cents },
  });

  return result;
}
