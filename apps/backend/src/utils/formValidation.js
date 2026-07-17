// Server-side mirror of the frontend's validateField/isFieldVisible
// (apps/web/src/pages/forms/[id].jsx and lib/formLayout.js). The frontend's
// checks are just UX — a submission can always be crafted directly against
// POST /forms/:id/responses, so required/email/phone/number/length rules
// have to be re-enforced here too, not just in the browser.

function isBlank(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function isFieldVisible(field, answers) {
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

function validateField(field, value) {
  const isEmpty = isBlank(value);
  if (field.required && isEmpty) return `${field.label} is required.`;
  if (isEmpty) return null;

  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address.";
  }
  if (field.type === "phone" && !/^[0-9+\-\s()]{7,15}$/.test(value)) {
    return "Enter a valid phone number.";
  }
  if (field.type === "number") {
    const num = Number(value);
    if (Number.isNaN(num)) return "Enter a valid number.";
    if (field.validation?.min !== undefined && field.validation.min !== "" && num < Number(field.validation.min)) {
      return `Must be at least ${field.validation.min}.`;
    }
    if (field.validation?.max !== undefined && field.validation.max !== "" && num > Number(field.validation.max)) {
      return `Must be at most ${field.validation.max}.`;
    }
  }
  if ((field.type === "text" || field.type === "longtext") && typeof value === "string") {
    if (field.validation?.minLength && value.length < Number(field.validation.minLength)) {
      return `Must be at least ${field.validation.minLength} characters.`;
    }
    if (field.validation?.maxLength && value.length > Number(field.validation.maxLength)) {
      return `Must be at most ${field.validation.maxLength} characters.`;
    }
  }
  return null;
}

// Validates every field that isn't already handled by its own dedicated
// server-side re-check (file uploads, booking slots) — returns the first
// error found, or null if the whole submission is valid. Fields hidden by
// conditional logic are skipped, same as the frontend never requiring an
// answer for a field the respondent never saw.
function validateSubmission(fields, answers) {
  for (const field of fields) {
    if (field.type === "file" || field.type === "booking") continue;
    if (!isFieldVisible(field, answers)) continue;
    const error = validateField(field, answers?.[field.id]);
    if (error) return error;
  }
  return null;
}

module.exports = { isFieldVisible, validateField, validateSubmission };
