import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users2,
  Contact,
  Building2,
  Target,
  Activity,
  ListChecks,
  MessageCircle,
  Mail,
  FileText,
  BarChart3,
  ClipboardList,
  TrendingUp,
  Sparkles,
  CalendarDays,
  History,
  UserCog,
  Users,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Eye,
  LogOut,
  ShieldCheck,
  UserCheck,
  Menu,
  X,
  AlertTriangle,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Inbox,
  UploadCloud,
  Command,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { APP_CATALOG } from "../lib/appCatalog";
import useLiveCollection from "../lib/useLiveCollection";
import usePlatformFeatures from "../lib/usePlatformFeatures";
import { APP_NAME } from "../lib/brand";
import { limitsFor } from "../lib/plans";

// Each item's `module` key maps to settings.modules (see routes/settings.js)
// — omit it (like Admin Portal / Settings) to always show it regardless of
// module toggles, since those are the controls used to manage the toggles.
const NAV_SECTIONS = [
  {
    label: "Home",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" }],
  },
  {
    label: "CRM",
    items: [
      { to: "/app/leads", label: "Leads", icon: Users2, module: "leads" },
      { to: "/app/contacts", label: "Contacts", icon: Contact, module: "contacts" },
      { to: "/app/companies", label: "Companies", icon: Building2, module: "companies" },
      { to: "/app/deals", label: "Deals", icon: Target, module: "deals" },
    ],
  },
  {
    label: "Work",
    items: [
      { to: "/app/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
      { to: "/app/meetings", label: "Meetings", icon: CalendarDays, module: "tasks" },
      { to: "/app/activities", label: "Activities", icon: Activity, module: "activities" },
      // WhatsApp/Email don't have their own named section in the target
      // structure — folded in here rather than dropped from the nav.
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle, module: "whatsapp" },
      { to: "/app/email", label: "Email", icon: Mail, module: "email" },
      // Timeline intentionally dropped from the nav (still reachable by
      // direct URL) — Activities is meant to be the one place for "what
      // happened," per the redesign; it doesn't yet show the same
      // auto-generated cross-entity event feed Timeline does, so nothing
      // was actually lost from Activities to compensate, just removed
      // from here.
    ],
  },
  {
    // Forms/Add New are merged into this section below (they're dynamic —
    // driven by the enabled Apps catalog, not this static list) — Templates
    // is the one static item that belongs here.
    label: "Forms",
    items: [{ to: "/app/templates", label: "Templates", icon: FileText, module: "templates" }],
  },
  {
    label: "AI",
    items: [{ to: "/app/ai-center", label: "AI Center", icon: Sparkles, minPlan: "growth" }],
  },
  {
    label: "Analytics",
    items: [
      { to: "/app/reports", label: "Sales Reports", icon: ClipboardList, module: "reports" },
      { to: "/app/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      { to: "/app/performance", label: "Performance", icon: TrendingUp, module: "performance" },
    ],
  },
  {
    // Order matters here (per the spec): Users (business directory) before
    // Team Access (real workspace members), then Settings, then Feedback.
    label: "Admin",
    items: [
      { to: "/app/users", label: "Users", icon: UserCog, module: "users" },
      { to: "/app/team", label: "Team Access", icon: UserCheck, ownerOnly: true },
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/feedback", label: "Feedback & Support", icon: LifeBuoy, ownerOnly: true },
    ],
  },
  {
    // Master-admin-only internals (managing the whole platform, not one
    // tenant's workspace) — kept out of Admin entirely so a regular
    // customer's account owner never sees it, not even folded in.
    label: "Platform",
    items: [
      { to: "/app/teams", label: "Teams", icon: Users, module: "teams", adminOnly: true },
      { to: "/app/apps", label: "Admin Portal", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

// Every target here reads `?create=1` on mount and opens its own Add
// modal (same pattern as Users.jsx's `?add=1`, wired per-page rather than
// centralized, since each page already owns its own create-modal state).
// Grouped to match the sidebar's own CRM/Work/Forms sections — and to
// front-load Flowora's actual differentiators (AI form generation,
// document import) as real menu entries, not just "New Form" then make
// the user pick again on the next page.
const CREATE_GROUPS = [
  {
    label: "CRM",
    items: [
      { label: "Lead", to: "/app/leads?create=1", icon: Users2, module: "leads" },
      { label: "Contact", to: "/app/contacts?create=1", icon: Contact, module: "contacts" },
      { label: "Company", to: "/app/companies?create=1", icon: Building2, module: "companies" },
      { label: "Deal", to: "/app/deals?create=1", icon: Target, module: "deals" },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Task", to: "/app/tasks?create=1", icon: ListChecks, module: "tasks" },
      { label: "Meeting", to: "/app/meetings?create=1", icon: CalendarDays, module: "tasks" },
    ],
  },
  {
    // Every one of these lands on /app/forms/new, which already surfaces
    // Generate-with-AI, Blank/Templates, and Import (one file picker
    // handles PDF/Word/image, plus a Google Form URL field) together — see
    // Forms.jsx's own NewFormMenu for the same reasoning. Distinct entries
    // here anyway so the menu itself demonstrates the AI/import
    // capabilities instead of hiding them behind a single "Form" link.
    label: "Forms",
    items: [
      { label: "Blank Form", to: "/app/forms/new", icon: FileText },
      { label: "AI Form", to: "/app/forms/new", icon: Sparkles },
      { label: "Import PDF", to: "/app/forms/new", icon: UploadCloud },
      { label: "Import Word", to: "/app/forms/new", icon: UploadCloud },
      { label: "Import Google Form", to: "/app/forms/new", icon: UploadCloud },
    ],
  },
];

// Global "+ Create" — reaches any module's create action from wherever you
// currently are, alongside (not replacing) each page's own contextual Add
// button for someone already working in that module.
function CreateMenu({ isModuleOn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  const groups = CREATE_GROUPS.map((g) => ({ ...g, items: g.items.filter((a) => isModuleOn(a.module)) })).filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-primary-dark"
      >
        <Plus size={15} /> <span className="hidden sm:inline">Create</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-border rounded-lg shadow-card p-1.5 z-30">
          {groups.map((g, i) => (
            <div key={g.label} className={i > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
              <p className="px-2.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink/35">{g.label}</p>
              {g.items.map((a) => (
                <Link
                  key={a.label}
                  href={a.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm text-left text-ink/70 hover:bg-base rounded-md"
                >
                  <a.icon size={14} /> {a.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-1 pt-1 border-t border-border">
            <Link
              href="/app/templates"
              onClick={() => setOpen(false)}
              className="flex items-center w-full px-2.5 py-2 text-sm text-left text-ink/50 hover:bg-base hover:text-ink/70 rounded-md"
            >
              Templates…
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const SEARCH_CATEGORY_META = {
  leads: { label: "Leads", icon: Users2 },
  contacts: { label: "Contacts", icon: Contact },
  companies: { label: "Companies", icon: Building2 },
  deals: { label: "Deals", icon: Target },
  tasks: { label: "Tasks", icon: ListChecks },
  meetings: { label: "Meetings", icon: CalendarDays },
  forms: { label: "Forms", icon: FileText },
};

// Static destinations for the ⌘K palette — not live /api/search results
// (those are records; these are pages), shown alongside them so "go to AI
// Center" works the same way "find lead ABC" does, with nothing typed yet.
const QUICK_LINKS = [
  { label: "Go to Dashboard", to: "/app", icon: LayoutDashboard },
  { label: "Go to AI Center", to: "/app/ai-center", icon: Sparkles },
  { label: "Go to Timeline", to: "/app/timeline", icon: History },
  { label: "Go to Settings", to: "/app/settings", icon: Settings },
];

function useDebouncedSearch(query) {
  const [results, setResults] = useState(null);
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      api
        .get(`/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => setResults(r.data))
        .catch(() => setResults(null));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);
  return results;
}

function SearchResultsList({ results, query, onNavigate }) {
  if (!query.trim()) {
    return (
      <div className="py-1.5">
        <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink/35">Go to</p>
        {QUICK_LINKS.map((q) => (
          <Link key={q.label} href={q.to} onClick={onNavigate} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left text-ink/70 hover:bg-base">
            <q.icon size={14} className="text-ink/40 shrink-0" /> {q.label}
          </Link>
        ))}
      </div>
    );
  }

  if (!results) return <p className="px-3 py-6 text-sm text-ink/35 text-center">Searching…</p>;

  const categories = Object.keys(SEARCH_CATEGORY_META).filter((k) => results[k]?.length);
  if (categories.length === 0) {
    return <p className="px-3 py-6 text-sm text-ink/40 text-center">No results for &quot;{query}&quot;</p>;
  }

  return (
    <div className="py-1.5">
      {categories.map((key) => {
        const meta = SEARCH_CATEGORY_META[key];
        return (
          <div key={key}>
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink/35">{meta.label}</p>
            {results[key].map((item) => (
              <Link key={item.id} href={item.href} onClick={onNavigate} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left text-ink/70 hover:bg-base">
                <meta.icon size={14} className="text-ink/40 shrink-0" /> <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Header search box (Leads/Contacts/Companies/Deals/Tasks/Meetings/Forms,
// via GET /api/search) doubling as the trigger surface for the ⌘K command
// palette — same query/results state drives both, so typing in one and
// then invoking ⌘K doesn't lose what was typed. Recent-items and AI-
// powered search ("find overdue deals") are real, separate features this
// doesn't attempt — no view-history tracking exists to back "recent," and
// natural-language query parsing needs its own design, not a search bar.
function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const results = useDebouncedSearch(query);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(false);
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setPaletteOpen(false);
    setQuery("");
  };

  return (
    <>
      <div className="relative flex-1 max-w-[200px] sm:max-w-xs md:w-80" ref={ref}>
        <div className="flex items-center gap-2 text-ink/40 bg-base rounded-lg px-3 py-2 w-full">
          <Search size={16} className="shrink-0" />
          <input
            placeholder="Search anything…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-ink/40 text-ink"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
          />
          <kbd className="hidden md:inline text-[10px] font-medium text-ink/30 border border-border rounded px-1 py-0.5 shrink-0">⌘K</kbd>
        </div>
        {open && (
          <div className="absolute left-0 top-full mt-1.5 w-full sm:w-96 bg-white border border-border rounded-lg shadow-card max-h-96 overflow-y-auto z-30">
            <SearchResultsList results={results} query={query} onNavigate={closeAll} />
          </div>
        )}
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-ink/40" onClick={closeAll}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search size={16} className="text-ink/40 shrink-0" />
              <input
                autoFocus
                placeholder="Search anything, or jump to a page…"
                className="bg-transparent outline-none text-sm w-full placeholder:text-ink/40"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="text-[10px] font-medium text-ink/30 border border-border rounded px-1 py-0.5 shrink-0">ESC</kbd>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <SearchResultsList results={results} query={query} onNavigate={closeAll} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Real destinations only — Profile, Preferences, Keyboard Shortcuts, and
// Theme aren't implemented anywhere in this app (no profile page, no
// theme system), so they're left out entirely rather than linked to
// something that doesn't exist. Settings and Logout are the two real
// actions this menu can offer today.
function UserMenu({ user, companyName, roleLabel, initials, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 hover:bg-base rounded-lg px-1.5 py-1">
        <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{initials}</div>
        <div className="hidden sm:block text-left">
          <p className="text-sm text-ink/80 leading-tight">{companyName || APP_NAME}</p>
        </div>
        <ChevronDown size={13} className={`hidden sm:block text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border rounded-lg shadow-card p-1.5 z-30">
          <div className="px-2.5 py-2 border-b border-border mb-1">
            <p className="text-sm font-medium text-ink/85 truncate">{user?.name}</p>
            <p className="text-xs text-ink/40 truncate">{user?.email} · {roleLabel}</p>
          </div>
          <Link
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm text-left text-ink/70 hover:bg-base rounded-md"
          >
            <Settings size={14} /> Settings
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm text-left text-danger hover:bg-danger/5 rounded-md"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

// `collapsed` reflects the desktop sidebar's collapse preference — it must
// never hide anything on mobile (the drawer there is a totally different
// fixed-width overlay), so every collapsed-only style is md:-prefixed and
// the label stays in the DOM (just hidden at md+) rather than being
// removed, so mobile always renders it regardless of the desktop setting.
function NavItem({ to, label, icon: Icon, collapsed, comingSoon }) {
  const router = useRouter();
  const active = router.pathname === to;

  // Not a real link — the feature doesn't exist yet (see AI Center's
  // sub-nav row for the same "kept visible but disabled" pattern). Shown
  // rather than omitted so users know it's planned, not missing.
  if (comingSoon) {
    return (
      <div
        title={collapsed ? `${label} — Coming soon` : "Coming soon"}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink/30 cursor-not-allowed ${collapsed ? "md:justify-center md:px-0" : ""}`}
      >
        <Icon size={17} strokeWidth={2} className="shrink-0" />
        <span className={`flex-1 ${collapsed ? "md:hidden" : ""}`}>{label}</span>
        {!collapsed && <span className="text-[10px] font-medium uppercase tracking-wide">Soon</span>}
      </div>
    );
  }

  return (
    <Link
      href={to}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        collapsed ? "md:justify-center md:px-0" : ""
      } ${active ? "bg-primary text-white font-medium" : "text-ink/85 hover:bg-primary/8 hover:text-ink"}`}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      <span className={collapsed ? "md:hidden" : ""}>{label}</span>
    </Link>
  );
}

export default function Layout({ children }) {
  const { user, logout, canManage, isMasterAdmin, isOwner } = useAuth();
  const { releasedModules, releasedApps } = usePlatformFeatures();
  const router = useRouter();
  const initials = (user?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);
  const roleLabel = { admin: "Admin", manager: "Manager", viewer: "Viewer" }[user?.authRole] || user?.authRole;
  const [enabledApps, setEnabledApps] = useState({});
  const [enabledModules, setEnabledModules] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [subscription, setSubscription] = useState(null);
  const [downgradeDismissed, setDowngradeDismissed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which nav section labels are collapsed — persisted so a collapsed
  // "Insights" (say) stays collapsed across page navigations and reloads,
  // not just for the current render.
  const [collapsedSections, setCollapsedSections] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("nav_collapsed_sections") || "[]"));
    } catch {
      return new Set();
    }
  });
  const toggleSection = (label) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem("nav_collapsed_sections", JSON.stringify([...next]));
      return next;
    });
  };

  // Whole-sidebar collapse (icons only) vs. expanded (icons + text) — the
  // logo header, every nav item, section labels, and the user footer all
  // respond to this; distinct from collapsedSections above, which toggles
  // one section's items while the sidebar stays fully expanded.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nav_sidebar_collapsed") === "1";
  });
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("nav_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const loadEnabledApps = () =>
    api
      .get("/settings")
      .then((r) => {
        setEnabledApps(r.data.apps || {});
        setEnabledModules(r.data.modules || {});
        setCompanyName(r.data.companyProfile?.name || "");
        setSubscription(r.data.subscription || null);
      })
      .catch(() => {});
  useEffect(() => {
    loadEnabledApps();
  }, []);
  useLiveCollection(["settings"], loadEnabledApps);

  // Close the mobile drawer whenever navigation happens — otherwise tapping
  // a nav link on a phone leaves the overlay open behind the new page.
  useEffect(() => {
    const close = () => setMobileOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `main` below is its own scrollable container (overflow-y-auto), not the
  // window — Next's default scroll restoration only resets window scroll,
  // so without this, navigating away from a page you'd scrolled down (e.g.
  // a long Forms list) leaves the *next* page rendered already scrolled
  // down too, hiding its own heading/content until the user scrolls up.
  const mainRef = useRef(null);
  useEffect(() => {
    const resetScroll = () => {
      if (mainRef.current) mainRef.current.scrollTop = 0;
    };
    router.events.on("routeChangeComplete", resetScroll);
    return () => router.events.off("routeChangeComplete", resetScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Release gate: master admin controls what's released platform-wide from
  // the Admin Portal (routes/platform.js) — a tenant's own enabledApps flag
  // only matters for apps that have actually been released to everyone.
  // Master admin sees every feature regardless of either flag.
  const enabledApps_ = APP_CATALOG
    .filter((a) => a.status !== "builtIn")
    .filter((a) => isMasterAdmin || (releasedApps[a.key] && enabledApps[a.key]));

  // Forms gets its own top-level sidebar section (Forms / Add New) instead
  // of being lumped into the generic "Apps" bucket — it's the only released
  // app today and warrants direct access to both the forms list and form
  // creation without an extra click into the Forms page first.
  const formsApp = enabledApps_.find((a) => a.key === "forms");
  const enabledAppItems = enabledApps_
    .filter((a) => a.key !== "forms")
    .map((a) => ({
      to: a.status === "available" ? a.route : `/app/module/${a.key}`,
      label: a.label,
      icon: a.icon,
    }));

  // Until settings load, show everything rather than flashing an empty
  // sidebar — modules default to true server-side anyway.
  const isModuleOn = (key) => {
    if (!key) return true;
    if (isMasterAdmin) return true;
    if (!releasedModules[key]) return false;
    return enabledModules === null || enabledModules[key] !== false;
  };

  // Same "show everything until we know otherwise" reasoning as
  // isModuleOn above — subscription hasn't loaded yet on first render, and
  // hiding-then-showing an item is worse than a brief over-show.
  const PLAN_RANK = { starter: 0, growth: 1, enterprise: 2 };
  const meetsPlan = (minPlan) => {
    if (!minPlan) return true;
    if (isMasterAdmin) return true;
    if (!subscription) return true;
    return (PLAN_RANK[subscription.plan] ?? 0) >= PLAN_RANK[minPlan];
  };

  // Forms is dynamic (driven by the enabled Apps catalog, not NAV_SECTIONS)
  // — merged into the static "Forms" section (Templates) here, before
  // empty sections get filtered out, so the Forms group still shows even
  // when Templates alone is module-gated off. "Add New" is deliberately
  // not merged in anymore — creating a form is a contextual action on the
  // Forms page itself (its own Add Form button) now that there's a global
  // Create menu in the top bar for reaching it from anywhere else.
  const visibleSections = NAV_SECTIONS.map((section) => {
    const items = section.items.filter(
      (item) =>
        (!item.adminOnly || isMasterAdmin) &&
        (!item.ownerOnly || isOwner) &&
        isModuleOn(item.module) &&
        meetsPlan(item.minPlan)
    );
    if (section.label === "Forms" && formsApp) {
      return {
        ...section,
        items: [
          { to: formsApp.route, label: "Forms", icon: formsApp.icon },
          { to: "/app/forms/responses", label: "Responses", icon: Inbox },
          ...items,
        ],
      };
    }
    return { ...section, items };
  }).filter((section) => section.items.length > 0);

  const sections = [
    ...visibleSections,
    ...(enabledAppItems.length ? [{ label: "Apps", items: enabledAppItems }] : []),
  ];

  return (
    <div className="flex h-screen bg-base font-body">
      {/* Mobile backdrop — tap to close the drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — fixed overlay drawer on mobile, static column from md up.
          Always fully expanded on mobile (it's an overlay, not competing for
          screen space) — sidebarCollapsed only narrows it from md up. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 shrink-0 bg-white border-r border-border flex flex-col transition-all duration-200 md:static md:translate-x-0 w-60 ${
          sidebarCollapsed ? "md:w-[68px]" : "md:w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`h-16 flex items-center gap-2 border-b border-border ${sidebarCollapsed ? "md:justify-center md:px-2 px-5" : "px-5"}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Target size={17} className="text-white" />
          </div>
          {/* Always shown on mobile (the drawer is never collapsed there) —
              only hidden at md+ when the desktop sidebar is collapsed. */}
          <span className={`font-display font-bold text-lg tracking-tight flex-1 ${sidebarCollapsed ? "md:hidden" : ""}`}>{APP_NAME}</span>
          <button onClick={() => setMobileOpen(false)} className="text-ink/40 hover:text-ink md:hidden">
            <X size={18} />
          </button>
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:block text-ink/40 hover:text-ink"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sections.map((section) => {
            const collapsed = collapsedSections.has(section.label);
            return (
              <div key={section.label}>
                {/* Mobile always shows the labeled accordion header; at
                    md+ this swaps to a plain divider when the desktop
                    sidebar is collapsed (no room/reason for text there). */}
                {sidebarCollapsed && <div className="hidden md:block h-px bg-border mx-1 mb-2 mt-1 first:mt-0" />}
                <button
                  onClick={() => toggleSection(section.label)}
                  className={`w-full flex items-center justify-between px-3 py-1 mt-2 mb-0.5 first:mt-0 text-xs font-medium uppercase tracking-wider text-ink/40 hover:text-ink/70 ${
                    sidebarCollapsed ? "md:hidden" : ""
                  }`}
                >
                  {section.label}
                  <ChevronDown size={13} className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                </button>
                {/* Mobile respects each section's own accordion state;
                    icon-only desktop mode always shows items regardless
                    (accordion-collapsing a bare icon list isn't meaningful
                    without labels to click). */}
                <div className={`space-y-0.5 mb-4 ${collapsed ? "hidden" : ""} ${sidebarCollapsed ? "md:block" : ""}`}>
                  {section.items.map((item) => (
                    <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            title={sidebarCollapsed ? user?.name : undefined}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-base text-left ${
              sidebarCollapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className={`flex-1 min-w-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-ink/50 truncate">{roleLabel}</div>
            </div>
            <LogOut size={15} className={`text-ink/30 shrink-0 ${sidebarCollapsed ? "md:hidden" : ""}`} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white border-b border-border flex items-center justify-between px-4 md:px-6 gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-ink/50 hover:text-ink md:hidden shrink-0">
            <Menu size={22} />
          </button>
          <GlobalSearch />
          <div className="flex items-center gap-3 shrink-0">
            {!canManage && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-accent-dark bg-accent/10 border border-accent/25 px-2.5 py-1.5 rounded-full">
                <Eye size={13} /> View only
              </span>
            )}
            {canManage && <CreateMenu isModuleOn={isModuleOn} />}
            <button className="relative text-ink/50 hover:text-ink" title="Notifications">
              <Bell size={19} />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-danger" />
            </button>
            <UserMenu user={user} companyName={companyName} roleLabel={roleLabel} initials={initials} onLogout={handleLogout} />
          </div>
        </header>
        {subscription?.downgradedFrom && !downgradeDismissed && (
          <div className="bg-danger/8 border-b border-danger/20 px-6 py-2.5 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                Your {limitsFor(subscription.downgradedFrom).label} plan expired and your account moved back to Starter.
                {" "}
                <Link href="/app/settings" className="underline font-medium">Upgrade again</Link>
              </span>
            </div>
            <button onClick={() => setDowngradeDismissed(true)} className="text-danger/50 hover:text-danger shrink-0">
              <X size={15} />
            </button>
          </div>
        )}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
