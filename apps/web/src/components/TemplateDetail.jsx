import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Clock, Check, ArrowRight, Smartphone, ShieldCheck, FileText, Bell, CheckSquare, Bot, Search, PlayCircle, Mail, MessageCircle, Building2, Pencil, Palette, ListChecks, User, Wand2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, Badge } from "./ui";
import { APP_NAME } from "../lib/brand";
import Seo from "./Seo";
import NavBar from "./MarketingNavBar";
import TemplateFieldPreview from "./TemplateFieldPreview";
import TemplateCustomizeEditor from "./TemplateCustomizeEditor";
import TemplateLiveDemo from "./TemplateLiveDemo";

// Carries the visitor's customization (title/fields/accent color/logo)
// across the signup redirect — { key, name, fields, branding }. A bare
// "Use Template" click (no customization) stores just the key with the
// template's own defaults, so the post-signup auto-copy effect always
// reads the same shape either way.
const PENDING_TEMPLATE_KEY = "flowora_pending_template";

// Field count is a proxy for how long the template takes to review/adapt —
// not a real complexity score, but a reasonable, honest stand-in until
// there's real usage data. Kept in sync with TemplateGallery.jsx's version.
function difficultyFor(fieldCount) {
  if (fieldCount <= 6) return "Easy";
  if (fieldCount <= 9) return "Medium";
  return "Advanced";
}

// Color-codes how long a template is typically left live — not how long it
// takes to fill out (that's `difficulty`/estimatedSetupMinutes above).
const USAGE_DOT = { "One-time": "bg-emerald-500", "Short-term": "bg-amber-500", Ongoing: "bg-blue-500" };

// Generic, duration-based explanation (not unique per-template copy) —
// keeps this maintainable across 40 templates, same reasoning as
// BUSINESS_OUTCOMES being category-based rather than hand-written per key.
const USAGE_EXPLAINER = {
  "One-time": ["Built for a single event or campaign", "Typically closed or archived once it's over", "No need to keep it live long-term"],
  "Short-term": ["Used for a defined window — days to a few weeks", "Common for cycles like hiring, admissions, or onboarding", "Can be reopened for the next cycle"],
  Ongoing: ["Left running indefinitely, no end date", "Used continuously as part of day-to-day operations", "Always available for new submissions"],
};

// ~20 seconds per field is a common, conservative rule of thumb for short
// business forms (not a measured average from this app's own data) —
// stated as an estimate, not a guarantee.
function completionTimeFor(fieldCount) {
  const seconds = fieldCount * 20;
  if (seconds < 60) return "Under 1 minute";
  const minutes = Math.round(seconds / 60);
  return `~${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Shortcut chips near the search box — the handful of categories visitors
// browse most, not the full list (that's what the gallery's own filter
// row is for).
const QUICK_CATEGORIES = ["Sales", "HR", "Finance", "Support", "Healthcare"];

// Who this template's category is actually built for — mixes team-type and
// company-type examples so visitors can identify with it either way.
const PERFECT_FOR = {
  HR: ["HR Teams", "SMBs", "Remote Teams", "Corporate Offices"],
  Feedback: ["Customer Support Teams", "Product Teams", "SaaS Companies"],
  Sales: ["Sales Teams", "SMBs", "Marketing Agencies", "SaaS Companies", "Professional Services", "Consultants"],
  Marketing: ["Marketing Teams", "Event Organizers", "Agencies"],
  Services: ["Service Businesses", "Consultants", "SMBs"],
  Support: ["Support Teams", "IT Teams", "SaaS Companies"],
  Healthcare: ["Clinics", "Hospitals", "Healthcare Providers"],
  Finance: ["Finance Teams", "SMBs", "Corporate Offices"],
  "Real Estate": ["Real Estate Agents", "Property Managers", "Brokers"],
  Education: ["Schools", "Training Providers", "Educational Institutions"],
  IT: ["IT Teams", "SaaS Companies", "Corporate Offices"],
  Operations: ["Operations Teams", "Facilities Teams", "SMBs"],
  Procurement: ["Procurement Teams", "Finance Teams", "Corporate Offices"],
  Legal: ["Legal Teams", "Corporate Offices", "SMBs"],
  Events: ["Event Organizers", "Marketing Teams", "Agencies"],
  General: ["SMBs", "Teams of Any Size"],
};

// Concrete scenarios this template's category covers — distinct from
// PERFECT_FOR (who uses it) by focusing on the use case itself, so a
// visitor can match it to what they're trying to build right now.
const USE_CASES_FOR = {
  Sales: ["Website Contact Form", "Product Inquiry", "Demo Request", "Partnership Request", "Sales Lead Capture"],
  HR: ["Employee Time-Off Request", "New Hire Onboarding", "Internal HR Requests", "Exit/Offboarding Process"],
  Feedback: ["Post-Purchase Survey", "Customer Satisfaction Tracking", "Product Feedback Collection"],
  Marketing: ["Event Sign-Up", "Webinar Registration", "Email List Growth"],
  Services: ["Appointment Requests", "Consultation Booking", "Service Scheduling"],
  Support: ["Help Desk Intake", "Bug/Issue Reporting", "Internal IT Requests"],
  Healthcare: ["New Patient Intake", "Pre-Visit Paperwork", "Appointment Registration"],
  Finance: ["Expense Submission", "Purchase/Budget Requests", "Reimbursement Tracking"],
  "Real Estate": ["Buyer/Renter Inquiries", "Listing Interest Capture", "Property Viewing Requests"],
  Education: ["Course Feedback Collection", "Training Session Reviews"],
  IT: ["Software Access Requests", "Equipment Requests", "Internal IT Intake"],
  Operations: ["Facilities Maintenance", "Incident Reporting", "Internal Ops Requests"],
  Procurement: ["Vendor Onboarding", "Purchase Approvals", "Supplier Registration"],
  Legal: ["Contract Review Requests", "NDA Requests", "Internal Legal Intake"],
  Events: ["Speaker Applications", "Post-Event Feedback", "Conference Logistics"],
  General: ["General-Purpose Data Collection"],
};

// What business problem the template actually solves — shifts the pitch
// from "here are the fields" to the outcome a decision-maker cares about.
// Category-based (not per-template copy) to keep this maintainable across
// 20+ templates; the approval-specific lines only show when the template
// actually includes an approval step.
const BUSINESS_OUTCOMES = {
  HR: ["Reduces manual back-and-forth over email", "Centralizes records in one place", "Improves visibility for managers", "Provides an audit trail"],
  Feedback: ["Centralizes feedback instead of scattered emails", "Tracks sentiment over time", "Surfaces issues before they escalate"],
  Sales: ["Captures leads before they go cold", "Routes inquiries to the right owner automatically", "Keeps every inquiry in one system, not inboxes"],
  Marketing: ["Removes manual spreadsheet tracking", "Centralizes registrations/signups in one place", "Makes follow-up easy with structured data"],
  Services: ["Cuts down on scheduling back-and-forth", "Reduces no-shows with a clear confirmation trail", "Keeps requests from falling through the cracks"],
  Support: ["Structures reports instead of vague messages", "Routes issues to the right team automatically", "Creates a searchable history of past issues"],
  Healthcare: ["Speeds up front-desk intake", "Reduces paperwork errors", "Creates a consistent, structured patient record"],
  Finance: ["Reduces manual approval chasing", "Centralizes receipts and records", "Improves audit-readiness"],
  "Real Estate": ["Captures buyer/renter interest before it's lost", "Routes inquiries to the right agent", "Keeps a record of every inquiry"],
  Education: ["Centralizes feedback across sessions", "Tracks trends across courses/instructors", "Removes manual paper forms"],
  IT: ["Cuts down on Slack/email requests", "Routes access requests through proper approval", "Creates an auditable request history"],
  Operations: ["Nothing gets lost in a group chat", "Creates a searchable maintenance/incident history", "Speeds up response time"],
  Procurement: ["Reduces unapproved spending", "Centralizes vendor records", "Creates an audit trail for purchases"],
  Legal: ["Routes requests to legal automatically", "Reduces back-and-forth over email", "Creates a record of every request"],
  Events: ["Centralizes speaker/attendee data", "Removes manual spreadsheet tracking", "Captures feedback while it's fresh"],
  General: ["Removes manual tracking", "Centralizes submissions in one place", "Creates a record you can search later"],
};

function outcomeCopy(step) {
  const s = step.toLowerCase();
  if (s.includes("submit")) return "Visitor submits the form";
  if (s.includes("approval")) return "Approval request is created and routed to the right approver";
  if (s.includes("notif")) return "The right person is notified automatically";
  if (s.includes("task")) return "A task is created so nothing falls through the cracks";
  if (s.includes("timeline")) return "Activity is recorded on the record's timeline";
  if (s.includes("ai")) return "AI monitors it and flags anything overdue";
  if (s.includes("meeting")) return "A meeting is created on the calendar";
  if (s.includes("lead created")) return "A Lead is created in the CRM";
  return step;
}

// Rough, honest expectation-setting — not a measured SLA, just a reasonable
// illustrative figure per step type. System-side steps (notify/task/
// timeline/lead-create) are near-instant since they're automated; only a
// human-approval decision genuinely varies.
function timingFor(step) {
  const s = step.toLowerCase();
  if (s.includes("submit")) return "<1 sec";
  if (s.includes("lead created")) return "<1 sec";
  if (s.includes("approval") && !s.includes("request")) return "Depends on approver";
  if (s.includes("notif")) return "Instant";
  if (s.includes("timeline")) return "Instant";
  if (s.includes("task")) return "Automatic";
  if (s.includes("ai")) return "Automatic";
  return "Instant";
}

const FEATURE_ICON = { Form: FileText, Approval: ShieldCheck, Notifications: Bell, Tasks: CheckSquare, Timeline: Clock, "AI Center": Bot };

// What's actually created in the platform when this template is used —
// distinct from the process narrative above (nouns, not verbs). Only
// includes what's genuinely true today: a Lead is created automatically
// only when a Sales-category form has Lead capture turned on in Settings
// (an opt-in toggle, not automatic for every form). Contact/Company are
// NOT auto-created from a form response — that only happens through a
// separate, manual "Convert Lead" action. Each entity carries a
// `destination` (the real module it shows up in — verified against
// Layout.jsx's nav: "Tasks", "Timeline", "Responses" are real pages;
// "Approvals" and "Notifications" are real concepts without their own
// standalone nav page) as the primary badge, plus an optional `caveat`
// only where the honesty bar from earlier rounds requires one (Lead is
// opt-in, Contact/Company only exist after a manual Convert).
function createdEntities(template, features) {
  const entities = [{ icon: FileText, label: "Form Response", destination: "Responses", color: "text-slate-600 bg-slate-100" }];
  const isLeadGen = template.tags?.includes("lead") || template.tags?.includes("crm");
  if (isLeadGen) {
    entities.push({ icon: Building2, label: "Lead", destination: "CRM", caveat: "Optional", color: "text-emerald-600 bg-emerald-100" });
    entities.push({ icon: User, label: "Contact", destination: "CRM", caveat: "via Convert", color: "text-emerald-600 bg-emerald-50" });
    entities.push({ icon: Building2, label: "Company", destination: "CRM", caveat: "via Convert", color: "text-emerald-600 bg-emerald-50" });
  }
  if (features.find((f) => f.label === "Approval")?.included) entities.push({ icon: ShieldCheck, label: "Approval Request", destination: "Approvals", color: "text-amber-600 bg-amber-100" });
  if (features.find((f) => f.label === "Tasks")?.included) entities.push({ icon: CheckSquare, label: "Task", destination: "Tasks", color: "text-blue-600 bg-blue-100" });
  if (features.find((f) => f.label === "Timeline")?.included) entities.push({ icon: Clock, label: "Timeline Entry", destination: "Timeline", color: "text-purple-600 bg-purple-100" });
  if (features.find((f) => f.label === "Notifications")?.included) entities.push({ icon: Bell, label: "Notification", destination: "Notifications", color: "text-orange-600 bg-orange-100" });
  return entities;
}

// The person/thing that kicks off the process — prepended to "What Happens
// After Submission" so the flow reads as a business process ("Employee →
// Approval → HR Notification") not just a bare list of system steps.
const ACTOR_FOR = {
  HR: "Employee",
  Finance: "Employee",
  Support: "Customer",
  Healthcare: "Patient",
  Services: "Customer",
  Sales: "Website Visitor",
  Marketing: "Attendee",
  "Real Estate": "Prospect",
  Education: "Participant",
  Feedback: "Customer",
  IT: "Employee",
  Operations: "Employee",
  Procurement: "Requester",
  Legal: "Employee",
  Events: "Attendee",
  General: "Respondent",
};

function includedFeatures(workflowSteps = []) {
  const steps = workflowSteps.join(" ").toLowerCase();
  return [
    { label: "Form", included: true },
    { label: "Approval", included: steps.includes("approval") },
    { label: "Notifications", included: steps.includes("notif") },
    { label: "Tasks", included: steps.includes("task") },
    { label: "Timeline", included: steps.includes("timeline") },
    { label: "AI Center", included: steps.includes("ai ") || steps.endsWith("ai") },
  ];
}

const FAQS = [
  { q: "Can I customize this template?", a: "Yes. After creating a free account, you can add, remove, and relabel fields, set branding, and configure approval workflows in the visual builder." },
  { q: "Do I need to code?", a: `No. All ${APP_NAME} templates are no-code and editable with the visual form builder.` },
  { q: "Can I share this form publicly?", a: "Yes. Once published, you get a shareable public link for this form — no account needed for respondents to fill it out." },
  { q: "Can I embed it?", a: "There's no dedicated embed snippet yet — you get a public link, which you can link to from your website or emails." },
  { q: "Can I export responses?", a: "Yes. Every form's responses can be exported to CSV or Excel at any time." },
  { q: "Can I receive email notifications?", a: "If the template includes an approval step, approvers are notified automatically by email. More notification rules can be configured after you sign up." },
  { q: "Can I connect it to my CRM?", a: `Yes. ${APP_NAME}'s CRM is built in — Sales-category forms can optionally turn each submission into a Lead automatically, right alongside your existing pipeline.` },
  { q: "Can I collect files?", a: "Yes. File upload is a standard field type — attach it to any template, including this one, from the builder." },
];

// Only the "Can I add approvals?" answer depends on the specific template
// (whether it already ships with an approval step), so it's built per-page
// rather than hardcoded into the shared FAQS list above.
function approvalFaq(approvalIncluded) {
  return {
    q: "Can I add approvals?",
    a: approvalIncluded
      ? "This template already comes with an approval step pre-configured — you can adjust who approves it after you sign up."
      : "This template doesn't include an approval step by default, but any template can have one added from the builder after you sign up.",
  };
}

export default function TemplateDetail({ template, related }) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [customizeState, setCustomizeState] = useState(() => ({ title: template.name, fields: template.fields, accentColor: "", logoDataUrl: "" }));
  const [stickyVisible, setStickyVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [flowVisible, setFlowVisible] = useState(false);
  const heroCtaRef = useRef(null);
  const flowRef = useRef(null);
  const firedRef = useRef(false);

  const useTemplate = async (payload) => {
    setError("");
    setCreating(true);
    try {
      const { data } = await api.post("/forms/from-template", {
        templateKey: template.key,
        name: payload?.name || template.name,
        fields: payload?.fields,
        branding: payload?.branding,
      });
      sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
      router.push(`/app/forms/${data.id}/build`);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't create that form. Please try again.");
      setCreating(false);
    }
  };

  const goToSignup = (payload) => {
    sessionStorage.setItem(PENDING_TEMPLATE_KEY, JSON.stringify({ key: template.key, ...payload }));
    const redirect = encodeURIComponent(`/templates/${template.key}?useTemplate=1`);
    router.push(`/signup?redirect=${redirect}`);
  };

  const handleUseTemplateClick = () => {
    if (user) useTemplate({ name: template.name });
    else goToSignup({ name: template.name });
  };

  const handleCustomizeSignUp = () => {
    const payload = {
      name: customizeState.title,
      fields: customizeState.fields,
      branding: customizeState.accentColor || customizeState.logoDataUrl
        ? { accentColor: customizeState.accentColor, logoDataUrl: customizeState.logoDataUrl }
        : undefined,
    };
    if (user) useTemplate(payload);
    else goToSignup(payload);
  };

  // Landed back here (from signup/login) with ?useTemplate=1 — auto-copy
  // the template (with any customization the visitor made) into the
  // now-authenticated visitor's workspace with no further click.
  useEffect(() => {
    if (!router.isReady || !ready || firedRef.current) return;
    if (user && router.query.useTemplate === "1") {
      let pending = null;
      try {
        pending = JSON.parse(sessionStorage.getItem(PENDING_TEMPLATE_KEY) || "null");
      } catch {
        pending = null;
      }
      if (pending?.key === template.key) {
        firedRef.current = true;
        useTemplate(pending);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, ready, user, router.query.useTemplate]);

  // Sticky bottom CTA appears once the hero's own "Use Template" button
  // scrolls out of view, so the primary action stays reachable.
  useEffect(() => {
    if (!heroCtaRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting), { threshold: 0 });
    observer.observe(heroCtaRef.current);
    return () => observer.disconnect();
  }, []);

  // "What Happens After Submission" fades each step in as it scrolls into
  // view (staggered, once) instead of rendering fully-formed — a subtle
  // touch that makes the flow read as something happening, not static text.
  useEffect(() => {
    if (!flowRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFlowVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(flowRef.current);
    return () => observer.disconnect();
  }, []);

  const runSearch = (e) => {
    e.preventDefault();
    router.push(`/templates?q=${encodeURIComponent(search)}`);
  };

  const difficulty = difficultyFor(template.fields.length);
  const features = includedFeatures(template.workflowSteps);
  const approvalIncluded = features.find((f) => f.label === "Approval")?.included;
  const perfectFor = PERFECT_FOR[template.category] || PERFECT_FOR.General;
  const useCases = USE_CASES_FOR[template.category] || USE_CASES_FOR.General;
  const businessOutcomes = BUSINESS_OUTCOMES[template.category] || BUSINESS_OUTCOMES.General;

  const whatYoullGet = [
    "Ready-to-use form",
    approvalIncluded && "Approval configuration",
    features.find((f) => f.label === "Notifications")?.included && "Email notifications",
    features.find((f) => f.label === "Timeline")?.included && "Activity timeline",
    features.find((f) => f.label === "AI Center")?.included && "AI monitoring",
    "Mobile responsive",
  ].filter(Boolean);

  const whyThisTemplate = [
    "Ready-to-use form — no coding required",
    approvalIncluded && "Built-in approval process",
    approvalIncluded && "Tracks approval history",
    "Mobile-friendly, works on any device",
    features.find((f) => f.label === "Tasks")?.included && "Integrates with Flowora Work and AI Center",
  ].filter(Boolean);

  const faqs = [...FAQS, approvalFaq(approvalIncluded)];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${template.name} — ${APP_NAME}`,
    applicationCategory: "BusinessApplication",
    description: template.tagline || template.description,
  };

  return (
    <div className="font-body text-ink pb-20">
      <Seo
        title={template.name}
        description={template.tagline || template.description}
        keywords={template.tags}
        path={`/templates/${template.key}`}
        jsonLd={[appJsonLd, faqJsonLd]}
      />
      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-1 text-sm text-ink/50">
            <Link href="/templates" className="hover:text-ink">Templates</Link>
            <span>/</span>
            <Link href={`/templates?category=${encodeURIComponent(template.category)}`} className="hover:text-ink">
              {template.category} Templates
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden sm:flex items-center gap-1.5">
              {QUICK_CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={`/templates?category=${encodeURIComponent(c)}`}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    c === template.category ? "bg-primary text-white border-primary" : "border-border text-ink/60 hover:bg-base"
                  }`}
                >
                  {c}
                </Link>
              ))}
            </div>
            <form onSubmit={runSearch} className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="h-9 pl-8 pr-3 rounded-lg border border-border text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </form>
          </div>
        </div>

        {/* Hero */}
        <h1 className="font-display font-bold text-3xl text-ink">{template.name} Template</h1>
        <div className="flex items-center gap-2 flex-wrap mt-3 mb-4">
          <Badge>{template.category}</Badge>
          <span className="text-xs px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">{difficulty}</span>
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">
            <Clock size={11} /> ~{template.estimatedSetupMinutes} min setup
          </span>
          <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${USAGE_DOT[template.usageDuration]}`} aria-hidden /> {template.usageDuration}
          </span>
        </div>

        <p className="text-lg text-ink/70 mb-4 max-w-2xl">{template.tagline || template.description}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/50 mb-8">
          <span className="flex items-center gap-1"><Check size={13} className="text-primary" /> Ready in {template.estimatedSetupMinutes} minutes</span>
          <span className="flex items-center gap-1"><Check size={13} className="text-primary" /> No coding</span>
          <span className="flex items-center gap-1"><Check size={13} className="text-primary" /> Free template</span>
          <span className="flex items-center gap-1"><Check size={13} className="text-primary" /> Mobile-friendly</span>
        </div>

        {error && <p className="text-sm text-danger mb-4">{error}</p>}
        <p className="text-xs font-medium text-ink/40 mb-2">Choose how you'd like to explore this template</p>
        {/* Hierarchy: Live Demo and Customize Free are both secondary
            (outlined) — "try it" / "adapt it" — while Use Template Free is
            the one solid, wider, primary-colored button, since it's the
            action that actually creates an account. */}
        <div ref={heroCtaRef} className="flex flex-col sm:flex-row gap-3 mb-10">
          {template.fields.length > 0 && (
            <button
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border font-medium text-ink/70 hover:bg-base"
            >
              <PlayCircle size={16} /> Live Demo
            </button>
          )}
          {template.fields.length > 0 && (
            <button
              onClick={() => setCustomizing((c) => !c)}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium border ${
                customizing ? "bg-primary/10 text-primary border-primary" : "border-border text-ink/70 hover:bg-base"
              }`}
            >
              <Wand2 size={16} /> {customizing ? "Editing…" : "Customize Free"}
            </button>
          )}
          <button
            onClick={handleUseTemplateClick}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark disabled:opacity-60"
          >
            {creating ? "Setting up your form…" : <>Use Template Free <ArrowRight size={16} /></>}
          </button>
        </div>

        {/* What You'll Get */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Included When You Use This Template</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {whatYoullGet.map((line) => (
              <li key={line} className="flex items-center gap-2 text-sm text-ink/70">
                <Check size={14} className="text-primary shrink-0" /> {line}
              </li>
            ))}
          </ul>
        </Card>

        {/* Two-column: interactive preview stays the focal point on the
            left; everything explaining business value stays visible in a
            sticky right rail as the visitor scrolls, instead of a long
            single-column scroll (mirrors the pattern on SaaS pricing/docs
            pages). Collapses to a single stacked column below `lg`. */}
        <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-6 mb-8 items-start">
          {/* Template Preview / temporary Customize editor */}
          <Card id="preview" className="p-6">
            {customizing ? (
              <>
                <h2 className="font-display font-semibold text-lg mb-1">Customize Template</h2>
                <p className="text-xs text-ink/40 mb-4">Try it your way — nothing is saved until you sign up.</p>
                <TemplateCustomizeEditor
                  template={template}
                  state={customizeState}
                  onChange={setCustomizeState}
                  onSignUp={handleCustomizeSignUp}
                  signingUp={creating}
                />
              </>
            ) : (
              <>
                <h2 className="font-display font-semibold text-lg mb-1">Template Preview</h2>
                <p className="text-xs text-ink/40 mb-4">This is what respondents will see.</p>
                <TemplateFieldPreview fields={template.fields} layoutColumns={template.layoutColumns} />
                <p className="text-xs text-ink/40 mt-4 text-center">
                  This is an interactive preview. <button onClick={() => setDemoOpen(true)} className="text-primary font-medium hover:underline">Try the live demo</button>,{" "}
                  <button onClick={() => setCustomizing(true)} className="text-primary font-medium hover:underline">customize it</button>, or create a free account to publish this template.
                </p>
              </>
            )}
          </Card>

          <div className="lg:sticky lg:top-6 space-y-6">
            {/* What Happens After Submission */}
            <div ref={flowRef}><Card className="p-6">
              <h2 className="font-display font-semibold text-lg mb-4">What Happens After Submission</h2>
              {template.workflowSteps?.length > 0 ? (
                (() => {
                  const nodes = [{ label: ACTOR_FOR[template.category] || ACTOR_FOR.General, isActor: true }, ...template.workflowSteps.map((step) => ({ step }))];
                  return (
                    <ol className="relative">
                      {/* Continuous connecting line behind every node — a
                          single element, not per-row arrows, so it reads as
                          one timeline rather than stacked boxes. */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
                      {nodes.map((n, i) => (
                        <li
                          key={i}
                          className="relative flex items-start gap-3 pb-5 last:pb-0 transition-all duration-500"
                          style={{ transitionDelay: `${i * 150}ms`, opacity: flowVisible ? 1 : 0, transform: flowVisible ? "translateX(0)" : "translateX(-6px)" }}
                        >
                          <span
                            className={`relative z-10 w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${
                              n.isActor ? "bg-ink/20" : flowVisible ? "bg-primary" : "bg-border"
                            }`}
                            aria-hidden
                          >
                            {!n.isActor && flowVisible && <Check size={9} className="text-white" strokeWidth={3} />}
                          </span>
                          {n.isActor ? (
                            <span className="text-sm font-medium text-ink/60">{n.label}</span>
                          ) : (
                            <div className="flex-1 flex items-baseline justify-between gap-3">
                              <div>
                                <span className="text-sm font-medium text-ink">{n.step}</span>
                                <span className="block text-xs text-ink/45 mt-0.5">{outcomeCopy(n.step)}</span>
                              </div>
                              <span className="text-[11px] text-ink/40 shrink-0">{timingFor(n.step)}</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  );
                })()
              ) : (
                <p className="text-sm text-ink/40">Add your own automation in the builder — approvals, notifications, and more.</p>
              )}
            </Card></div>

            {/* AI Center — only for templates whose workflow includes it,
                and scoped to what the rule engine genuinely does today
                (services/rules/*.js): flagging overdue approvals and
                rejection spikes. Not duplicate-detection, spam-detection,
                or summarization — those aren't built yet, so they're not
                claimed here. */}
            {features.find((f) => f.label === "AI Center")?.included && (
              <Card className="p-6">
                <h2 className="font-display font-semibold text-lg mb-1 flex items-center gap-2"><Bot size={16} className="text-primary" /> AI Center</h2>
                <p className="text-xs text-ink/40 mb-4">Flowora AI watches this template's approvals in the background.</p>
                <ul className="space-y-1.5">
                  {["Flags approvals stuck pending for 48+ hours", "Detects unusual spikes in approval rejections"].map((line) => (
                    <li key={line} className="flex items-center gap-2 text-sm text-ink/70">
                      <Check size={14} className="text-primary shrink-0" /> {line}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Included Features */}
            <Card className="p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Included Features</h2>
              <div className="flex flex-wrap gap-2">
                {features.map((f) => {
                  const Icon = FEATURE_ICON[f.label];
                  return (
                    <span
                      key={f.label}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                        f.included ? "bg-primary/8 text-primary" : "bg-base text-ink/30 line-through"
                      }`}
                    >
                      {Icon && <Icon size={13} />}
                      {f.label}
                    </span>
                  );
                })}
              </div>
            </Card>

            {/* Why {category} Teams Use This Template (Business Benefits) */}
            <Card className="p-6 bg-emerald-50/40">
              <h2 className="font-display font-semibold text-lg mb-4">Why {template.category} Teams Use This Template</h2>
              <ul className="space-y-2">
                {businessOutcomes.map((line) => (
                  <li key={line} className="flex items-center gap-2 text-sm text-ink/70">
                    <Check size={14} className="text-primary shrink-0" /> {line}
                  </li>
                ))}
              </ul>
            </Card>

            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleUseTemplateClick}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark disabled:opacity-60"
            >
              {creating ? "Setting up your form…" : <>Use Template Free <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>

        {/* Flowora Creates — moved below the two-column grid (was in the
            sticky right rail) so the grid's height is driven by the
            shorter, tighter set of right-column cards instead of stacking
            5 cards against a single form preview on the left. */}
        <Card className="p-6 mb-8 bg-sky-50/40">
          <h2 className="font-display font-semibold text-lg mb-1">Flowora Automatically Creates</h2>
          <p className="text-xs text-ink/40 mb-4">This isn't just a form builder — here's what shows up elsewhere in your workspace.</p>
          {/* auto-fit (not a fixed column count) so a leftover item on the
              last row doesn't sit alone against empty space — the row
              redistributes to however many items actually fit per width. */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            {createdEntities(template, features).map((e) => (
              <div key={e.label} className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center ${e.color}`}>
                  <e.icon size={16} />
                </span>
                <span className="text-xs font-medium text-ink/70">{e.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                  {e.destination}
                </span>
                {e.caveat && <span className="text-[9px] text-ink/35">{e.caveat}</span>}
              </div>
            ))}
          </div>
        </Card>

        {/* Customize This Template — only real, shipped builder capabilities.
            No "email notifications" claim: the only real notification
            behavior is approvers getting emailed automatically when an
            approval step exists — that's a side effect of "Approval
            rules", not a separately configurable setting, so it's not
            listed as its own line. Same reasoning ruled out "email
            templates"/"confirmation message" earlier — no editing UI
            exists for it. */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Customize This Template</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {[
              { icon: Pencil, label: "Add & remove fields" },
              { icon: Palette, label: "Change branding" },
              { icon: ListChecks, label: "Configure approvals" },
              { icon: ListChecks, label: "Conditional logic" },
            ].map(({ icon: Icon, label }, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink/70">
                <Icon size={14} className="text-primary shrink-0" /> {label}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setCustomizing(true);
              document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark"
          >
            <Wand2 size={14} /> Customize Free
          </button>
        </Card>

        {/* Works With */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Works With</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Mail, label: "Email" },
              { icon: MessageCircle, label: "WhatsApp" },
              { icon: Building2, label: "Built-in CRM" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-base text-ink/70">
                <Icon size={13} /> {label}
              </span>
            ))}
          </div>
        </Card>

        {/* Template Information */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Template Information</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
            <div><dt className="text-ink/40">Category</dt><dd className="font-medium">{template.category}</dd></div>
            <div><dt className="text-ink/40">Difficulty</dt><dd className="font-medium">{difficulty}</dd></div>
            <div><dt className="text-ink/40">Estimated Setup</dt><dd className="font-medium">{template.estimatedSetupMinutes} minutes</dd></div>
            <div><dt className="text-ink/40">Avg. Completion Time</dt><dd className="font-medium">{completionTimeFor(template.fields.length)}</dd></div>
            <div><dt className="text-ink/40">Layout</dt><dd className="font-medium">{template.layoutColumns} Column{template.layoutColumns === 1 ? "" : "s"}</dd></div>
            <div><dt className="text-ink/40">Typical Usage</dt><dd className="font-medium flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${USAGE_DOT[template.usageDuration]}`} aria-hidden /> {template.usageDuration}</dd></div>
            <div><dt className="text-ink/40 flex items-center gap-1"><Smartphone size={12} /> Mobile Ready</dt><dd className="font-medium">Yes</dd></div>
            <div><dt className="text-ink/40 flex items-center gap-1"><ShieldCheck size={12} /> Approval Included</dt><dd className="font-medium">{approvalIncluded ? "Yes" : "No"}</dd></div>
          </dl>
        </Card>

        {/* Typical Usage */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${USAGE_DOT[template.usageDuration]}`} aria-hidden />
            Typical Usage — {template.usageDuration}
          </h2>
          <ul className="space-y-2 mt-3">
            {USAGE_EXPLAINER[template.usageDuration].map((line) => (
              <li key={line} className="flex items-center gap-2 text-sm text-ink/70">
                <Check size={14} className="text-primary shrink-0" /> {line}
              </li>
            ))}
          </ul>
        </Card>

        {/* Works Great For */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Works Great For</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {useCases.map((u) => (
              <li key={u} className="flex items-center gap-2 text-sm text-ink/70">
                <Check size={14} className="text-primary shrink-0" /> {u}
              </li>
            ))}
          </ul>
        </Card>

        {/* Who Uses This */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Who Uses This</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {perfectFor.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-ink/70">
                <Check size={14} className="text-primary shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </Card>

        {/* Why this template */}
        <Card className="p-6 mb-8">
          <h2 className="font-display font-semibold text-lg mb-4">Why This Template?</h2>
          <ul className="space-y-2">
            {whyThisTemplate.map((line) => (
              <li key={line} className="flex items-center gap-2 text-sm text-ink/70">
                <Check size={14} className="text-primary shrink-0" /> {line}
              </li>
            ))}
          </ul>
        </Card>

        {/* Related Templates */}
        {related.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display font-semibold text-xl mb-4">Related Templates</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((t) => (
                <Link
                  key={t.key}
                  href={`/templates/${t.key}`}
                  className="block p-4 rounded-lg border border-border hover:shadow-card transition-shadow"
                >
                  <p className="font-medium text-sm text-ink">{t.name}</p>
                  <p className="text-xs text-ink/40 mt-1">{t.category}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div>
          <h2 className="font-display font-semibold text-xl mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details key={f.q} className="p-4 rounded-lg border border-border group" open={i === 0}>
                <summary className="cursor-pointer select-none font-medium text-sm text-ink list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-ink/30 group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="text-sm text-ink/60 mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      {stickyVisible && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,.06)]">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-sm text-ink truncate">{template.name} Template</p>
              <p className="text-xs text-ink/40">Ready in {template.estimatedSetupMinutes} minutes</p>
            </div>
            <button
              onClick={handleUseTemplateClick}
              disabled={creating}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-dark disabled:opacity-60"
            >
              Use Template Free <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {demoOpen && (
        <TemplateLiveDemo
          template={template}
          onClose={() => setDemoOpen(false)}
          onUseTemplate={() => {
            setDemoOpen(false);
            handleUseTemplateClick();
          }}
        />
      )}
    </div>
  );
}
