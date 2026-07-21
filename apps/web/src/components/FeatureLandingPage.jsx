import Link from "next/link";
import { Target, Check, Mail, ArrowRight } from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

const SITE_URL = "https://floworaone.com";

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

function Footer() {
  return (
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
  );
}

// Shared layout for every SEO feature landing page (pages/ai-form-builder.jsx,
// pages/pdf-to-form.jsx, etc.) — content comes entirely from
// lib/featurePages.js so adding another page never means writing new JSX.
export default function FeatureLandingPage({ data }) {
  const {
    slug, metaTitle, metaDescription, keywords, h1, subtitle,
    benefits, supported, differentiators, howItWorks, useCases, faqs, finalCta, related,
  } = data;

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
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: h1, item: `${SITE_URL}/${slug}` },
    ],
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: metaDescription,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="font-body text-ink">
      <Seo title={metaTitle} description={metaDescription} keywords={keywords} path={`/${slug}`} jsonLd={[softwareJsonLd, faqJsonLd, breadcrumbJsonLd]} />
      <NavBar />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl leading-tight">{h1}</h1>
        <p className="text-ink/60 text-lg mt-5">{subtitle}</p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/signup" className="px-5 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
            Start Free →
          </Link>
          <a href="#how-it-works" className="px-5 py-3 rounded-lg border border-border font-medium text-ink/70 hover:bg-base">
            Watch Demo
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="font-display font-bold text-2xl text-center mb-8">Why Choose {APP_NAME}</h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-ink/75">
              <Check size={16} className="text-primary shrink-0 mt-0.5" /> {b}
            </li>
          ))}
        </ul>
      </section>

      {/* Supported */}
      {supported && (
        <section className="max-w-4xl mx-auto px-6 py-10">
          <h2 className="font-display font-bold text-2xl text-center mb-6">Supported Imports</h2>
          <div className="flex flex-wrap justify-center gap-2.5">
            {supported.map((s) => (
              <span key={s} className="text-sm font-medium text-ink/70 bg-base border border-border rounded-full px-3.5 py-1.5">{s}</span>
            ))}
          </div>
        </section>
      )}

      {/* Differentiators */}
      {differentiators && (
        <section className="max-w-4xl mx-auto px-6 py-10">
          <h2 className="font-display font-bold text-2xl text-center mb-6">{differentiators.heading}</h2>
          <ul className="grid sm:grid-cols-3 gap-3">
            {differentiators.items.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-ink/75 bg-base rounded-lg px-3.5 py-2.5">
                <Check size={14} className="text-primary shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="font-display font-bold text-2xl text-center mb-8">How It Works</h2>
        <ol className="space-y-4">
          {howItWorks.map((step, i) => (
            <li key={step} className="flex items-start gap-3.5">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
              <p className="text-sm text-ink/75 pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Use cases */}
      {useCases && (
        <section className="max-w-4xl mx-auto px-6 py-10">
          <h2 className="font-display font-bold text-2xl text-center mb-6">Use Cases</h2>
          <div className="flex flex-wrap justify-center gap-2.5">
            {useCases.map((u) => (
              <span key={u} className="text-sm text-ink/70 bg-white border border-border rounded-full px-3.5 py-1.5">{u}</span>
            ))}
          </div>
        </section>
      )}

      {/* FAQs */}
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

      {/* Related */}
      {related && related.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-10">
          <h2 className="font-display font-bold text-2xl text-center mb-6">Related Features</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 hover:bg-primary/10"
              >
                {r.label} <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 py-14 text-center">
        <p className="font-display font-semibold text-xl mb-5">{finalCta}</p>
        <Link href="/signup" className="inline-block px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
          Start Free →
        </Link>
      </section>

      <Footer />
    </div>
  );
}
