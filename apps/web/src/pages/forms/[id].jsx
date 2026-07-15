import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { CheckCircle2, FormInput, Eye, X, ArrowLeft, ArrowRight } from "lucide-react";
import api from "../../api/client";
import FormFieldInput from "../../components/FormFieldInput";
import Seo from "../../components/Seo";
import { WIDE_FIELD_TYPES, LAYOUT_GRID_COLS_CLASS } from "../../lib/formLayout";
import { getLayoutStyleClasses, getFieldRowClasses, findPresentationTemplate } from "../../lib/formLayouts";

function validateField(field, value) {
  const isEmpty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
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

function FieldBlock({ f, answers, setAnswer, errors, accentColor, id, row, layoutStyle }) {
  return (
    <div className={`${WIDE_FIELD_TYPES.includes(f.type) ? "sm:col-span-full" : ""} ${row.rowClass}`}>
      <div className={row.labelWrapClass}>
        <label className={`block ${layoutStyle.labelClass}`}>
          {f.label} {f.required && <span className="text-danger">*</span>}
        </label>
      </div>
      <div className={row.inputWrapClass}>
        <FormFieldInput field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} invalid={!!errors[f.id]} accentColor={accentColor} formId={id} />
        {errors[f.id] ? (
          <p className="text-xs text-danger mt-1">{errors[f.id]}</p>
        ) : (
          f.helpText && <p className="text-xs text-ink/40 mt-1">{f.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default function PublicFormPage() {
  const router = useRouter();
  const { id, preview } = router.query;
  const isPreview = preview === "1";
  const [form, setForm] = useState(null);
  const [error, setError] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!id || !router.isReady) return;
    api
      .get(`/forms/${id}/${isPreview ? "preview" : "public"}`)
      .then((r) => {
        setForm(r.data);
        const defaults = {};
        r.data.fields.forEach((f) => {
          if (f.defaultValue) defaults[f.id] = f.defaultValue;
        });
        setAnswers(defaults);
      })
      .catch(() => setError(true));
  }, [id, isPreview, router.isReady]);

  const setAnswer = (fieldId, value) => {
    setAnswers((a) => ({ ...a, [fieldId]: value }));
    setErrors((e) => (e[fieldId] ? { ...e, [fieldId]: null } : e));
  };

  const doSubmit = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      if (!isPreview) {
        await api.post(`/forms/${id}/responses`, { answers });
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.error || "Couldn't submit this form — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    form.fields.forEach((f) => {
      const msg = validateField(f, answers[f.id]);
      if (msg) nextErrors[f.id] = msg;
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    await doSubmit();
  };

  // One-at-a-time mode validates just the field(s) on the current step
  // before advancing, instead of the whole form at once — a wrong answer
  // three questions back shouldn't block progress on the current one.
  const goNext = async (e) => {
    e.preventDefault();
    const f = form.fields[step];
    const msg = validateField(f, answers[f.id]);
    if (msg) {
      setErrors((er) => ({ ...er, [f.id]: msg }));
      return;
    }
    if (step === form.fields.length - 1) {
      await doSubmit();
    } else {
      setStep((s) => s + 1);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base p-4">
        <Seo title="Form unavailable" noindex path={`/forms/${id || ""}`} />
        <div className="bg-white border border-border rounded-card shadow-card p-8 max-w-md text-center">
          <FormInput size={28} className="text-ink/30 mx-auto mb-3" />
          <p className="font-medium text-ink/70">This form isn't available</p>
          <p className="text-sm text-ink/40 mt-1">It may be unpublished or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const branding = form.settings?.branding || {};
  const hasBackgroundImage = !!branding.backgroundImageDataUrl;
  const pageStyle = hasBackgroundImage
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
  const pageClass = pageStyle ? "relative" : "bg-base relative";
  const overlayOpacity = hasBackgroundImage ? (branding.backgroundImageOverlay || 0) / 100 : 0;
  const accentColor = branding.accentColor || "";
  const layoutColumns = form.settings?.layoutColumns || 1;
  // Wider card for a multi-column layout — the default max-w-xl is sized
  // for a single vertical stack of fields and would cram 2-3 side-by-side
  // fields into too little space otherwise.
  const cardWidthClass = layoutColumns === 3 ? "max-w-4xl" : layoutColumns === 2 ? "max-w-2xl" : "max-w-xl";
  const layoutStyle = getLayoutStyleClasses(branding.layoutStyle);
  const row = getFieldRowClasses(branding.labelPosition, branding.contentAlign);
  const presentationTemplate = findPresentationTemplate(branding.presentationMode);
  const oneAtATime = presentationTemplate.stepped;

  const Overlay = overlayOpacity > 0 && (
    <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />
  );
  // Back-compat: older forms only ever had logoDataUrl with no explicit logoType.
  const logoType = branding.logoType || (branding.logoDataUrl ? "image" : "none");

  const Logo = ({ center }) => {
    if (logoType === "image" && branding.logoDataUrl) {
      return <img src={branding.logoDataUrl} alt="" className={`h-14 ${center ? "mx-auto" : ""} mb-4 object-contain`} />;
    }
    if (logoType === "text" && branding.logoText) {
      return <div className={`font-display font-bold text-xl mb-4 ${center ? "text-center" : ""}`}>{branding.logoText}</div>;
    }
    return null;
  };

  const PreviewBanner = isPreview && (
    <div className="sticky top-0 z-10 bg-ink text-white text-sm px-4 py-2.5 flex items-center justify-center gap-3">
      <Eye size={14} />
      <span>
        <strong>Preview Mode</strong> — this is exactly what customers will see. Submissions here aren't saved.
      </span>
      <Link href="/app/forms" className="flex items-center gap-1 text-white/70 hover:text-white ml-2">
        <X size={14} /> Close
      </Link>
    </div>
  );

  if (submitted) {
    return (
      <div>
        {PreviewBanner}
        <div className={`min-h-screen flex items-center justify-center p-4 ${pageClass}`} style={pageStyle}>
          {Overlay}
          <div className="relative z-10 bg-white border border-border rounded-card shadow-card p-8 max-w-md text-center">
            <Logo center />
            <CheckCircle2 size={32} className="text-primary mx-auto mb-3" />
            <p className="font-display font-semibold text-lg">{form.settings?.confirmationMessage || "Thanks for your submission!"}</p>
            {isPreview && <p className="text-xs text-ink/40 mt-3">(Preview only — nothing was actually submitted.)</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Seo title={form.name} description={form.description || undefined} noindex path={`/forms/${id}`} />
      {PreviewBanner}
      <div className={`min-h-screen p-4 flex justify-center ${pageClass}`} style={pageStyle}>
      {Overlay}
      <div className={`relative z-10 bg-white ${layoutStyle.cardClass} ${layoutStyle.cardPaddingClass} ${cardWidthClass} w-full h-fit my-8 ${row.formAlignClass}`}>
        <Logo center={branding.contentAlign === "center"} />

        {oneAtATime && presentationTemplate.indicator === "bar" && (
          <div className="mb-6">
            <div className="h-1.5 rounded-full bg-base overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((step + 1) / form.fields.length) * 100}%`, backgroundColor: accentColor || undefined }}
              />
            </div>
            <p className="text-xs text-ink/40 mt-1.5">Question {step + 1} of {form.fields.length}</p>
          </div>
        )}
        {oneAtATime && presentationTemplate.indicator === "dots" && (
          <div className={`flex items-center gap-1.5 mb-6 ${branding.contentAlign === "center" ? "justify-center" : ""}`}>
            {form.fields.map((f, i) => (
              <span
                key={f.id}
                className={`w-2 h-2 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-base"}`}
                style={i <= step && accentColor ? { backgroundColor: accentColor } : undefined}
              />
            ))}
          </div>
        )}
        {oneAtATime && presentationTemplate.indicator === "counter" && (
          <p className={`text-xs text-ink/40 mb-6 ${branding.contentAlign === "center" ? "text-center" : ""}`}>
            Question {step + 1} of {form.fields.length}
          </p>
        )}
        {oneAtATime && presentationTemplate.indicator === "percent" && (
          <p className={`text-xs font-medium text-ink/50 mb-6 ${branding.contentAlign === "center" ? "text-center" : ""}`}>
            {Math.round(((step + 1) / form.fields.length) * 100)}% complete
          </p>
        )}

        <h1 className="font-display font-bold text-2xl mb-1">{form.name}</h1>
        {form.description && <p className="text-sm text-ink/50 mb-6">{form.description}</p>}

        {oneAtATime ? (
          <form onSubmit={goNext} noValidate>
            <FieldBlock f={form.fields[step]} answers={answers} setAnswer={setAnswer} errors={errors} accentColor={accentColor} id={id} row={row} layoutStyle={layoutStyle} />

            {submitError && <p className="text-sm text-danger mt-4">{submitError}</p>}

            {presentationTemplate.nav === "arrows" ? (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  aria-label="Previous question"
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-ink/60 hover:border-primary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  aria-label={step === form.fields.length - 1 ? "Submit" : "Next question"}
                  style={accentColor ? { backgroundColor: accentColor } : undefined}
                  className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  {step === form.fields.length - 1 ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-2 mt-6 ${branding.contentAlign === "center" ? "justify-center" : "justify-between"}`}>
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="flex items-center gap-1 text-sm font-medium text-ink/50 hover:text-ink disabled:opacity-30"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={accentColor ? { backgroundColor: accentColor } : undefined}
                  className="flex items-center gap-1.5 bg-primary text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : step === form.fields.length - 1 ? (form.settings?.submitButtonText || "Submit") : "Next"}
                  {step !== form.fields.length - 1 && <ArrowRight size={14} />}
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={submit} noValidate className={`grid grid-cols-1 ${LAYOUT_GRID_COLS_CLASS[layoutColumns]} ${layoutStyle.gapClass}`}>
            {form.fields.map((f) => (
              <FieldBlock key={f.id} f={f} answers={answers} setAnswer={setAnswer} errors={errors} accentColor={accentColor} id={id} row={row} layoutStyle={layoutStyle} />
            ))}

            {submitError && <p className="text-sm text-danger sm:col-span-full">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={accentColor ? { backgroundColor: accentColor } : undefined}
              className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50 sm:col-span-full"
            >
              {submitting ? "Submitting…" : form.settings?.submitButtonText || "Submit"}
            </button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
