import { useEffect, useState } from "react";
import api from "../api/client";
import { inputCls } from "./ui";

// Uploaded files are stored inline as base64 (same approach as branding
// logos/backgrounds — see Forms.jsx's ImageUploadField) rather than to a
// file server, so the answer is a self-contained { name, type, dataUrl }
// object the admin's response view can render/download directly, with no
// separate storage or public URL to manage.
//
// This client-side allowlist/size check is UX only, not a security
// boundary — a request could be crafted to skip it entirely, so the same
// rules are re-enforced server-side (utils/fileUploads.js on the backend)
// against every submission regardless of what the client sent.
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB — answers ride along in the same encrypted JSON blob as every other field
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "zip"];
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileFieldInput({ value, onChange }) {
  const [error, setError] = useState("");
  const [converting, setConverting] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`That file type isn't allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}.`);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large — please use one under 3MB.");
      e.target.value = "";
      return;
    }
    setError("");
    setConverting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ name: file.name, type: file.type, dataUrl });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div>
      {converting ? (
        <p className="text-sm text-ink/40">Uploading…</p>
      ) : value?.name ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink/70">{value.name}</span>
          <button type="button" onClick={() => onChange("")} className="text-xs text-danger hover:underline">
            Remove
          </button>
        </div>
      ) : (
        <input type="file" accept={ACCEPT_ATTR} onChange={handleFile} className="text-sm" />
      )}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      <p className="text-[11px] text-ink/35 mt-1">Max 3MB. Allowed: images, PDF, Office docs, csv, txt, zip.</p>
    </div>
  );
}

const TIME_PERIODS = [
  { key: "morning", label: "Morning", test: (h) => h < 12 },
  { key: "afternoon", label: "Afternoon", test: (h) => h >= 12 && h < 17 },
  { key: "evening", label: "Evening / Night", test: (h) => h >= 17 },
];

// `slots` is [{ time: isoString, booked: bool }, ...] — already-booked
// slots are included (not filtered out server-side) so they can render
// as visibly disabled instead of just disappearing from the list.
function groupSlotsByPeriod(slots) {
  const groups = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) {
    const hour = new Date(slot.time).getHours();
    const period = TIME_PERIODS.find((p) => p.test(hour));
    groups[period.key].push(slot);
  }
  return groups;
}

// Available-date list + time-of-day-grouped slot picker for a "booking"
// field. The owner sets specific calendar dates (not a recurring weekly
// pattern — see BookingConfigEditor in Forms.jsx), so respondents pick
// from that fixed list instead of an open-ended date input that would
// mostly land on unavailable days. Only active when a real, published
// formId is available (the public form page) — the Form Builder's canvas
// preview renders a static mock instead, since a Draft form's
// /booking-dates endpoint 404s (it only serves Published forms) and
// there's nothing meaningful to preview before publishing.
function BookingFieldInput({ formId, field, value, onChange, invalid, accentColor }) {
  const [dates, setDates] = useState(null);
  const [date, setDate] = useState(value ? value.slice(0, 10) : "");
  const [slots, setSlots] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!formId) return;
    api
      .get(`/forms/${formId}/booking-dates`, { params: { fieldId: field.id } })
      .then((r) => setDates(r.data.dates))
      .catch(() => setDates([]));
  }, [formId, field.id]);

  useEffect(() => {
    if (!formId || !date) {
      setSlots(null);
      return;
    }
    setLoadingSlots(true);
    setSlots(null);
    api
      .get(`/forms/${formId}/booking-slots`, { params: { fieldId: field.id, date } })
      .then((r) => setSlots(r.data.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [formId, field.id, date]);

  if (!formId) {
    return (
      <div className={`${inputCls} bg-base/60 text-ink/40 text-xs py-6 text-center`}>
        Meeting time picker — respondents pick a date and available slot here once this form is published.
      </div>
    );
  }

  if (dates === null) {
    return <p className="text-xs text-ink/40">Loading available dates…</p>;
  }
  if (dates.length === 0) {
    return <p className={`${inputCls} bg-base/60 text-ink/40 text-xs py-4 text-center`}>No dates are available for booking right now.</p>;
  }

  const grouped = slots ? groupSlotsByPeriod(slots) : null;

  return (
    <div>
      <div className={`flex flex-wrap gap-1.5 mb-3 ${invalid && !value ? "outline outline-1 outline-danger rounded-lg p-1.5" : ""}`}>
        {dates.map((d) => {
          const isSelected = date === d;
          const label = new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
          return (
            <button
              type="button"
              key={d}
              onClick={() => {
                setDate(d);
                onChange("");
              }}
              style={isSelected && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                isSelected ? "bg-primary text-white border-primary" : "border-border text-ink/60 hover:border-primary/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!date ? (
        <p className="text-xs text-ink/40">Pick a date above to see available times.</p>
      ) : loadingSlots ? (
        <p className="text-xs text-ink/40">Loading available times…</p>
      ) : !slots || slots.length === 0 ? (
        <p className="text-xs text-ink/40">No times available on this date — try another day.</p>
      ) : (
        <div className="space-y-3">
          {TIME_PERIODS.map((period) => {
            const periodSlots = grouped[period.key];
            if (periodSlots.length === 0) return null;
            return (
              <div key={period.key}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-1.5">{period.label}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {periodSlots.map((slot) => {
                    const isSelected = value === slot.time;
                    const label = new Date(slot.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    if (slot.booked) {
                      return (
                        <div
                          key={slot.time}
                          title="Already booked"
                          className="px-2 py-1.5 rounded-lg border border-border bg-base/60 text-ink/30 text-xs font-medium line-through cursor-not-allowed text-center"
                        >
                          {label}
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        key={slot.time}
                        onClick={() => onChange(slot.time)}
                        style={isSelected && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${
                          isSelected ? "bg-primary text-white border-primary" : "border-border text-ink/60 hover:border-primary/40"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Renders the right input control for a form field, by type. Shared by the
// public/preview form page and the Form Builder's live preview panel, so
// what you see while editing is pixel-for-pixel what customers will see.
// `formId` is only passed by the public form page — the builder canvas
// omits it, which field types that need a live backend call (booking)
// treat as "preview only, don't fetch anything real."
export default function FormFieldInput({ field, value, onChange, invalid, accentColor, formId }) {
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
    case "booking":
      return <BookingFieldInput formId={formId} field={field} value={value} onChange={onChange} invalid={invalid} accentColor={accentColor} />;
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
      return <FileFieldInput value={value} onChange={onChange} />;
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
