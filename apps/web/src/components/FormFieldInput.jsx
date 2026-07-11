import { inputCls } from "./ui";

// Renders the right input control for a form field, by type. Shared by the
// public/preview form page and the Form Builder's live preview panel, so
// what you see while editing is pixel-for-pixel what customers will see.
export default function FormFieldInput({ field, value, onChange, invalid, accentColor }) {
  const common = {
    className: `${inputCls} ${invalid ? "border-danger focus:border-danger" : ""}`,
    value: value ?? "",
    onChange: (e) => onChange(e.target.value),
  };

  switch (field.type) {
    case "longtext":
      return <textarea {...common} rows={4} placeholder={field.placeholder} />;
    case "email":
      return <input type="email" {...common} placeholder={field.placeholder} />;
    case "phone":
      return <input type="tel" {...common} placeholder={field.placeholder} />;
    case "number":
      return (
        <input
          type="number"
          {...common}
          placeholder={field.placeholder}
          min={field.validation?.min || undefined}
          max={field.validation?.max || undefined}
        />
      );
    case "date":
      return <input type="date" {...common} />;
    case "time":
      return <input type="time" {...common} />;
    case "dropdown":
      return (
        <select {...common}>
          <option value="">Select…</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="space-y-1.5">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="radio" name={field.id} checked={value === o} onChange={() => onChange(o)} />
              {o}
            </label>
          ))}
        </div>
      );
    case "checkbox": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "file":
      return <input type="file" onChange={(e) => onChange(e.target.files?.[0]?.name || "")} className="text-sm" />;
    case "rating":
      return (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const isSelected = Number(value) === n;
            return (
              <button
                type="button"
                key={n}
                onClick={() => onChange(n)}
                style={isSelected && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                className={`w-9 h-9 rounded-lg border text-sm font-medium ${
                  isSelected ? "bg-primary text-white border-primary" : "border-border text-ink/60"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      );
    case "yesno":
      return (
        <div className="flex gap-2">
          {["Yes", "No"].map((o) => {
            const isSelected = value === o;
            return (
              <button
                type="button"
                key={o}
                onClick={() => onChange(o)}
                style={isSelected && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                  isSelected ? "bg-primary text-white border-primary" : "border-border text-ink/60"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    default:
      return <input type="text" {...common} placeholder={field.placeholder} />;
  }
}
