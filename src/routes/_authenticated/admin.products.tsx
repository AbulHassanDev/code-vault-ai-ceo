import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { adminListDiscounts, adminListProducts, adminSaveDiscount, adminSaveProduct } from "@/lib/ops.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Products & discounts — CodeVault admin" },
      { name: "description", content: "Create, edit, and publish CodeVault products and discount codes." },
      { property: "og:title", content: "CodeVault product manager" },
      { property: "og:description", content: "Admin product publishing and discount codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminProducts,
});

const EMPTY = { slug: "", title: "", tagline: "", description: "", category: "template", tech: "", price: "49", cover_url: "", demo_url: "", asset_path: "", status: "draft" as "draft" | "published" };

function AdminProducts() {
  const list = useServerFn(adminListProducts);
  const save = useServerFn(adminSaveProduct);
  const listCodes = useServerFn(adminListDiscounts);
  const saveCode = useServerFn(adminSaveDiscount);
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const codes = useQuery({ queryKey: ["admin-codes"], queryFn: () => listCodes() });
  const [form, setForm] = useState<any>(EMPTY);
  const [editId, setEditId] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", percent: "10" });

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  function edit(p: any) {
    setEditId(p.id);
    setForm({ ...p, tech: (p.tech ?? []).join(", "), price: String(p.price_cents / 100), tagline: p.tagline ?? "", description: p.description ?? "", cover_url: p.cover_url ?? "", demo_url: p.demo_url ?? "", asset_path: p.asset_path ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function upload(file: File) {
    if (!form.slug) return toast.error("Set a slug first.");
    setUploading(true);
    const path = `${form.slug}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("product-assets").upload(path, file);
    setUploading(false);
    if (error) return toast.error(error.message);
    setForm({ ...form, asset_path: path });
    toast.success("Bundle uploaded.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await save({
      data: {
        id: editId, slug: form.slug, title: form.title, tagline: form.tagline || null, description: form.description || null,
        category: form.category, tech: form.tech.split(",").map((t: string) => t.trim()).filter(Boolean),
        price_cents: Math.round(Number(form.price) * 100), cover_url: form.cover_url, demo_url: form.demo_url,
        asset_path: form.asset_path || null, status: form.status,
      },
    });
    if (r.ok) { toast.success(r.message); setForm(EMPTY); setEditId(undefined); qc.invalidateQueries({ queryKey: ["admin-products"] }); }
    else toast.error(r.message);
  }

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    const r = await saveCode({ data: { code: newCode.code, percent_off: Number(newCode.percent), active: true } });
    if (r.ok) { setNewCode({ code: "", percent: "10" }); qc.invalidateQueries({ queryKey: ["admin-codes"] }); toast.success("Code created."); }
    else toast.error(r.message);
  }
  async function toggleCode(id: string, active: boolean) {
    await saveCode({ data: { id, active } });
    qc.invalidateQueries({ queryKey: ["admin-codes"] });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Products & discounts</h1>
          <div className="flex gap-2 text-sm">
            <Link to="/admin/ai" className="text-muted-foreground hover:text-foreground">Command Center</Link>
            <Link to="/admin/inbox" className="text-muted-foreground hover:text-foreground">Inbox</Link>
          </div>
        </div>
        {products.error && <p className="mt-6 text-sm text-destructive">{(products.error as Error).message}</p>}

        <form onSubmit={submit} className="panel mt-8 grid gap-4 p-6 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{editId ? "Edit product" : "New product"}</h2>
          <Field label="Title"><Input value={form.title} onChange={set("title")} required /></Field>
          <Field label="Slug (url)"><Input value={form.slug} onChange={set("slug")} required pattern="[a-z0-9-]+" /></Field>
          <Field label="Tagline"><Input value={form.tagline} onChange={set("tagline")} /></Field>
          <Field label="Category"><Input value={form.category} onChange={set("category")} required /></Field>
          <Field label="Tech (comma separated)"><Input value={form.tech} onChange={set("tech")} /></Field>
          <Field label="Price (USDT)"><Input type="number" min="0" step="1" value={form.price} onChange={set("price")} required /></Field>
          <Field label="Cover image URL"><Input value={form.cover_url} onChange={set("cover_url")} /></Field>
          <Field label="Demo URL"><Input value={form.demo_url} onChange={set("demo_url")} /></Field>
          <div className="md:col-span-2"><Field label="Description"><Textarea rows={4} value={form.description} onChange={set("description")} /></Field></div>
          <Field label="Code bundle (zip)">
            <Input type="file" accept=".zip,.tar,.gz" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{form.asset_path || "No file yet"}</p>
          </Field>
          <div className="flex items-center gap-3">
            <Switch checked={form.status === "published"} onCheckedChange={(v) => setForm({ ...form, status: v ? "published" : "draft" })} />
            <span className="text-sm">{form.status === "published" ? "Published (visible in store)" : "Draft (hidden)"}</span>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={uploading}>{editId ? "Save changes" : "Create product"}</Button>
            {editId && <Button type="button" variant="ghost" onClick={() => { setEditId(undefined); setForm(EMPTY); }}>Cancel</Button>}
          </div>
        </form>

        <div className="mt-8 grid gap-3">
          {(products.data ?? []).map((p: any) => (
            <div key={p.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.title}</span>
                  <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status}</Badge>
                  {!p.asset_path && <Badge variant="destructive">no bundle</Badge>}
                </div>
                <p className="font-mono text-xs text-muted-foreground">/{p.slug} · {(p.price_cents / 100).toFixed(0)} USDT</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => edit(p)}>Edit</Button>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-xl font-semibold">Discount codes</h2>
        <form onSubmit={addCode} className="panel mt-4 flex flex-wrap items-end gap-3 p-5">
          <Field label="Code"><Input value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} required className="uppercase" /></Field>
          <Field label="% off"><Input type="number" min="1" max="100" value={newCode.percent} onChange={(e) => setNewCode({ ...newCode, percent: e.target.value })} required className="w-24" /></Field>
          <Button type="submit">Add code</Button>
        </form>
        <div className="mt-4 grid gap-2">
          {(codes.data ?? []).map((c: any) => (
            <div key={c.id} className="panel flex items-center justify-between p-3">
              <span className="font-mono">{c.code} — {c.percent_off}% off</span>
              <div className="flex items-center gap-2 text-sm">
                {c.active ? "Active" : "Off"}
                <Switch checked={c.active} onCheckedChange={(v) => toggleCode(c.id, v)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
