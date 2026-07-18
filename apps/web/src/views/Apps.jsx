import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles, Rocket, UserPlus } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, Switch, Badge } from "../components/ui";
import { APP_CATALOG, APP_CATEGORIES } from "../lib/appCatalog";
import { CORE_MODULES } from "../lib/coreModules";
import { formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import usePlatformFeatures from "../lib/usePlatformFeatures";
import useResizableColumns from "../lib/useResizableColumns";
import ResizableTh from "../components/ResizableTh";

const AI_PROVIDER_LABEL = { anthropic: "Anthropic (Claude)", gemini: "Google Gemini" };
const MODULE_LABEL = Object.fromEntries(CORE_MODULES.map((m) => [m.key, m.label]));
const APP_LABEL = Object.fromEntries(APP_CATALOG.map((a) => [a.key, a.label]));

const TENANT_OVERVIEW_COLUMNS = [
  { key: "company", label: "Company", defaultWidth: 220 },
  { key: "owner", label: "Owner", defaultWidth: 200 },
  { key: "joined", label: "Joined", defaultWidth: 140 },
  { key: "plan", label: "Plan", defaultWidth: 120 },
  { key: "aiProvider", label: "AI Provider", defaultWidth: 160 },
  { key: "features", label: "Features opted in", defaultWidth: 260 },
];

// The actual platform-wide release switch — separate from (and above) the
// per-account toggles below. A module/app only ever reaches a real
// customer's sidebar or the signup picker once it's released here, no
// matter what any tenant's own settings.modules/apps says.
function ReleaseFeatures() {
  const { releasedModules, releasedApps, reload } = usePlatformFeatures();

  const toggleModule = async (key, next) => {
    await api.put("/platform", { releasedModules: { [key]: next } });
    reload();
  };
  const toggleApp = async (key, next) => {
    await api.put("/platform", { releasedApps: { [key]: next } });
    reload();
  };

  return (
    <div className="mb-8">
      <h3 className="font-display font-semibold text-sm text-ink/70 mb-2.5 flex items-center gap-1.5">
        <Rocket size={14} className="text-primary" /> Release to all users
      </h3>
      <p className="text-xs text-ink/40 mb-2.5 -mt-1.5">
        Controls what every account other than yours can even see or pick — at signup, in Settings → Upgrade Plan,
        and in their sidebar. Off here means invisible everywhere else, regardless of any tenant's own toggle below.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        {CORE_MODULES.filter((m) => m.key !== "dashboard").map((mod) => (
          <div key={mod.key} className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm">
            <span className="truncate">{mod.label}</span>
            <Switch checked={!!releasedModules[mod.key]} onChange={(next) => toggleModule(mod.key, next)} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {APP_CATALOG.filter((a) => a.status !== "builtIn").map((app) => (
          <div key={app.key} className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm">
            <span className="truncate">{app.label}</span>
            <Switch checked={!!releasedApps[app.key]} onChange={(next) => toggleApp(app.key, next)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Platform-wide, master-admin-only: every tenant, which AI provider they've
// picked, and which released features they've actually opted into. Both AI
// providers are configured via platform-wide env vars, not per-tenant keys,
// so this is really "who's routed to which shared provider" plus a
// feature-adoption snapshot without opening each tenant's Settings.
function TenantOverview() {
  const [rows, setRows] = useState(null);
  const { widthFor, setWidth, commitWidths } = useResizableColumns("tenant-overview", TENANT_OVERVIEW_COLUMNS);

  const load = () => api.get("/settings/accounts").then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["settings"], load);

  const featureLabels = (r) => [
    ...r.optedModules.map((k) => MODULE_LABEL[k] || k),
    ...r.optedApps.map((k) => APP_LABEL[k] || k),
  ];

  // Real customer signups only — the platform's own master admin account
  // isn't a signup to count. Everything below is derived straight from
  // each account's own createdAt, not a separate tracked metric.
  const customers = (rows || []).filter((r) => !r.isMasterAdmin);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const signupStats = rows === null ? null : {
    total: customers.length,
    today: customers.filter((r) => r.createdAt && startOfDay(new Date(r.createdAt)).getTime() === startOfDay(now).getTime()).length,
    last7Days: customers.filter((r) => r.createdAt && now - new Date(r.createdAt) <= 7 * 24 * 60 * 60 * 1000).length,
    last30Days: customers.filter((r) => r.createdAt && now - new Date(r.createdAt) <= 30 * 24 * 60 * 60 * 1000).length,
  };

  return (
    <div className="mb-8">
      <h3 className="font-display font-semibold text-sm text-ink/70 mb-2.5 flex items-center gap-1.5">
        <Sparkles size={14} className="text-primary" /> Tenant Overview
      </h3>
      <p className="text-xs text-ink/40 mb-2.5 -mt-1.5">AI provider routing and which released features each tenant has opted into.</p>

      {signupStats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Card className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-ink/40"><UserPlus size={12} /> Total Signups</div>
            <div className="text-xl font-display font-bold mt-0.5">{signupStats.total}</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-xs text-ink/40">New Today</div>
            <div className="text-xl font-display font-bold mt-0.5">{signupStats.today}</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-xs text-ink/40">Last 7 Days</div>
            <div className="text-xl font-display font-bold mt-0.5">{signupStats.last7Days}</div>
          </Card>
          <Card className="p-3.5">
            <div className="text-xs text-ink/40">Last 30 Days</div>
            <div className="text-xl font-display font-bold mt-0.5">{signupStats.last30Days}</div>
          </Card>
        </div>
      )}

      {rows === null ? (
        <p className="text-xs text-ink/40">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-ink/40">No tenant accounts yet.</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-base text-left">
                {TENANT_OVERVIEW_COLUMNS.map((c) => (
                  <ResizableTh
                    key={c.key}
                    className="p-2.5 font-medium text-ink/50 text-xs"
                    width={widthFor(c.key, c.defaultWidth)}
                    onResize={(w) => setWidth(c.key, w)}
                    onResizeEnd={commitWidths}
                  >
                    {c.label}
                  </ResizableTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId} className="border-b border-border last:border-0">
                  <td className="p-2.5">{r.company || "—"}</td>
                  <td className="p-2.5 text-ink/60">
                    {r.name} {r.isMasterAdmin && <Badge>Master Admin</Badge>}
                    <div className="text-xs text-ink/40">{r.email}</div>
                  </td>
                  <td className="p-2.5 text-xs text-ink/60">{r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                  <td className="p-2.5 capitalize text-ink/60">{r.plan}</td>
                  <td className="p-2.5">{AI_PROVIDER_LABEL[r.aiProvider] || r.aiProvider}</td>
                  <td className="p-2.5 text-xs text-ink/60 max-w-[220px]">
                    {featureLabels(r).length ? featureLabels(r).join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function Apps() {
  const [settings, setSettings] = useState(null);

  const load = () => api.get("/settings").then((r) => setSettings(r.data));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["settings"], load);

  const isOn = (app) => app.status === "builtIn" || !!settings?.apps?.[app.key];

  const toggle = async (app, next) => {
    const updatedApps = { ...settings.apps, [app.key]: next };
    setSettings((s) => ({ ...s, apps: updatedApps }));
    await api.put("/settings", { apps: updatedApps });
  };

  const isModuleOn = (key) => settings?.modules?.[key] !== false;

  const toggleModule = async (key, next) => {
    const updatedModules = { ...settings.modules, [key]: next };
    setSettings((s) => ({ ...s, modules: updatedModules }));
    await api.put("/settings", { modules: updatedModules });
  };

  if (!settings) return <div className="text-ink/40 text-sm">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Admin Portal"
        subtitle="Release features platform-wide, then turn on the modules your own account needs — admins only."
      />

      <ReleaseFeatures />
      <TenantOverview />

      <div className="mb-8">
        <h3 className="font-display font-semibold text-sm text-ink/70 mb-2.5">Core CRM (your account)</h3>
        <p className="text-xs text-ink/40 mb-2.5 -mt-1.5">
          Hide sections your team isn't using yet — e.g. launch with only Dashboard + Forms turned on.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {CORE_MODULES.map((mod) => {
            const Icon = mod.icon;
            const on = isModuleOn(mod.key);
            return (
              <Card key={mod.key} className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <Icon size={17} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{mod.label}</p>
                  <p className="text-xs text-ink/40 mt-0.5">
                    {on ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 size={11} /> Visible
                      </span>
                    ) : (
                      "Hidden"
                    )}
                  </p>
                </div>
                <Switch checked={on} onChange={(next) => toggleModule(mod.key, next)} />
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {APP_CATEGORIES.map((category) => {
          const apps = APP_CATALOG.filter((a) => a.category === category);
          return (
            <div key={category}>
              <h3 className="font-display font-semibold text-sm text-ink/70 mb-2.5">{category}</h3>
              <div className="grid grid-cols-3 gap-3">
                {apps.map((app) => {
                  const Icon = app.icon;
                  const on = isOn(app);
                  const builtIn = app.status === "builtIn";
                  const planned = app.status === "planned";
                  return (
                    <Card key={app.key} className="p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                        <Icon size={17} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{app.label}</p>
                        <p className="text-xs text-ink/40 mt-0.5">
                          {builtIn ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 size={11} /> Always on
                            </span>
                          ) : planned ? (
                            "Coming soon"
                          ) : (
                            "Ready to use"
                          )}
                        </p>
                      </div>
                      <Switch checked={on} onChange={(next) => toggle(app, next)} disabled={builtIn} />
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
