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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/app/leads", label: "Leads", icon: Users2 },
      { to: "/app/contacts", label: "Contacts", icon: Contact },
      { to: "/app/companies", label: "Companies", icon: Building2 },
      { to: "/app/deals", label: "Deals", icon: Target },
    ],
  },
  {
    label: "Work",
    items: [
      { to: "/app/activities", label: "Activities", icon: Activity },
      { to: "/app/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/app/email", label: "Email", icon: Mail },
      { to: "/app/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/app/reports", label: "Sales Reports", icon: ClipboardList },
      { to: "/app/performance", label: "Performance", icon: TrendingUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/app/users", label: "Users", icon: UserCog },
      { to: "/app/teams", label: "Teams", icon: Users },
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
  const { user, logout, canManage } = useAuth();
  const router = useRouter();
  const initials = (user?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);
  const roleLabel = { admin: "Admin", manager: "Manager", viewer: "Viewer" }[user?.authRole] || user?.authRole;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-base font-body">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-border flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Pipeline</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_SECTIONS.map((section) => (
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
        <header className="h-16 shrink-0 bg-white border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-ink/40 bg-base rounded-lg px-3 py-2 w-80">
            <Search size={16} />
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
            <div className="flex items-center gap-1.5 text-sm text-ink/70 cursor-pointer">
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
