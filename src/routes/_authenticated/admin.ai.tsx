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
import { toast } from "sonner";

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
  component: CommandCenter;
});

const RISK: Record<string, string> = { low: "secondary", medium: "outline", high: "destructive" };

function CommandCenter() {
  const qc = useQueryClient();
  const chat = useServerFn(aiChat);
  const decide = useServerFn(decideApproval);
  const setSettings = useServerFn(updateAiSettings);
  const setAgent = useServerFn(toggleAgent);
  const runLoop = useServerFn(runDailyLoop);

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

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

  const s = settings.data as any;
  const pending = (approvals.data ?? []).filter((a: any) => a.status === "pending");

  async function send() {
    const text = input.trim();
    if (!text) return;
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
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-primary">AI Operating System</h1>
            <p className="mt-2 text-3xl font-semibold tracking-tight">Command Center</p>
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

        <Tabs defaultValue="chat" className="mt-8">
          <TabsList>
            <TabsTrigger value="chat">AI CEO</TabsTrigger>
            <TabsTrigger value="approvals">Approvals {pending.length > 0 && `(${pending.length})`}</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="panel mt-6 flex flex-col gap-4 p-6">
            <div className="flex max-h-[420px] min-h-[220px] flex-col gap-4 overflow-y-auto">
              {messages.length === 0 && (
                <p className="font-mono text-sm text-muted-foreground">
                  Ask for a business review, a growth plan, or a proposal. Level 2 actions become approval requests;
                  level 3 actions are refused by design.
                </p>
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
              <Button onClick={send} disabled={thinking}>
                Send
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="mt-6 grid gap-4">
            {(approvals.data ?? []).map((a: any) => (
              <div key={a.id} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={(RISK[a.risk_level] as any) ?? "secondary"}>{a.risk_level} risk</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{a.tool_name}</span>
                  </div>
                  <Badge variant={a.status === "pending" ? "outline" : "secondary"}>{a.status}</Badge>
                </div>
                <h3 className="mt-3 font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.rationale}</p>
                {a.expected_impact && (
                  <p className="mt-2 font-mono text-xs text-primary">Expected impact: {a.expected_impact}</p>
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
            {(approvals.data ?? []).length === 0 && (
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
            <p className="border-t border-border pt-4 font-mono text-xs text-muted-foreground">
              Refunds, payouts and fund transfers are permanently human-only and cannot be enabled here.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
