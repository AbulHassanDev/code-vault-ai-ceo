import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin access required.");
}

export const checkDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().min(1).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: pct } = await (context as any).supabase.rpc("lookup_discount", { _code: data.code });
    return pct ? { ok: true, percentOff: pct as number } : { ok: false, percentOff: 0 };
  });

/* ---------- Buyer orders & support ---------- */
export const myOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const [{ data: orders }, { data: tickets }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,status,amount_cents,discount_code,discount_cents,merchant_trade_no,buyer_txid,failure_reason,review_reason,created_at,updated_at,products(title,slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    return { orders: orders ?? [], tickets: tickets ?? [] };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ subject: z.string().trim().min(3).max(140), message: z.string().trim().min(5).max(4000), orderId: z.string().uuid().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId, subject: data.subject, message: data.message, order_id: data.orderId ?? null,
    });
    if (error) return { ok: false, message: error.message };
    await supabase.from("ai_events").insert({ type: "support_ticket", payload: { subject: data.subject } });
    return { ok: true, message: "Message sent. We'll reply here." };
  });

/* ---------- Admin: products ---------- */
const ProductInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(3).max(80),
  title: z.string().trim().min(3).max(140),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  category: z.string().max(40),
  tech: z.array(z.string().max(40)).max(20),
  price_cents: z.number().int().min(0).max(10_000_000),
  cover_url: z.string().url().optional().nullable().or(z.literal("")),
  demo_url: z.string().url().optional().nullable().or(z.literal("")),
  asset_path: z.string().max(400).optional().nullable(),
  status: z.enum(["draft", "published"]),
});

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data } = await supabase
      .from("products")
      .select("id,slug,title,tagline,description,category,tech,price_cents,status,cover_url,demo_url,asset_path,updated_at")
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProductInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { id, ...row } = data;
    const clean = { ...row, cover_url: row.cover_url || null, demo_url: row.demo_url || null };
    const q = id ? supabase.from("products").update(clean).eq("id", id) : supabase.from("products").insert(clean);
    const { error } = await q;
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: id ? "Product updated." : "Product created." };
  });

/* ---------- Admin: discount codes ---------- */
export const adminListDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminSaveDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      code: z.string().trim().regex(/^[A-Za-z0-9_-]+$/).min(3).max(40).optional(),
      percent_off: z.number().int().min(1).max(100).optional(),
      active: z.boolean().optional(),
      expires_at: z.string().datetime().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { id, ...row } = data;
    if (row.code) row.code = row.code.toUpperCase();
    const { error } = id
      ? await supabase.from("discount_codes").update(row).eq("id", id)
      : await supabase.from("discount_codes").insert(row);
    return error ? { ok: false, message: error.message } : { ok: true, message: "Saved." };
  });

/* ---------- Admin: support & incidents ---------- */
export const adminInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const [{ data: tickets }, { data: incidents }] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("ai_incidents").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    return { tickets: tickets ?? [], incidents: incidents ?? [] };
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reply: z.string().max(4000).optional(), status: z.enum(["open", "answered", "closed"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const patch: any = { status: data.status };
    if (data.reply !== undefined) patch.admin_reply = data.reply;
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", data.id);
    return error ? { ok: false, message: error.message } : { ok: true, message: "Ticket updated." };
  });

export const adminResolveIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), resolution: z.string().max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("ai_incidents")
      .update({ status: "resolved", resolution: data.resolution, resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    return error ? { ok: false, message: error.message } : { ok: true, message: "Incident resolved." };
  });
