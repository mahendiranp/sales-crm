import { useState } from "react";
import FormFieldInput from "./FormFieldInput";

// Live preview of a form as it's being built — reuses the exact same field
// renderer the public form page uses, so this is a faithful "what customers
// will see" preview, not a rough approximation. Answers are local/ephemeral
// (nothing is ever submitted from here) — just lets you click through
// rating/yes-no/radio controls to see how they behave.
export default function FormPreview({ name, description, fields, branding = {} }) {
  const [answers, setAnswers] = useState({});
  const setAnswer = (fieldId, value) => setAnswers((a) => ({ ...a, [fieldId]: value }));

  const logoType = branding.logoType || (branding.logoDataUrl ? "image" : "none");
  const accentColor = branding.accentColor || "";
  const pageStyle = branding.backgroundImageDataUrl
    ? {
        backgroundImage: `url(${branding.backgroundImageDataUrl})`,
        backgroundSize: branding.backgroundImageFit === "repeat" ? "auto" : branding.backgroundImageFit || "cover",
        backgroundRepeat: branding.backgroundImageFit === "repeat" ? "repeat" : "no-repeat",
        backgroundPosition: branding.backgroundImagePosition || "center",
      }
    : branding.backgroundCss
    ? { background: branding.backgroundCss }
    : branding.backgroundColor
    ? { backgroundColor: branding.backgroundColor }
    : undefined;
  const overlayOpacity = branding.backgroundImageDataUrl ? (branding.backgroundImageOverlay || 0) / 100 : 0;

  return (
    <div className="sticky top-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2">Live Preview</p>
      <div
        className={`relative rounded-card border border-border overflow-hidden ${pageStyle ? "" : "bg-base"}`}
        style={pageStyle}
      >
        {overlayOpacity > 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />
        )}
        <div className="relative p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <div className="bg-white border border-border rounded-card shadow-card p-5">
            {logoType === "image" && branding.logoDataUrl && (
              <img src={branding.logoDataUrl} alt="" className="h-12 mb-3 object-contain" />
            )}
            {logoType === "text" && branding.logoText && (
              <div className="font-display font-bold text-lg mb-3">{branding.logoText}</div>
            )}

            <h2 className="font-display font-bold text-xl mb-1">{name || "Untitled Form"}</h2>
            {description && <p className="text-sm text-ink/50 mb-5">{description}</p>}

            {fields.length === 0 ? (
              <p className="text-sm text-ink/40 border border-dashed border-border rounded-lg p-6 text-center">
                Add fields to see them here.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((f) => (
                  <div key={f.id}>
                    <label className="block text-sm font-medium mb-1.5">
                      {f.label} {f.required && <span className="text-danger">*</span>}
                    </label>
                    <FormFieldInput field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} accentColor={accentColor} />
                    {f.helpText && <p className="text-xs text-ink/40 mt-1">{f.helpText}</p>}
                  </div>
                ))}

                <button
                  type="button"
                  style={accentColor ? { backgroundColor: accentColor } : undefined}
                  className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-medium mt-2"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
