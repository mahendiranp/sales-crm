import Link from "next/link";
import {
  Target, Sparkles, ArrowRight, Check, Mail,
  FormInput, Workflow, Share2, BarChart3, MessageCircle,
} from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

const FEATURES = [
  { icon: FormInput, title: "Drag-and-drop builder", desc: "13 field types, branding, and a live canvas that's exactly what respondents see — no separate preview pane to keep in sync." },
  { icon: Sparkles, title: "AI Assistant", desc: "Describe the form you want and let AI add the fields — or just ask it to add one field at a time." },
  { icon: Workflow, title: "Approval workflows", desc: "Route submissions through Employee → Manager → HR style multi-step approvals, with role-based or specific-person approvers." },
  { icon: Share2, title: "Publish anywhere", desc: "A public share link, ready in one click — responses land straight in your dashboard, encrypted at rest." },
  { icon: MessageCircle, title: "WhatsApp survey bot", desc: "Deliver a form as a conversational, one-field-at-a-time WhatsApp chat instead of a web link." },
  { icon: BarChart3, title: "Export & analyze", desc: "Search, filter, and export every response to CSV or Excel — with per-form response counts on your dashboard." },
];

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: "₹0",
    period: "forever",
    tagline: "For getting your first form live and collecting responses.",
    features: ["Up to 3 forms", "100 responses / month", "CSV/Excel export", "1 user"],
    cta: "Start free",
    href: "/signup",
  },
  {
    key: "growth",
    name: "Growth",
    price: "₹499",
    period: "/month",
    tagline: "For teams that need approvals and WhatsApp delivery.",
    features: ["Unlimited forms", "2,000 responses / month", "Approval workflows", "WhatsApp survey bot", "AI form-building assistant", "Up to 20 users"],
    cta: "Start free trial",
    highlighted: true,
    // Signup collects payment for this plan right after email verification
    // (see Signup.jsx) — Enterprise below stays sales-assisted, not self-serve.
    href: "/signup?plan=growth",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For larger orgs that need admin controls and dedicated support.",
    features: ["Everything in Growth", "Unlimited responses", "Role-based permissions", "Priority support", "Custom integrations"],
    cta: "Talk to sales",
    href: "mailto:info@floworaone.com?subject=Enterprise%20plan%20inquiry",
  },
];

function NavBar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">{APP_NAME}</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-ink/60">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
        </nav>
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

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "A drag-and-drop form builder with approval workflows, WhatsApp delivery, and an AI assistant that builds fields for you.",
  offers: PLANS.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: p.price === "Custom" ? undefined : p.price.replace(/[^\d]/g, "") || "0",
    priceCurrency: p.price.startsWith("₹") ? "INR" : undefined,
  })),
};

export default function Landing() {
  return (
    <div className="font-body text-ink">
      <Seo
        description={`${APP_NAME} is a drag-and-drop form builder with approval workflows, WhatsApp delivery, and an AI assistant that builds fields for you. Free forever on the Starter plan.`}
        keywords={[
          "form builder",
          "drag and drop form builder",
          "online form builder",
          "CRM software",
          "sales CRM",
          "approval workflow software",
          "WhatsApp form delivery",
          "AI form builder",
          "lead management CRM",
          "free CRM",
        ]}
        path="/"
        jsonLd={JSON_LD}
      />
      <NavBar />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium mb-6">
          <Sparkles size={12} /> AI-assisted form building
        </div>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-[1.05] max-w-3xl mx-auto">
          Build forms, collect responses, know what's happening.
        </h1>
        <p className="text-ink/60 text-lg max-w-xl mx-auto mt-5">
          A drag-and-drop form builder with approval workflows, WhatsApp delivery,
          and a dashboard that shows exactly what's coming in — all in one place.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
            Get started free <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg border border-border font-medium hover:bg-base">
            Log in
          </Link>
        </div>
        <p className="text-xs text-ink/40 mt-4">No credit card required · Free plan available forever</p>
      </section>

      {/* Product preview mock */}
      <section className="max-w-5xl mx-auto px-6 -mt-4 mb-20">
        <div className="rounded-2xl border border-border shadow-card bg-white p-3">
          <div className="rounded-xl bg-base border border-border p-6">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: "Total Forms", value: "12", color: "#2F5D50" },
                { label: "Total Responses", value: "486", color: "#3E6FA3" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg border border-border p-3">
                  <p className="text-[10px] text-ink/40">{s.label}</p>
                  <p className="text-xl font-display font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-border p-4">
              <p className="text-[10px] font-medium text-ink/40 mb-2">Recent Form Responses</p>
              {[
                { name: "Employee Leave Request", when: "2m ago" },
                { name: "Customer Feedback", when: "18m ago" },
                { name: "Event Registration", when: "1h ago" },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between text-sm py-1.5 border-t border-border first:border-t-0">
                  <span className="text-ink/70">{r.name}</span>
                  <span className="text-xs text-ink/40">{r.when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Everything you need to collect and act on responses</h2>
          <p className="text-ink/50 mt-2">Build, publish, and route — one tool instead of a form builder plus a spreadsheet.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-5 rounded-card border border-border bg-white shadow-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <f.icon size={18} />
              </div>
              <h3 className="font-display font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-ink/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI callout */}
      <section className="bg-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Sparkles size={28} className="mx-auto mb-4 text-accent" />
          <h2 className="font-display font-bold text-3xl mb-3">Your form-building copilot.</h2>
          <p className="text-white/70 max-w-xl mx-auto">
            Describe the form you need — "create an employee leave request form" — and
            the AI Assistant adds the fields for you, right inside the builder.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Simple, transparent pricing</h2>
          <p className="text-ink/50 mt-2">Start free. Upgrade when you need workflows and WhatsApp delivery.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-card p-6 border ${p.highlighted ? "border-primary shadow-lg bg-white relative" : "border-border bg-white shadow-card"}`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-6 bg-accent text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  Most popular
                </span>
              )}
              <h3 className="font-display font-semibold text-lg">{p.name}</h3>
              <p className="text-xs text-ink/50 mt-1 mb-4 h-8">{p.tagline}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-display font-bold">{p.price}</span>
                <span className="text-sm text-ink/40">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ink/70">
                    <Check size={14} className="text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`block text-center py-2.5 rounded-lg text-sm font-medium ${
                  p.highlighted ? "bg-primary text-white hover:bg-primary-dark" : "border border-border hover:bg-base"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
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
            <span className="flex items-center gap-1"><Mail size={12} /> hello@pipeline.app</span>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
