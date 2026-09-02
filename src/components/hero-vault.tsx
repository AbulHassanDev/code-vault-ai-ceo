import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

/** Browser-only: the 3D libraries must never be imported during SSR. */
const VaultScene = lazy(() => import("@/components/vault-scene"));

function VaultSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative">
        <div className="size-32 animate-pulse rounded-2xl border border-primary/30 bg-primary/10 backdrop-blur-md sm:size-40" />
        <div className="brand-ring absolute inset-0 rounded-2xl" />
      </div>
    </div>
  );
}

export function HeroVault() {
  return (
    <div className="relative mx-auto h-[280px] w-full max-w-md sm:h-[340px] lg:h-[420px] lg:max-w-none">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/15 blur-[80px]" />
      <ClientOnly fallback={<VaultSkeleton />}>
        <Suspense fallback={<VaultSkeleton />}>
          <VaultScene />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
