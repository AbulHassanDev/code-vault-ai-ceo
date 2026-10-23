import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adminInbox, adminReplyTicket, adminResolveIncident } from "@/lib/ops.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/inbox")({
  head: () => ({
    meta: [
      { title: "Support & incidents — CodeVault admin" },
      { name: "description", content: "Reply to buyer support messages and resolve logged incidents." },
      { property: "og:title", content: "CodeVault support inbox" },
      { property: "og:description", content: "Admin support tickets and incidents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Inbox,
});

function Inbox() {
  const load = useServerFn(adminInbox);
  const reply = useServerFn(adminReplyTicket);
  const resolve = useServerFn(adminResolveIncident);
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-inbox"], queryFn: () => load() });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-inbox"] });

  async function send(id: string, status: "answered" | "closed") {
    const r = await reply({ data: { id, reply: drafts[id], status } });
    r.ok ? toast.success(r.message) : toast.error(r.message);
    refresh();
  }
  async function close(id: string) {
    const r = await resolve({ data: { id, resolution: drafts[id] || "Resolved by founder." } });
    r.ok ? toast.success(r.message) : toast.error(r.message);
    refresh();
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Support & incidents</h1>
          <div className="flex gap-3 text-sm">
            <Link to="/admin/ai" className="text-muted-foreground hover:text-foreground">Command Center</Link>
            <Link to="/admin/products" className="text-muted-foreground hover:text-foreground">Products</Link>
          </div>
        </div>
        {error && <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>}

        <h2 className="mt-10 text-xl font-semibold">Buyer messages</h2>
        <div className="mt-4 grid gap-3">
          {(data?.tickets ?? []).map((t: any) => (
            <div key={t.id} className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.subject}</span>
                <Badge variant={t.status === "open" ? "default" : "outline"}>{t.status}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.message}</p>
              <Textarea className="mt-3" rows={2} placeholder="Reply…" defaultValue={t.admin_reply ?? ""} onChange={(e) => setDrafts({ ...drafts, [t.id]: e.target.value })} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => send(t.id, "answered")}>Send reply</Button>
                <Button size="sm" variant="ghost" onClick={() => send(t.id, "closed")}>Close</Button>
              </div>
            </div>
          ))}
          {data && data.tickets.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
        </div>

        <h2 className="mt-12 text-xl font-semibold">Incidents</h2>
        <div className="mt-4 grid gap-3">
          {(data?.incidents ?? []).map((i: any) => (
            <div key={i.id} className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{i.title}</span>
                <div className="flex gap-2">
                  <Badge variant={i.severity === "high" || i.severity === "critical" ? "destructive" : "outline"}>{i.severity}</Badge>
                  <Badge variant="outline">{i.status}</Badge>
                </div>
              </div>
              {i.description && <p className="mt-2 text-sm text-muted-foreground">{i.description}</p>}
              {i.status !== "resolved" ? (
                <div className="mt-3 flex gap-2">
                  <Textarea rows={1} placeholder="Resolution note" onChange={(e) => setDrafts({ ...drafts, [i.id]: e.target.value })} />
                  <Button size="sm" onClick={() => close(i.id)}>Resolve</Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Resolved: {i.resolution}</p>
              )}
            </div>
          ))}
          {data && data.incidents.length === 0 && <p className="text-sm text-muted-foreground">No incidents.</p>}
        </div>
      </div>
    </div>
  );
}
