// Shared between the Build canvas (Forms.jsx) and the public form page
// (pages/forms/[id].jsx) so both render a form's field layout identically —
// what the owner sees while building is what respondents actually get.

// These always take the full row width even in a 2/3-column layout — a
// long-text box, file picker, multi-option list, or the meeting-booking
// slot picker all look cramped squeezed into a narrow column.
export const WIDE_FIELD_TYPES = ["longtext", "file", "checkbox", "radio", "booking"];

// Tailwind's JIT only picks up class names literally present in source, so
// grid-cols-N has to be an explicit lookup rather than a template literal
// built from the numeric column count at runtime.
export const LAYOUT_GRID_COLS_CLASS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

// Appearance: a field can force full-row width regardless of type (beyond
// the automatic WIDE_FIELD_TYPES list above), or explicitly opt back into
// the default auto-sizing.
export function fieldColSpanClass(field) {
  if (field.appearance?.width === "full") return "sm:col-span-full";
  if (field.appearance?.width === "auto" || !field.appearance?.width) {
    return WIDE_FIELD_TYPES.includes(field.type) ? "sm:col-span-full" : "";
  }
  return "";
}

function isBlank(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

// Logic: whether a field should be shown, based on another field's current
// answer. Fields without logic enabled (the vast majority) always show.
export function isFieldVisible(field, answers) {
  const logic = field.logic;
  if (!logic?.enabled || !logic.fieldId) return true;
  const actual = answers ? answers[logic.fieldId] : undefined;
  const target = logic.value;
  const operator = logic.operator || "equals";

  if (operator === "is_empty") return isBlank(actual);
  if (operator === "is_not_empty") return !isBlank(actual);
  if (operator === "greater_than") return Number(actual) > Number(target);
  if (operator === "less_than") return Number(actual) < Number(target);

  const equalsMatch = Array.isArray(actual) ? actual.includes(target) : String(actual ?? "") === String(target ?? "");
  if (operator === "not_equals") return !equalsMatch;

  const containsMatch = Array.isArray(actual)
    ? actual.some((v) => String(v).toLowerCase().includes(String(target ?? "").toLowerCase()))
    : String(actual ?? "").toLowerCase().includes(String(target ?? "").toLowerCase());
  if (operator === "contains") return containsMatch;
  if (operator === "not_contains") return !containsMatch;

  return equalsMatch;
}
