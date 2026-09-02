import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UploadCloud, FileText, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

function prettySize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export type UploadedProof = { path: string; name: string; size: number; previewUrl: string | null };

export function ProofDropzone({
  value,
  onChange,
}: {
  value: UploadedProof | null;
  onChange: (proof: UploadedProof | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPT.includes(file.type)) {
      toast.error("Use a PNG, JPG or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 5MB.");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("Sign in again to upload your proof.");
      return;
    }

    setUploading(true);
    setProgress(12);
    const timer = setInterval(() => setProgress((p) => (p < 88 ? p + 7 : p)), 180);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("payment-proofs").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      setProgress(100);
      onChange({
        path,
        name: file.name,
        size: file.size,
        previewUrl: file.type === "application/pdf" ? null : URL.createObjectURL(file),
      });
      toast.success("Screenshot uploaded — AI Vision will inspect it on submit.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      clearInterval(timer);
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  }

  if (value) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 transition-all">
        <div className="flex items-center gap-4">
          {value.previewUrl ? (
            <img
              src={value.previewUrl}
              alt="Payment proof preview"
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{prettySize(value.size)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded &amp; ready for AI verification
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-4 w-4" /> Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={`group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
        dragging
          ? "scale-[1.01] border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
          : "border-border hover:border-primary/60 hover:bg-primary/5"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <>
          <Spinner className="text-primary" />
          <p className="text-sm text-muted-foreground">Uploading your proof…</p>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <UploadCloud
            className={`h-8 w-8 transition-transform duration-300 ${dragging ? "-translate-y-1 text-primary" : "text-muted-foreground group-hover:-translate-y-0.5 group-hover:text-primary"}`}
          />
          <div>
            <p className="text-sm font-medium">Drag &amp; drop your Binance payment screenshot</p>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG or PDF · max 5MB</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Browse files from your device
          </Button>
        </>
      )}
    </div>
  );
}
