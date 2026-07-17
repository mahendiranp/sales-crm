import { Check } from "lucide-react";
import { MODULE_GROUPS } from "../lib/coreModules";
import { useAuth } from "../context/AuthContext";
import usePlatformFeatures from "../lib/usePlatformFeatures";

// Group picker for core CRM sections — one tile per sidebar section
// (Pipeline, Work, Engage, Insights, Admin), matching Layout.jsx's
// NAV_SECTIONS exactly: picking "Pipeline" turns on Leads, Contacts,
// Companies, and Deals together, since that's how they show up together
// in the sidebar — not four separate toggles for one visual section.
// Only shows groups with at least one module master admin has released
// platform-wide from the Admin Portal; toggling only ever touches the
// released members of a group, never one that isn't live yet. Master
// admin sees every group in full, same as everywhere else.
//
// Dashboard has its own "Overview" section but isn't included here at
// all — it's on every plan by default, so there's nothing to pick.
export default function CoreModulePicker({ selected, onToggle }) {
  const { isMasterAdmin } = useAuth();
  const { releasedModules } = usePlatformFeatures();

  const visibleGroups = MODULE_GROUPS
    .map((g) => ({
      ...g,
      keys: isMasterAdmin ? g.moduleKeys : g.moduleKeys.filter((k) => releasedModules[k]),
    }))
    .filter((g) => g.keys.length > 0);

  if (!isMasterAdmin && visibleGroups.length === 0) {
    return <p className="text-xs text-ink/40">Dashboard is included in every plan — no other core sections are available yet.</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {visibleGroups.map((group) => {
        const Icon = group.icon;
        const on = group.keys.every((k) => !!selected[k]);
        return (
          <button
            type="button"
            key={group.key}
            onClick={() => group.keys.forEach((k) => onToggle(k, !on))}
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
            <span className="text-[10.5px] font-medium leading-tight line-clamp-2">{group.label}</span>
          </button>
        );
      })}
    </div>
  );
}
