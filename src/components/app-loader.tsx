import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function BrandLoader({ label = "Booting CodeVault" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative grid size-16 place-items-center">
        <span className="brand-ring absolute inset-0 rounded-2xl border border-primary/60" />
        <span className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
        <span className="relative grid size-14 place-items-center rounded-2xl bg-primary font-mono text-lg font-bold text-primary-foreground shadow-glow">
          CV
        </span>
      </div>
      <div className="w-48 space-y-3 text-center">
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <div className="shimmer-bar h-full w-full" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Full-screen loader for initial boot and route transitions. */
export function AppLoader() {
  const [booting, setBooting] = useState(true);
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(t);
  }, []);

  const visible = booting || isNavigating;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[100] grid place-items-center bg-background transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <BrandLoader label={booting ? "Booting CodeVault" : "Loading"} />
    </div>
  );
}
