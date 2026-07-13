import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { CheckCircle2, FormInput, Eye, X } from "lucide-react";
import api from "../../api/client";
import FormFieldInput from "../../components/FormFieldInput";
import Seo from "../../components/Seo";
import { WIDE_FIELD_TYPES, LAYOUT_GRID_COLS_CLASS } from "../../lib/formLayout";

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
      <div className={`relative z-10 bg-white border border-border rounded-card shadow-card p-6 sm:p-8 ${cardWidthClass} w-full h-fit my-8`}>
        <Logo />
        <h1 className="font-display font-bold text-2xl mb-1">{form.name}</h1>
        {form.description && <p className="text-sm text-ink/50 mb-6">{form.description}</p>}

        <form onSubmit={submit} noValidate className={`grid grid-cols-1 ${LAYOUT_GRID_COLS_CLASS[layoutColumns]} gap-x-4 gap-y-5`}>
          {form.fields.map((f) => (
            <div key={f.id} className={WIDE_FIELD_TYPES.includes(f.type) ? "sm:col-span-full" : ""}>
              <label className="block text-sm font-medium mb-1.5">
                {f.label} {f.required && <span className="text-danger">*</span>}
              </label>
              <FormFieldInput field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} invalid={!!errors[f.id]} accentColor={accentColor} formId={id} />
              {errors[f.id] ? (
                <p className="text-xs text-danger mt-1">{errors[f.id]}</p>
              ) : (
                f.helpText && <p className="text-xs text-ink/40 mt-1">{f.helpText}</p>
              )}
            </div>
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
      </div>
      </div>
    </div>
  );
}
