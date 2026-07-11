import { Check, Sparkles } from "lucide-react";
import { APP_CATALOG, APP_CATEGORIES, RELEASED_APP_KEYS } from "../lib/appCatalog";
import { useAuth } from "../context/AuthContext";

// A "build your toolkit" style multi-select: tap a tile to pick it up into
// your starter kit. Used on signup so picking features feels like putting
// together a kit rather than filling out a form. Only offers apps that
// are actually released (master admin sees the full catalog) — otherwise
// an owner could turn on something that isn't live yet.
export default function FeaturePicker({ selected, onToggle, onUseRecommended }) {
  const { isMasterAdmin } = useAuth();
  const visibleCatalog = isMasterAdmin ? APP_CATALOG : APP_CATALOG.filter((a) => a.status === "builtIn" || RELEASED_APP_KEYS.includes(a.key));
  const pickedApps = visibleCatalog.filter((a) => a.status === "builtIn" || selected[a.key]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center -space-x-2">
          {pickedApps.slice(0, 8).map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.key}
                className="w-8 h-8 rounded-full bg-primary/10 border-2 border-white flex items-center justify-center shrink-0"
                title={a.label}
              >
                <Icon size={14} className="text-primary" />
              </div>
            );
          })}
          <span className="pl-4 text-xs text-ink/50 font-medium">
            {pickedApps.length} in your kit
          </span>
        </div>
        <button
          type="button"
          onClick={onUseRecommended}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors shrink-0"
        >
          <Sparkles size={13} /> Use recommended
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto pr-1 space-y-4 border border-border rounded-lg p-3 bg-base/40">
        {APP_CATEGORIES.map((category) => {
          const apps = visibleCatalog.filter((a) => a.category === category);
          if (apps.length === 0) return null;
          return (
            <div key={category}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-1.5">
                {category}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {apps.map((app) => {
                  const Icon = app.icon;
                  const builtIn = app.status === "builtIn";
                  const on = builtIn || !!selected[app.key];
                  return (
                    <button
                      type="button"
                      key={app.key}
                      disabled={builtIn}
                      onClick={() => onToggle(app.key)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2.5 text-center transition-all duration-150 ${
                        builtIn
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                          : on
                          ? "border-primary bg-primary/10 text-primary shadow-sm -translate-y-0.5"
                          : "border-border bg-white text-ink/60 hover:border-primary/40 hover:-translate-y-0.5"
                      }`}
                    >
                      {on && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                      <Icon size={18} />
                      <span className="text-[10.5px] font-medium leading-tight line-clamp-2">{app.label}</span>
                      {app.status === "planned" && !builtIn && (
                        <span className="text-[9px] text-ink/35">Soon</span>
                      )}
                    </button>
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
