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
} from "lucide-react";

// Mirrors Layout.jsx's NAV_SECTIONS module keys — core CRM sections, unlike
// the Odoo-style APP_CATALOG (lib/appCatalog.js) which is for optional
// add-on modules. Shared by the Admin Portal's toggles and the signup
// starter-kit picker so both stay in sync.
export const CORE_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: Users2 },
  { key: "contacts", label: "Contacts", icon: Contact },
  { key: "companies", label: "Companies", icon: Building2 },
  { key: "deals", label: "Deals", icon: Target },
  { key: "activities", label: "Activities", icon: Activity },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "email", label: "Email", icon: Mail },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "reports", label: "Sales Reports", icon: ClipboardList },
  { key: "performance", label: "Performance", icon: TrendingUp },
  { key: "users", label: "Users", icon: UserCog },
  { key: "teams", label: "Teams", icon: Users },
];

// Sensible default for a brand-new signup. Initial release only ships
// Dashboard + Forms — everything else (the rest of the core sales loop,
// WhatsApp, Analytics, Users, Teams, etc.) starts hidden until the owner
// turns it on from Settings > Upgrade Plan as those areas go live.
export const RECOMMENDED_MODULE_KEYS = ["dashboard"];

// Mirrors Layout.jsx's NAV_SECTIONS groupings exactly — a user picks/
// unpicks a whole section at once (e.g. "Pipeline") rather than four
// separate Leads/Contacts/Companies/Deals toggles, since that's how they
// actually show up together in the sidebar. Dashboard has its own
// "Overview" section in the nav but isn't included here — it's excluded
// from the toggleable grid entirely (see CoreModulePicker).
export const MODULE_GROUPS = [
  { key: "pipeline", label: "Pipeline", icon: Target, moduleKeys: ["leads", "contacts", "companies", "deals"] },
  { key: "work", label: "Work", icon: ListChecks, moduleKeys: ["activities", "tasks"] },
  { key: "engage", label: "Engage", icon: MessageCircle, moduleKeys: ["whatsapp", "email", "templates"] },
  { key: "insights", label: "Insights", icon: BarChart3, moduleKeys: ["analytics", "reports", "performance"] },
  { key: "admin", label: "Admin", icon: UserCog, moduleKeys: ["users", "teams"] },
];

// What's actually released platform-wide now lives in the backend
// (routes/platform.js, GET/PUT /api/platform) — editable at runtime by
// master admin from the Admin Portal instead of a hardcoded array here.
// See lib/usePlatformFeatures.js.
