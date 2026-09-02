import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

/** Browser-only: the 3D libraries must never be imported during SSR. */
const VaultScene = lazy(() => import("@/components/vault-scene"));

/** Glassmorphic gradient-orb stand-in shown while WebGL initialises. */
function VaultFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative">
        <div className="size-40 rounded-full bg-[radial-gradient(circle_at_32%_28%,color-mix(in_oklab,var(--primary)_75%,transparent),color-mix(in_oklab,var(--primary)_18%,transparent)_58%,transparent_72%)] blur-[2px] sm:size-52" />
        <div className="absolute inset-0 animate-pulse rounded-full border border-primary/30 bg-primary/5 backdrop-blur-md" />
        <div className="brand-ring absolute inset-0 rounded-full" />
      </div>
    </div>
  );
}

export function HeroVault() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-md sm:h-[380px] lg:h-[460px] lg:max-w-none">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/15 blur-[90px]" />
      <ClientOnly fallback={<VaultFallback />}>
        <Suspense fallback={<VaultFallback />}>
          <VaultScene />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
