import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getPublicProduct, startCheckout } from "@/lib/marketplace.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

function CheckoutPage() {
  const product = Route.useLoaderData() as any;
  const router = useRouter();
  const checkout = useServerFn(startCheckout);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ merchantTradeNo: string; message: string } | null>(null);

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
        setOrder({ merchantTradeNo: (result as any).merchantTradeNo, message: result.message });
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

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 lg:grid-cols-[1fr_380px]">
        <div className="panel h-fit p-6">
          {order ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">Pay with Binance Pay</h1>
              <p className="text-sm text-muted-foreground">{order.message}</p>
              <div className="rounded-md border border-border bg-card p-4 font-mono text-sm">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Order reference</div>
                <div className="mt-1 text-primary">{order.merchantTradeNo}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your library unlocks automatically once the payment is confirmed by a verified Binance Pay callback.
              </p>
              <Button variant="outline" onClick={() => router.navigate({ to: "/library" })}>
                Go to my library
              </Button>
            </div>
          ) : signedIn ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">Confirm your order</h1>
              <p className="text-sm text-muted-foreground">
                You'll get a Binance Pay order reference next. Nothing is charged until you complete payment.
              </p>
              <Button size="lg" onClick={placeOrder} disabled={busy}>
                {busy ? "Creating order…" : "Continue to Binance Pay"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Buyer checkout</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a buyer account (or sign in) so we can deliver your download securely. No founder access
                  required.
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
          )}
        </div>

        <aside className="panel h-fit p-6">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            {product.category}
          </Badge>
          <h2 className="mt-3 text-lg font-semibold leading-tight">{product.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total</span>
            <span className="font-mono text-2xl text-primary">${(product.price_cents / 100).toFixed(0)}</span>
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
