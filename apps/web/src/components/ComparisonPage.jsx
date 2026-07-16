import Link from "next/link";
import { Target, Check, X, Mail } from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

function NavBar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-3.5 py-2 rounded-lg text-sm font-medium text-ink/70 hover:bg-base">
            Log in
          </Link>
          <Link href="/signup" className="px-3.5 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark">
            Sign up free
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeatureCell({ value }) {
  if (value === true) return <Check size={16} className="text-primary mx-auto" />;
  if (value === false) return <X size={16} className="text-ink/25 mx-auto" />;
  return <span className="text-xs text-ink/60">{value}</span>;
}

// Shared layout for every /compare/[slug] page — content comes entirely
// from lib/comparisons.js so adding a new comparison never touches JSX.
export default function ComparisonPage({ slug, data }) {
  const { name, tagline, summary, features, pricingUs, pricingThem, chooseThemIf, chooseUsIf, faqs } = data;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://floworaone.com/" },
      { "@type": "ListItem", position: 2, name: `${APP_NAME} vs ${name}`, item: `https://floworaone.com/compare/${slug}` },
    ],
  };

  return (
    <div className="font-body text-ink">
      <Seo
        title={`${APP_NAME} vs ${name}`}
        description={summary}
        keywords={[`${APP_NAME} vs ${name}`, `${name} alternative`, `${name} vs ${APP_NAME}`, "form builder comparison"]}
        path={`/compare/${slug}`}
        jsonLd={[faqJsonLd, breadcrumbJsonLd]}
      />
      <NavBar />

      <section className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl leading-tight">{tagline}</h1>
        <p className="text-ink/60 text-lg mt-5">{summary}</p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/signup" className="px-5 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
            Start Free →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="font-display font-bold text-2xl text-center mb-6">Feature comparison</h2>
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-base text-left">
                <th className="p-3 font-medium text-ink/60">Feature</th>
                <th className="p-3 font-medium text-center">{APP_NAME}</th>
                <th className="p-3 font-medium text-center">{name}</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.label} className="border-t border-border">
                  <td className="p-3 text-ink/80">{f.label}</td>
                  <td className="p-3 text-center"><FeatureCell value={f.us} /></td>
                  <td className="p-3 text-center"><FeatureCell value={f.them} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-5">
        <div className="rounded-card border border-border bg-white p-6">
          <h3 className="font-display font-semibold mb-2">Pricing — {APP_NAME}</h3>
          <p className="text-sm text-ink/70">{pricingUs}</p>
        </div>
        <div className="rounded-card border border-border bg-white p-6">
          <h3 className="font-display font-semibold mb-2">Pricing — {name}</h3>
          <p className="text-sm text-ink/70">{pricingThem}</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-card border border-border bg-base p-6 mb-4">
          <p className="text-sm text-ink/80"><strong>Choose {name} if:</strong> {chooseThemIf}</p>
        </div>
        <div className="rounded-card border border-primary/30 bg-primary/5 p-6">
          <p className="text-sm text-ink/80"><strong>Choose {APP_NAME} if:</strong> {chooseUsIf}</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="font-display font-bold text-2xl mb-6">Frequently asked questions</h2>
        <div className="space-y-5">
          {faqs.map((f) => (
            <div key={f.q}>
              <p className="font-medium text-sm">{f.q}</p>
              <p className="text-sm text-ink/60 mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-14 text-center">
        <Link href="/signup" className="inline-block px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
          Start Free →
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Target size={14} className="text-white" />
            </div>
            <span className="font-display font-semibold">{APP_NAME}</span>
          </div>
          <p className="text-xs text-ink/40">© 2026 {APP_NAME}. Forms that route themselves.</p>
          <div className="flex items-center gap-4 text-xs text-ink/50">
            <span className="flex items-center gap-1"><Mail size={12} /> floworaone@gmail.com</span>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
