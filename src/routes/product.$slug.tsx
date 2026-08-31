import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicProduct, startCheckout } from "@/lib/marketplace.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

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
      ],
    };
  },
  errorComponent: ({ error }) => <div className="p-10 text-center">Could not load product: {error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-center">This product is not available.</div>,
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData() as any;
  const router = useRouter();

  function buy() {
    router.navigate({ to: "/checkout", search: { slug: product.slug } });
  }


  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            {product.category}
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{product.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{product.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(product.tech ?? []).map((t: string) => (
              <Badge key={t} variant="secondary" className="font-mono text-[11px]">
                {t}
              </Badge>
            ))}
          </div>
          <div className="panel mt-8 p-6 leading-relaxed text-muted-foreground">{product.description}</div>
        </div>

        <aside className="panel h-fit p-6">
          <div className="font-mono text-3xl text-primary">${(product.price_cents / 100).toFixed(0)}</div>
          <p className="mt-1 text-xs text-muted-foreground">One commercial license · lifetime updates</p>
          <Button className="mt-5 w-full" size="lg" onClick={buy} disabled={busy}>
            {busy ? "Creating order…" : "Buy source code"}
          </Button>
          {product.demo_url && (
            <a href={product.demo_url} target="_blank" rel="noreferrer">
              <Button variant="outline" className="mt-3 w-full">
                View live demo
              </Button>
            </a>
          )}
          <dl className="mt-6 space-y-2 border-t border-border pt-4 font-mono text-xs text-muted-foreground">
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
    </div>
  );
}
