import { useCallback, useState } from "react";

const storageName = (tableKey) => `table-col-widths:${tableKey}`;

// Per-table column widths, persisted to localStorage so a resize sticks
// across visits (same browser/device — this is client-only, no backend).
// `columns` is [{ key, defaultWidth }]; only used to seed defaults the
// first time a column is seen (e.g. a table like Form Responses whose
// columns depend on the specific form's fields) — already-saved widths for
// still-present keys always win over a changed default.
export default function useResizableColumns(tableKey, columns) {
  const [widths, setWidths] = useState(() => {
    const defaults = Object.fromEntries(columns.map((c) => [c.key, c.defaultWidth]));
    if (typeof window === "undefined") return defaults;
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(storageName(tableKey)) || "{}") };
    } catch {
      return defaults;
    }
  });

  // Called continuously while dragging — updates the live column width
  // without touching localStorage (writing on every mousemove pixel would
  // be wasteful and can jank the drag itself).
  const setWidth = useCallback((key, value) => {
    setWidths((w) => ({ ...w, [key]: value }));
  }, []);

  // Called once on drag end — persists whatever the widths ended up at.
  const commitWidths = useCallback(() => {
    setWidths((w) => {
      try {
        localStorage.setItem(storageName(tableKey), JSON.stringify(w));
      } catch {
        // Private-mode/quota-exceeded localStorage — resizing still works
        // for the rest of this session, just doesn't survive a reload.
      }
      return w;
    });
  }, [tableKey]);

  // Width for a column not yet in state (e.g. a newly-added form field
  // column) — falls back to its own default so it renders sanely before
  // the very first resize ever touches it.
  const widthFor = useCallback(
    (key, fallback) => widths[key] ?? fallback,
    [widths]
  );

  return { widths, widthFor, setWidth, commitWidths };
}
