import {
  Calculator,
  Receipt,
  Wallet,
  Sheet,
  FolderOpen,
  PenTool,
  Target,
  Store,
  Utensils,
  Repeat,
  Car,
  Globe,
  ShoppingCart,
  Newspaper,
  MessageSquare,
  MessageCircle,
  GraduationCap,
  Package,
  Factory,
  ClipboardList,
  ShoppingBasket,
  Wrench,
  BadgeCheck,
  Users2,
  UserPlus,
  CalendarOff,
  Award,
  Share2,
  Mail,
  Send,
  CalendarDays,
  Megaphone,
  ListChecks,
  Briefcase,
  Clock,
  HardHat,
  Headphones,
  CalendarClock,
  CalendarCheck,
  MessageSquareText,
  Sparkles,
  Cpu,
  PhoneCall,
  BookOpen,
  FormInput,
} from "lucide-react";

// Mirrors the Odoo-style app catalog the user asked for. `status` drives
// behavior: "builtIn" apps are always on (already implemented as core CRM
// features), "available" apps are fully implemented and can be toggled,
// "planned" apps can be toggled on (they show up in nav) but currently
// route to a placeholder page until built out for real.
export const APP_CATEGORIES = [
  "Finance",
  "Sales",
  "Websites",
  "Supply Chain",
  "Human Resources",
  "Marketing",
  "Services",
  "Productivity",
];

export const APP_CATALOG = [
  // ---------------- Finance ----------------
  { key: "accounting", label: "Accounting", category: "Finance", icon: Calculator, status: "planned" },
  { key: "invoicing", label: "Invoicing", category: "Finance", icon: Receipt, status: "available", route: "/app/invoicing" },
  { key: "expenses", label: "Expenses", category: "Finance", icon: Wallet, status: "available", route: "/app/expenses" },
  { key: "spreadsheetBi", label: "Spreadsheet (BI)", category: "Finance", icon: Sheet, status: "planned" },
  { key: "documents", label: "Documents", category: "Finance", icon: FolderOpen, status: "available", route: "/app/documents" },
  { key: "sign", label: "Sign", category: "Finance", icon: PenTool, status: "planned" },

  // ---------------- Sales ----------------
  { key: "crm", label: "CRM", category: "Sales", icon: Target, status: "builtIn", route: "/app/deals" },
  { key: "sales", label: "Sales", category: "Sales", icon: Target, status: "builtIn", route: "/app/deals" },
  { key: "posShop", label: "POS Shop", category: "Sales", icon: Store, status: "planned" },
  { key: "posRestaurant", label: "POS Restaurant", category: "Sales", icon: Utensils, status: "planned" },
  { key: "subscriptions", label: "Subscriptions", category: "Sales", icon: Repeat, status: "planned" },
  { key: "rental", label: "Rental", category: "Sales", icon: Car, status: "planned" },

  // ---------------- Websites ----------------
  { key: "websiteBuilder", label: "Website Builder", category: "Websites", icon: Globe, status: "planned" },
  { key: "ecommerce", label: "eCommerce", category: "Websites", icon: ShoppingCart, status: "planned" },
  { key: "blog", label: "Blog", category: "Websites", icon: Newspaper, status: "planned" },
  { key: "forum", label: "Forum", category: "Websites", icon: MessageSquare, status: "planned" },
  { key: "liveChat", label: "Live Chat", category: "Websites", icon: MessageCircle, status: "planned" },
  { key: "elearning", label: "eLearning", category: "Websites", icon: GraduationCap, status: "planned" },

  // ---------------- Supply Chain ----------------
  { key: "inventory", label: "Inventory", category: "Supply Chain", icon: Package, status: "planned" },
  { key: "manufacturing", label: "Manufacturing", category: "Supply Chain", icon: Factory, status: "planned" },
  { key: "plm", label: "PLM", category: "Supply Chain", icon: ClipboardList, status: "planned" },
  { key: "purchase", label: "Purchase", category: "Supply Chain", icon: ShoppingBasket, status: "planned" },
  { key: "maintenance", label: "Maintenance", category: "Supply Chain", icon: Wrench, status: "planned" },
  { key: "quality", label: "Quality", category: "Supply Chain", icon: BadgeCheck, status: "planned" },

  // ---------------- Human Resources ----------------
  { key: "employees", label: "Employees", category: "Human Resources", icon: Users2, status: "planned" },
  { key: "recruitment", label: "Recruitment", category: "Human Resources", icon: UserPlus, status: "planned" },
  { key: "timeOff", label: "Time Off", category: "Human Resources", icon: CalendarOff, status: "planned" },
  { key: "appraisals", label: "Appraisals", category: "Human Resources", icon: Award, status: "planned" },
  { key: "referrals", label: "Referrals", category: "Human Resources", icon: Share2, status: "planned" },
  { key: "fleet", label: "Fleet", category: "Human Resources", icon: Car, status: "planned" },

  // ---------------- Marketing ----------------
  { key: "socialMarketing", label: "Social Marketing", category: "Marketing", icon: Share2, status: "planned" },
  { key: "emailMarketing", label: "Email Marketing", category: "Marketing", icon: Mail, status: "planned" },
  { key: "smsMarketing", label: "SMS Marketing", category: "Marketing", icon: Send, status: "planned" },
  { key: "events", label: "Events", category: "Marketing", icon: CalendarDays, status: "planned" },
  { key: "marketingAutomation", label: "Marketing Automation", category: "Marketing", icon: Megaphone, status: "planned" },
  { key: "surveys", label: "Surveys", category: "Marketing", icon: ListChecks, status: "planned" },
  { key: "forms", label: "Forms", category: "Marketing", icon: FormInput, status: "available", route: "/app/forms" },

  // ---------------- Services ----------------
  { key: "project", label: "Project", category: "Services", icon: Briefcase, status: "planned" },
  { key: "timesheets", label: "Timesheets", category: "Services", icon: Clock, status: "planned" },
  { key: "fieldService", label: "Field Service", category: "Services", icon: HardHat, status: "planned" },
  { key: "helpdesk", label: "Helpdesk", category: "Services", icon: Headphones, status: "planned" },
  { key: "planning", label: "Planning", category: "Services", icon: CalendarClock, status: "planned" },
  { key: "appointments", label: "Appointments", category: "Services", icon: CalendarCheck, status: "planned" },

  // ---------------- Productivity ----------------
  { key: "discuss", label: "Discuss", category: "Productivity", icon: MessageSquareText, status: "planned" },
  { key: "ai", label: "Artificial Intelligence", category: "Productivity", icon: Sparkles, status: "planned" },
  { key: "iot", label: "IoT", category: "Productivity", icon: Cpu, status: "planned" },
  { key: "voip", label: "VoIP", category: "Productivity", icon: PhoneCall, status: "planned" },
  { key: "knowledge", label: "Knowledge", category: "Productivity", icon: BookOpen, status: "planned" },
  { key: "whatsapp", label: "WhatsApp", category: "Productivity", icon: MessageCircle, status: "builtIn", route: "/app/whatsapp" },
];

export function findApp(key) {
  return APP_CATALOG.find((a) => a.key === key);
}

// Toggleable apps only (builtIn apps are always on and not part of the
// settings.apps map).
export const TOGGLEABLE_APPS = APP_CATALOG.filter((a) => a.status !== "builtIn");

// Suggested starter kit for new signups. Initial release only ships
// Forms + Dashboard — narrower than "every status: available app" (which
// currently also includes Documents/Expenses/Invoicing) so new signups
// aren't nudged toward enabling areas that aren't actually launched yet.
export const RECOMMENDED_APP_KEYS = ["forms"];

// Single source of truth for what's actually released — used by
// Layout.jsx's Apps grid AND FeaturePicker (so the Upgrade Plan / signup
// UI doesn't offer to turn on an app that isn't live yet). Master admin
// bypasses this everywhere, same as every other gate in the app.
export const RELEASED_APP_KEYS = ["forms"];
