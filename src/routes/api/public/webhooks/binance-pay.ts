import { createFileRoute } from "@tanstack/react-router";

/**
 * Binance Pay payment callback. This is the ONLY path in the system that can
 * turn an order into a verified purchase.
 */
export const Route = createFileRoute("/api/public/webhooks/binance-pay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { verifyBinanceSignature, fulfilVerifiedPayment, isPaymentsConfigured } = await import(
          "@/lib/payments.server"
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (!isPaymentsConfigured()) {
          return new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: "not_configured" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }

        const check = await verifyBinanceSignature(request.headers, rawBody);
        if (!check.valid) {
          await supabaseAdmin.from("payment_webhook_events").insert({
            provider: "binance_pay",
            signature_valid: false,
            status: "rejected",
            error: check.reason ?? "invalid_signature",
            payload: { raw_length: rawBody.length },
          });
          return new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: "invalid_signature" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let envelope: any;
        try {
          envelope = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: "bad_json" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const data = typeof envelope?.data === "string" ? JSON.parse(envelope.data) : (envelope?.data ?? envelope);
        const merchantTradeNo: string | undefined = data?.merchantTradeNo;
        const bizStatus: string = envelope?.bizStatus ?? data?.status ?? "";
        const transactionId: string | null = data?.transactionId ?? data?.transactTime?.toString?.() ?? null;
        const currency: string = data?.currency ?? data?.fiatCurrency ?? "USD";
        const amountCents = Math.round(Number(data?.totalFee ?? data?.orderAmount ?? data?.fiatAmount ?? 0) * 100);

        if (!merchantTradeNo) {
          return new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: "missing_trade_no" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        if (bizStatus !== "PAY_SUCCESS") {
          await supabaseAdmin.from("payment_webhook_events").insert({
            provider: "binance_pay",
            merchant_trade_no: merchantTradeNo,
            transaction_id: transactionId,
            signature_valid: true,
            status: "ignored",
            error: bizStatus || "non_success_status",
            payload: data,
          });
          await supabaseAdmin
            .from("orders")
            .update({ status: "failed", failure_reason: bizStatus || "payment_not_successful" })
            .eq("merchant_trade_no", merchantTradeNo)
            .neq("status", "paid");
          return new Response(JSON.stringify({ returnCode: "SUCCESS", returnMessage: null }), {
            headers: { "content-type": "application/json" },
          });
        }

        const outcome = await fulfilVerifiedPayment(supabaseAdmin as any, {
          merchantTradeNo,
          transactionId,
          amountCents,
          currency,
        });

        await supabaseAdmin.from("payment_webhook_events").insert({
          provider: "binance_pay",
          merchant_trade_no: merchantTradeNo,
          transaction_id: transactionId,
          signature_valid: true,
          amount_matched: outcome.amountMatched,
          status: outcome.ok ? "fulfilled" : "rejected",
          error: outcome.ok ? null : outcome.message,
          payload: data,
        });

        return new Response(JSON.stringify({ returnCode: "SUCCESS", returnMessage: null }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
