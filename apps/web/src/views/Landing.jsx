import { useState } from "react";
import Link from "next/link";
import {
  Target, Sparkles, ArrowRight, Check, X as XIcon, Mail, ChevronDown,
  FormInput, Workflow, Share2, BarChart3, MessageCircle,
  Building2, HeartPulse, GraduationCap, Factory, Landmark, Truck, Store,
} from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

const FEATURES = [
  { icon: Sparkles, title: "AI Form Builder", desc: "Describe the form you want — \"employee leave request with dates and reason\" — and AI builds the fields for you instantly." },
  { icon: Workflow, title: "Approval Workflow", desc: "Route submissions through Employee → Manager → HR style multi-step approvals, with role-based or specific-person approvers." },
  { icon: MessageCircle, title: "WhatsApp Forms", desc: "Respondents answer directly inside WhatsApp, one field at a time — no website or app required." },
  { icon: BarChart3, title: "Dashboard & Analytics", desc: "A live dashboard showing new responses, pending approvals, trends, and one-click exports to CSV or Excel." },
  { icon: FormInput, title: "Drag-and-drop builder", desc: "13 field types, branding, and a live canvas that's exactly what respondents see — no separate preview pane to keep in sync." },
  { icon: Share2, title: "Publish anywhere", desc: "A public share link, ready in one click — responses land straight in your dashboard, encrypted at rest." },
];

const COMPARISON_ROWS = [
  { feature: "AI Form Builder", flowora: true, googleForms: false, typeform: "limited" },
  { feature: "Approval Workflow", flowora: true, googleForms: false, typeform: false },
  { feature: "WhatsApp Forms", flowora: true, googleForms: false, typeform: false },
  { feature: "Dashboard & Analytics", flowora: true, googleForms: "basic", typeform: "basic" },
  { feature: "Workflow Automation", flowora: true, googleForms: false, typeform: false },
];

const INDUSTRIES = [
  { icon: Building2, label: "HR" },
  { icon: HeartPulse, label: "Healthcare" },
  { icon: GraduationCap, label: "Schools" },
  { icon: Factory, label: "Manufacturing" },
  { icon: Landmark, label: "Finance" },
  { icon: Truck, label: "Logistics" },
  { icon: Store, label: "Retail" },
];

const TESTIMONIALS = [
  { quote: "Reduced HR paperwork by 70%.", author: "HR Manager" },
  { quote: "We replaced three tools with Flowora.", author: "Operations Lead" },
  { quote: "The WhatsApp forms doubled our response rate.", author: "Marketing Manager" },
];

const FAQS = [
  { q: "Is Flowora free?", a: "Yes — the Free plan is free forever, no credit card required. Upgrade to Team or Enterprise when you need approval workflows and WhatsApp delivery." },
  { q: "Can I collect unlimited responses?", a: "The Free plan includes 100 responses/month. Team and Enterprise plans raise or remove that limit." },
  { q: "Can I export to Excel?", a: "Yes — every form's responses can be exported to CSV or Excel with one click." },
  { q: "Does Flowora support approvals?", a: "Yes — route submissions through multi-step approval chains (e.g. Employee → Manager → HR) with role-based or specific-person approvers." },
  { q: "Can forms be embedded?", a: "Yes — every published form gets a public share link you can link to or embed anywhere." },
  { q: "Can respondents answer on WhatsApp?", a: "Yes — the WhatsApp survey bot delivers your form as a conversational, one-field-at-a-time WhatsApp chat instead of a web link." },
  { q: "Is data encrypted?", a: "Yes — responses are encrypted at rest." },
  { q: "Can multiple team members collaborate?", a: "Yes — invite teammates with role-based permissions (Admin, Manager, Viewer) on Team and Enterprise plans." },
  { q: "Do I need coding?", a: "No — Flowora is a drag-and-drop builder. No code is required to build, publish, or route forms." },
  { q: "Can AI build my form?", a: "Yes — describe the form you need in plain language and the AI Assistant generates the fields for you." },
];

const PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "For individuals",
    price: "₹0",
    period: "forever",
    features: ["Up to 3 forms", "100 responses / month", "CSV/Excel export", "1 user"],
    cta: "Start free",
    href: "/signup",
  },
  {
    key: "team",
    name: "Team",
    tagline: "For growing businesses",
    price: "₹499",
    period: "/month",
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
    tagline: "For large organizations",
    price: "Custom",
    period: "",
    features: ["Everything in Team", "Unlimited responses", "Role-based permissions", "Priority support", "Custom integrations"],
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
          <a href="#faq" className="hover:text-ink">FAQ</a>
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

function ComparisonCell({ value }) {
  if (value === true) return <Check size={16} className="text-primary mx-auto" />;
  if (value === false) return <XIcon size={16} className="text-ink/25 mx-auto" />;
  return <span className="text-xs text-ink/50">{value === "limited" ? "Limited" : "Basic"}</span>;
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border py-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left gap-4">
        <span className="font-medium text-sm">{q}</span>
        <ChevronDown size={16} className={`text-ink/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-ink/60 mt-2 leading-relaxed">{a}</p>}
    </div>
  );
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "The AI-powered form platform for modern teams — build forms with AI, automate approvals, and collect responses on WhatsApp.",
  offers: PLANS.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: p.price === "Custom" ? undefined : p.price.replace(/[^\d]/g, "") || "0",
    priceCurrency: p.price.startsWith("₹") ? "INR" : undefined,
  })),
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Landing() {
  return (
    <div className="font-body text-ink">
      <Seo
        description="Create beautiful forms in seconds with AI, automate approvals, collect responses through WhatsApp, and track everything from one dashboard."
        keywords={[
          "form builder",
          "AI form builder",
          "drag and drop form builder",
          "online form builder",
          "approval workflow software",
          "WhatsApp form delivery",
          "WhatsApp survey software",
          "CRM software",
          "sales CRM",
          "lead management CRM",
          "free CRM",
        ]}
        path="/"
        jsonLd={[JSON_LD, FAQ_JSON_LD]}
      />
      <NavBar />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium mb-6">
          <Sparkles size={12} /> The AI-powered form platform for modern teams
        </div>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-[1.05] max-w-3xl mx-auto">
          Forms that don't just collect responses—they move work forward.
        </h1>
        <p className="text-ink/60 text-lg max-w-xl mx-auto mt-5">
          Create beautiful forms in seconds with AI, automate approvals, collect responses
          through WhatsApp, and track everything from one dashboard.
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

        {/* Social proof */}
        <div className="mt-10 pt-8 border-t border-border/70 max-w-2xl mx-auto">
          <p className="text-xs font-medium text-ink/40 mb-3">Built for HR, Operations, Sales &amp; Customer Support teams</p>
          <div className="flex items-center justify-center gap-8 flex-wrap text-center">
            <div>
              <p className="font-display font-bold text-2xl">5,000+</p>
              <p className="text-xs text-ink/40">Forms created</p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl">100K+</p>
              <p className="text-xs text-ink/40">Responses collected</p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl">99.9%</p>
              <p className="text-xs text-ink/40">Uptime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product preview mock */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
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

      {/* Problem section */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <h2 className="font-display font-bold text-3xl mb-8">Still using Google Forms?</h2>
        <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left mb-8">
          {["No approval workflow", "No WhatsApp surveys", "No AI form builder", "Responses stuck inside spreadsheets"].map((p) => (
            <div key={p} className="flex items-center gap-2 text-sm text-ink/60">
              <XIcon size={14} className="text-danger shrink-0" /> {p}
            </div>
          ))}
        </div>
        <p className="font-display font-semibold text-lg text-primary">{APP_NAME} fixes all of it.</p>
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

      {/* Comparison table */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl">How {APP_NAME} compares</h2>
        </div>
        <div className="overflow-x-auto border border-border rounded-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-base/50">
                <th className="text-left font-medium py-3 px-4">Feature</th>
                <th className="font-display font-semibold py-3 px-4 text-primary">{APP_NAME}</th>
                <th className="font-medium py-3 px-4 text-ink/50">Google Forms</th>
                <th className="font-medium py-3 px-4 text-ink/50">Typeform</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((r) => (
                <tr key={r.feature} className="border-b border-border last:border-b-0">
                  <td className="py-3 px-4 text-ink/70">{r.feature}</td>
                  <td className="py-3 px-4 text-center"><ComparisonCell value={r.flowora} /></td>
                  <td className="py-3 px-4 text-center"><ComparisonCell value={r.googleForms} /></td>
                  <td className="py-3 px-4 text-center"><ComparisonCell value={r.typeform} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Industries */}
      <section className="max-w-5xl mx-auto px-6 pb-20 text-center">
        <h2 className="font-display font-bold text-3xl mb-10">Perfect for</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {INDUSTRIES.map((i) => (
            <div key={i.label} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-white text-sm font-medium text-ink/70">
              <i.icon size={16} className="text-primary" /> {i.label}
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-base/40 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-display font-bold text-3xl text-center mb-10">Loved by teams that used to juggle spreadsheets</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="p-5 rounded-card border border-border bg-white shadow-card">
                <div className="flex gap-0.5 text-accent mb-3">
                  {Array.from({ length: 5 }).map((_, i) => <Sparkles key={i} size={13} fill="currentColor" />)}
                </div>
                <p className="text-sm text-ink/70 mb-3">"{t.quote}"</p>
                <p className="text-xs font-medium text-ink/40">— {t.author}</p>
              </div>
            ))}
          </div>
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

      {/* FAQ */}
      <section id="faq" className="max-w-2xl mx-auto px-6 py-20">
        <h2 className="font-display font-bold text-3xl text-center mb-10">Frequently asked questions</h2>
        <div>
          {FAQS.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-white py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="font-display font-bold text-3xl mb-3">Build your first AI-powered form in under 60 seconds.</h2>
          <p className="text-white/70 mb-8">Create your first form for free. No credit card required.</p>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-6 py-3 rounded-lg bg-white text-primary font-medium hover:bg-white/90">
            Start Building Free <ArrowRight size={16} />
          </Link>
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
