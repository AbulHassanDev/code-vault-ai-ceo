import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProofUrl } from "@/lib/payment-queue.functions";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ImageOff, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

type Tone = "ok" | "warn" | "bad";

const toneClass: Record<Tone, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
};

function tagTone(tag: string, approved: boolean): Tone {
  if (approved) return "ok";
  return /unreadable|not a|fake|failed|not found|no screenshot/i.test(tag) ? "bad" : "warn";
}

/** AI extraction pills + zoomable screenshot lightbox for a buyer proof. */
export function ProofInspector({ path, verification }: { path: string | null; verification: any }) {
  const signProof = useServerFn(getProofUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let active = true;
    if (!path) return;
    setLoading(true);
    signProof({ data: { path } })
      .then((r) => active && setUrl(r.url))
      .catch(() => active && setUrl(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path]);

  const approved = verification?.decision === "auto_approved";
  const tags: string[] = verification?.tags ?? [];
  const extraction = verification?.extraction ?? null;
  const confidence = typeof extraction?.confidence === "number" ? Math.round(extraction.confidence * 100) : null;

  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md sm:grid-cols-[140px_1fr]">
      <div>
        {loading ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-muted/40">
            <Spinner />
          </div>
        ) : url ? (
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOpen(true);
            }}
            className="group relative block h-32 w-full overflow-hidden rounded-lg border border-border transition-all hover:border-primary"
          >
            <img src={url} alt="Buyer payment proof" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-5 w-5 text-primary" />
            </span>
          </button>
        ) : (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground">
            <ImageOff className="h-5 w-5" />
            <span className="text-[11px]">No screenshot</span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">AI Vision extraction</p>
        {verification ? (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass[approved ? "ok" : "warn"]}`}
              >
                {approved ? "Auto-approved" : "Needs human review"}
                {confidence !== null ? ` · ${confidence}%` : ""}
              </span>
              {tags.map((t) => (
                <span
                  key={t}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass[tagTone(t, approved)]}`}
                >
                  {t}
                </span>
              ))}
            </div>
            {extraction && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { k: "Detected TxID", v: extraction.txid ?? "—" },
                  { k: "Detected amount", v: extraction.amount != null ? `${extraction.amount} ${extraction.token ?? ""}` : "—" },
                  { k: "Recipient Pay ID", v: extraction.recipient_pay_id ?? "—" },
                  { k: "Status label", v: extraction.status_label ?? "—" },
                ].map((f) => (
                  <div key={f.k}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{f.k}</p>
                    <p className="truncate text-sm">{f.v}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <Badge variant="outline" className="mt-2 font-mono text-[10px] uppercase tracking-widest">
            Not analysed yet
          </Badge>
        )}
      </div>

      {open && url && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 p-6 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div className="mb-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rounded-md border border-border bg-card p-2 hover:border-primary"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="rounded-md border border-border bg-card p-2 hover:border-primary"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-card p-2 hover:border-primary"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[80vh] max-w-[92vw] overflow-auto rounded-lg border border-border">
            <img
              src={url}
              alt="Buyer payment proof full size"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
