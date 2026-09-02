import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aiChat, decideApproval, runDailyLoop, toggleAgent, updateAiSettings } from "@/lib/ai.functions";
import { paymentQueue, setPaymentMode, verifyPaymentManually } from "@/lib/payment-queue.functions";
import { toast } from "sonner";

const money = (cents: number, currency = "USDT") =>
  `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const activeTabClass =
  "data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 data-[state=active]:font-semibold data-[state=active]:shadow-none";

const QUICK_PROMPTS = [
  { label: "Audit Pending TxIDs", prompt: "Audit all pending orders with submitted TxIDs. Summarize each order, its buyer, amount, and flag any suspicious patterns." },
  { label: "Review Product Catalog", prompt: "Review the product catalog: listing readiness, pricing consistency, and which products should be featured or delisted." },
  { label: "Generate Weekly Report", prompt: "Generate a weekly business report covering revenue, orders, support load, security incidents, and the top 3 recommended actions." },
];

type ApprovalFilter = "all" | "payments" | "catalog" | "payouts";
const APPROVAL_FILTERS: { key: ApprovalFilter; label: string; match: (a: any) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  {
    key: "payments",
    label: "Payments",
    match: (a) =>
      /payment|order|refund|discount|pricing|price/i.test(`${a.tool_name} ${a.title ?? ""} ${a.agent_role ?? ""}`) &&
      !/payout|seller/i.test(`${a.tool_name} ${a.title ?? ""}`),
  },
  {
    key: "catalog",
    label: "Catalog",
    match: (a) => /product|publish|catalog|listing|price/i.test(`${a.tool_name} ${a.title ?? ""} ${a.agent_role ?? ""}`),
  },
  {
    key: "payouts",
    label: "Payouts",
    match: (a) => /payout|seller/i.test(`${a.tool_name} ${a.title ?? ""} ${a.agent_role ?? ""}`),
  },
];


export const Route = createFileRoute("/_authenticated/admin/ai")({
  head: () => ({
    meta: [
      { title: "AI Command Center — CodeVault" },
      { name: "description", content: "Founder control room for the CodeVault autonomous AI operating system." },
      { property: "og:title", content: "CodeVault AI Command Center" },
      { property: "og:description", content: "Approvals, agents, activity log and AI CEO chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommandCenter,
});

const RISK: Record<string, string> = { low: "secondary", medium: "outline", high: "destructive" };

function CommandCenter() {
  const qc = useQueryClient();
  const chat = useServerFn(aiChat);
  const decide = useServerFn(decideApproval);
  const setSettings = useServerFn(updateAiSettings);
  const setAgent = useServerFn(toggleAgent);
  const runLoop = useServerFn(runDailyLoop);
  const loadPayments = useServerFn(paymentQueue);
  const verifyPayment = useServerFn(verifyPaymentManually);
  const changePaymentMode = useServerFn(setPaymentMode);


  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");

  const settings = useQuery({
    queryKey: ["ai-settings"],
    queryFn: async () => (await supabase.from("ai_settings").select("*").maybeSingle()).data,
  });
  const approvals = useQuery({
    queryKey: ["ai-approvals"],
    queryFn: async () =>
      (
        await supabase
          .from("ai_approvals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
    refetchInterval: 20000,
  });
  const agents = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => (await supabase.from("ai_agents").select("*").order("key")).data ?? [],
  });
  const logs = useQuery({
    queryKey: ["ai-logs"],
    queryFn: async () =>
      (await supabase.from("ai_activity_logs").select("*").order("created_at", { ascending: false }).limit(60)).data ??
      [],
    refetchInterval: 20000,
  });
  const reports = useQuery({
    queryKey: ["ai-reports"],
    queryFn: async () =>
      (await supabase.from("ai_reports").select("*").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });

  const payments = useQuery({
    queryKey: ["payment-queue"],
    queryFn: () => loadPayments({}),
    refetchInterval: 20000,
  });

  const s = settings.data as any;
  const pending = (approvals.data ?? []).filter((a: any) => a.status === "pending");
  const metrics = payments.data?.metrics;
  const paymentOrders = payments.data?.orders ?? [];
  const awaitingVerification = paymentOrders.filter((o) => o.status === "pending");

  async function decidePayment(orderId: string, decision: "approve" | "flag" | "reject") {
    try {
      const r = await verifyPayment({ data: { orderId, decision } });
      r.ok ? toast.success(r.message) : toast.error(r.message);
      payments.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }


  async function send(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || thinking) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const result = await chat({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: result.text }]);
      qc.invalidateQueries({ queryKey: ["ai-approvals"] });
      qc.invalidateQueries({ queryKey: ["ai-logs"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The AI could not respond.");
      setMessages(next);
    } finally {
      setThinking(false);
    }
  }

  async function patch(values: Record<string, boolean>) {
    try {
      await setSettings({ data: values });
      settings.refetch();
      toast.success("Settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">AI Operating System</h1>
            <p className="text-2xl font-semibold tracking-tight">Command Center</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={s?.emergency_stop ? "destructive" : s?.paused ? "outline" : "default"}>
              {s?.emergency_stop ? "EMERGENCY STOP" : s?.paused ? "PAUSED" : "OPERATING"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await runLoop({});
                toast.success(("message" in (r as any) && (r as any).message) || "Daily loop finished.");
                qc.invalidateQueries();
              }}
            >
              Run daily loop
            </Button>
            <Button
              variant={s?.emergency_stop ? "default" : "destructive"}
              size="sm"
              onClick={() => patch({ emergency_stop: !s?.emergency_stop })}
            >
              {s?.emergency_stop ? "Release stop" : "Emergency stop"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Pending payments (USDT)", value: money(metrics?.pendingCents ?? 0), tone: "text-foreground" },
            { label: "Verified revenue today (USDT)", value: money(metrics?.verifiedTodayCents ?? 0), tone: "text-primary" },
            {
              label: "Unresolved TxIDs",
              value: String(metrics?.unresolvedTxids ?? 0),
              tone: (metrics?.unresolvedTxids ?? 0) > 0 ? "text-destructive" : "text-foreground",
            },
          ].map((m) => (
            <div key={m.label} className="panel p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{m.label}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-tight ${m.tone}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="chat" className="mt-6">
          <TabsList>
            <TabsTrigger value="chat" className={activeTabClass}>AI CEO</TabsTrigger>
            <TabsTrigger value="payments" className={activeTabClass}>
              Payments {awaitingVerification.length > 0 && `(${awaitingVerification.length})`}
            </TabsTrigger>
            <TabsTrigger value="approvals" className={activeTabClass}>
              Approvals {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="agents" className={activeTabClass}>Agents</TabsTrigger>
            <TabsTrigger value="activity" className={activeTabClass}>Activity</TabsTrigger>
            <TabsTrigger value="reports" className={activeTabClass}>Reports</TabsTrigger>
            <TabsTrigger value="controls" className={activeTabClass}>Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="panel mt-6 flex flex-col gap-4 p-6">
            <div className="flex max-h-[420px] min-h-[220px] flex-col gap-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="grid gap-3">
                  <p className="font-mono text-sm text-muted-foreground">
                    Quick actions — click to run. Level 2 actions become approval requests; level 3 actions are
                    refused by design.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        disabled={thinking}
                        onClick={() => send(q.prompt)}
                        className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 font-mono text-xs text-cyan-400 transition hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 disabled:opacity-50"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : ""}>
                  <div
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {thinking && <p className="font-mono text-xs text-muted-foreground">CEO agent is thinking…</p>}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Review this week's performance and propose the highest-impact action."
                className="min-h-[70px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
                }}
              />
              <Button onClick={() => send()} disabled={thinking}>
                Send
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-6 grid gap-4">
            <p className="font-mono text-xs text-muted-foreground">
              Manual Binance Pay verification queue. Only you can release funds-backed access — the AI has no tool that
              can mark an order paid.
            </p>
            {paymentOrders.map((o) => (
              <div key={o.id} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={o.status === "paid" ? "default" : o.status === "failed" ? "destructive" : "outline"}>
                      {o.status}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.merchantTradeNo ?? o.id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { k: "Buyer", v: o.buyerEmail ?? o.buyerName ?? "unknown" },
                    { k: "Product", v: o.productTitle },
                    { k: "Expected amount", v: money(o.amountCents) },
                    { k: "Order reference", v: o.merchantTradeNo ?? o.id },
                  ].map((f) => (
                    <div key={f.k}>
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{f.k}</p>
                      <p className="mt-1 break-all text-sm">{f.v}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Buyer-submitted Binance TxID
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="break-all font-mono text-sm">{o.buyerTxid ?? "— not submitted yet —"}</code>
                    {o.buyerTxid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(o.buyerTxid!);
                          toast.success("TxID copied.");
                        }}
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                </div>

                {o.verificationNote && (
                  <p className="mt-3 font-mono text-xs text-muted-foreground">Note: {o.verificationNote}</p>
                )}

                {o.status !== "paid" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" disabled={!o.buyerTxid} onClick={() => decidePayment(o.id, "approve")}>
                      Approve payment (mark paid & release download)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decidePayment(o.id, "flag")}>
                      Flag invalid TxID
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => decidePayment(o.id, "reject")}>
                      Reject order
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {paymentOrders.length === 0 && (
              <p className="panel p-8 text-center text-muted-foreground">No orders yet.</p>
            )}
          </TabsContent>


          <TabsContent value="approvals" className="mt-6 grid gap-4">
            <div className="flex flex-wrap gap-2">
              {APPROVAL_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setApprovalFilter(f.key)}
                  className={`rounded-full border px-4 py-1.5 font-mono text-xs transition ${
                    approvalFilter === f.key
                      ? "border-cyan-500 bg-cyan-500 font-semibold text-slate-950"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-cyan-500/50 hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {(approvals.data ?? [])
              .filter((a: any) => APPROVAL_FILTERS.find((f) => f.key === approvalFilter)?.match(a))
              .map((a: any) => (
              <div key={a.id} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={(RISK[a.risk_level] as any) ?? "secondary"}>{a.risk_level} risk</Badge>
                    {a.agent_role && <Badge variant="secondary">{a.agent_role}</Badge>}
                    <span className="font-mono text-xs text-muted-foreground">{a.tool_name}</span>
                    {a.task_id && <span className="font-mono text-xs text-muted-foreground">{a.task_id}</span>}
                  </div>
                  <Badge variant={a.status === "pending" ? "outline" : "secondary"}>{a.status}</Badge>
                </div>
                <h3 className="mt-3 font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.reason ?? a.rationale}</p>
                {a.expected_outcome && (
                  <p className="mt-2 font-mono text-xs text-primary">Expected outcome: {a.expected_outcome}</p>
                )}
                {a.proposal && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-xs text-muted-foreground">
                      proposal.json
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-[11px]">
                      {JSON.stringify(a.proposal, null, 2)}
                    </pre>
                  </details>
                )}

                {a.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        const r = await decide({ data: { approvalId: a.id, decision: "approve" } });
                        r.ok ? toast.success(r.message) : toast.error(r.message);
                        approvals.refetch();
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const r = await decide({ data: { approvalId: a.id, decision: "reject" } });
                        r.ok ? toast.success(r.message) : toast.error(r.message);
                        approvals.refetch();
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {(approvals.data ?? []).filter((a: any) => APPROVAL_FILTERS.find((f) => f.key === approvalFilter)?.match(a)).length === 0 && (
              <p className="panel p-8 text-center text-muted-foreground">No proposals yet.</p>
            )}
          </TabsContent>

          <TabsContent value="agents" className="mt-6 grid gap-3 md:grid-cols-2">
            {(agents.data ?? []).map((a: any) => (
              <div key={a.key} className="panel flex items-start justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    max permission level {a.max_permission_level}
                  </p>
                </div>
                <Switch
                  checked={a.enabled}
                  onCheckedChange={async (v) => {
                    await setAgent({ data: { key: a.key, enabled: v } });
                    agents.refetch();
                  }}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="activity" className="panel mt-6 divide-y divide-border p-0">
            {(logs.data ?? []).map((l: any) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 font-mono text-xs">
                <span className="text-foreground">
                  [{l.agent_key}] {l.action}
                  {l.tool_name ? ` · ${l.tool_name}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {l.result} · {new Date(l.created_at).toLocaleString()}
                </span>
              </div>
            ))}
            {(logs.data ?? []).length === 0 && <p className="p-8 text-center text-muted-foreground">No activity yet.</p>}
          </TabsContent>

          <TabsContent value="reports" className="mt-6 grid gap-4">
            {(reports.data ?? []).map((r: any) => (
              <div key={r.id} className="panel p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{r.title}</h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted-foreground">{r.body}</pre>
              </div>
            ))}
            {(reports.data ?? []).length === 0 && (
              <p className="panel p-8 text-center text-muted-foreground">
                No reports yet — run the daily loop to generate the morning briefing.
              </p>
            )}
          </TabsContent>

          <TabsContent value="controls" className="panel mt-6 grid gap-5 p-6">
            {[
              { key: "ai_enabled", label: "AI system enabled", help: "Master switch for all agent activity." },
              { key: "paused", label: "Paused", help: "Temporarily halt autonomous work; chat stays available." },
              {
                key: "auto_apply_low_risk_seo",
                label: "Auto-apply low-risk SEO",
                help: "Let the marketing agent adjust meta titles and descriptions without approval.",
              },
            ].map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-6">
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-sm text-muted-foreground">{row.help}</p>
                </div>
                <Switch checked={Boolean(s?.[row.key])} onCheckedChange={(v) => patch({ [row.key]: v })} />
              </div>
            ))}

            <div className="border-t border-border pt-5">
              <p className="font-medium">Payment mode</p>
              <p className="text-sm text-muted-foreground">
                Choose how buyer payments are confirmed. Both modes keep fulfilment out of AI hands.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    mode: "manual" as const,
                    title: "Manual Binance Pay ID / QR",
                    help: "Buyers submit a TxID; you verify each payment in the founder queue.",
                  },
                  {
                    mode: "merchant_api" as const,
                    title: "Binance Pay Merchant API",
                    help: "Signed webhooks fulfil orders automatically after RSA verification.",
                    badge: "Coming soon",
                  },
                ].map((opt) => {
                  const active = (s?.payment_mode ?? "manual") === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await changePaymentMode({ data: { mode: opt.mode } });
                          toast.success(r.message);
                          settings.refetch();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Update failed");
                        }
                      }}
                      className={`rounded-lg border p-4 text-left transition ${
                        active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{opt.title}</p>
                        <span className="flex items-center gap-2">
                          {"badge" in opt && opt.badge && (
                            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
                              {opt.badge}
                            </Badge>
                          )}
                          {active && <Badge>active</Badge>}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{opt.help}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="border-t border-border pt-4 font-mono text-xs text-muted-foreground">

              Refunds, payouts and fund transfers are permanently human-only and cannot be enabled here.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
