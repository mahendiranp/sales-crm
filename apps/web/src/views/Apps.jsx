import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, Switch, Badge } from "../components/ui";
import { APP_CATALOG, APP_CATEGORIES } from "../lib/appCatalog";
import { CORE_MODULES } from "../lib/coreModules";
import useLiveCollection from "../lib/useLiveCollection";

const AI_PROVIDER_LABEL = { anthropic: "Anthropic (Claude)", gemini: "Google Gemini" };

// Platform-wide, master-admin-only: every tenant with which AI provider
// they've picked (Settings → AI Configuration on their end). Both
// providers are configured via platform-wide env vars, not per-tenant
// keys, so this is really "who's routed to which shared provider."
function TenantAiProviders() {
  const [rows, setRows] = useState(null);

  const load = () => api.get("/settings/accounts").then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["settings"], load);

  return (
    <div className="mb-8">
      <h3 className="font-display font-semibold text-sm text-ink/70 mb-2.5 flex items-center gap-1.5">
        <Sparkles size={14} className="text-primary" /> Tenant AI Providers
      </h3>
      <p className="text-xs text-ink/40 mb-2.5 -mt-1.5">Which AI provider each tenant's Form Builder AI Assistant is routed to.</p>
      {rows === null ? (
        <p className="text-xs text-ink/40">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-ink/40">No tenant accounts yet.</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-base text-left">
                <th className="p-2.5 font-medium text-ink/50 text-xs">Company</th>
                <th className="p-2.5 font-medium text-ink/50 text-xs">Owner</th>
                <th className="p-2.5 font-medium text-ink/50 text-xs">Plan</th>
                <th className="p-2.5 font-medium text-ink/50 text-xs">AI Provider</th>
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
                  <td className="p-2.5 capitalize text-ink/60">{r.plan}</td>
                  <td className="p-2.5">{AI_PROVIDER_LABEL[r.aiProvider] || r.aiProvider}</td>
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
        subtitle="Turn on the modules your team needs. Enabled apps show up in the sidebar right away — admins only."
      />

      <TenantAiProviders />

      <div className="mb-8">
        <h3 className="font-display font-semibold text-sm text-ink/70 mb-2.5">Core CRM</h3>
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
