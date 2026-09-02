/** Industry verticals used by the navbar mega-menu and the landing "Browse by industry" grid. */

export type Industry = {
  slug: string;
  label: string;
  blurb: string;
  /** lucide-react icon name resolved in the UI layer */
  icon: string;
  /** lowercase keywords matched against a product's category, tags, tech and copy */
  keywords: string[];
  unit: string;
};

export const INDUSTRIES: Industry[] = [
  {
    slug: "healthcare",
    label: "Healthcare & Hospitals",
    blurb: "Telehealth, EHR systems, AI diagnostic dashboards",
    icon: "Stethoscope",
    keywords: ["health", "healthcare", "hospital", "telehealth", "ehr", "clinic", "medical", "patient", "diagnostic"],
    unit: "Templates",
  },
  {
    slug: "edtech",
    label: "EdTech & Schools",
    blurb: "LMS platforms, student portals, exam engines",
    icon: "GraduationCap",
    keywords: ["edtech", "education", "school", "lms", "course", "student", "exam", "learning", "tutor"],
    unit: "Platforms",
  },
  {
    slug: "fintech",
    label: "FinTech & Crypto",
    blurb: "DeFi apps, payment gateways, neobanking UI",
    icon: "Landmark",
    keywords: ["fintech", "crypto", "defi", "payment", "bank", "neobank", "wallet", "trading", "invoice", "stripe"],
    unit: "Systems",
  },
  {
    slug: "enterprise",
    label: "Enterprise & Business",
    blurb: "CRM, ERP systems, multi-tenant SaaS",
    icon: "Building2",
    keywords: ["crm", "erp", "enterprise", "saas", "multi-tenant", "b2b", "dashboard", "admin", "workflow"],
    unit: "Suites",
  },
  {
    slug: "wellness",
    label: "Health & Wellness",
    blurb: "Fitness tracking, tele-wellness, habit apps",
    icon: "HeartPulse",
    keywords: ["fitness", "wellness", "workout", "nutrition", "meditation", "habit", "gym", "mobile"],
    unit: "Apps",
  },
  {
    slug: "ai-agents",
    label: "AI & Agentic Systems",
    blurb: "Autonomous agents, RAG search, LLM tooling",
    icon: "Bot",
    keywords: ["ai", "agent", "agentic", "rag", "llm", "gpt", "vector", "chatbot", "openai", "embedding"],
    unit: "Engines",
  },
  {
    slug: "proptech",
    label: "PropTech & Real Estate",
    blurb: "Property portals, VR listings, rental CRMs",
    icon: "Home",
    keywords: ["proptech", "real estate", "property", "listing", "rental", "realty", "housing", "vr"],
    unit: "Portals",
  },
];

export const INDUSTRY_BY_SLUG = Object.fromEntries(INDUSTRIES.map((i) => [i.slug, i])) as Record<string, Industry>;

/** Haystack of every searchable string on a product row. */
export function productHaystack(p: any): string {
  return `${p.title ?? ""} ${p.tagline ?? ""} ${p.description ?? ""} ${p.category ?? ""} ${(p.tech ?? []).join(" ")} ${(
    p.tags ?? []
  ).join(" ")}`.toLowerCase();
}

export function matchesIndustry(p: any, slug: string): boolean {
  const ind = INDUSTRY_BY_SLUG[slug];
  if (!ind) return true;
  const hay = productHaystack(p);
  return ind.keywords.some((k) => hay.includes(k));
}

export function industryCounts(products: any[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ind of INDUSTRIES) out[ind.slug] = products.filter((p) => matchesIndustry(p, ind.slug)).length;
  return out;
}
