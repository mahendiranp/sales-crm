import { Check } from "lucide-react";
import { CORE_MODULES, RELEASED_MODULE_KEYS } from "../lib/coreModules";
import { useAuth } from "../context/AuthContext";

// Tile picker for core CRM sections (Leads, Deals, Dashboard, etc.) — used
// on signup and again in Settings → Upgrade Plan so an owner can adjust
// their selection later without going through the master admin. Only
// shows modules that are actually released — otherwise an owner could
// toggle on a section that isn't live yet and get an empty/broken page.
// Master admin sees the full catalog, same as everywhere else.
export default function CoreModulePicker({ selected, onToggle }) {
  const { isMasterAdmin } = useAuth();
  const visibleModules = isMasterAdmin ? CORE_MODULES : CORE_MODULES.filter((m) => RELEASED_MODULE_KEYS.includes(m.key));

  return (
    <div className="grid grid-cols-4 gap-2">
      {visibleModules.map((mod) => {
        const Icon = mod.icon;
        const on = !!selected[mod.key];
        return (
          <button
            type="button"
            key={mod.key}
            onClick={() => onToggle(mod.key)}
            className={`relative flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2.5 text-center transition-all duration-150 ${
              on ? "border-primary bg-primary/10 text-primary shadow-sm -translate-y-0.5" : "border-border bg-white text-ink/60 hover:border-primary/40 hover:-translate-y-0.5"
            }`}
          >
            {on && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
            <Icon size={18} />
            <span className="text-[10.5px] font-medium leading-tight line-clamp-2">{mod.label}</span>
          </button>
        );
      })}
    </div>
  );
}
