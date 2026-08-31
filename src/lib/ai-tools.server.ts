import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * CodeVault AI tool layer.
 *
 * The model NEVER gets database access. It may only call the tools declared
 * here, each with a validated input schema, a risk level and a permission
 * level. LEVEL_2 tools never execute — they create an approval request.
 * LEVEL_3 tools are never executable by the AI at all.
 */

export type PermissionLevel = "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
export type RiskLevel = "low" | "medium" | "high" | "critical";

type Db = SupabaseClient<any, any, any>;

export type ToolContext = {
  supabase: Db;
  userId: string;
  /** Set when the call is executing a founder-approved proposal. */
  approvalId?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  permission: PermissionLevel;
  risk: RiskLevel;
  schema: z.ZodTypeAny;
  /** Human summary of the proposed action, shown in the approval card. */
  summarize?: (args: any) => string;
  handler?: (args: any, ctx: ToolContext) => Promise<unknown>;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/* ------------------------------------------------------------------ */
/* LEVEL 1 — autonomous, read/analyse/internal-write only              */
/* ------------------------------------------------------------------ */

const readTools: ToolDefinition[] = [
  {
    name: "get_business_metrics",
    description:
      "Verified marketplace metrics: revenue, orders, customers, conversion, AOV for a period.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({ days: z.number().int().describe("Lookback window in days, 1-90") }),
    handler: async ({ days }, { supabase }) => {
      const window = Math.min(Math.max(Math.trunc(days || 1), 1), 90);
      const since = new Date(Date.now() - window * 86_400_000).toISOString();
      const [orders, products, purchases, downloads] = await Promise.all([
        supabase.from("orders").select("status,amount_cents,user_id,created_at").gte("created_at", since),
        supabase.from("products").select("id,status,views"),
        supabase.from("purchases").select("id,created_at").gte("created_at", since),
        supabase.from("download_events").select("status").gte("created_at", since),
      ]);
      const rows = orders.data ?? [];
      const paid = rows.filter((o: any) => o.status === "paid");
      const revenue = paid.reduce((sum: number, o: any) => sum + o.amount_cents, 0);
      const views = (products.data ?? []).reduce((s: number, p: any) => s + (p.views ?? 0), 0);
      return {
        window_days: window,
        revenue: money(revenue),
        revenue_cents: revenue,
        orders_total: rows.length,
        orders_paid: paid.length,
        orders_failed: rows.filter((o: any) => o.status === "failed").length,
        orders_pending: rows.filter((o: any) => o.status === "pending").length,
        unique_customers: new Set(paid.map((o: any) => o.user_id)).size,
        purchases: purchases.data?.length ?? 0,
        avg_order_value: paid.length ? money(Math.round(revenue / paid.length)) : "$0.00",
        conversion_pct: views ? Number(((paid.length / views) * 100).toFixed(2)) : 0,
        published_products: (products.data ?? []).filter((p: any) => p.status === "published").length,
        draft_products: (products.data ?? []).filter((p: any) => p.status !== "published").length,
        failed_downloads: (downloads.data ?? []).filter((d: any) => d.status === "failed").length,
      };
    },
  },
  {
    name: "get_product_metrics",
    description: "Per-product performance: views, purchases, revenue, quality score.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({ limit: z.number().int().describe("Max products to return, 1-50") }),
    handler: async ({ limit }, { supabase }) => {
      const cap = Math.min(Math.max(Math.trunc(limit || 10), 1), 50);
      const { data: products } = await supabase
        .from("products")
        .select("id,slug,title,status,price_cents,views,quality_score")
        .order("views", { ascending: false })
        .limit(cap);
      const { data: purchases } = await supabase.from("purchases").select("product_id");
      const counts = new Map<string, number>();
      for (const p of purchases ?? []) counts.set(p.product_id, (counts.get(p.product_id) ?? 0) + 1);
      return (products ?? []).map((p: any) => ({
        slug: p.slug,
        title: p.title,
        status: p.status,
        price: money(p.price_cents),
        views: p.views,
        purchases: counts.get(p.id) ?? 0,
        conversion_pct: p.views ? Number((((counts.get(p.id) ?? 0) / p.views) * 100).toFixed(2)) : 0,
        quality_score: p.quality_score,
      }));
    },
  },
  {
    name: "search_products",
    description: "Search the catalog by text, category or status.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({
      query: z.string().describe("Free text; empty string matches everything"),
      status: z.string().describe("published, draft or all"),
    }),
    handler: async ({ query, status }, { supabase }) => {
      let q = supabase
        .from("products")
        .select("slug,title,tagline,category,status,price_cents,tech,quality_score")
        .limit(25);
      if (status && status !== "all") q = q.eq("status", status);
      if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`);
      const { data } = await q;
      return data ?? [];
    },
  },
  {
    name: "check_product_metadata",
    description:
      "Audit every product for missing SEO metadata, cover, demo URL, asset file or description.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({}),
    handler: async (_args, { supabase }) => {
      const { data } = await supabase
        .from("products")
        .select("slug,title,status,description,cover_url,demo_url,asset_path,seo_title,seo_description,tags");
      return (data ?? []).map((p: any) => {
        const issues: string[] = [];
        if (!p.description || p.description.length < 80) issues.push("thin_description");
        if (!p.seo_title) issues.push("missing_seo_title");
        if (!p.seo_description) issues.push("missing_seo_description");
        if (!p.cover_url) issues.push("missing_cover");
        if (!p.demo_url) issues.push("missing_demo");
        if (!p.asset_path) issues.push("missing_download_asset");
        if (!p.tags?.length) issues.push("missing_tags");
        return { slug: p.slug, title: p.title, status: p.status, issues };
      });
    },
  },
  {
    name: "get_failed_payments",
    description: "Recent failed or stuck orders with customer and product context.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({ days: z.number().int().describe("Lookback window in days") }),
    handler: async ({ days }, { supabase }) => {
      const since = new Date(Date.now() - Math.min(Math.max(days || 7, 1), 90) * 86_400_000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id,status,amount_cents,provider,failure_reason,created_at,product_id")
        .in("status", ["failed", "pending"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  },
  {
    name: "get_failed_downloads",
    description: "Recent failed download attempts by paying customers.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({ days: z.number().int().describe("Lookback window in days") }),
    handler: async ({ days }, { supabase }) => {
      const since = new Date(Date.now() - Math.min(Math.max(days || 7, 1), 90) * 86_400_000).toISOString();
      const { data } = await supabase
        .from("download_events")
        .select("id,status,error,created_at,product_id,user_id")
        .eq("status", "failed")
        .gte("created_at", since)
        .limit(50);
      return data ?? [];
    },
  },
  {
    name: "check_system_health",
    description: "Deterministic health check of catalog, payments, downloads and open incidents.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({}),
    handler: async (_args, { supabase }) => {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const [products, orders, downloads, incidents] = await Promise.all([
        supabase.from("products").select("id,status,asset_path"),
        supabase.from("orders").select("status").gte("created_at", since),
        supabase.from("download_events").select("status").gte("created_at", since),
        supabase.from("ai_incidents").select("id,severity,title,status").eq("status", "open"),
      ]);
      const published = (products.data ?? []).filter((p: any) => p.status === "published");
      const missingAsset = published.filter((p: any) => !p.asset_path).length;
      const failedOrders = (orders.data ?? []).filter((o: any) => o.status === "failed").length;
      const failedDownloads = (downloads.data ?? []).filter((d: any) => d.status === "failed").length;
      const grade = (bad: number, warn: number) => (bad > warn ? "critical" : bad > 0 ? "warning" : "healthy");
      return {
        catalog: { status: grade(missingAsset, 2), published: published.length, missing_download_asset: missingAsset },
        payments: { status: grade(failedOrders, 3), failed_24h: failedOrders },
        downloads: { status: grade(failedDownloads, 2), failed_24h: failedDownloads },
        incidents: { status: (incidents.data?.length ?? 0) > 0 ? "warning" : "healthy", open: incidents.data ?? [] },
      };
    },
  },
  {
    name: "get_knowledge",
    description: "Retrieve approved policy / strategy knowledge documents.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({ topic: z.string().describe("Topic keyword, empty for all") }),
    handler: async ({ topic }, { supabase }) => {
      let q = supabase.from("ai_knowledge_documents").select("title,category,body").limit(10);
      if (topic) q = q.or(`title.ilike.%${topic}%,body.ilike.%${topic}%`);
      const { data } = await q;
      return data ?? [];
    },
  },
  {
    name: "get_memory",
    description: "Read stored founder preferences, past decisions and operational memory.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({}),
    handler: async (_args, { supabase }) => {
      const { data } = await supabase
        .from("ai_memory")
        .select("kind,source,title,content,confirmed,created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
  },
  {
    name: "list_tasks",
    description: "List internal AI tasks and their status.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({ status: z.string().describe("queued, executing, completed, failed or all") }),
    handler: async ({ status }, { supabase }) => {
      let q = supabase
        .from("ai_tasks")
        .select("id,title,status,priority,agent_key,requires_approval,created_at")
        .order("priority")
        .limit(50);
      if (status && status !== "all") q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    },
  },
];

const writeLevel1Tools: ToolDefinition[] = [
  {
    name: "create_internal_task",
    description: "Create an internal operational task in the founder's task queue.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({
      title: z.string(),
      description: z.string(),
      priority: z.number().int().describe("0 = customer impacting, 4 = nice to have"),
      agent_key: z.string().describe("CEO, OPERATIONS, SUPPORT, PRODUCT, MARKETING, SEO, ANALYTICS, QUALITY, SECURITY_MONITOR"),
    }),
    handler: async (args, { supabase }) => {
      const dedupe = `${args.agent_key}:${args.title}`.slice(0, 180).toLowerCase();
      const { data, error } = await supabase
        .from("ai_tasks")
        .upsert(
          {
            title: args.title,
            description: args.description,
            priority: Math.min(Math.max(args.priority ?? 2, 0), 4),
            agent_key: args.agent_key,
            dedupe_key: dedupe,
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        )
        .select("id,title,status")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? { deduplicated: true, title: args.title };
    },
  },
  {
    name: "create_incident",
    description: "Open an operational incident for something that needs tracking.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({
      title: z.string(),
      description: z.string(),
      severity: z.string().describe("info, low, medium, high or critical"),
      affected_system: z.string(),
    }),
    handler: async (args, { supabase }) => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .insert({
          title: args.title,
          description: args.description,
          severity: ["info", "low", "medium", "high", "critical"].includes(args.severity) ? args.severity : "low",
          affected_system: args.affected_system,
          source: "ai_agent",
        })
        .select("id,title,severity")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "save_memory",
    description:
      "Store an operational memory or AI recommendation. Founder instructions must be marked source=founder_instruction and are only written when the founder said them.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({
      title: z.string(),
      content: z.string(),
      kind: z.string().describe("business, operational, preference or decision"),
      source: z.string().describe("founder_instruction, database_fact or ai_recommendation"),
    }),
    handler: async (args, { supabase }) => {
      const { data, error } = await supabase
        .from("ai_memory")
        .insert({
          title: args.title,
          content: args.content,
          kind: args.kind,
          source: args.source,
          confirmed: args.source === "founder_instruction",
        })
        .select("id,title,source")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "save_report",
    description: "Persist a generated report (daily, weekly or monthly) for the founder.",
    permission: "LEVEL_1",
    risk: "low",
    schema: z.object({
      kind: z.string().describe("daily, weekly, monthly or adhoc"),
      title: z.string(),
      body: z.string().describe("Markdown report body"),
    }),
    handler: async (args, { supabase }) => {
      const { data, error } = await supabase
        .from("ai_reports")
        .insert({ kind: args.kind, title: args.title, body: args.body })
        .select("id,title,kind")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_product_draft",
    description: "Create an unpublished product draft. Publishing is a separate, approval-gated action.",
    permission: "LEVEL_1",
    risk: "medium",
    schema: z.object({
      slug: z.string(),
      title: z.string(),
      tagline: z.string(),
      description: z.string(),
      category: z.string(),
      tech: z.array(z.string()),
      price_cents: z.number().int(),
      seo_title: z.string(),
      seo_description: z.string(),
      tags: z.array(z.string()),
    }),
    handler: async (args, { supabase }) => {
      const { data, error } = await supabase
        .from("products")
        .insert({ ...args, status: "draft" })
        .select("id,slug,title,status")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
];

/* ------------------------------------------------------------------ */
/* LEVEL 2 — AI proposes, founder approves, then the engine executes   */
/* ------------------------------------------------------------------ */

const level2Tools: ToolDefinition[] = [
  {
    name: "publish_product",
    description:
      "Publish a product to the public marketplace. Requires founder approval. Blocked unless the listing has a sandbox preview URL, repository reference, licence type, download asset and SEO metadata.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({ slug: z.string() }),
    summarize: (a) => `Publish product "${a.slug}" to the public marketplace`,
    handler: async ({ slug }, { supabase }) => {
      const { data: product } = await supabase
        .from("products")
        .select("slug,sandbox_url,repo_ref,license_type,asset_path,seo_title,seo_description,description")
        .eq("slug", slug)
        .maybeSingle();
      if (!product) throw new Error(`Product "${slug}" not found.`);
      const missing = [
        !product.sandbox_url && "sandbox_url",
        !product.repo_ref && "repo_ref",
        !product.license_type && "license_type",
        !product.asset_path && "asset_path",
        !product.seo_title && "seo_title",
        !product.seo_description && "seo_description",
        (product.description?.length ?? 0) < 80 && "description",
      ].filter(Boolean);
      if (missing.length) {
        throw new Error(`Listing quality gate failed — missing: ${missing.join(", ")}. Fix these before publishing.`);
      }
      const { data, error } = await supabase
        .from("products")
        .update({ status: "published" })
        .eq("slug", slug)
        .select("slug,status")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  {
    name: "unpublish_product",
    description: "Remove a product from the public marketplace. Requires founder approval.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({ slug: z.string(), reason: z.string() }),
    summarize: (a) => `Unpublish "${a.slug}" — ${a.reason}`,
    handler: async ({ slug }, { supabase }) => {
      const { data, error } = await supabase
        .from("products")
        .update({ status: "draft" })
        .eq("slug", slug)
        .select("slug,status")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "update_product_price",
    description: "Change a product price. Financial impact — requires founder approval.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({ slug: z.string(), price_cents: z.number().int(), reason: z.string() }),
    summarize: (a) => `Set ${a.slug} price to ${money(a.price_cents)} — ${a.reason}`,
    handler: async ({ slug, price_cents }, { supabase }) => {
      const { data, error } = await supabase
        .from("products")
        .update({ price_cents })
        .eq("slug", slug)
        .select("slug,price_cents")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "update_product_metadata",
    description: "Apply improved title/description/SEO metadata to a product. Requires founder approval.",
    permission: "LEVEL_2",
    risk: "medium",
    schema: z.object({
      slug: z.string(),
      seo_title: z.string(),
      seo_description: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
    }),
    summarize: (a) => `Update marketing + SEO metadata for "${a.slug}"`,
    handler: async ({ slug, ...fields }, { supabase }) => {
      const { data, error } = await supabase
        .from("products")
        .update(fields)
        .eq("slug", slug)
        .select("slug,seo_title")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "create_campaign",
    description: "Prepare an outbound marketing campaign. Sending requires founder approval.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({
      name: z.string(),
      audience: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
    summarize: (a) => `Send campaign "${a.name}" to ${a.audience}`,
    handler: async (args, { supabase }) => {
      const { data, error } = await supabase
        .from("ai_reports")
        .insert({
          kind: "campaign",
          title: `Campaign: ${args.name}`,
          body: `**Audience:** ${args.audience}\n\n**Subject:** ${args.subject}\n\n${args.body}`,
        })
        .select("id,title")
        .single();
      if (error) throw new Error(error.message);
      return { queued: true, ...data };
    },
  },
  {
    name: "send_customer_message",
    description: "Send a message to a customer about their order. Requires founder approval.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({ order_id: z.string(), subject: z.string(), body: z.string() }),
    summarize: (a) => `Message the customer of order ${a.order_id}: "${a.subject}"`,
    handler: async (args, { supabase }) => {
      const { error } = await supabase.from("ai_activity_logs").insert({
        agent_key: "SUPPORT",
        action: "customer_message_sent",
        tool_name: "send_customer_message",
        input_summary: `${args.order_id}: ${args.subject}`,
        result: "queued_for_delivery",
        risk_level: "high",
        approval_required: true,
      });
      if (error) throw new Error(error.message);
      return { queued: true, order_id: args.order_id };
    },
  },
  {
    name: "create_discount_code",
    description: "Create a promotional discount code. Revenue impact — requires founder approval.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({ code: z.string(), percent_off: z.number().int(), reason: z.string() }),
    summarize: (a) => `Create discount code ${a.code} at ${a.percent_off}% off — ${a.reason}`,
    handler: async ({ code, percent_off }, { supabase }) => {
      const pct = Math.min(Math.max(Math.trunc(percent_off), 1), 90);
      const { data, error } = await supabase
        .from("discount_codes")
        .insert({ code: code.toUpperCase(), percent_off: pct, active: true })
        .select("code,percent_off,active")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "propose_seller_payout",
    description:
      "Record a proposed seller payout for the founder to settle manually. The AI never moves money — this only writes a payout record. Requires founder approval.",
    permission: "LEVEL_2",
    risk: "high",
    schema: z.object({ seller_reference: z.string(), amount_cents: z.number().int(), reason: z.string() }),
    summarize: (a) => `Record a ${money(a.amount_cents)} payout for ${a.seller_reference} — ${a.reason}`,
    handler: async (args, { supabase }) => {
      const { data, error } = await supabase
        .from("seller_payouts")
        .insert({
          amount_cents: Math.max(0, Math.trunc(args.amount_cents)),
          reference: args.seller_reference,
          note: args.reason,
          status: "proposed",
        })
        .select("id,amount_cents,status")
        .single();
      if (error) throw new Error(error.message);
      return { ...data, note: "Recorded only. The founder settles this outside the AI system." };
    },
  },
];

/* ------------------------------------------------------------------ */
/* LEVEL 3 — human only. Declared so the AI can recommend, never run.  */
/* ------------------------------------------------------------------ */

const level3Tools: ToolDefinition[] = [
  {
    name: "refund_customer",
    description:
      "HUMAN ONLY. Refunds are executed by the founder outside the AI system. Calling this returns a refusal you must relay.",
    permission: "LEVEL_3",
    risk: "critical",
    schema: z.object({ order_id: z.string(), reason: z.string() }),
  },
  {
    name: "mark_order_paid",
    description:
      "HUMAN ONLY AND STRUCTURALLY IMPOSSIBLE. Orders only become paid through a signature-verified Binance Pay callback. Calling this returns a refusal.",
    permission: "LEVEL_3",
    risk: "critical",
    schema: z.object({ order_id: z.string() }),
  },
  {
    name: "transfer_funds",
    description: "HUMAN ONLY. The AI can never move money. Calling this returns a refusal.",
    permission: "LEVEL_3",
    risk: "critical",
    schema: z.object({ amount_cents: z.number().int(), destination: z.string() }),
  },
  {
    name: "grant_admin_role",
    description: "HUMAN ONLY. Permission changes are never made by the AI.",
    permission: "LEVEL_3",
    risk: "critical",
    schema: z.object({ user_id: z.string() }),
  },
  {
    name: "change_payment_configuration",
    description: "HUMAN ONLY. Payment provider keys, certificates and payout destinations are founder-only.",
    permission: "LEVEL_3",
    risk: "critical",
    schema: z.object({ change: z.string() }),
  },
];


export const TOOLS: ToolDefinition[] = [
  ...readTools,
  ...writeLevel1Tools,
  ...level2Tools,
  ...level3Tools,
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

export function stableHash(value: unknown): string {
  const canonical = JSON.stringify(value, Object.keys(value as object).sort());
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash * 31 + canonical.charCodeAt(i)) | 0;
  }
  return `${canonical.length}:${hash.toString(16)}`;
}
