import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target, Sparkles, ArrowRight, Check, Mail, ChevronDown, UploadCloud,
  Workflow, Bot, Clock, Lock,
  Building2, HeartPulse, GraduationCap, Factory, Landmark, Truck, Store,
  Briefcase, TrendingUp, ClipboardList, ShieldCheck, History, DatabaseBackup, Globe, Activity,
} from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

// Grouped by the same Forms/CRM/Work/AI structure as the rest of the
// page's "forms are the entry point, everything after is the platform"
// positioning, instead of one flat undifferentiated checklist.
const SECURITY_POINTS = [
  { icon: Lock, label: "Encrypted in transit and at rest" },
  { icon: ShieldCheck, label: "Role-based access control" },
  { icon: History, label: "Complete audit history" },
  { icon: DatabaseBackup, label: "Automatic backups" },
  { icon: Globe, label: "Secure cloud infrastructure" },
  { icon: Activity, label: "24×7 system monitoring" },
];

const INDUSTRIES = [
  { icon: Building2, label: "Human Resources", use: "Leave requests" },
  { icon: Landmark, label: "Finance", use: "Expense approvals" },
  { icon: HeartPulse, label: "Healthcare", use: "Patient intake" },
  { icon: GraduationCap, label: "Education", use: "Admissions" },
  { icon: Factory, label: "Manufacturing", use: "Inspection forms" },
  { icon: Truck, label: "Logistics", use: "Delivery confirmations" },
  { icon: Store, label: "Retail", use: "Customer feedback" },
  { icon: Briefcase, label: "Operations", use: "Process requests" },
  { icon: TrendingUp, label: "Sales", use: "Lead capture" },
  { icon: ClipboardList, label: "Administration", use: "Internal requests" },
];

// This is now the single comparison section on the homepage — it used to
// compete with "See the Difference" (a 2-col outcome table) and "How
// Flowora compares" (a 4-col feature-vs-competitor table), all saying the
// same "Traditional forms stop at collecting data, Flowora keeps going"
// thing three different ways. The named-competitor angle (Google Forms/
// Typeform feature-by-feature) still lives on the dedicated /compare/
// [slug] pages — this is deliberately the simple, single visual version.
const BEFORE_STEPS = ["Create Form", "Download Excel", "Email Approval", "Manual CRM Entry", "Manual Tasks"];
const AFTER_STEPS = ["AI Builds Form", "Approval", "CRM Updated", "Task Created", "Meeting Scheduled", "AI Insight"];

// Trimmed from 16 to the ones that actually affect a signup decision
// (pricing, core differentiators, collaboration, branding) — cut ones
// answered elsewhere on the page (data encryption reads as a trust badge,
// not an FAQ) or too support-desk-granular for a marketing page (thank-you
// page customization, Excel export, coding requirement, Google Forms
// migration, API availability).
// Trimmed to 5 — the ones that actually affect a signup decision, per
// feedback that a 7-question wall reads as filler this far down a page
// that's already explained most of this in earlier sections.
const FAQS = [
  { q: "Is Flowora free?", a: "Yes — the Free plan is free forever, with up to 3 forms and 100 responses a month. No credit card required. Paid plans unlock unlimited forms, approvals, and AI automation." },
  { q: "Can I import Google Forms?", a: "Yes. Paste in an existing Google Form and Flowora rebuilds it as a smart form — no manual re-entry of fields." },
  { q: "Does Flowora support approvals?", a: "Yes. Every form can be connected to an approval workflow, so submissions route to the right person automatically instead of sitting in an inbox." },
  { q: "Can teams collaborate?", a: "Yes. Team and Enterprise plans support multiple users with role-based permissions, shared forms, and a shared audit history." },
  { q: "How does AI work?", a: "Describe what you need in plain language and Flowora generates the form fields, logic, and validation. AI credits also power the recommendations and insights generated from submissions." },
];

// Every line here is checked against utils/plans.js's actual limits, not
// just aspirational copy — e.g. AI Form Builder is genuinely gated off
// Starter/Free (aiAssistant: false, enforced in routes/forms.js and
// leads.js), so it's deliberately not listed as a Free feature even
// though a fresh signup gets a one-time 100-credit grant; Enterprise's AI
// credits are the real 2,000/month from PLANS.enterprise, not a fabricated
// "unlimited" claim; and SSO isn't listed at all since there's no SAML/
// enterprise-SSO integration anywhere in the backend.
const PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "For individuals",
    price: "$0",
    period: "forever",
    features: ["Up to 3 forms", "100 responses/month", "CSV export", "1 user", "Upgrade to unlock AI features"],
    cta: "Start Building Free",
    href: "/signup",
  },
  {
    key: "team",
    name: "Team",
    tagline: "For growing businesses",
    price: "$19",
    period: "/month",
    features: ["Unlimited active forms", "2,000 responses/month", "Approval workflows", "CRM + Work automation", "500 AI credits/month", "Import existing forms", "Up to 20 users"],
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
    features: ["Unlimited forms, responses & users", "2,000+ AI credits/month", "Advanced permissions", "Custom integrations", "Dedicated support"],
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
    // Templates/Roadmap dropped — no such pages exist yet; fewer links
    // beats dead ones (same reasoning the Resources column below no
    // longer exists at all).
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    // Every link here is a real, working page (apps/web/src/pages/*.jsx) —
    // the main source of internal links pointing at the SEO feature pages,
    // since nothing else in the marketing site links to them yet.
    title: "Explore",
    links: [
      { label: "AI Form Builder", href: "/ai-form-builder" },
      { label: "PDF to Form", href: "/pdf-to-form" },
      { label: "Word to Form", href: "/word-to-form" },
      { label: "Image to Form", href: "/image-to-form" },
      { label: "Google Forms Import", href: "/google-forms-import" },
      { label: "Approval Workflows", href: "/approval-workflow" },
      { label: "Workflow Automation", href: "/workflow-automation" },
      { label: "CRM", href: "/crm" },
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

// Descriptive, not a fabricated discount/launch-offer claim — nothing in
// this codebase backs a "50% off" or similar promotion, so the bar states
// what's actually true (AI Forms + CRM + Approval Workflows shipped) and
// links to the section that proves it.
// Fixed height (h-9), single line always (truncate instead of wrap) — a
// wrapped 2-line bar was growing tall enough to push/overlap the hero's
// CTA buttons below it on narrower viewports. Shorter copy so truncation
// rarely if ever kicks in even on small screens.
function AnnouncementBar() {
  return (
    <a
      href="#demo"
      className="group flex items-center justify-center gap-1.5 h-9 bg-primary text-white text-xs sm:text-sm font-medium px-4 hover:bg-primary-dark transition-colors overflow-hidden"
    >
      <span className="truncate">✨ New — Google Forms Import · Approval Automation</span>
      <ArrowRight size={13} className="shrink-0 transition-transform group-hover:translate-x-1" />
    </a>
  );
}

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
          <Link href="/templates" className="hover:text-ink">Templates</Link>
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

// Single shared timeline driving BOTH the hero mock and the "How it
// works" chip row below it — one timer, owned by Landing() and passed
// down as a prop, so the two animations move on the exact same clock
// instead of two independent loops that drift apart from each other.
// Four macro-phases instead of six granular steps — each phase groups
// several real things happening (e.g. "Workflow Executes" covers the
// submit → approve → task-creation chain) so the story reads as "prompt
// in, business outcome out" rather than a flat list of form-builder UI
// states. Phases run at different durations (2s/2s/3s/3s = 10s/loop)
// since "Workflow Executes" and "Business Updates" each show three
// sub-items that need time to stagger in, while "Prompt" is just a
// typing cursor.
const HERO_PHASES = [
  { key: "prompt", label: "Describe", ms: 2000 },
  { key: "assets", label: "Generate", ms: 2000 },
  { key: "workflow", label: "Execute", ms: 3000 },
  { key: "business", label: "Complete", ms: 3000 },
];

function useSyncedPhase() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setPhaseIndex((i) => (i + 1) % HERO_PHASES.length), HERO_PHASES[phaseIndex].ms);
    return () => clearTimeout(timer);
  }, [phaseIndex]);
  return phaseIndex;
}

// One accent color per module — echoed in the mock, the sidebar dots, and
// the feature cards below, so a visitor learns "orange = Work, indigo =
// AI Center" once and it stays consistent everywhere. Restrained on
// purpose (text color only, not full colored backgrounds) — enough to
// scan by, not a rainbow.
const MODULE_COLOR = {
  Forms: "text-blue-600",
  Form: "text-blue-600",
  Approval: "text-emerald-600",
  Work: "text-amber-600",
  Task: "text-amber-600",
  Meetings: "text-violet-600",
  CRM: "text-primary",
  "AI Center": "text-indigo-600",
};

const AI_ASSETS = [
  { icon: "📄", label: "Form Created", color: MODULE_COLOR.Form },
  { icon: "✅", label: "Approval Added", color: MODULE_COLOR.Approval },
  { icon: "📋", label: "Task Assigned", color: MODULE_COLOR.Task },
];
const WORKFLOW_STEPS = ["Employee submits", "Manager approves", "Task created"];
const BUSINESS_UPDATES = [
  { icon: "📈", label: "CRM updated", color: MODULE_COLOR.CRM },
  { icon: "🤖", label: "AI Center receives event", color: MODULE_COLOR["AI Center"] },
  { icon: "🎉", label: "Business Process Completed", color: "text-emerald-600" },
];

// Mimics a real app's left nav rail (one dot per module, in module-color
// order) — a small, low-cost signal that this is a miniature product
// screenshot, not an abstract diagram, without rebuilding the mock as a
// full fake application.
const SIDEBAR_MODULES = [
  { icon: "📄", color: MODULE_COLOR.Forms },
  { icon: "✅", color: MODULE_COLOR.Approval },
  { icon: "📋", color: MODULE_COLOR.Work },
  { icon: "📅", color: MODULE_COLOR.Meetings },
  { icon: "📈", color: MODULE_COLOR.CRM },
  { icon: "🤖", color: MODULE_COLOR["AI Center"] },
];

// Three always-visible columns (Prompt / AI Creates Assets / a
// right-hand panel that swaps between "Workflow Executes" and "Business
// Updates" content). The right panel tells the real story in order —
// waiting → executing the workflow → the business-level outcome — so it
// matches what actually happens after a form gets submitted, not just
// form-builder UI states.
function HeroMock({ phaseIndex }) {
  const phase = HERO_PHASES[phaseIndex].key;
  const at = (k) => phaseIndex >= HERO_PHASES.findIndex((p) => p.key === k);

  return (
    <div className="rounded-3xl border border-border/70 shadow-[0_20px_60px_-15px_rgba(20,23,43,0.15)] bg-white/90 backdrop-blur-sm p-3">
      {/* Window chrome — a real app's title bar, not an abstract card, so
          the mock reads as a miniature product screenshot at a glance. */}
      <div className="flex items-center gap-1.5 px-2 pb-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-accent/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[10px] text-ink/30 font-medium">flowora.app/workflows/leave-request</span>
      </div>
      <div className="flex rounded-xl bg-base border border-border overflow-hidden">
        {/* Left nav rail — one dot per module, hidden below sm where
            there's no room for it without crowding the three columns. */}
        <div className="hidden sm:flex flex-col items-center gap-3 w-11 shrink-0 bg-white border-r border-border py-4">
          {SIDEBAR_MODULES.map((m, i) => (
            <span key={i} className={`text-sm ${m.color}`}>{m.icon}</span>
          ))}
        </div>
        <div className="flex-1 p-5 sm:p-6">
        <div className="grid sm:grid-cols-3 gap-4 text-left items-start">
          {/* Request — "Prompt" is the progress indicator's label for this
              same phase (below the demo); this column is named
              differently ("Request") on purpose so the two don't read as
              the same concept repeated twice. */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/35 mb-1.5">Request</p>
            <div className="bg-white rounded-lg border border-border px-3 py-2.5 text-sm text-ink/70 min-h-[52px]">
              {/* Reads as "still typing" during the prompt phase (trailing
                  ellipsis + blinking caret), then settles to the plain
                  quoted request once the AI has moved on to building it. */}
              {phase === "prompt" ? "Create an Employee Leave Process…" : "“Create an Employee Leave Process”"}
              {phase === "prompt" && <span className="inline-block w-[2px] h-3.5 bg-primary ml-0.5 align-middle animate-pulse" />}
            </div>
          </div>

          {/* Generated Assets — built once at "assets" and stays visible
              (as the source of truth) through every later phase. Named
              differently from the progress indicator's "AI Creates
              Assets" label for the same reason as "Request" above. */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/35 mb-1.5">Generated Assets</p>
            {!at("assets") ? (
              <div className="bg-white rounded-lg border border-border px-3 py-2.5 min-h-[52px] flex items-center">
                <p className="text-xs text-ink/30">Waiting for prompt…</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-border p-3.5 space-y-1.5">
                {AI_ASSETS.map((a, i) => (
                  <div
                    key={a.label}
                    className={`flex items-center gap-1.5 text-xs font-medium ${a.color} ${phase === "assets" ? "opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]" : ""}`}
                    style={phase === "assets" ? { animationDelay: `${i * 0.5}s` } : undefined}
                  >
                    <span>{a.icon}</span> {a.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel — one fixed column name ("Business Process") for
              the whole panel's lifecycle instead of swapping the heading
              itself per phase; its *content* still moves waiting →
              workflow-execution chain → business-level outcome. */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/35 mb-1.5">Business Process</p>

            {(phase === "prompt" || phase === "assets") && (
              <div className="bg-white rounded-lg border border-border px-3 py-2.5 min-h-[52px] flex items-center">
                <p className="text-xs text-ink/30">Not yet configured</p>
              </div>
            )}

            {phase === "workflow" && (
              <div className="bg-white rounded-lg border border-border p-3.5 space-y-1.5">
                {WORKFLOW_STEPS.map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-1.5 text-xs text-ink/70 opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]"
                    style={{ animationDelay: `${i * 0.8}s` }}
                  >
                    <Check size={12} className="text-primary shrink-0" /> {s}
                  </div>
                ))}
              </div>
            )}

            {phase === "business" && (
              <div className="bg-white rounded-lg border border-border p-3.5 space-y-1.5">
                {BUSINESS_UPDATES.map((u, i) => (
                  <div
                    key={u.label}
                    className={`flex items-center gap-1.5 text-xs font-medium ${u.color} opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]`}
                    style={{ animationDelay: `${i * 0.8}s` }}
                  >
                    <span>{u.icon}</span> {u.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// Animated chip row — only the current phase is highlighted (solid
// green), completed phases get a checkmark + light green, upcoming
// phases stay white/gray. Driven by the same phaseIndex as HeroMock (see
// useSyncedPhase above) so both animations move in lockstep instead of
// two independently-drifting timers. Restored after being mistakenly
// folded into the How It Works consolidation — it wasn't one of the
// three overlapping sections that request actually named, and it's the
// only place the Describe/Generate/Execute/Complete phase labels render
// as visible text (paired with the Live Workflow Demo mock, not with
// the separate How It Works section below).
function WorkflowChips({ phaseIndex }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 text-sm font-medium">
      {HERO_PHASES.map((p, i) => {
        const isLast = i === HERO_PHASES.length - 1;
        const completed = i < phaseIndex || (isLast && phaseIndex === HERO_PHASES.length - 1);
        const active = i === phaseIndex;
        return (
          <span key={p.key} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-primary text-white border-primary"
                  : completed
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-white border-border text-ink/60"
              }`}
            >
              {completed && !active && <Check size={12} />} {p.label}
            </span>
            {!isLast && <ArrowRight size={13} className={i < phaseIndex ? "text-primary/40" : "text-ink/25"} />}
          </span>
        );
      })}
    </div>
  );
}

function FaqItem({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
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
    priceCurrency: p.price === "Custom" ? undefined : "USD",
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
  const heroPhase = useSyncedPhase();
  // Real, live remaining-slots count from the backend (routes/payments.js's
  // public GET /launch-offer) — never a hardcoded "first 100" claim that
  // could drift from what checkout would actually charge.
  const [launchOffer, setLaunchOffer] = useState(null);
  useEffect(() => {
    fetch("/api/payments/launch-offer")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.active && setLaunchOffer(data))
      .catch(() => {});
  }, []);
  return (
    <div className="font-body text-ink">
      <Seo
        description="Build production-ready forms with AI in 30 seconds. Import PDFs, Word documents, images, or Google Forms—then automate approvals and track everything from one dashboard."
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
      <AnnouncementBar />
      <NavBar />

      {/* Hero — a faint radial glow behind the headline instead of a flat
          white background, understated enough not to fight the copy. The
          glow/circles live in this full-width relative wrapper (not
          inside the max-w-6xl content section below) so the background
          spans the entire viewport instead of being clipped to the
          centered content column; pointer-events-none + -z-10 keep them
          decorative and never intercepting clicks on the CTA buttons. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[680px] -z-10"
          style={{ background: "radial-gradient(circle at top, rgba(47,93,80,0.08), transparent 45%), #ffffff" }}
        />
        {/* Near-invisible dot grid for texture (Linear-style) — a single
            repeating radial-gradient tile, not an image asset. Faded out
            toward the edges via a mask so it doesn't read as a hard-edged
            pattern. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[680px] -z-10 opacity-[0.4]"
          style={{
            backgroundImage: "radial-gradient(rgba(20,23,43,0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse 55% 45% at 50% 0%, black 25%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(ellipse 55% 45% at 50% 0%, black 25%, transparent 65%)",
          }}
        />
        {/* Two faint blurred circles for a touch of depth — hidden below
            md since there's no room for them not to collide with the copy
            on a narrow viewport. */}
        <div aria-hidden="true" className="hidden md:block pointer-events-none absolute left-[8%] top-4 w-40 h-40 rounded-full bg-primary/[0.06] blur-3xl -z-10" />
        <div aria-hidden="true" className="hidden md:block pointer-events-none absolute right-[8%] top-32 w-56 h-56 rounded-full bg-accent/[0.07] blur-3xl -z-10" />
      <section className="max-w-[820px] mx-auto px-6 pt-12 pb-3 text-center">
        {/* Narrower hero column (820px, was max-w-6xl/1152px) and a
            deliberate spacing rhythm between each element (24/28/36/24/28
            per the badge→headline→subtitle→buttons→badges→chips chain)
            instead of a uniform tight stack — reads calmer, and gives the
            headline room to be the clear focal point at a smaller,
            better-balanced size. This reverses the previous "compact
            Monday-style" pass's tighter spacing — that direction and this
            one were both requested; this is the later, more specific
            instruction. */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-6 shadow-[0_1px_2px_rgba(20,23,43,0.06)]">
          <Sparkles size={12} className="animate-pulse" /> AI Forms + Business Automation
        </div>
        {/* Leads with the outcome ("get finished work"), not the feature
            list — the mechanism (approvals/tasks/CRM/AI) now shows up
            once in the subhead and once in the How It Works section
            below, not scattered across four separate blocks. */}
        <h1 className="font-display font-extrabold text-4xl md:text-[60px] leading-[1.05] tracking-[-0.04em] max-w-[900px] mx-auto">
          {"Build a form. "}
          <br />
          <span className="sm:whitespace-nowrap">Get finished work.</span>
        </h1>
        <p className="text-ink/60 text-[16px] leading-relaxed max-w-xl mx-auto mt-7">
          Describe what you need and Flowora builds the form. Every submission that comes in automatically routes for approval, creates tasks, updates your CRM, and surfaces AI insights — no extra setup.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg bg-primary text-white font-medium shadow-[0_1px_2px_rgba(20,23,43,0.06)] transition-all duration-[250ms] hover:bg-primary-dark hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_12px_35px_rgba(47,93,80,0.3)]"
          >
            Start Free →
          </Link>
          {/* Ghost BUTTON now (bordered), not plain text — was easy to
              miss next to the solid primary CTA. Still visually secondary
              (no fill), but recognizable as a real second action, with an
              upload icon since "import" is the whole point of it. */}
          <Link
            href="/signup"
            className="group inline-flex items-center gap-1.5 px-5 py-3 rounded-lg font-medium text-ink/70 border border-border hover:border-ink/30 hover:text-ink hover:bg-base transition-colors"
          >
            <UploadCloud size={16} />
            Import Existing Form
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {/* Concrete, click-de-risking checkmarks sit closest to the CTA;
            the softer department/qualitative trust line sits further
            below it — ordered by how directly each de-risks the click.
            Trimmed to 3 (dropped "Cancel anytime" — least relevant to
            someone starting on the free plan, where there's nothing to
            cancel yet). */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-5 text-xs text-ink/50">
          {["Free forever", "No credit card required", "Live in under 60 seconds"].map((t) => (
            <span key={t} className="flex items-center gap-1">
              <Check size={12} className="text-primary" /> {t}
            </span>
          ))}
        </div>
        {/* "Built for" rather than "Trusted by teams in" — the latter
            implies existing customer traction across these industries,
            which isn't a claim there's real data to back yet. Also not
            "Perfect for" — this page already has a "Perfect for" heading
            further down (the INDUSTRIES grid); reusing it here would
            either read as a duplicate heading or trip up a
            cy.contains("Perfect for") match against two elements. */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <span className="text-xs font-medium text-ink/40 mr-1">Built for</span>
          {[
            { icon: Building2, label: "HR" },
            { icon: Landmark, label: "Finance" },
            { icon: Briefcase, label: "Operations" },
            { icon: TrendingUp, label: "Sales" },
            { icon: GraduationCap, label: "Education" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-ink/60 bg-base border border-border/70 rounded-full px-3 py-1.5">
              <Icon size={13} className="text-primary" /> {label}
            </span>
          ))}
        </div>
      </section>
      </div>

      {/* Product preview mock — a small looping animation (prompt → AI
          creates the form/approval/task assets → the workflow executes →
          the business-level outcome) instead of a static list, so a
          visitor understands what Flowora does within a few seconds
          without needing a real demo video. A real product screenshot/GIF
          still converts better than a hand-built mock like this — swap
          this block for one once captured.
          A divider + a short, bold section-label ("⚡ Live Workflow Demo")
          replaces the previous long sentence, which was the same size/
          weight as the industry chips right above it and visually blurred
          into them — this is deliberately a clear section break instead,
          32px above the divider, 20px below the title. */}
      <section id="demo" className="relative max-w-[1320px] mx-auto px-6 mb-16">
        <div className="max-w-xs mx-auto h-px bg-border mt-8 mb-5" />
        <p className="text-center text-[16px] font-semibold text-ink mb-4">
          ⚡ Live Workflow Demo
        </p>
        {/* Floating chips — fully OUTSIDE the mock's own box (top corners
            + bottom-center), not overlapping its edges. The mock is wide
            enough now (max-w-[1320px]) that there's no real side margin
            left in the section for chips to float beside it without
            clipping — hence top/bottom placement instead of left/right.
            z-20 so they never render underneath the mock regardless of
            paint order; hidden below lg where there isn't room for either
            the mock or the chips to breathe. */}
        <div className="relative mt-8">
          <div className="hidden lg:block">
            {[
              { emoji: "✅", label: "Approval Complete", className: "-top-5 left-10", delay: "0s" },
              { emoji: "📈", label: "CRM Updated", className: "-top-5 right-10", delay: "3s" },
              { emoji: "🤖", label: "AI Recommendation Ready", className: "-bottom-5 right-10", delay: "6s" },
            ].map((c) => (
              <span
                key={c.label}
                className={`absolute z-20 ${c.className} flex items-center gap-1.5 text-xs font-medium text-ink/70 bg-white border border-border rounded-full px-3 py-1.5 shadow-card opacity-0 animate-[floatFade_8s_ease-in-out_infinite]`}
                style={{ animationDelay: c.delay }}
              >
                {c.emoji} {c.label}
              </span>
            ))}
          </div>
          <HeroMock phaseIndex={heroPhase} />
        </div>
        {/* Phase chip row — paired with the demo mock right above it,
            synced to the same timer (useSyncedPhase/heroPhase). */}
        <div className="mt-8">
          <WorkflowChips phaseIndex={heroPhase} />
        </div>
      </section>

      {/* How It Works — replaces three sections that used to say the same
          thing three different ways (an icon-only feature row, a
          "Forms are just the beginning" chip chain, and a separate "From
          Idea to Live Form" 6-card list). One section, real sentences a
          skimming visitor can parse in under two seconds instead of
          icon-plus-fragment labels. */}
      <section id="features" className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="font-display font-bold text-3xl text-center mb-2">From idea to finished work</h2>
        <div className="grid sm:grid-cols-3 gap-5 mt-10">
          {[
            {
              n: "1",
              title: "Describe it.",
              body: 'Tell Flowora what you need — "employee leave request," "vendor onboarding," "expense claim." Or import a PDF, Word doc, image, or existing Google Form.',
            },
            {
              n: "2",
              title: "AI builds the form.",
              body: "Fields, logic, and validation are generated in seconds. Adjust anything by hand if you want.",
            },
            {
              n: "3",
              title: "Publish anywhere.",
              body: "Share a link, embed it, or drop it into an existing workflow.",
            },
          ].map((s) => (
            <div key={s.n} className="bg-white border border-border rounded-card p-5 shadow-card">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
                {s.n}
              </span>
              <p className="font-semibold text-sm text-ink/90 mb-1">{s.title}</p>
              <p className="text-sm text-ink/55 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Step 4 — every submission moves on its own. Same module colors
            used everywhere else on the page (hero mock, module cards). */}
        <div className="bg-primary/[0.04] border border-primary/15 rounded-card p-6 mt-5">
          <p className="font-semibold text-sm text-ink/90 mb-4">4. Every submission moves on its own.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: Workflow, label: "Approval", desc: "routed to the right person automatically", color: MODULE_COLOR.Approval },
              { icon: ClipboardList, label: "Work", desc: "tasks created and assigned, nothing falls through", color: MODULE_COLOR.Work },
              { icon: Building2, label: "CRM", desc: "pipelines and records updated without manual entry", color: MODULE_COLOR.CRM },
              { icon: Clock, label: "Meetings", desc: "scheduled straight from a submission when needed", color: MODULE_COLOR.Meetings },
              { icon: Bot, label: "AI Center", desc: "gets a recommendation or insight on the data as it comes in", color: MODULE_COLOR["AI Center"] },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                <p className="text-sm text-ink/65">
                  <span className="font-medium text-ink/85">{label}</span> — {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Imports — the concrete differentiator, as visual cards instead of
          just a text mention. */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { from: "PDF", to: "Form" },
            { from: "Word", to: "Form" },
            { from: "Image", to: "Form" },
            { from: "Google Forms", to: "Flowora" },
          ].map((c) => (
            <div key={c.from} className="p-4 rounded-card border border-border bg-white shadow-card text-center">
              <p className="text-sm font-semibold text-ink/80">{c.from}</p>
              <ArrowRight size={13} className="text-primary/50 mx-auto my-1.5 rotate-90" />
              <p className="text-sm font-medium text-primary">{c.to}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Traditional vs Flowora — the one comparison section (see the
          const comment above BEFORE_STEPS for what this replaced). */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="font-display font-bold text-3xl text-center mb-12">Traditional Forms vs. {APP_NAME}</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-4 text-center">Traditional Forms</p>
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
            {/* Not "~30 seconds" for the whole chain — approval is a real
                human decision, not instant. The honest claim is that the
                form itself takes seconds, and everything after it fires
                automatically without someone re-keying it by hand. */}
            <p className="text-center text-xs text-primary font-semibold mt-3">Form: ~30 seconds. Then automatic.</p>
          </div>
        </div>
      </section>

      {/* Perfect for — INDUSTRIES already carries icon + department +
          one-line use case per entry, which is exactly "Common use
          cases" was showing a second time in a separate sub-section
          below this one; merged into this single grid instead of two. */}
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

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Simple, transparent pricing</h2>
          <p className="text-ink/50 mt-2">Start free. Upgrade when you need approval workflows and more responses.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => {
            const offer = p.key === "team" ? launchOffer : null;
            return (
              <div
                key={p.name}
                className={`rounded-card p-6 border ${p.highlighted ? "border-primary shadow-lg bg-white relative" : "border-border bg-white shadow-card"}`}
              >
                {offer ? (
                  <span className="absolute -top-3 left-6 flex items-center gap-1 bg-accent text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    🚀 Launch Offer · Most popular
                  </span>
                ) : (
                  p.highlighted && (
                    <span className="absolute -top-3 left-6 bg-accent text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      Most popular
                    </span>
                  )
                )}
                <h3 className="font-display font-semibold text-lg">{p.name}</h3>
                <p className="text-xs text-ink/50 mt-1 mb-4 h-8">{p.tagline}</p>
                {offer ? (
                  <div className="mb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-display font-bold">${offer.priceInMinorUnits / 100}</span>
                      <span className="text-sm text-ink/40">{p.period}</span>
                      <span className="text-sm text-ink/35 line-through">${offer.regularPriceInMinorUnits / 100}</span>
                    </div>
                    <p className="text-xs font-medium text-primary mt-1">Save 50% on your first payment</p>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-display font-bold">{p.price}</span>
                    <span className="text-sm text-ink/40">{p.period}</span>
                  </div>
                )}
                {offer && (
                  <p className="text-[11px] text-ink/40 mb-4">{offer.remaining} of {offer.limit} launch-offer spots left</p>
                )}
                <ul className={`space-y-2 mb-6 ${offer ? "mt-4" : "mt-5"}`}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-ink/70">
                      <Check size={14} className="text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {p.key === "team" && (
                  <a href="#features" className="block text-center text-xs text-primary hover:underline -mt-4 mb-4">
                    View all features →
                  </a>
                )}
                <Link
                  href={p.href}
                  className={`block text-center py-2.5 rounded-lg text-sm font-medium ${
                    p.highlighted ? "bg-primary text-white hover:bg-primary-dark" : "border border-border hover:bg-base"
                  }`}
                >
                  {offer ? "Claim Launch Offer" : p.cta}
                </Link>
                {p.key === "free" && <p className="text-[11px] text-ink/35 text-center mt-2">No credit card required</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Security & Reliability */}
      <section className="bg-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <ShieldCheck size={28} className="mx-auto mb-4 text-accent" />
          <h2 className="font-display font-bold text-3xl mb-2">Security & Reliability</h2>
          <p className="text-white/70 mb-10">Your business data deserves enterprise-grade protection.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            {SECURITY_POINTS.map((s) => (
              <div key={s.label} className="flex items-center gap-3 bg-white/10 rounded-lg py-3 px-4">
                <s.icon size={18} className="text-accent shrink-0" />
                <span className="text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-2xl mx-auto px-6 py-20">
        <h2 className="font-display font-bold text-3xl text-center mb-10">Frequently asked questions</h2>
        <div>
          {FAQS.map((f, i) => <FaqItem key={f.q} {...f} defaultOpen={i === 0} />)}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-white py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="font-display font-bold text-3xl mb-3">Stop managing work across five different tools</h2>
          <p className="text-white/70 mb-8">
            Build forms, automate approvals, manage leads, assign tasks, schedule meetings, and track everything —
            in one platform.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-6 py-3 rounded-lg bg-white text-primary font-medium hover:bg-white/90">
            Start Free <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-white/50 mt-4">No credit card required</p>
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
            <p className="text-xs text-ink/40">AI Forms that Move Work Forward.</p>
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
