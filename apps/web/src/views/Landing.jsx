import Link from "next/link";
import {
  Target, Users2, MessageCircle, BarChart3, Sparkles, Building2,
  ArrowRight, Check, ListChecks, Mail, TrendingUp,
} from "lucide-react";

const FEATURES = [
  { icon: Users2, title: "Leads & Pipeline", desc: "Capture leads from Website, Facebook, and WhatsApp, then move them through a real sales pipeline." },
  { icon: MessageCircle, title: "WhatsApp built in", desc: "Send, template, and bulk-message straight from the CRM — with AI-suggested replies." },
  { icon: Sparkles, title: "AI Suggestions", desc: "Stale leads, overdue tasks, and hot deals surfaced automatically, every morning." },
  { icon: Building2, title: "B2B ready", desc: "Company accounts, GST numbers, and account managers for teams selling to businesses." },
  { icon: BarChart3, title: "Real analytics", desc: "Conversion rate, lead sources, best performers, and lost reasons — not vanity charts." },
  { icon: ListChecks, title: "Tasks that stick", desc: "Follow-ups with Email, SMS, and push reminders so nothing slips through." },
];

const PLANS = [
  {
    name: "Starter",
    price: "₹0",
    period: "forever",
    tagline: "For solo founders getting their first leads organized.",
    features: ["Up to 100 leads", "Leads, Contacts, Deals", "Basic email sending", "1 user"],
    cta: "Start free",
  },
  {
    name: "Growth",
    price: "₹1,499",
    period: "/user/month",
    tagline: "For sales teams who live in WhatsApp and need a real pipeline.",
    features: ["Unlimited leads", "WhatsApp + AI replies", "Analytics & Sales Reports", "Teams & Performance", "Up to 20 users"],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For larger orgs that need admin controls and dedicated support.",
    features: ["Everything in Growth", "Role-based permissions", "Priority support", "Custom integrations"],
    cta: "Talk to sales",
  },
];

function NavBar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Pipeline</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-ink/60">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
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

export default function Landing() {
  return (
    <div className="font-body text-ink">
      <NavBar />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium mb-6">
          <Sparkles size={12} /> AI suggestions built in, not bolted on
        </div>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-[1.05] max-w-3xl mx-auto">
          The sales CRM built for how Indian teams actually sell.
        </h1>
        <p className="text-ink/60 text-lg max-w-xl mx-auto mt-5">
          Leads, WhatsApp, deals, and reports in one place — with AI that tells you
          who to call next, not just where you left off.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
            Get started free <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg border border-border font-medium hover:bg-base">
            Log in
          </Link>
        </div>
        <p className="text-xs text-ink/40 mt-4">No credit card required · Free plan available forever</p>
      </section>

      {/* Product preview mock */}
      <section className="max-w-5xl mx-auto px-6 -mt-4 mb-20">
        <div className="rounded-2xl border border-border shadow-card bg-white p-3">
          <div className="rounded-xl bg-base border border-border p-6">
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: "Total Leads", value: "482", color: "#3E6FA3" },
                { label: "New Today", value: "12", color: "#2F5D50" },
                { label: "Follow-ups Due", value: "7", color: "#E8A33D" },
                { label: "Deals Won", value: "38", color: "#8B5FBF" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg border border-border p-3">
                  <p className="text-[10px] text-ink/40">{s.label}</p>
                  <p className="text-xl font-display font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-border p-4 flex items-end gap-1.5 h-28">
              {[40, 55, 45, 70, 60, 85, 65, 90].map((h, i) => (
                <div key={i} className="flex-1 bg-primary/70 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Everything your sales team needs</h2>
          <p className="text-ink/50 mt-2">16 modules, one login — no more switching between five different tools.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-5 rounded-card border border-border bg-white shadow-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <f.icon size={18} />
              </div>
              <h3 className="font-display font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-ink/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI callout */}
      <section className="bg-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Sparkles size={28} className="mx-auto mb-4 text-accent" />
          <h2 className="font-display font-bold text-3xl mb-3">Your sales manager, minus the spreadsheet.</h2>
          <p className="text-white/70 max-w-xl mx-auto">
            Every morning, Pipeline surfaces the leads going cold, the tasks slipping,
            and the deals in Negotiation that need a nudge — before you even open the dashboard.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl">Simple, transparent pricing</h2>
          <p className="text-ink/50 mt-2">Start free. Upgrade when your pipeline grows.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-card p-6 border ${p.highlighted ? "border-primary shadow-lg bg-white relative" : "border-border bg-white shadow-card"}`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-6 bg-accent text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  Most popular
                </span>
              )}
              <h3 className="font-display font-semibold text-lg">{p.name}</h3>
              <p className="text-xs text-ink/50 mt-1 mb-4 h-8">{p.tagline}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-display font-bold">{p.price}</span>
                <span className="text-sm text-ink/40">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ink/70">
                    <Check size={14} className="text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`block text-center py-2.5 rounded-lg text-sm font-medium ${
                  p.highlighted ? "bg-primary text-white hover:bg-primary-dark" : "border border-border hover:bg-base"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Target size={14} className="text-white" />
            </div>
            <span className="font-display font-semibold">Pipeline</span>
          </div>
          <p className="text-xs text-ink/40">© 2026 Pipeline CRM. Built for teams who sell every day.</p>
          <div className="flex items-center gap-4 text-xs text-ink/50">
            <span className="flex items-center gap-1"><Mail size={12} /> hello@pipeline.app</span>
            <span className="flex items-center gap-1"><TrendingUp size={12} /> Made in Bengaluru</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
