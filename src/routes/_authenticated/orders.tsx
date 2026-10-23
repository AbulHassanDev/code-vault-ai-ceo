import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { myOrders, createTicket } from "@/lib/ops.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Your orders — CodeVault" },
      { name: "description", content: "Track your CodeVault orders, payment review, and support messages." },
      { property: "og:title", content: "Your CodeVault orders" },
      { property: "og:description", content: "Order status and payment verification progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const STEPS = ["Order placed", "Proof submitted", "Verified"];
function stepOf(o: any) {
  if (o.status === "paid") return 3;
  if (o.buyer_txid) return 2;
  return 1;
}

function OrdersPage() {
  const fetchOrders = useServerFn(myOrders);
  const sendTicket = useServerFn(createTicket);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders() });
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await sendTicket({ data: { subject, message, orderId } });
    if (r.ok) {
      toast.success(r.message);
      setSubject(""); setMessage(""); setOrderId(undefined);
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    } else toast.error(r.message);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Your orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Follow each payment from transfer to unlocked download.</p>
        {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

        <div className="mt-8 grid gap-4">
          {(data?.orders ?? []).map((o: any) => {
            const step = o.status === "failed" ? 0 : stepOf(o);
            return (
              <div key={o.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{o.products?.title}</h2>
                    <p className="font-mono text-xs text-muted-foreground">
                      {o.merchant_trade_no} · {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg text-primary">{(o.amount_cents / 100).toFixed(2)} USDT</div>
                    {o.discount_code && <div className="text-xs text-muted-foreground">Code {o.discount_code}</div>}
                  </div>
                </div>
                {o.status === "failed" ? (
                  <p className="mt-4 text-sm text-destructive">Payment failed: {o.failure_reason ?? "not completed"}</p>
                ) : (
                  <ol className="mt-4 grid grid-cols-3 gap-2">
                    {STEPS.map((s, i) => (
                      <li key={s} className={`rounded-md border px-3 py-2 text-xs ${i < step ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                        {s}
                      </li>
                    ))}
                  </ol>
                )}
                {o.review_reason && o.status !== "paid" && (
                  <p className="mt-3 text-xs text-muted-foreground">Under review: {o.review_reason}</p>
                )}
                <div className="mt-4 flex gap-2">
                  {o.status === "paid" ? (
                    <Link to="/library"><Button size="sm">Go to downloads</Button></Link>
                  ) : o.status === "pending" && !o.buyer_txid ? (
                    <Link to="/checkout" search={{ slug: o.products?.slug } as any}><Button size="sm" variant="outline">Finish payment</Button></Link>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => { setOrderId(o.id); setSubject(`Help with order ${o.merchant_trade_no}`); }}>
                    Get help
                  </Button>
                </div>
              </div>
            );
          })}
          {data && data.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        </div>

        <h2 className="mt-14 text-xl font-semibold">Support</h2>
        <form onSubmit={submit} className="panel mt-4 grid gap-3 p-5">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required minLength={3} />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" required minLength={5} rows={4} />
          <Button type="submit" className="justify-self-start">Send message</Button>
        </form>
        <div className="mt-4 grid gap-3">
          {(data?.tickets ?? []).map((t: any) => (
            <div key={t.id} className="panel p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.subject}</span>
                <Badge variant="outline">{t.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.message}</p>
              {t.admin_reply && <p className="mt-3 border-l-2 border-primary pl-3 text-sm">{t.admin_reply}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
