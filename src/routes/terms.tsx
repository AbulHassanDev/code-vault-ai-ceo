import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Privacy — CodeVault" },
      {
        name: "description",
        content: "CodeVault terms of service and privacy policy for buyers of production-grade source code.",
      },
      { property: "og:title", content: "CodeVault Terms & Privacy" },
      { property: "og:description", content: "How CodeVault handles purchases, licenses, refunds and your data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  {
    title: "1. Licence",
    body: "Every purchase grants a non-exclusive, perpetual licence to use the source code in unlimited personal or commercial projects. Reselling or redistributing the code as-is is not permitted.",
  },
  {
    title: "2. Payments",
    body: "Payments are made in USDT via Binance Pay. Orders remain pending until the transaction ID you submit is verified. Download access unlocks automatically once verification completes.",
  },
  {
    title: "3. Refunds",
    body: "Because source code is delivered digitally and instantly, refunds are reviewed case by case by a human operator. Refunds are never issued automatically.",
  },
  {
    title: "4. Account & Data",
    body: "We store your email address, orders and download history only to operate your account. We never sell personal data and we never store payment credentials.",
  },
  {
    title: "5. Acceptable Use",
    body: "Do not attempt to bypass payment verification, share download links, or use the marketplace for unlawful purposes. Abusive accounts may be suspended.",
  },
];

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms &amp; Privacy</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The short version: buy once, ship anywhere, we keep your data minimal.
        </p>
        <div className="mt-10 space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.title} className="panel p-6">
              <h2 className="text-base font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
