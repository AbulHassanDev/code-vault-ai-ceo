import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";
import { Download, ShieldCheck, Terminal } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CodeVault" },
      { name: "description", content: "Sign in to CodeVault to access your purchased source code library." },
      { property: "og:title", content: "Sign in to CodeVault" },
      { property: "og:description", content: "Access your purchased source code and downloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/library" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/library" });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-4xl gap-10 px-4 py-20 lg:grid-cols-[1fr_380px] lg:items-center">
        <div className="hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Terminal className="h-3 w-3 text-primary" /> Buyer access
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back to the vault." : "Claim your code library."}
          </h1>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Instant download links for every verified purchase.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Payments verified against Binance Pay — no founder privileges needed.
            </li>
            <li className="flex items-start gap-2">
              <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              One account for checkout, order tracking, and your library.
            </li>
          </ul>
          <p className="border-l-2 border-primary/40 pl-3 font-mono text-xs text-muted-foreground">
            The first account created becomes the founder with AI Command Center access.
          </p>
        </div>

        <div className="panel p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Access your purchases and downloads."
                : "Takes 30 seconds — then you can check out."}
            </p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" onClick={google}>
              Continue with Google
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
