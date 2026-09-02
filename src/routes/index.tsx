import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { HeroVault } from "@/components/hero-vault";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listPublicProducts } from "@/lib/marketplace.functions";
import { useEffect, useState } from "react";

const productsQuery = queryOptions({
  queryKey: ["public-products"],
  queryFn: () => listPublicProducts(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeVault — Premium Source Code & SaaS Starter Kits" },
      {
        name: "description",
        content:
          "Buy production-ready React, Next.js, MERN, Flutter and AI application source code. Instant secure delivery from an AI-operated marketplace.",
      },
      { property: "og:title", content: "CodeVault — Premium Source Code Marketplace" },
      {
        property: "og:description",
        content: "Production-ready source code, SaaS starter kits, dashboards and AI apps for developers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-muted-foreground">Catalog unavailable: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Not found</div>,
  component: Marketplace,
});

const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

function Marketplace() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const [filtering, setFiltering] = useState(false);

  useEffect(() => {
    setFiltering(true);
    const t = setTimeout(() => setFiltering(false), 220);
    return () => clearTimeout(t);
  }, [category, query]);

  const categories = ["all", ...Array.from(new Set(products.map((p: any) => p.category)))];
  const filtered = products.filter(
    (p: any) =>
      (category === "all" || p.category === category) &&
      (query === "" || `${p.title} ${p.tagline} ${p.tech?.join(" ")}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="grid-lines border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <Badge
              variant="outline"
              className="mb-6 flex w-fit items-center gap-2 border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs tracking-widest text-primary"
            >
              <span className="pulse-dot size-1.5 rounded-full bg-primary" />
              LIVE · AI-OPERATED MARKETPLACE
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Ship faster with production-grade source code.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              SaaS starter kits, dashboards, mobile apps and AI applications — quality-gated, securely delivered, and
              operated around the clock by an AI system under founder control.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#catalog">
                <Button size="lg" className="shadow-glow">Browse the catalog</Button>
              </a>
              <Link to="/auth">
                <Button size="lg" variant="outline">
                  Create an account
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <HeroVault />
          </div>
        </div>
      </section>


      <section id="catalog" className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stacks, e.g. Next.js"
            className="h-10 w-64 rounded-lg border border-input bg-card/60 px-3 text-sm backdrop-blur-md outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtering &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="panel flex flex-col gap-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-3 h-8 w-full" />
              </div>
            ))}
          {!filtering &&
            filtered.map((p: any) => (
            <Link
              key={p.id}
              to="/product/$slug"
              params={{ slug: p.slug }}
              className="panel card-hover group flex flex-col gap-3 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-tight group-hover:text-primary">{p.title}</h2>
                <span className="font-mono text-sm text-primary">{money(p.price_cents)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {(p.tech ?? []).map((t: string) => (
                  <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                <span>{p.category}</span>
                <span>quality {p.quality_score ?? "—"}/100</span>
              </div>
            </Link>
          ))}
        </div>
        {!filtering && filtered.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">No products match that search.</p>
        )}
      </section>

      <footer className="border-t border-border/60 py-14 text-center font-mono text-xs text-muted-foreground">
        CODEVAULT · operated by an AI system with founder approval gates
      </footer>
    </div>
  );
}
