import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, Switch } from "../components/ui";
import { APP_CATALOG, APP_CATEGORIES } from "../lib/appCatalog";
import useLiveCollection from "../lib/useLiveCollection";

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

  if (!settings) return <div className="text-ink/40 text-sm">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Admin Portal"
        subtitle="Turn on the modules your team needs. Enabled apps show up in the sidebar right away — admins only."
      />

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
