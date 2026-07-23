import { useEffect, useRef, useState } from "react";
import { Plus, X as XIcon } from "lucide-react";
import api from "../api/client";
import { inputCls } from "./ui";
import ImageLightbox from "./ImageLightbox";

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

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
// Matches the "growth" plan tier's server-side limits (utils/plans.js) —
// a sensible default for a field a form creator hasn't customized, not a
// hard ceiling: the real enforcement is server-side and clamped to
// whatever the submitting account's actual plan allows, which may be
// lower (starter) or higher (enterprise) than these.
const DEFAULT_MAX_IMAGES = 10;
const DEFAULT_MAX_FILE_BYTES_IMAGES = 5 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

// Base64 encodes ~4/3 the original byte count (3 bytes -> 4 chars, plus up
// to 2 chars of trailing "=" padding) — decoding to a real Blob just to
// measure size would work too, but this is exact and synchronous.
function base64Size(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = (base64.match(/=+$/)?.[0] || "").length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// Multi-image gallery upload — "images" field type. Answer shape is an
// array of { name, type, dataUrl }, unlike "file" (single object) above.
// The Add-Image tile lives inside the same grid as the thumbnails rather
// than a separate "+ Add another image" link below it — it's where a user
// instinctively looks for the next slot once they've already uploaded a
// few, and naturally disappears once the field's own max is reached
// instead of needing a separate disabled-state explanation.
//
// Two independent limits apply — count (field.maxFiles) and total size
// across every image combined (field.maxTotalBytes) — surfaced together
// in one status line/bar so a rejected upload is never a mystery ("why
// won't this next image upload when it's well under the per-file cap?"
// is answered by seeing the total is already nearly at its own limit).
function ImagesFieldInput({ field, value, onChange }) {
  const [error, setError] = useState("");
  const [converting, setConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const inputRef = useRef(null);
  const images = Array.isArray(value) ? value : [];
  const max = field.maxFiles || DEFAULT_MAX_IMAGES;
  const maxFileBytes = field.maxFileBytes || DEFAULT_MAX_FILE_BYTES_IMAGES;
  const maxTotalBytes = field.maxTotalBytes || DEFAULT_MAX_TOTAL_BYTES;
  const atMax = images.length >= max;
  const totalBytes = images.reduce((sum, img) => sum + (img.dataUrl ? base64Size(img.dataUrl) : 0), 0);
  const sizePct = Math.min(100, Math.round((totalBytes / maxTotalBytes) * 100));

  const addFiles = async (fileList) => {
    const all = Array.from(fileList || []);
    const remaining = max - images.length;
    if (all.length > remaining) {
      // A hard stop rather than silently accepting the first `remaining`
      // and dropping the rest — the user picked a specific batch and
      // should get to choose which ones to drop, not have that decided
      // for them.
      setError(`You can upload up to ${max} images.`);
      return;
    }
    const files = all;
    if (files.length === 0) return;
    setError("");
    const rejected = [];
    const accepted = [];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) {
        rejected.push(`"${file.name}" isn't an image.`);
        continue;
      }
      if (file.size > maxFileBytes) {
        rejected.push(`"${file.name}" exceeds the ${formatMB(maxFileBytes)} MB limit.`);
        continue;
      }
      accepted.push(file);
    }
    const acceptedBytes = accepted.reduce((sum, f) => sum + f.size, 0);
    if (accepted.length > 0 && totalBytes + acceptedBytes > maxTotalBytes) {
      setError(
        `Adding these files would exceed the ${formatMB(maxTotalBytes)} MB total upload limit. ` +
          `Please remove some files or upload smaller images.`
      );
      return;
    }
    if (rejected.length) setError(rejected.join(" "));
    if (accepted.length === 0) return;

    setConverting(true);
    try {
      const converted = await Promise.all(
        accepted.map(async (file) => ({ name: file.name, type: file.type, dataUrl: await fileToDataUrl(file) }))
      );
      onChange([...images, ...converted]);
    } finally {
      setConverting(false);
    }
  };

  const removeAt = (i) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!atMax) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!atMax) addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-wrap gap-2 p-2 rounded-lg ${dragOver ? "bg-primary/5 ring-2 ring-primary/30" : ""}`}
      >
        {images.map((img, i) => (
          <div key={i} className="relative w-20 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewIndex(i)}
              className="block h-20 w-20 rounded-lg overflow-hidden border border-border cursor-zoom-in"
            >
              <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${img.name}`}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center hover:bg-danger"
            >
              <XIcon size={11} />
            </button>
            <p className="text-[11px] text-ink/45 mt-1 truncate" title={img.name}>{img.name}</p>
          </div>
        ))}

        {!atMax && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={converting}
            className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-0.5 text-ink/40 hover:border-primary hover:text-primary shrink-0"
          >
            <Plus size={16} />
            <span className="text-[10px] leading-none text-center">{converting ? "Uploading…" : "Add Image"}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        className="hidden"
      />

      {/* Status bar — count and total-size usage together, so a rejected
          upload is explained even when every individual file was under
          the per-file cap. */}
      <div className="mt-2 max-w-[280px]">
        <div className="h-1.5 rounded-full bg-base overflow-hidden">
          <div
            className={`h-full transition-all ${sizePct >= 100 ? "bg-danger" : "bg-primary"}`}
            style={{ width: `${sizePct}%` }}
          />
        </div>
        <p className="text-[11px] text-ink/40 mt-1">
          {images.length}/{max} files · {formatMB(totalBytes)} MB / {formatMB(maxTotalBytes)} MB
        </p>
      </div>

      {atMax && <p className="text-[11px] text-ink/35 mt-1">Maximum files reached. You can upload up to {max} images.</p>}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}

      {previewIndex !== null && (
        <ImageLightbox
          images={images.map((img) => ({ src: img.dataUrl, alt: img.name }))}
          startIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
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
    case "images":
      return <ImagesFieldInput field={field} value={value} onChange={onChange} />;
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
