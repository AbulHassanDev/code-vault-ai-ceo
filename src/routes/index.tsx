import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { HeroVault } from "@/components/hero-vault";

import { Skeleton } from "@/components/ui/skeleton";
import { Search, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { CATEGORY_TABS, SORT_OPTIONS, type SortValue } from "@/lib/product-meta";
import { INDUSTRY_BY_SLUG, industryCounts, matchesIndustry } from "@/lib/industries";
import { IndustryGrid } from "@/components/industry-grid";
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
  validateSearch: (search: Record<string, unknown>): { industry?: string } =>
    typeof search["industry"] === "string" ? { industry: search["industry"] as string } : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-muted-foreground">Catalog unavailable: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Not found</div>,
  component: Marketplace,
});

function Marketplace() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { industry } = Route.useSearch();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortValue>("quality");

  const [filtering, setFiltering] = useState(false);

  useEffect(() => {
    setFiltering(true);
    const t = setTimeout(() => setFiltering(false), 220);
    return () => clearTimeout(t);
  }, [category, query, sort, industry]);

  const categories = Array.from(
    new Set<string>([...CATEGORY_TABS, ...products.map((p: any) => String(p.category))]),
  );
  const counts = industryCounts(products as any[]);
  const activeIndustry = industry ? INDUSTRY_BY_SLUG[industry] : undefined;
  const q = query.trim().toLowerCase();
  const filtered = products
    .filter(
      (p: any) =>
        (category === "all" || p.category === category) &&
        (!activeIndustry || matchesIndustry(p, activeIndustry.slug)) &&
        (q === "" ||
          `${p.title} ${p.tagline ?? ""} ${p.description ?? ""} ${(p.tech ?? []).join(" ")} ${(p.tags ?? []).join(" ")}`
            .toLowerCase()
            .includes(q)),
    )
    .sort((a: any, b: any) => {
      if (sort === "price-asc") return a.price_cents - b.price_cents;
      if (sort === "price-desc") return b.price_cents - a.price_cents;
      if (sort === "recent") return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      return (b.quality_score ?? 0) - (a.quality_score ?? 0);
    });

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
        <div className="mb-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, stacks or descriptions…"
              className="h-10 w-full rounded-lg border border-input bg-card/60 pl-9 pr-3 text-sm backdrop-blur-md outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            className="h-10 rounded-lg border border-input bg-card/60 px-3 text-sm backdrop-blur-md outline-none transition-colors focus:border-primary/50"
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider transition-all ${
                category === c
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtering &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="panel flex flex-col gap-3 p-5">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          {!filtering && filtered.map((p: any) => <ProductCard key={p.id} p={p} />)}
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
