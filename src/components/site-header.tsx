import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const { data: admin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        if (active) setIsAdmin(Boolean(admin));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setEmail(null);
        setIsAdmin(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
            CV
          </span>
          <span className="font-mono text-sm tracking-[0.25em] text-foreground">CODEVAULT</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Marketplace
          </Link>
          {email ? (
            <>
              <Link
                to="/library"
                className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Library
              </Link>
              {isAdmin && (
                <Link to="/admin/ai">
                  <Button size="sm">AI Command Center</Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
