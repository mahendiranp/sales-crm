import { Star, Calendar } from "lucide-react";
import { LAYOUT_GRID_COLS_CLASS, fieldColSpanClass } from "../lib/formLayout";

// Read-only — a visitor should see what respondents would see, not a form
// builder. Field customization happens after signup in the real builder
// (views/Forms.jsx's FormBuilder), not here.
const inputLook = "w-full h-10 px-3 rounded-lg border border-border bg-base/40 text-sm text-ink/50";

function FieldPreviewInput({ field }) {
  switch (field.type) {
    case "longtext":
      return <textarea disabled rows={2} placeholder={`Type your ${field.label.toLowerCase()}…`} className={`${inputLook} h-auto py-2 resize-none`} />;
    case "dropdown":
      return (
        <select disabled className={inputLook}>
          <option>{field.options?.[0] || "Select an option"}</option>
        </select>
      );
    case "checkbox":
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {(field.options?.length ? field.options : ["Option 1", "Option 2"]).map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-ink/50">
              <input type="checkbox" disabled /> {o}
            </label>
          ))}
        </div>
      );
    case "yesno":
      return (
        <div className="flex gap-3 pt-1">
          <label className="flex items-center gap-1.5 text-sm text-ink/50"><input type="radio" disabled /> Yes</label>
          <label className="flex items-center gap-1.5 text-sm text-ink/50"><input type="radio" disabled /> No</label>
        </div>
      );
    case "rating":
      return (
        <div className="flex gap-1 pt-1">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={18} className="text-border" />)}
        </div>
      );
    case "file":
      return <div className={`${inputLook} h-auto py-2.5 flex items-center gap-2 text-ink/35`}>📎 Choose a file…</div>;
    case "date":
    case "time":
      return (
        <div className="relative">
          <input disabled type="text" placeholder={field.type === "date" ? "dd/mm/yyyy" : "--:--"} className={inputLook} />
          <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/25" />
        </div>
      );
    default:
      return <input disabled type="text" placeholder={`Your ${field.label.toLowerCase()}`} className={inputLook} />;
  }
}

// `layoutColumns` (1/2/3) is the template's real default settings.layoutColumns
// value (see formTemplates.js's layoutColumnsFor) — the same setting the
// Form Builder and public form-fill page use, so what a visitor sees here
// is what the created form will actually look like, not a fabricated
// preview-only layout.
export default function TemplateFieldPreview({ fields, layoutColumns = 1 }) {
  if (fields.length === 0) {
    return <p className="text-sm text-ink/40">This is a blank starting point — add your own fields after you sign up.</p>;
  }
  return (
    <div>
      <div className={`grid grid-cols-1 ${LAYOUT_GRID_COLS_CLASS[layoutColumns]} gap-4`}>
        {fields.map((f, i) => (
          <div key={i} className={fieldColSpanClass(f)}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm font-medium text-ink/80">{f.label}</span>
              {f.required && <span className="text-danger text-sm">*</span>}
            </div>
            <FieldPreviewInput field={f} />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled
        className="w-full h-11 rounded-lg bg-primary/30 text-white font-medium text-sm cursor-not-allowed mt-4"
      >
        Submit (Preview Only)
      </button>
    </div>
  );
}

export { FieldPreviewInput, inputLook };
