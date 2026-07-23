import { useState } from "react";
import { Trash2, ChevronUp, ChevronDown, Plus, Upload, X } from "lucide-react";
import { FieldPreviewInput } from "./TemplateFieldPreview";

// A deliberately small customization surface for anonymous visitors —
// title, fields, one accent color, one logo. Everything else (branding
// theme picker, approval config, workflow, AI Center, publishing) stays
// behind the real, authenticated Form Builder (views/Forms.jsx) — this
// isn't a scaled-down version of that editor, it's a distinct, narrower
// "try before you sign up" surface by design.
const ADDABLE_TYPES = [
  { type: "text", label: "Short Text" },
  { type: "longtext", label: "Paragraph" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "dropdown", label: "Dropdown" },
  { type: "checkbox", label: "Checkboxes" },
  { type: "yesno", label: "Yes / No" },
  { type: "rating", label: "Rating" },
  { type: "file", label: "File Upload" },
];

// Same size cap as the real builder's logo upload (Forms.jsx's
// ImageUploadField) — images are stored inline as base64, keep them small.
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

const ACCENT_SWATCHES = ["#2F5D50", "#DC2626", "#2563EB", "#D97706", "#7C3AED", "#0D9488"];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateCustomizeEditor({ template, state, onChange, onSignUp, signingUp }) {
  const { title, fields, accentColor, logoDataUrl } = state;
  const [addType, setAddType] = useState(ADDABLE_TYPES[0].type);
  const [logoError, setLogoError] = useState("");

  const update = (patch) => onChange({ ...state, ...patch });

  const updateField = (index, patch) => update({ fields: fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  const removeField = (index) => update({ fields: fields.filter((_, i) => i !== index) });
  const moveField = (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    [next[index], next[to]] = [next[to], next[index]];
    update({ fields: next });
  };
  const addField = () => {
    const meta = ADDABLE_TYPES.find((t) => t.type === addType);
    update({ fields: [...fields, { type: addType, label: `New ${meta.label} Field`, required: false }] });
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");
    if (file.size > MAX_IMAGE_BYTES) {
      setLogoError("Image is too large — please use one under 1.5MB.");
      return;
    }
    update({ logoDataUrl: await fileToDataUrl(file) });
  };

  // Progress checklist is computed from a diff against the template's
  // untouched defaults, not tracked as separate booleans — it can't drift
  // out of sync with what's actually changed.
  const fieldCountDelta = fields.length - template.fields.length;
  const progress = [
    title.trim() && title.trim() !== template.name && "Renamed form",
    fieldCountDelta > 0 && `Added ${fieldCountDelta} field${fieldCountDelta === 1 ? "" : "s"}`,
    fieldCountDelta < 0 && `Removed ${-fieldCountDelta} field${fieldCountDelta === -1 ? "" : "s"}`,
    accentColor && "Changed accent color",
    logoDataUrl && "Added a logo",
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-ink/50 mb-1">Form Title</label>
        <input
          value={title}
          onChange={(e) => update({ title: e.target.value })}
          className="w-full h-10 px-3 rounded-lg border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1.5">Accent Color</label>
          <div className="flex gap-1.5">
            {ACCENT_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ accentColor: c })}
                className={`w-6 h-6 rounded-full border-2 ${accentColor === c ? "border-ink" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={`Use accent color ${c}`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1.5">Logo</label>
          {logoDataUrl ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoDataUrl} alt="Logo preview" className="w-8 h-8 rounded object-contain border border-border" />
              <button type="button" onClick={() => update({ logoDataUrl: "" })} className="text-ink/40 hover:text-danger">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-border text-xs text-ink/50 cursor-pointer hover:bg-base">
              <Upload size={12} /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
          )}
          {logoError && <p className="text-[11px] text-danger mt-1">{logoError}</p>}
        </div>
      </div>

      <div className="space-y-4">
        {fields.map((f, i) => (
          <div key={i} className="group relative">
            <div className="flex items-center gap-1.5 mb-1">
              <input
                className="flex-1 min-w-0 text-sm font-medium text-ink/80 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-0.5"
                value={f.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
              />
              {f.required && <span className="text-danger text-sm">*</span>}
              <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} className="text-ink/30 hover:text-ink disabled:opacity-20" aria-label="Move field up">
                  <ChevronUp size={13} />
                </button>
                <button type="button" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-ink/30 hover:text-ink disabled:opacity-20" aria-label="Move field down">
                  <ChevronDown size={13} />
                </button>
                <label className="flex items-center gap-1 text-[10px] text-ink/50 px-1">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> Req
                </label>
                <button type="button" onClick={() => removeField(i)} className="text-ink/30 hover:text-danger" aria-label="Remove field">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <FieldPreviewInput field={f} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
        <select className="h-9 px-2 rounded border border-border text-sm" value={addType} onChange={(e) => setAddType(e.target.value)}>
          {ADDABLE_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1 h-9 px-3 rounded-lg border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5"
        >
          <Plus size={14} /> Add Field
        </button>
      </div>

      {progress.length > 0 && (
        <div className="mt-5 p-3 rounded-lg bg-primary/5 border border-primary/15">
          <p className="text-xs font-semibold text-ink/70 mb-1.5">Customize Progress</p>
          <ul className="space-y-0.5">
            {progress.map((line) => (
              <li key={line} className="text-xs text-ink/60">✓ {line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-border text-center">
        <p className="text-xs text-ink/40 mb-3">Changes are temporary. Sign up to save and publish this template.</p>
        <button
          onClick={onSignUp}
          disabled={signingUp}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark disabled:opacity-60"
        >
          {signingUp ? "Setting up your form…" : "Sign Up to Continue →"}
        </button>
      </div>
    </div>
  );
}
