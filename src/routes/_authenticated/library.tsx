import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { myLibrary, requestDownload } from "@/lib/marketplace.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Your library — CodeVault" },
      { name: "description", content: "Download the source code products you own on CodeVault." },
      { property: "og:title", content: "Your CodeVault library" },
      { property: "og:description", content: "Your purchased source code and order history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const fetchLibrary = useServerFn(myLibrary);
  const download = useServerFn(requestDownload);
  const { data, isLoading } = useQuery({ queryKey: ["library"], queryFn: () => fetchLibrary() });

  async function get(productId: string) {
    const result = await download({ data: { productId } });
    if (result.ok && "url" in result && result.url) {
      window.open(result.url, "_blank", "noopener");
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Your library</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Downloads are signed private links, valid for five minutes each.
        </p>

        {isLoading && <p className="mt-10 font-mono text-sm text-muted-foreground">Loading…</p>}

        <div className="mt-8 grid gap-4">
          {(data?.purchases ?? []).map((p: any) => (
            <div key={p.id} className="panel flex items-center justify-between gap-4 p-5">
              <div>
                <h2 className="font-semibold">{p.products?.title}</h2>
                <p className="text-sm text-muted-foreground">{p.products?.tagline}</p>
              </div>
              <Button onClick={() => get(p.product_id)}>Download</Button>
            </div>
          ))}
          {data && data.purchases.length === 0 && (
            <p className="panel p-8 text-center text-muted-foreground">
              You don't own any products yet. Verified purchases appear here automatically.
            </p>
          )}
        </div>

        <h2 className="mt-12 font-mono text-xs uppercase tracking-widest text-muted-foreground">Order history</h2>
        <div className="mt-4 grid gap-2">
          {(data?.orders ?? []).map((o: any) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm"
            >
              <span>{o.products?.title ?? "Order"}</span>
              <span className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                ${(o.amount_cents / 100).toFixed(2)}
                <Badge variant={o.status === "paid" ? "default" : "secondary"}>{o.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
