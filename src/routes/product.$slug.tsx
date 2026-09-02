import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPublicProduct } from "@/lib/marketplace.functions";
import { DEFAULT_MODULES, folderTree, qualityTone, repoMetrics, usdt } from "@/lib/product-meta";
import { Boxes, ExternalLink, FileCode2, MonitorPlay, ShieldCheck, TestTube2 } from "lucide-react";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const product = await getPublicProduct({ data: { slug: params.slug } });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => {
    const p = loaderData as any;
    const title = p?.seo_title ?? `${p?.title ?? "Product"} — CodeVault`;
    const description = p?.seo_description ?? p?.tagline ?? "Premium source code from CodeVault.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(typeof p?.cover_url === "string" && p.cover_url.startsWith("https://")
          ? [
              { property: "og:image", content: p.cover_url },
              { name: "twitter:image", content: p.cover_url },
            ]
          : []),
      ],
    };
  },
  errorComponent: ({ error }) => <div className="p-10 text-center">Could not load product: {error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-center">This product is not available.</div>,
  component: ProductPage,
});

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProductPage() {
  const product = Route.useLoaderData() as any;
  const router = useRouter();
  const [demoOpen, setDemoOpen] = useState(false);

  const m = repoMetrics(product.static_analysis);
  const modules = m.modules.length ? m.modules : DEFAULT_MODULES;
  const demoUrl: string | null = product.sandbox_url ?? product.demo_url ?? null;

  function buy() {
    router.navigate({ to: "/checkout", search: { slug: product.slug } });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
                {product.category}
              </Badge>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${qualityTone(product.quality_score)}`}
              >
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                AI quality {product.quality_score ?? "—"}/100
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{product.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{product.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(product.tech ?? []).map((t: string) => (
                <Badge key={t} variant="secondary" className="font-mono text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          {product.cover_url && (
            <img
              src={product.cover_url}
              alt={`${product.title} interface preview`}
              className="panel w-full object-cover p-0"
              loading="lazy"
            />
          )}

          <Section title="Architecture overview" icon={<Boxes className="h-4 w-4" />}>
            <p className="leading-relaxed text-muted-foreground">
              {product.description ??
                "A production-grade codebase with a typed data layer, server-side business logic, row-level security on every table, and a component-driven UI system."}
            </p>
          </Section>

          <Section title="Included modules" icon={<Boxes className="h-4 w-4" />}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {modules.map((mod: string) => (
                <li
                  key={mod}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm backdrop-blur-md"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  {mod}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Codebase structure" icon={<FileCode2 className="h-4 w-4" />}>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 p-4 font-mono text-xs leading-6 text-muted-foreground">
              {folderTree(product.tech ?? [], product.category).join("\n")}
            </pre>
          </Section>

          <Section title="Setup instructions" icon={<FileCode2 className="h-4 w-4" />}>
            <ol className="space-y-3 text-sm text-muted-foreground">
              {[
                "Unzip the delivered archive and open the project folder.",
                "Install dependencies with your package manager (npm install / bun install).",
                "Copy .env.example to .env and fill in your database, auth and payment keys.",
                "Run the included SQL migrations against your database.",
                "Start the dev server, then deploy with the provided build command.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 font-mono text-[11px] text-primary">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <aside className="panel h-fit p-6 lg:sticky lg:top-24">
          <div className="font-mono text-3xl text-primary">{usdt(product.price_cents)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            One commercial license · lifetime updates · {product.license_type ?? "standard"}
          </p>
          <Button className="mt-5 w-full" size="lg" onClick={buy}>
            Buy Now — {usdt(product.price_cents)}
          </Button>

          {demoUrl && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => setDemoOpen(true)}>
              <MonitorPlay className="mr-2 h-4 w-4" />
              Live interactive demo
            </Button>
          )}

          <dl className="mt-6 space-y-2 border-t border-border pt-4 font-mono text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt className="inline-flex items-center gap-1">
                <FileCode2 className="h-3 w-3" /> Files
              </dt>
              <dd>{m.files ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="inline-flex items-center gap-1">
                <TestTube2 className="h-3 w-3" /> Test coverage
              </dt>
              <dd>{m.coverage != null ? `${Math.round(m.coverage)}%` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Quality score</dt>
              <dd>{product.quality_score ?? "—"}/100</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>Signed private download</dd>
            </div>
          </dl>
        </aside>
      </article>

      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="max-w-5xl p-0">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MonitorPlay className="h-4 w-4 text-primary" />
              {product.title} — live demo
            </DialogTitle>
          </DialogHeader>
          {demoUrl && (
            <>
              <iframe
                src={demoUrl}
                title={`${product.title} live demo`}
                className="h-[70vh] w-full rounded-b-lg bg-background"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                loading="lazy"
              />
              <a
                href={demoUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute right-14 top-3 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-primary"
              >
                Open in new tab <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
