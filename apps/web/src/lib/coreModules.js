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

// Sensible default for a brand-new signup — the core sales loop. Everything
// else (WhatsApp, Analytics, Users, Teams, etc.) starts hidden until the
// admin turns it on from the Admin Portal.
export const RECOMMENDED_MODULE_KEYS = ["dashboard", "leads", "contacts", "deals", "activities", "tasks"];
