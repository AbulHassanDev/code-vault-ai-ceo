/** Presentation helpers for catalog + product detail. Pure client-safe formatting. */

export const CATEGORY_TABS = [
  "all",
  "ai",
  "dashboard",
  "e-commerce",
  "web-app",
  "mobile",
  "developer-tools",
] as const;

export const SORT_OPTIONS = [
  { value: "quality", label: "Highest Quality Score" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "recent", label: "Recently Added" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const usdt = (cents: number) => `${(cents / 100).toFixed(2)} USDT`;
export const usdtShort = (cents: number) => `${(cents / 100).toFixed(0)} USDT`;

export type RepoMetrics = { files: number | null; coverage: number | null; modules: string[] };

/** Reads repository metrics out of the product's static_analysis JSON, tolerating shape drift. */
export function repoMetrics(raw: unknown): RepoMetrics {
  const a = (raw ?? {}) as Record<string, any>;
  const num = (...keys: string[]) => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
  };
  const modules = Array.isArray(a["modules"]) ? (a["modules"] as string[]) : [];
  return {
    files: num("file_count", "files", "total_files"),
    coverage: num("test_coverage", "coverage", "coverage_percent"),
    modules,
  };
}

export const DEFAULT_MODULES = [
  "Authentication",
  "Billing & Payments",
  "Database Schema",
  "Admin Panel",
  "API Layer",
  "Design System",
];

export function qualityTone(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground border-border bg-muted/40";
  if (score >= 90) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (score >= 75) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-rose-400 border-rose-500/30 bg-rose-500/10";
}

/** Deterministic folder tree preview derived from the product's stack. */
export function folderTree(tech: string[], category: string): string[] {
  const t = tech.map((x) => x.toLowerCase()).join(" ");
  const mobile = category === "mobile" || t.includes("flutter") || t.includes("expo");
  return mobile
    ? [
        "lib/",
        "  main.dart",
        "  core/            # theming, routing, env",
        "  features/        # auth, catalog, checkout",
        "  services/        # api clients, storage",
        "assets/",
        "test/",
        "pubspec.yaml",
      ]
    : [
        "src/",
        "  routes/          # pages & API endpoints",
        "  components/      # UI + design system",
        "  lib/             # server functions, utils",
        "  integrations/    # database, auth, payments",
        "supabase/",
        "  migrations/      # versioned SQL schema",
        "public/",
        "package.json",
      ];
}
