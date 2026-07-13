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
