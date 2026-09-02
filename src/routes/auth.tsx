import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui/spinner";
import { GoogleLogo } from "@/components/google-logo";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, Eye, EyeOff, MailCheck, ShieldCheck, Terminal } from "lucide-react";

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

type Mode = "signin" | "signup" | "forgot";

const BENEFITS = [
  { icon: Download, text: "Instant download links for every verified purchase." },
  { icon: ShieldCheck, text: "Payments verified against Binance Pay — no founder privileges needed." },
  { icon: Terminal, text: "One account for checkout, order tracking, and your library." },
];

function strengthOf(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const strength = strengthOf(password);
  const strengthLabel = ["Too short", "Weak", "Fair", "Strong", "Excellent"][strength];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !accepted) {
      toast.error("Please accept the Terms & Privacy Policy");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Welcome to CodeVault.");
          router.navigate({ to: "/library" });
        } else {
          toast.success("Account created. You can sign in now.");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/library" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo(email);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        toast.error("Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      router.navigate({ to: "/library" });
    } finally {
      setGoogleBusy(false);
    }
  }

  const heading =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password";
  const sub =
    mode === "signin"
      ? "Access your purchases and downloads."
      : mode === "signup"
        ? "Takes 30 seconds — then you can check out."
        : "We'll email you a secure link to set a new password.";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-16 lg:grid-cols-[1fr_420px] lg:items-center lg:py-24">
        <div className="hidden space-y-7 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary pulse-dot" /> Buyer access
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            {mode === "signup" ? "Claim your code library." : "Welcome back to the vault."}
          </h1>
          <ul className="space-y-4 text-sm text-muted-foreground">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <p className="border-l-2 border-primary/40 pl-3 font-mono text-xs text-muted-foreground">
            The first account created becomes the founder with AI Command Center access.
          </p>
        </div>

        <div className="panel p-7">
          {sentTo ? (
            <div className="space-y-5 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Check your inbox</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We sent a password reset link to <span className="font-mono text-foreground">{sentTo}</span>. The
                  link opens a page where you can set a new password.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSentTo(null);
                  setMode("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        mode === m
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "signin" ? "Sign in" : "Sign up"}
                    </button>
                  ))}
                </div>
              )}

              <div className="mb-6">
                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                )}
                <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
              </div>

              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs text-primary underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        required
                        minLength={8}
                        className="pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {mode === "signup" && password.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < strength ? "bg-primary" : "bg-border"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {mode === "signup" && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
                    <span
                      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                        accepted ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {accepted && <Check className="h-3 w-3" />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    <span>
                      I agree to the{" "}
                      <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                )}

                <Button type="submit" disabled={busy} className="gap-2">
                  {busy && <Spinner />}
                  {busy
                    ? "Working…"
                    : mode === "signin"
                      ? "Sign in"
                      : mode === "signup"
                        ? "Create account"
                        : "Send reset link"}
                </Button>

                {mode !== "forgot" && (
                  <>
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2.5"
                      disabled={googleBusy}
                      onClick={google}
                    >
                      {googleBusy ? <Spinner /> : <GoogleLogo />}
                      Continue with Google
                    </Button>
                  </>
                )}
              </form>

              <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                Protected by encrypted sessions. We never store your payment credentials.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
