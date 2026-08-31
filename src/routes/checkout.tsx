import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getPublicProduct, startCheckout, submitPaymentProof } from "@/lib/marketplace.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Copy, Clock, ShieldCheck, ArrowRight } from "lucide-react";

const BINANCE_PAY_ID = "530019824";

export const Route = createFileRoute("/checkout")({
  validateSearch: z.object({ slug: z.string().max(120).optional() }),
  loaderDeps: ({ search }) => ({ slug: search.slug }),
  loader: async ({ deps }) => (deps.slug ? await getPublicProduct({ data: { slug: deps.slug } }) : null),
  head: () => ({
    meta: [
      { title: "Checkout — CodeVault" },
      { name: "description", content: "Complete your CodeVault purchase and pay securely with Binance Pay." },
      { property: "og:title", content: "CodeVault Checkout" },
      { property: "og:description", content: "Secure buyer checkout with Binance Pay for premium source code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-10 text-center">Checkout unavailable: {error.message}</div>,
  component: CheckoutPage,
});

const STEPS = ["Select Payment Method", "Transfer & Enter TxID", "Access & Download Code"];

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span
                className={`hidden text-xs md:block ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </div>
            {n < STEPS.length && <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={`truncate text-sm ${mono ? "font-mono text-primary" : ""}`}>{value}</div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function CheckoutPage() {
  const product = Route.useLoaderData() as any;
  const router = useRouter();
  const checkout = useServerFn(startCheckout);
  const submitProof = useServerFn(submitPaymentProof);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ id: string; merchantTradeNo: string } | null>(null);
  const [txid, setTxid] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const priceUsdt = product ? (product.price_cents / 100).toFixed(0) : "0";

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session?.user)));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function placeOrder() {
    setBusy(true);
    try {
      const result = await checkout({ data: { productId: product.id } });
      if (result.ok) {
        setOrder({ id: (result as any).orderId, merchantTradeNo: (result as any).merchantTradeNo });
        toast.success("Order created — complete payment with Binance Pay.");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendProof(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setBusy(true);
    try {
      const result = await submitProof({ data: { orderId: order.id, txid } });
      if (result.ok) {
        setSubmitted(true);
        toast.success("Payment proof submitted for verification.");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitBuyer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/checkout${product ? `?slug=${product.slug}` : ""}` },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          toast.success("Account created. Confirm your email, then sign in to finish checkout.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setSignedIn(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed");
  }

  if (!product) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Nothing to check out</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick a product from the marketplace to continue.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Browse the catalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  const step = submitted ? 3 : order ? 2 : 1;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 lg:grid-cols-[1fr_380px]">
        <div className="panel h-fit p-6">
          <Stepper current={step} />

          <div className="mt-8">
            {!signedIn ? (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Create your buyer account</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Step 1 starts after sign-in. Your download is delivered to this account — no founder access
                    involved.
                  </p>
                </div>
                <form onSubmit={submitBuyer} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyer-email">Email</Label>
                    <Input
                      id="buyer-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer-password">Password</Label>
                    <Input
                      id="buyer-password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Working…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
                  </Button>
                  <Button type="button" variant="outline" onClick={google}>
                    Continue with Google
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  >
                    {mode === "signup" ? "Already have an account? Sign in" : "New here? Create a buyer account"}
                  </button>
                </form>
              </div>
            ) : !order ? (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Step 1 — Select payment method</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We accept Binance Pay. Nothing is charged until you send the transfer yourself.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={busy}
                  className="flex w-full items-center justify-between rounded-md border-2 border-primary bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F0B90B]/15 font-mono text-sm font-bold text-[#F0B90B]">
                      B
                    </div>
                    <div>
                      <div className="font-medium">Binance Pay / QR Code</div>
                      <div className="text-xs text-muted-foreground">Send ${priceUsdt} USDT — zero fees</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </button>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Ownership unlocks only after payment verification.
                </p>
              </div>
            ) : !submitted ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Step 2 — Transfer & enter TxID</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Send the exact amount, then paste your transaction ID below.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <div className="mx-auto flex flex-col items-center gap-2 rounded-md border border-border bg-white p-3">
                    <QRCode value={BINANCE_PAY_ID} size={150} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-black">
                      Binance Pay
                    </span>
                  </div>
                  <div className="space-y-3">
                    <CopyField label="Binance Pay ID" value={BINANCE_PAY_ID} />
                    <CopyField label="Exact amount" value={`${priceUsdt} USDT`} />
                    <CopyField label="Order reference" value={order.merchantTradeNo} />
                  </div>
                </div>

                <ol className="space-y-2 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                  <li><span className="font-mono text-primary">1.</span> Scan the QR or copy the Pay ID in your Binance app.</li>
                  <li><span className="font-mono text-primary">2.</span> Send exactly <span className="font-mono text-foreground">{priceUsdt} USDT</span> and include the order reference in the note.</li>
                  <li><span className="font-mono text-primary">3.</span> Copy the Transaction ID / TxID from your Binance payment history.</li>
                </ol>

                <form onSubmit={sendProof} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="txid">Binance Transaction ID / TxID</Label>
                    <Input
                      id="txid"
                      required
                      minLength={6}
                      placeholder="e.g. 382910475628193"
                      value={txid}
                      onChange={(e) => setTxid(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? "Submitting…" : "Submit Payment for Verification"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-md border border-primary/40 bg-primary/5 p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-primary" />
                  <h1 className="mt-3 text-xl font-semibold tracking-tight">Payment Pending Founder Verification</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your TxID has been received. Your 5-minute download link will unlock automatically once the
                    founder verifies the payment.
                  </p>
                  <div className="mx-auto mt-4 max-w-xs space-y-2 text-left">
                    <CopyField label="Order reference" value={order.merchantTradeNo} />
                    <CopyField label="Your TxID" value={txid} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => router.navigate({ to: "/library" })}>
                  View order status in my library
                </Button>
              </div>
            )}
          </div>
        </div>

        <aside className="panel h-fit p-6">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            {product.category}
          </Badge>
          <h2 className="mt-3 text-lg font-semibold leading-tight">{product.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total</span>
            <span className="font-mono text-2xl text-primary">${priceUsdt}</span>
          </div>
          <Link
            to="/product/$slug"
            params={{ slug: product.slug }}
            className="mt-4 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to product details
          </Link>
        </aside>
      </div>
    </div>
  );
}
