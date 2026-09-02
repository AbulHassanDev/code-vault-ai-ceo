import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listPublicProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("products")
    .select("id,slug,title,tagline,category,tech,price_cents,cover_url,quality_score,views")
    .eq("status", "published")
    .order("views", { ascending: false });
  return data ?? [];
});

export const getPublicProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { data: product } = await publicClient()
      .from("products")
      .select(
        "id,slug,title,tagline,description,category,tech,price_cents,cover_url,demo_url,seo_title,seo_description,tags,quality_score",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return product;
  });

/** Creates a pending order. Ownership is only granted by a verified payment callback. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id,price_cents,status,title")
      .eq("id", data.productId)
      .eq("status", "published")
      .maybeSingle();
    if (pErr || !product) return { ok: false, message: "Product not available." };

    const merchantTradeNo = `CV${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const paymentsConfigured = Boolean(process.env["BINANCE_PAY_PUBLIC_CERT"]);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        product_id: product.id,
        amount_cents: product.price_cents,
        status: "pending",
        provider: paymentsConfigured ? "binance_pay" : "unconfigured",
        merchant_trade_no: merchantTradeNo,
      })
      .select("id,status,amount_cents,merchant_trade_no")
      .single();
    if (error) return { ok: false, message: error.message };

    await supabase.from("ai_events").insert({
      type: "order_created",
      payload: { order_id: order.id, product: product.title, amount_cents: order.amount_cents },
    });

    return {
      ok: true,
      orderId: order.id as string,
      merchantTradeNo,
      message: paymentsConfigured
        ? `Order ${merchantTradeNo} created. Ownership unlocks only after Binance Pay confirms the payment against a verified signature.`
        : "Order created and waiting for payment. Binance Pay is not connected yet, so ownership stays unverified — the AI can never mark it paid.",
    };
  });


/** Verified buyers only. Logs every attempt so the operations agent can see failures. */
export const requestDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id,product_id")
      .eq("user_id", userId)
      .eq("product_id", data.productId)
      .maybeSingle();

    if (!purchase) {
      await supabase.from("download_events").insert({
        user_id: userId,
        product_id: data.productId,
        status: "denied",
        error: "no_verified_purchase",
      });
      return { ok: false, message: "No verified purchase found for this product." };
    }

    const { data: product } = await supabase
      .from("products")
      .select("asset_path,title")
      .eq("id", data.productId)
      .maybeSingle();

    if (!product?.asset_path) {
      await supabase.from("download_events").insert({
        user_id: userId,
        product_id: data.productId,
        status: "failed",
        error: "missing_asset",
      });
      await supabase.from("ai_events").insert({
        type: "download_failed",
        payload: { product_id: data.productId, reason: "missing_asset" },
      });
      return { ok: false, message: "The download file is missing. Support has been alerted automatically." };
    }

    const { data: signed } = await supabase.storage.from("product-assets").createSignedUrl(product.asset_path, 300);
    await supabase.from("download_events").insert({
      user_id: userId,
      product_id: data.productId,
      status: signed?.signedUrl ? "success" : "failed",
      error: signed?.signedUrl ? null : "signing_failed",
    });
    return signed?.signedUrl
      ? { ok: true, url: signed.signedUrl as string, message: "Download link valid for 5 minutes." }
      : { ok: false, message: "Could not create a download link. An incident has been logged." };
  });

/**
 * Buyer attaches their Binance TxID plus an optional payment screenshot.
 * When a screenshot is present, the AI Vision engine inspects it and may
 * auto-release the download; otherwise the order goes to the founder queue.
 */
export const submitPaymentProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        txid: z.string().min(6).max(120),
        proofPath: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (data.proofPath && !data.proofPath.startsWith(`${userId}/`)) {
      return { ok: false, message: "Invalid proof upload path." };
    }
    const { data: order, error } = await supabase
      .from("orders")
      .update({
        buyer_txid: data.txid.trim(),
        ...(data.proofPath ? { proof_path: data.proofPath } : {}),
      })
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id,merchant_trade_no")
      .maybeSingle();
    if (error || !order) return { ok: false, message: "Pending order not found." };
    await supabase.from("ai_events").insert({
      type: "payment_proof_submitted",
      payload: { order_id: order.id, merchant_trade_no: order.merchant_trade_no, has_screenshot: Boolean(data.proofPath) },
    });

    if (!data.proofPath) {
      return {
        ok: true,
        verified: false,
        tags: [] as string[],
        message: "Payment proof received. Awaiting founder verification.",
      };
    }

    const { verifyProofWithVision } = await import("./vision.server");
    const result = await verifyProofWithVision(order.id as string);
    return result.decision === "auto_approved"
      ? {
          ok: true,
          verified: true,
          tags: result.tags,
          message: "AI Vision verified your payment — your download is unlocked in your library.",
        }
      : {
          ok: true,
          verified: false,
          tags: result.tags,
          message: "Screenshot received. Our AI could not fully verify it, so a founder is reviewing your order.",
        };
  });

export const myLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: purchases } = await supabase
      .from("purchases")
      .select("id,product_id,created_at,download_count,products(slug,title,tagline,category)")
      .eq("user_id", userId);
    const { data: orders } = await supabase
      .from("orders")
      .select("id,status,amount_cents,created_at,products(title,slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { purchases: purchases ?? [], orders: orders ?? [] };
  });
