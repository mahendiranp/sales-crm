import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { APP_CATALOG, RELEASED_APP_KEYS } from "../lib/appCatalog";
import { RELEASED_MODULE_KEYS } from "../lib/coreModules";
import useLiveCollection from "../lib/useLiveCollection";
import { APP_NAME } from "../lib/brand";

// Each item's `module` key maps to settings.modules (see routes/settings.js)
// — omit it (like Admin Portal / Settings) to always show it regardless of
// module toggles, since those are the controls used to manage the toggles.
const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" }],
  },
  {
    label: "Pipeline",
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
      { to: "/app/activities", label: "Activities", icon: Activity, module: "activities" },
      { to: "/app/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle, module: "whatsapp" },
      { to: "/app/email", label: "Email", icon: Mail, module: "email" },
      { to: "/app/templates", label: "Templates", icon: FileText, module: "templates" },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/app/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      { to: "/app/reports", label: "Sales Reports", icon: ClipboardList, module: "reports" },
      { to: "/app/performance", label: "Performance", icon: TrendingUp, module: "performance" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/app/users", label: "Users", icon: UserCog, module: "users" },
      { to: "/app/teams", label: "Teams", icon: Users, module: "teams" },
      { to: "/app/team", label: "Team Access", icon: UserCheck, ownerOnly: true },
      { to: "/app/apps", label: "Admin Portal", icon: ShieldCheck, adminOnly: true },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavItem({ to, label, icon: Icon }) {
  const router = useRouter();
  const active = router.pathname === to;

  return (
    <Link
      href={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? "bg-primary text-white font-medium" : "text-ink/70 hover:bg-primary/8 hover:text-ink"
      }`}
    >
      <Icon size={17} strokeWidth={2} />
      {label}
    </Link>
  );
}

export default function Layout({ children }) {
  const { user, logout, canManage, isMasterAdmin, isOwner } = useAuth();
  const router = useRouter();
  const initials = (user?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);
  const roleLabel = { admin: "Admin", manager: "Manager", viewer: "Viewer" }[user?.authRole] || user?.authRole;
  const [enabledApps, setEnabledApps] = useState({});
  const [enabledModules, setEnabledModules] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadEnabledApps = () =>
    api
      .get("/settings")
      .then((r) => {
        setEnabledApps(r.data.apps || {});
        setEnabledModules(r.data.modules || {});
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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // UI-only release lock: this build only ships Dashboard + Forms (see
  // lib/coreModules.js / lib/appCatalog.js for the shared allowlists —
  // also used by CoreModulePicker/FeaturePicker so the Upgrade Plan and
  // signup UI can't offer to turn on something that isn't released).
  // Deliberately front-end only — doesn't touch settings.modules/apps in
  // the database at all. Master admin bypasses this (and everything
  // else) same as always.

  // Master admin sees every feature regardless of any tenant's flags — the
  // flags exist to restrict what everyone *else* under this account sees.
  const enabledAppItems = APP_CATALOG
    .filter((a) => a.status !== "builtIn")
    .filter((a) => isMasterAdmin || (RELEASED_APP_KEYS.includes(a.key) && enabledApps[a.key]))
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
    if (!RELEASED_MODULE_KEYS.includes(key)) return false;
    return enabledModules === null || enabledModules[key] !== false;
  };

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => (!item.adminOnly || isMasterAdmin) && (!item.ownerOnly || isOwner) && isModuleOn(item.module)
    ),
  })).filter((section) => section.items.length > 0);

  const sections = enabledAppItems.length
    ? [...visibleSections, { label: "Apps", items: enabledAppItems }]
    : visibleSections;

  return (
    <div className="flex h-screen bg-base font-body">
      {/* Mobile backdrop — tap to close the drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — fixed overlay drawer on mobile, static column from md up */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 bg-white border-r border-border flex flex-col transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight flex-1">{APP_NAME}</span>
          <button onClick={() => setMobileOpen(false)} className="text-ink/40 hover:text-ink md:hidden">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink/35">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-base text-left">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-ink/50 truncate">{roleLabel}</div>
            </div>
            <LogOut size={15} className="text-ink/30" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white border-b border-border flex items-center justify-between px-4 md:px-6 gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-ink/50 hover:text-ink md:hidden shrink-0">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 text-ink/40 bg-base rounded-lg px-3 py-2 w-full max-w-[200px] sm:max-w-xs md:w-80">
            <Search size={16} className="shrink-0" />
            <input
              placeholder="Search leads, deals, contacts…"
              className="bg-transparent outline-none text-sm w-full placeholder:text-ink/40"
            />
          </div>
          <div className="flex items-center gap-4">
            {!canManage && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-accent-dark bg-accent/10 border border-accent/25 px-2.5 py-1.5 rounded-full">
                <Eye size={13} /> View only
              </span>
            )}
            <button className="relative text-ink/50 hover:text-ink">
              <Bell size={19} />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-danger" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-ink/70 cursor-pointer">
              Bangalore Sales
              <ChevronDown size={15} />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
