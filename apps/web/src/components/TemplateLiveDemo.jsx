import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { X, Star, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "./ui";

const inputLook = "w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

// Real, fillable inputs (unlike TemplateFieldPreview's disabled look-alikes)
// — values live in local state only, never sent anywhere. "Not allowed" per
// the spec: no save, no publish, no share, nothing persisted.
function LiveField({ field, value, onChange }) {
  switch (field.type) {
    case "longtext":
      return <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputLook} h-auto py-2`} />;
    case "dropdown":
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputLook}>
          <option value="">Select an option</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "checkbox":
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={(value || []).includes(o)}
                onChange={(e) => {
                  const set = new Set(value || []);
                  e.target.checked ? set.add(o) : set.delete(o);
                  onChange([...set]);
                }}
              /> {o}
            </label>
          ))}
        </div>
      );
    case "yesno":
      return (
        <div className="flex gap-4 pt-1">
          {["Yes", "No"].map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-ink/70">
              <input type="radio" checked={value === o} onChange={() => onChange(o)} /> {o}
            </label>
          ))}
        </div>
      );
    case "rating":
      return (
        <div className="flex gap-1 pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} type="button" onClick={() => onChange(i + 1)}>
              <Star size={20} className={i < (value || 0) ? "fill-accent text-accent" : "text-border"} />
            </button>
          ))}
        </div>
      );
    case "file":
      return <div className={`${inputLook} h-auto py-2.5 flex items-center gap-2 text-ink/40`}>📎 (Preview only — file upload is disabled)</div>;
    case "date":
      return <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputLook} />;
    case "time":
      return <input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputLook} />;
    case "email":
      return <input type="email" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputLook} />;
    case "number":
      return <input type="number" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputLook} />;
    default:
      return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputLook} />;
  }
}

function outcomeBullet(step) {
  const s = step.toLowerCase();
  if (s.includes("approval")) return "Approval request created";
  if (s.includes("notif")) return "Manager notified";
  if (s.includes("task")) return "Task created";
  if (s.includes("timeline")) return "Activity recorded";
  if (s.includes("ai")) return "AI monitoring started";
  if (s.includes("meeting")) return "Meeting created on calendar";
  return step;
}

export default function TemplateLiveDemo({ template, onClose, onUseTemplate }) {
  const router = useRouter();
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  const steps = template.workflowSteps?.length ? template.workflowSteps : ["Timeline updated"];

  const setValue = (i, v) => setValues((prev) => ({ ...prev, [i]: v }));

  // Reveals each automation step one at a time (not all at once) so the
  // demo reads as something actually happening, not a static checklist.
  useEffect(() => {
    if (!submitted) return;
    setRevealedCount(0);
    const timers = steps.map((_, i) => setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), 500 + i * 550));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const goSignup = () => {
    const redirect = encodeURIComponent(`/templates/${template.key}?useTemplate=1`);
    router.push(`/signup?redirect=${redirect}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-display font-semibold">{submitted ? "✓ Demo Complete" : `${template.name} — Live Demo`}</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink"><X size={19} /></button>
        </div>

        {!submitted ? (
          <div className="p-5">
            <p className="text-xs text-ink/40 mb-4">Try it out — fill this in like a real respondent would. This is a safe demo environment. Nothing is saved.</p>
            <div className="space-y-4">
              {template.fields.map((f, i) => (
                <div key={i}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm font-medium text-ink/80">{f.label}</span>
                    {f.required && <span className="text-danger text-sm">*</span>}
                  </div>
                  <LiveField field={f} value={values[i]} onChange={(v) => setValue(i, v)} />
                </div>
              ))}
            </div>
            <Button onClick={() => setSubmitted(true)} className="w-full justify-center mt-5">Submit</Button>
          </div>
        ) : (
          <div className="p-6 text-center">
            <CheckCircle2 size={40} className="text-primary mx-auto mb-3" />
            <p className="text-ink/60 mb-4">Here's what Flowora would create:</p>
            <ul className="text-left inline-block space-y-2 mb-6 min-w-[220px]">
              {steps.map((step, i) => {
                const revealed = i < revealedCount;
                return (
                  <li key={step} className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${revealed ? "opacity-100 text-ink/70" : "opacity-0"}`}>
                    {revealed ? <CheckCircle2 size={15} className="text-primary shrink-0" /> : <Loader2 size={15} className="shrink-0" />}
                    {outcomeBullet(step)}
                  </li>
                );
              })}
            </ul>
            {revealedCount >= steps.length && (
              <div className="animate-[fadeIn_0.4s_ease-out]">
                <p className="font-medium text-ink mb-3">Want to use this workflow?</p>
                <Button onClick={onUseTemplate || goSignup} className="w-full justify-center">Sign Up to Continue →</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
