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

// Single source of truth for what's actually released — used by
// Layout.jsx's nav (to hide unreleased sections) AND CoreModulePicker (to
// stop the Upgrade Plan / signup UI from offering to turn on a module that
// isn't live yet). Master admin bypasses this everywhere, same as every
// other gate in the app. Widening the release later is editing this array.
export const RELEASED_MODULE_KEYS = ["dashboard"];
