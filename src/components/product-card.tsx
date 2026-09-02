import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { FileCode2, ShieldCheck, TestTube2 } from "lucide-react";
import { qualityTone, repoMetrics, usdtShort } from "@/lib/product-meta";

export function ProductCard({ p }: { p: any }) {
  const m = repoMetrics(p.static_analysis);
  return (
    <Link
      to="/product/$slug"
      params={{ slug: p.slug }}
      className="panel card-hover group flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent),0_18px_50px_-24px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
    >
      <div className="relative h-36 w-full overflow-hidden border-b border-border/70 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_65%)]">
        {p.cover_url ? (
          <img
            src={p.cover_url}
            alt={`${p.title} preview`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
            {p.category}
          </div>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full border px-2 py-0.5 font-mono text-[10px] backdrop-blur-md ${qualityTone(p.quality_score)}`}
        >
          <ShieldCheck className="mr-1 inline h-3 w-3" />
          {p.quality_score ?? "—"}/100
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold leading-tight group-hover:text-primary">{p.title}</h2>
          <span className="shrink-0 font-mono text-sm text-primary">{usdtShort(p.price_cents)}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>

        <div className="flex flex-wrap gap-1.5">
          {(p.tech ?? []).slice(0, 5).map((t: string) => (
            <Badge key={t} variant="secondary" className="font-mono text-[10px]">
              {t}
            </Badge>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileCode2 className="h-3 w-3" />
            {m.files != null ? `${m.files} files` : "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <TestTube2 className="h-3 w-3" />
            {m.coverage != null ? `${Math.round(m.coverage)}% tests` : "—"}
          </span>
          <span className="uppercase">{p.category}</span>
        </div>
      </div>
    </Link>
  );
}
