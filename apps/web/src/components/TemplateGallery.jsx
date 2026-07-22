import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Search, Clock, ArrowRight, Columns3 } from "lucide-react";
import { Card, Badge } from "./ui";
import { APP_NAME } from "../lib/brand";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import Seo from "./Seo";
import NavBar from "./MarketingNavBar";

const SORTS = [
  { value: "popular", label: "Popular" },
  { value: "new", label: "Recently Added" },
];

// Same key/shape TemplateDetail.jsx uses for its post-signup auto-copy
// effect — reused here so a signup started from the gallery card completes
// the same way a signup started from the detail page does.
const PENDING_TEMPLATE_KEY = "flowora_pending_template";

// Field count is a proxy for how long the template takes to review/adapt —
// not a real complexity score, but a reasonable, honest stand-in until
// there's real usage data. Kept in sync with TemplateDetail.jsx's version.
function difficultyFor(fieldCount) {
  if (fieldCount <= 6) return "Easy";
  if (fieldCount <= 9) return "Medium";
  return "Advanced";
}

// Kept in sync with TemplateDetail.jsx's version.
const USAGE_DOT = { "One-time": "bg-emerald-500", "Short-term": "bg-amber-500", Ongoing: "bg-blue-500" };

function TemplateCard({ template }) {
  const difficulty = difficultyFor(template.fieldCount);
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  // "Use Template" acts immediately instead of just navigating to the same
  // page "Preview" goes to (that was the bug: both buttons landed on the
  // detail page, so a click on "Use Template" did nothing visible). Logged
  // in visitors skip the detail page entirely; anonymous visitors go
  // through signup and land back on the detail page only long enough for
  // its existing auto-copy effect to fire and redirect into the builder.
  const handleUseTemplate = async () => {
    if (!user) {
      // Same { key, name } shape TemplateDetail.jsx's own auto-copy effect
      // expects (see its `useTemplate`/`goToSignup`) — a bare string here
      // would fail that page's JSON.parse and silently no-op the copy.
      sessionStorage.setItem(PENDING_TEMPLATE_KEY, JSON.stringify({ key: template.key, name: template.name }));
      const redirect = encodeURIComponent(`/templates/${template.key}?useTemplate=1`);
      router.push(`/signup?redirect=${redirect}`);
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post("/forms/from-template", { templateKey: template.key, name: template.name });
      router.push(`/app/forms/${data.id}/build`);
    } catch {
      // Falls back to the detail page, which shows a real error message
      // and lets them retry — better than failing silently on the card.
      router.push(`/templates/${template.key}`);
    }
  };

  return (
    <Card className="p-5 flex flex-col h-full" style={{ borderColor: "#E7EAF0", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display font-semibold text-[16px] text-ink leading-snug">{template.name}</h3>
        <Badge>{template.category}</Badge>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">{difficulty}</span>
        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">
          <Clock size={10} /> ~{template.estimatedSetupMinutes} min
        </span>
        {template.layoutColumns > 1 && (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">
            <Columns3 size={10} /> {template.layoutColumns}-Col
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-base text-ink/60 font-medium">
          <span className={`w-1.5 h-1.5 rounded-full ${USAGE_DOT[template.usageDuration]}`} aria-hidden /> {template.usageDuration}
        </span>
      </div>
      <p className="text-sm text-ink/60 flex-1">{template.description}</p>
      {template.workflowSteps?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {template.workflowSteps.slice(0, 3).map((step) => (
            <span key={step} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium">
              {step}
            </span>
          ))}
          {template.workflowSteps.length > 3 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-base text-ink/40">+{template.workflowSteps.length - 3} more</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
        <Link
          href={`/templates/${template.key}`}
          className="flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium text-ink/70 border border-border hover:bg-base"
        >
          Preview
        </Link>
        <button
          onClick={handleUseTemplate}
          disabled={creating}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {creating ? "Setting up…" : <>Use Template <ArrowRight size={14} /></>}
        </button>
      </div>
    </Card>
  );
}

export default function TemplateGallery({ templates }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("popular");
  const router = useRouter();

  // Supports deep links like /templates?category=HR&q=leave — used by the
  // template detail page's "← Back to HR Templates" link and mini search.
  useEffect(() => {
    if (!router.isReady) return;
    if (typeof router.query.category === "string") setCategory(router.query.category);
    if (typeof router.query.q === "string") setSearch(router.query.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const categories = useMemo(() => ["All", ...new Set(templates.map((t) => t.category))].sort((a, b) => (a === "All" ? -1 : a.localeCompare(b))), [templates]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = templates.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.industry?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    });
    list = [...list].sort((a, b) => (sort === "popular" ? b.popularity - a.popularity : templates.indexOf(b) - templates.indexOf(a)));
    return list;
  }, [templates, search, category, sort]);

  return (
    <div className="font-body text-ink">
      <Seo
        title="Form Templates"
        description={`Browse ${templates.length}+ free, ready-to-use form templates for HR, Sales, CRM, Finance, and more — with approval workflows and automation built in.`}
        path="/templates"
      />
      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink">Template Marketplace</h1>
          <p className="mt-3 text-ink/60 text-lg">
            Start from a ready-made form with approvals, notifications, and tasks already wired in — no {APP_NAME} account needed to browse.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
            <input
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-border text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search templates — leave, expense, crm, hr, patient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-11 px-3 rounded-lg border border-border text-[15px] sm:w-48"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                category === c ? "bg-primary text-white border-primary" : "border-border text-ink/60 hover:bg-base"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="text-center text-ink/40 py-16">No templates match "{search}". Try a different search or category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((t) => <TemplateCard key={t.key} template={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
