import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { INDUSTRIES } from "@/lib/industries";
import { IndustryIcon } from "@/components/industry-icon";

/** "Browse by industry" showcase grid rendered under the hero on the landing page. */
export function IndustryGrid({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <div className="mb-8 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Browse by industry</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Production codebases for the industries shipping in 2026
        </h2>
        <p className="mt-3 text-muted-foreground">
          Jump straight into vertical-specific starter kits — each one quality-gated, documented and ready to deploy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((ind) => (
          <Link
            key={ind.slug}
            to="/"
            search={{ industry: ind.slug }}
            hash="catalog"
            className="panel card-hover group flex items-start gap-4 p-5 transition-shadow hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent),0_18px_50px_-24px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
              <IndustryIcon name={ind.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold leading-tight group-hover:text-primary">{ind.label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </span>
              <span className="mt-1.5 block text-sm leading-snug text-muted-foreground">{ind.blurb}</span>
              <span className="mt-3 inline-block rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {counts[ind.slug] ?? 0} {ind.unit}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
