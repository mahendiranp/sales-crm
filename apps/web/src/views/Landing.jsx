import { useState } from "react";
import Link from "next/link";
import {
  Target, Sparkles, ArrowRight, Check, X as XIcon, Mail, ChevronDown,
  Workflow, Share2, BarChart3, FormInput, Upload, Bot, Clock,
  Building2, HeartPulse, GraduationCap, Factory, Landmark, Truck, Store,
} from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

const FEATURES = [
  { icon: Bot, title: "AI Form Builder", desc: "Describe your form in plain English. Flowora creates the fields, validation, and layout in seconds." },
  { icon: Upload, title: "Import Existing Forms", desc: "Upload PDFs, Word documents, images, or Google Forms. AI converts them into fully editable Flowora forms." },
  { icon: Workflow, title: "Approval Workflows", desc: "Automatically route submissions through managers, HR, finance, or any approval chain—without emails or spreadsheets." },
  { icon: BarChart3, title: "AI Insights", desc: "Summarize responses, identify trends, and uncover actionable insights without reading every submission." },
  { icon: FormInput, title: "Drag-and-drop Builder", desc: "13 field types, branding options, and a live canvas that matches exactly what respondents will see." },
  { icon: Share2, title: "Publish Anywhere", desc: "Share with a public link or embed on your website. Responses are securely stored and available instantly." },
];

// true/false/"limited"/"basic" — a defensible, not-fabricated read of each
// competitor's public feature set, same spirit as any vendor comparison
// page. Not tied to any live data source, so revisit if a competitor
// ships one of these.
const COMPARISON_ROWS = [
  { feature: "AI Form Builder", flowora: true, googleForms: false, typeform: "limited" },
  { feature: "Approval Workflow", flowora: true, googleForms: false, typeform: false },
  { feature: "Dashboard & Analytics", flowora: true, googleForms: "basic", typeform: "basic" },
  { feature: "Workflow Automation", flowora: true, googleForms: false, typeform: "limited" },
  { feature: "Team Collaboration", flowora: true, googleForms: "limited", typeform: "limited" },
];

const INDUSTRIES = [
  { icon: Building2, label: "HR", use: "Leave Requests" },
  { icon: HeartPulse, label: "Healthcare", use: "Patient Intake" },
  { icon: GraduationCap, label: "Education", use: "Admissions" },
  { icon: Factory, label: "Manufacturing", use: "Inspection Forms" },
  { icon: Landmark, label: "Finance", use: "Expense Approvals" },
  { icon: Truck, label: "Logistics", use: "Delivery Confirmations" },
  { icon: Store, label: "Retail", use: "Customer Feedback" },
];

const TESTIMONIALS = [
  { quote: "Creating employee onboarding forms now takes 2 minutes instead of 30.", author: "HR Team" },
  { quote: "We replaced three separate tools with one Flowora workflow.", author: "Operations Lead" },
  { quote: "The AI Assistant turns a 20-field form into a 2-minute job.", author: "Marketing Manager" },
];

const HOW_IT_WORKS = [
  { emoji: "💬", label: "Tell AI what you need" },
  { emoji: "✨", label: "AI creates your form" },
  { emoji: "🎨", label: "Customize if needed" },
  { emoji: "🚀", label: "Publish anywhere" },
  { emoji: "📈", label: "Track responses" },
  { emoji: "⚡", label: "Automate approvals" },
];

const BEFORE_STEPS = ["Create Form", "Collect Responses", "Download Excel", "Email Manager", "Wait", "Update Spreadsheet"];
const AFTER_STEPS = ["Describe Form", "AI Builds It", "Share", "Responses", "Approvals", "Done"];

const TIME_SAVED_ROWS = [
  { without: "Build a form manually", withFlowora: "AI creates it in seconds" },
  { without: "Recreate old forms", withFlowora: "Import PDF, Word, Image, or Google Forms" },
  { without: "Chase approvals by email", withFlowora: "Automated approval workflows" },
  { without: "Analyze spreadsheets", withFlowora: "AI summaries and dashboards" },
];

// Trimmed from 16 to the ones that actually affect a signup decision
// (pricing, core differentiators, collaboration, branding) — cut ones
// answered elsewhere on the page (data encryption reads as a trust badge,
// not an FAQ) or too support-desk-granular for a marketing page (thank-you
// page customization, Excel export, coding requirement, Google Forms
// migration, API availability).
const FAQS = [
  { q: "Is Flowora free?", a: "Yes — the Free plan is free forever, no credit card required. Upgrade to Team or Enterprise when you need approval workflows and more responses." },
  { q: "Can I collect unlimited responses?", a: "The Free plan includes 100 responses/month. Team and Enterprise plans raise or remove that limit." },
  { q: "Does Flowora support approvals?", a: "Yes — route submissions through multi-step approval chains (e.g. Employee → Manager → HR) with role-based or specific-person approvers." },
  { q: "Can I embed forms on my website?", a: "Yes — every published form gets a public share link you can embed directly on your site or link to from anywhere." },
  { q: "Can I remove Flowora branding?", a: "Yes, on Team and Enterprise plans. The Free plan shows a small Flowora badge on public forms." },
  { q: "Can multiple team members collaborate?", a: "Yes — invite teammates with role-based permissions (Admin, Manager, Viewer) on Team and Enterprise plans." },
  { q: "Can AI build my form?", a: "Yes — describe the form you need in plain language and the AI Assistant generates the fields for you." },
];

const PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "For individuals",
    price: "₹0",
    period: "forever",
    features: ["Up to 3 forms", "100 responses / month", "3 AI generations / month", "CSV/Excel export", "1 user"],
    cta: "Start Building Free",
    href: "/signup",
  },
  {
    key: "team",
    name: "Team",
    tagline: "For growing businesses",
    price: "₹999",
    period: "/month",
    features: ["Unlimited forms", "2,000 responses / month", "Approval workflows", "AI form builder", "Team collaboration", "Up to 20 users"],
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

// Footer links that don't have a real destination yet (no Blog/Help
// Center/Roadmap/API-docs/About page exists in this app) render as plain
// text instead of a dead <a href>, so the footer can show the fuller IA
// without shipping broken links. Swap `href: null` for a real path once
// that page exists.
const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Templates", href: null },
      { label: "Roadmap", href: null },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: null },
      { label: "Blog", href: null },
      { label: "API", href: null },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: null },
      { label: "Contact", href: "mailto:floworaone@gmail.com" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
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
    "Flowora is an AI form builder with multi-step approval workflows — build forms with AI or import from PDFs, Word, images, and Google Forms, automate approvals, and track everything from one dashboard.",
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

// Kept separate from the file's local Review/testimonial copy — that's UI
// display text, not a claim about verified, collectible third-party
// reviews, so it isn't reflected here as schema.org Review markup.
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: APP_NAME,
  url: "https://floworaone.com",
  logo: "https://floworaone.com/favicon.svg",
  email: "info@floworaone.com",
};

export default function Landing() {
  return (
    <div className="font-body text-ink">
      <Seo
        description="Build forms with AI, automate approvals, and track everything from one dashboard."
        keywords={[
          "flowora",
          "flowora forms",
          "online form builder",
          "form creation tool",
          "approval workflow software",
          "free form builder",
          "custom form builder",
          "form builder software",
          "AI form creation",
          "approval workflow tool",
          "form builder",
          "drag and drop form builder",
          "CRM software",
          "sales CRM",
          "lead management CRM",
          "free CRM",
          "AI form builder",
          "create with AI",
          "generate form",
          "AI generator",
          "new AI form",
          "smart form",
          "prompt to form",
          "AI assistant",
          "PDF import",
          "PDF to form",
          "import PDF",
          "upload PDF",
          "convert PDF",
          "PDF converter",
          "generate from PDF",
          "PDF form import",
          "PDF upload",
          "image import",
          "image to form",
          "import image",
          "upload image",
          "scan form",
          "photo to form",
          "convert image",
          "JPG to form",
          "PNG to form",
          "Word import",
          "Word to form",
          "import Word",
          "upload DOCX",
          "DOCX to form",
          "Word converter",
          "generate from Word",
          "Google Forms",
          "import Google Form",
          "Google Forms import",
          "migrate Google Forms",
          "copy Google Form",
          "Google Form converter",
          "Google Forms migration",
          "universal import",
          "import form",
          "import existing form",
          "convert to Flowora",
          "AI import",
          "smart import",
          "import with AI",
          "import document",
          "upload and convert",
          "AI document import",
          "pdf to form converter",
          "convert pdf to online form",
        ]}
        path="/"
        jsonLd={[JSON_LD, FAQ_JSON_LD, ORG_JSON_LD]}
      />
      <NavBar />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium mb-6">
          <Sparkles size={12} /> AI Form Builder — Import PDFs, Word, Images & Google Forms
        </div>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-[1.05] max-w-3xl mx-auto">
          Create Any Form in 30 Seconds. AI Does the Rest.
        </h1>
        <p className="text-ink/60 text-lg max-w-xl mx-auto mt-5">
          From PDFs, Word documents, images, or a simple prompt, {APP_NAME} creates beautiful forms with approvals
          and automation—no manual setup required.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
            Start Free <ArrowRight size={16} />
          </Link>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg border border-border font-medium hover:bg-base">
            Import a Form
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-6 text-xs text-ink/50">
          {["Free forever", "No credit card required", "Import existing forms", "Setup in under 60 seconds"].map((t) => (
            <span key={t} className="flex items-center gap-1">
              <Check size={12} className="text-primary" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* Product preview mock — a real product screenshot converts far
          better than a hand-drawn mock; swap this block for an actual
          <img> of the dashboard once one is captured. */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="rounded-2xl border border-border shadow-card bg-white p-3">
          <div className="rounded-xl bg-base border border-border p-6">
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

      {/* Problem → solution */}
      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <h2 className="font-display font-bold text-3xl mb-2">Why Teams Are Switching to {APP_NAME}</h2>
        <p className="text-ink/50 mb-8">Still using Google Forms?</p>
        <div className="grid sm:grid-cols-2 gap-3 text-left">
          {[
            { before: "Rebuilding forms manually", after: "Import existing forms instantly" },
            { before: "Copying responses into spreadsheets", after: "Real-time dashboards" },
            { before: "Email approval chains", after: "Automated approval workflows" },
            { before: "Basic forms", after: "AI-powered forms" },
          ].map((row) => (
            <div key={row.before} className="p-4 rounded-card border border-border bg-white shadow-card">
              <div className="flex items-center gap-2 text-sm text-ink/40 mb-1.5">
                <XIcon size={14} className="text-danger shrink-0" /> {row.before}
              </div>
              <div className="flex items-center gap-2 text-sm text-ink/80 font-medium">
                <Check size={14} className="text-primary shrink-0" /> {row.after}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-base/40 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-display font-bold text-3xl text-center mb-12">From Idea to Live Form in Under a Minute</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.label} className="flex items-center gap-3 bg-white border border-border rounded-card p-4 shadow-card">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-base shrink-0">
                  {s.emoji}
                </span>
                <span className="font-medium text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before vs After */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="font-display font-bold text-3xl text-center mb-12">Before vs. After {APP_NAME}</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-4 text-center">Before {APP_NAME}</p>
            <div className="space-y-2">
              {BEFORE_STEPS.map((s, i) => (
                <div key={s}>
                  <div className="text-sm text-ink/60 bg-white border border-border rounded-lg py-2.5 px-4 text-center">{s}</div>
                  {i < BEFORE_STEPS.length - 1 && <div className="text-ink/25 text-center py-0.5">↓</div>}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-danger font-medium mt-3">~30 minutes</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-4 text-center">With {APP_NAME}</p>
            <div className="space-y-2">
              {AFTER_STEPS.map((s, i) => (
                <div key={s}>
                  <div className="text-sm font-medium text-ink/80 bg-primary/5 border border-primary/20 rounded-lg py-2.5 px-4 text-center">{s}</div>
                  {i < AFTER_STEPS.length - 1 && <div className="text-primary/40 text-center py-0.5">↓</div>}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-primary font-semibold mt-3">~30 seconds</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Everything you need to collect and act on responses</h2>
          <p className="text-ink/50 mt-2">Build, publish, and automate—all from one platform.</p>
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

      {/* AI section */}
      <section className="bg-primary text-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Sparkles size={28} className="mx-auto mb-4 text-accent" />
          <h2 className="font-display font-bold text-3xl mb-3">Your AI form-building copilot</h2>
          <p className="text-white/70 max-w-xl mx-auto">
            Describe the form you need—"Create an employee leave request form"—and Flowora
            generates the form structure, fields, and validation in seconds.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl">How {APP_NAME} compares</h2>
        </div>
        <div className="overflow-x-auto border border-border rounded-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-base/50">
                <th className="text-left font-medium py-3 px-4">Feature</th>
                <th className="font-display font-semibold py-3 px-4 text-primary whitespace-nowrap">{APP_NAME}</th>
                <th className="font-medium py-3 px-4 text-ink/50 whitespace-nowrap">Google Forms</th>
                <th className="font-medium py-3 px-4 text-ink/50 whitespace-nowrap">Typeform</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((r) => (
                <tr key={r.feature} className="border-b border-border last:border-b-0">
                  <td className="py-3 px-4 text-ink/70 whitespace-nowrap">{r.feature}</td>
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
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="font-display font-bold text-3xl text-center mb-10">Perfect for</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {INDUSTRIES.map((i) => (
            <div key={i.label} className="flex items-center gap-3 px-4 py-3.5 rounded-card border border-border bg-white shadow-card">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i.icon size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{i.label}</p>
                <p className="text-xs text-ink/40 truncate">{i.use}</p>
              </div>
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

      {/* Save hours every week */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="font-display font-bold text-3xl text-center mb-2 flex items-center justify-center gap-2">
          <Clock size={26} className="text-primary" /> Save Hours Every Week
        </h2>
        <p className="text-ink/50 text-center mb-10">This is the part Typeform, Jotform, and Tally don't talk about.</p>
        <div className="overflow-x-auto border border-border rounded-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-base/50">
                <th className="text-left font-medium py-3 px-4 text-ink/50">Without {APP_NAME}</th>
                <th className="text-left font-display font-semibold py-3 px-4 text-primary">With {APP_NAME}</th>
              </tr>
            </thead>
            <tbody>
              {TIME_SAVED_ROWS.map((r) => (
                <tr key={r.without} className="border-b border-border last:border-b-0">
                  <td className="py-3 px-4 text-ink/50">{r.without}</td>
                  <td className="py-3 px-4 text-ink/80 font-medium">{r.withFlowora}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Simple, transparent pricing</h2>
          <p className="text-ink/50 mt-2">Start free. Upgrade when you need approval workflows and more responses.</p>
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
              {p.key === "free" && <p className="text-[11px] text-ink/35 text-center mt-2">No credit card required</p>}
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
          <h2 className="font-display font-bold text-3xl mb-3">Stop Building Forms the Hard Way</h2>
          <p className="text-white/70 mb-8">
            Create new forms with AI or import your existing ones in seconds. Join teams that are replacing manual
            form creation with intelligent workflows.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-6 py-3 rounded-lg bg-white text-primary font-medium hover:bg-white/90">
            Start Building Free <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-white/50 mt-4">No credit card • Free forever</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Target size={14} className="text-white" />
              </div>
              <span className="font-display font-semibold">{APP_NAME}</span>
            </div>
            <p className="text-xs text-ink/40">Forms that route themselves.</p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href ? (
                      <Link href={l.href} className="text-sm text-ink/60 hover:text-ink">{l.label}</Link>
                    ) : (
                      <span className="text-sm text-ink/30">{l.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-ink/40">© 2026 {APP_NAME}. All rights reserved.</p>
            <span className="flex items-center gap-1 text-xs text-ink/50"><Mail size={12} /> floworaone@gmail.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
