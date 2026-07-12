import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Plus, FormInput, Copy, Trash2, GripVertical, Pencil, Share2, Check, ExternalLink, Eye, ClipboardCheck,
  LayoutGrid, Inbox, BarChart3, Plug, Settings as SettingsIcon, Sparkles, Send, X as XIcon,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState, ConfirmDialog, ErrorModal } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import FormResponses from "./FormResponses";
import WhatsAppSurveyPanel from "./WhatsAppSurveyPanel";
import FormFieldInput from "../components/FormFieldInput";
import { FORM_THEMES } from "../lib/formThemes";
import { limitsFor } from "../lib/plans";

const FIELD_TYPES = [
  { type: "text", label: "Short Text" },
  { type: "longtext", label: "Long Text" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "time", label: "Time" },
  { type: "dropdown", label: "Dropdown" },
  { type: "radio", label: "Radio Button" },
  { type: "checkbox", label: "Checkbox" },
  { type: "file", label: "File Upload" },
  { type: "rating", label: "Rating" },
  { type: "yesno", label: "Yes/No" },
  { type: "booking", label: "Meeting Booking" },
];

// Specific calendar dates, not a recurring weekly pattern — the owner
// picks exactly which days they're free (e.g. "July 15" and "July 20"),
// each with its own time window. Matches how a one-off availability
// window actually gets set in practice more often than "every Monday."
const DEFAULT_BOOKING_CONFIG = {
  durationMinutes: 30,
  bufferMinutes: 0,
  dates: [],
};

const BASIC_FIELD_TYPES = ["text", "longtext", "email", "phone", "number", "date", "dropdown", "checkbox"];
const FIELD_CATEGORIES = [
  { key: "basic", label: "Basic Fields", types: FIELD_TYPES.filter((f) => BASIC_FIELD_TYPES.includes(f.type)) },
  { key: "advanced", label: "Advanced Fields", types: FIELD_TYPES.filter((f) => !BASIC_FIELD_TYPES.includes(f.type)) },
];

const STUDIO_NAV = [
  { key: "builder", label: "Build", icon: LayoutGrid },
  { key: "settings", label: "Settings", icon: SettingsIcon },
  { key: "responses", label: "Submissions", icon: Inbox },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "whatsapp", label: "Integrations", icon: Plug },
];

const OPTION_TYPES = ["dropdown", "radio", "checkbox"];

function fieldTypeLabel(type) {
  return FIELD_TYPES.find((f) => f.type === type)?.label || type;
}

function newField(type) {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: fieldTypeLabel(type),
    placeholder: "",
    defaultValue: "",
    helpText: "",
    required: false,
    options: OPTION_TYPES.includes(type) ? ["Option 1", "Option 2"] : undefined,
    bookingConfig: type === "booking" ? { ...DEFAULT_BOOKING_CONFIG } : undefined,
    validation: {},
  };
}

function StatCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="text-2xl font-display font-bold mt-1.5">{value}</p>
    </Card>
  );
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayFor(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAY_SHORT[d.getDay()];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Bulk-add panel: pick a date range + which weekdays within it + one time
// window, and it generates one date entry per matching day. Exists so
// "I'm free every weekday for the next two weeks" doesn't mean clicking
// "Add Date" ten separate times — the underlying model stays a flat list
// of specific dates (what respondents actually see), this is just a
// faster way to populate it.
function BulkAddDates({ onAdd, onClose }) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]); // Mon-Fri by default
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [error, setError] = useState("");

  const toggleWeekday = (d) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  const apply = () => {
    setError("");
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }
    if (to < from) {
      setError("End date must be on or after the start date.");
      return;
    }
    if (weekdays.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }
    const generated = [];
    let cursor = new Date(`${from}T00:00:00`);
    const last = new Date(`${to}T00:00:00`);
    while (cursor <= last) {
      if (weekdays.includes(cursor.getDay())) {
        generated.push({ date: cursor.toISOString().slice(0, 10), start, end });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    onAdd(generated);
    onClose();
  };

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="From">
          <input type="date" className={`${inputCls} py-1`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={`${inputCls} py-1`} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <div>
        <p className="text-xs font-medium text-ink/60 mb-1.5">On these days</p>
        <div className="flex gap-1">
          {WEEKDAY_SHORT.map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleWeekday(d)}
              className={`px-2 py-1 rounded text-[11px] font-medium border ${
                weekdays.includes(d) ? "bg-primary text-white border-primary" : "border-border text-ink/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="time" className={`${inputCls} py-1`} value={start} onChange={(e) => setStart(e.target.value)} />
        <span className="text-xs text-ink/40">to</span>
        <input type="time" className={`${inputCls} py-1`} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={apply}>Add These Dates</Button>
      </div>
    </div>
  );
}

// Specific-dates availability editor for a "booking" field — the owner
// adds individual calendar dates, each with its own start/end time
// window, matching the shape utils/bookingSlots.js (the backend's
// slot-generation logic) expects. Dates always render sorted
// chronologically regardless of the order they were added in, since
// that's the order a respondent will see them.
function BookingConfigEditor({ config, onChange }) {
  const cfg = config || DEFAULT_BOOKING_CONFIG;
  const dates = cfg.dates || [];
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rowErrors, setRowErrors] = useState({});
  const update = (patch) => onChange({ ...cfg, ...patch });

  const sortedIndices = dates.map((_, i) => i).sort((a, b) => (dates[a].date > dates[b].date ? 1 : dates[a].date < dates[b].date ? -1 : 0));

  const validateRow = (i, d) => {
    const errs = { ...rowErrors };
    if (d.end <= d.start) errs[i] = "End must be after start";
    else delete errs[i];
    setRowErrors(errs);
  };

  const addDate = () => {
    const entry = { date: todayStr(), start: "09:00", end: "17:00" };
    update({ dates: [...dates, entry] });
  };
  // Same date, a different time window — e.g. morning + evening on one
  // day with a gap in between. The slot-generation logic (utils/
  // bookingSlots.js) already treats every entry as an independent
  // window and unions them per date, so this is just another row that
  // happens to share a date value with an existing one.
  const addWindowForDate = (dateStr) => {
    update({ dates: [...dates, { date: dateStr, start: "09:00", end: "12:00" }] });
  };
  const addBulk = (generated) => {
    update({ dates: [...dates, ...generated] });
  };
  const updateDate = (i, patch) => {
    const next = dates.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    update({ dates: next });
    validateRow(i, next[i]);
  };
  const removeDate = (i) => {
    update({ dates: dates.filter((_, idx) => idx !== i) });
    const errs = { ...rowErrors };
    delete errs[i];
    setRowErrors(errs);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5 bg-base/40">
      <div>
        <h5 className="text-xs font-semibold text-ink/60">Availability</h5>
        <p className="text-[11px] text-ink/40 mt-0.5">
          Add every date you can take a meeting, and the hours you're free that day. Respondents will only be able to pick from these exact dates.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Meeting length (minutes)">
          <input
            type="number"
            className={inputCls}
            value={cfg.durationMinutes}
            onChange={(e) => update({ durationMinutes: Number(e.target.value) || 30 })}
          />
        </Field>
        <Field label="Buffer between meetings (minutes)">
          <input
            type="number"
            className={inputCls}
            value={cfg.bufferMinutes || 0}
            onChange={(e) => update({ bufferMinutes: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <div className="space-y-2.5">
        {dates.length === 0 && <p className="text-xs text-ink/40">No available dates added yet — add one below, or add several at once.</p>}
        {(() => {
          // Group sorted indices by date so multiple time windows on the
          // same day (e.g. a morning block and a separate evening block)
          // render together under one date heading instead of as
          // unrelated-looking rows that happen to repeat the same date.
          const groups = [];
          for (const i of sortedIndices) {
            const last = groups[groups.length - 1];
            if (last && last.date === dates[i].date) last.indices.push(i);
            else groups.push({ date: dates[i].date, indices: [i] });
          }
          return groups.map((group) => (
            <div key={group.date} className="border border-border/60 rounded-lg p-2 bg-white">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-medium text-ink/40 w-8 shrink-0">{weekdayFor(group.date)}</span>
                <input
                  type="date"
                  className={`${inputCls} py-1`}
                  value={group.date}
                  onChange={(e) => group.indices.forEach((i) => updateDate(i, { date: e.target.value }))}
                />
              </div>
              <div className="space-y-1 ml-10">
                {group.indices.map((i) => {
                  const d = dates[i];
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          className={`${inputCls} py-1 ${rowErrors[i] ? "border-danger" : ""}`}
                          value={d.start}
                          onChange={(e) => updateDate(i, { start: e.target.value })}
                        />
                        <span className="text-xs text-ink/40">to</span>
                        <input
                          type="time"
                          className={`${inputCls} py-1 ${rowErrors[i] ? "border-danger" : ""}`}
                          value={d.end}
                          onChange={(e) => updateDate(i, { end: e.target.value })}
                        />
                        <button type="button" onClick={() => removeDate(i)} className="text-danger shrink-0"><Trash2 size={13} /></button>
                      </div>
                      {rowErrors[i] && <p className="text-[11px] text-danger mt-0.5">{rowErrors[i]}</p>}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addWindowForDate(group.date)}
                  className="text-[11px] text-primary hover:underline"
                >
                  + Add another time window this day (e.g. morning + evening)
                </button>
              </div>
            </div>
          ));
        })()}
      </div>

      {bulkOpen ? (
        <BulkAddDates onAdd={addBulk} onClose={() => setBulkOpen(false)} />
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={addDate}><Plus size={13} /> Add One Date</Button>
          <Button variant="secondary" onClick={() => setBulkOpen(true)}><Plus size={13} /> Add Several at Once</Button>
        </div>
      )}
    </div>
  );
}

function FieldEditor({ field, onChange, onDelete }) {
  const update = (patch) => onChange({ ...field, ...patch });
  // Placeholder/Default Value don't mean anything for a booking field
  // (there's no text box to place text in, and no sensible "default"
  // meeting time) — hiding them instead of leaving irrelevant, empty-
  // looking inputs in the editor.
  const isBooking = field.type === "booking";
  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5 bg-base/40">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Label">
          <input className={inputCls} value={field.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>
        {!isBooking && (
          <Field label="Placeholder">
            <input className={inputCls} value={field.placeholder || ""} onChange={(e) => update({ placeholder: e.target.value })} />
          </Field>
        )}
      </div>
      <div className={isBooking ? "" : "grid grid-cols-2 gap-2.5"}>
        {!isBooking && (
          <Field label="Default Value">
            <input className={inputCls} value={field.defaultValue || ""} onChange={(e) => update({ defaultValue: e.target.value })} />
          </Field>
        )}
        <Field label="Help Text">
          <input className={inputCls} value={field.helpText || ""} onChange={(e) => update({ helpText: e.target.value })} />
        </Field>
      </div>

      {OPTION_TYPES.includes(field.type) && (
        <Field label="Options (comma-separated)">
          <input
            className={inputCls}
            value={(field.options || []).join(", ")}
            onChange={(e) => update({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
      )}

      {field.type === "booking" && (
        <BookingConfigEditor config={field.bookingConfig} onChange={(bookingConfig) => update({ bookingConfig })} />
      )}

      {field.type === "number" && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min value">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.min ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, min: e.target.value } })}
            />
          </Field>
          <Field label="Max value">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.max ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, max: e.target.value } })}
            />
          </Field>
        </div>
      )}

      {(field.type === "text" || field.type === "longtext") && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min length">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.minLength ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, minLength: e.target.value } })}
            />
          </Field>
          <Field label="Max length">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.maxLength ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, maxLength: e.target.value } })}
            />
          </Field>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={!!field.required} onChange={(e) => update({ required: e.target.checked })} />
          Required field
        </label>
        <button onClick={onDelete} className="text-danger text-xs font-medium flex items-center gap-1 hover:underline">
          <Trash2 size={13} /> Remove field
        </button>
      </div>
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5MB — images are stored inline as base64, keep them small

function ImageUploadField({ label, value, onChange }) {
  const [error, setError] = useState("");
  // Converting a near-1.5MB file to a base64 data URL isn't instant — show
  // something instead of letting the UI look frozen for that stretch.
  const [converting, setConverting] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large — please use one under 1.5MB.");
      return;
    }
    setError("");
    setConverting(true);
    try {
      onChange(await fileToDataUrl(file));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">{label}</p>
      {converting ? (
        <p className="text-xs text-ink/40">Uploading…</p>
      ) : value ? (
        <div className="flex items-center gap-2">
          <img src={value} alt={label} className="h-12 w-12 object-cover rounded-lg border border-border" />
          <Button variant="secondary" onClick={() => onChange("")}>Remove</Button>
        </div>
      ) : (
        <input type="file" accept="image/*" onChange={handleFile} className="text-sm" />
      )}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

function ThemePicker({ activeTheme, onPick }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">
        Design Theme {!activeTheme && <span className="text-ink/35">(none active — using a plain color/image below)</span>}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {FORM_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            title={t.name}
            className={`rounded-lg overflow-hidden border-2 ${activeTheme === t.key ? "border-primary" : "border-transparent"}`}
          >
            <div className="h-10" style={{ background: t.background }} />
            <div className="text-[10px] py-1 text-center bg-white text-ink/60">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandingEditor({ branding, onChange }) {
  const update = (patch) => onChange({ ...branding, ...patch });
  const bgMode = branding.backgroundImageDataUrl ? "image" : "color";
  // Back-compat: older forms only ever had logoDataUrl with no explicit logoType.
  const logoType = branding.logoType || (branding.logoDataUrl ? "image" : "none");

  const pickTheme = (theme) => {
    update({
      theme: theme.key,
      backgroundCss: theme.background,
      accentColor: theme.accent,
      backgroundColor: "",
      backgroundImageDataUrl: "",
    });
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-base/40">
      <h4 className="font-display font-semibold text-sm">Branding</h4>

      <ThemePicker activeTheme={branding.theme} onPick={pickTheme} />

      <div>
        <p className="text-xs font-medium text-ink/60 mb-1.5">Logo</p>
        <div className="flex gap-2 mb-2">
          {[
            { key: "image", label: "Image" },
            { key: "text", label: "Text" },
            { key: "none", label: "None" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => update({ logoType: opt.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                logoType === opt.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {logoType === "image" && (
          <ImageUploadField label="" value={branding.logoDataUrl || ""} onChange={(v) => update({ logoDataUrl: v })} />
        )}
        {logoType === "text" && (
          <input
            className={inputCls}
            placeholder="e.g. Your Company Name"
            value={branding.logoText || ""}
            onChange={(e) => update({ logoText: e.target.value })}
          />
        )}
        {logoType === "none" && <p className="text-xs text-ink/40">No logo will be shown on the form.</p>}
      </div>

      <div>
        <p className="text-xs font-medium text-ink/60 mb-1.5">Background {branding.theme && <span className="text-ink/35">(overrides theme)</span>}</p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => update({ backgroundImageDataUrl: "", theme: "", backgroundCss: "" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${bgMode === "color" ? "bg-primary text-white border-primary" : "border-border text-ink/60"}`}
          >
            Solid Color
          </button>
          <button
            type="button"
            onClick={() => update({ backgroundImageDataUrl: branding.backgroundImageDataUrl || " ", theme: "", backgroundCss: "" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${bgMode === "image" ? "bg-primary text-white border-primary" : "border-border text-ink/60"}`}
          >
            Image
          </button>
        </div>

        {bgMode === "color" ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.backgroundColor || "#F5F6F8"}
              onChange={(e) => update({ backgroundColor: e.target.value, theme: "", backgroundCss: "" })}
              className="w-10 h-10 rounded border border-border cursor-pointer"
            />
            <span className="text-xs text-ink/50">{branding.backgroundColor || "#F5F6F8"}</span>
          </div>
        ) : (
          <div>
            <ImageUploadField
              label=""
              value={branding.backgroundImageDataUrl.trim() ? branding.backgroundImageDataUrl : ""}
              onChange={(v) => update({ backgroundImageDataUrl: v })}
            />

            {branding.backgroundImageDataUrl.trim() && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div>
                  <p className="text-xs font-medium text-ink/60 mb-1.5">Fit</p>
                  <div className="flex gap-2">
                    {[
                      { key: "cover", label: "Cover" },
                      { key: "contain", label: "Contain" },
                      { key: "repeat", label: "Repeat" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => update({ backgroundImageFit: opt.key })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          (branding.backgroundImageFit || "cover") === opt.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-ink/60 mb-1.5">Position</p>
                  <div className="flex gap-2">
                    {["top", "center", "bottom"].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => update({ backgroundImagePosition: pos })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${
                          (branding.backgroundImagePosition || "center") === pos ? "bg-primary text-white border-primary" : "border-border text-ink/60"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-ink/60 mb-1.5">
                    Darken overlay <span className="text-ink/35">({branding.backgroundImageOverlay || 0}%)</span>
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={branding.backgroundImageOverlay || 0}
                    onChange={(e) => update({ backgroundImageOverlay: Number(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-[11px] text-ink/40 mt-0.5">Darkens the image so text and logos stay readable.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldPalette({ onAdd, onAskAI, showAI }) {
  const [cat, setCat] = useState("basic");
  const active = FIELD_CATEGORIES.find((c) => c.key === cat);
  return (
    <div className="border border-border rounded-card bg-white p-3 h-fit">
      <h4 className="font-display font-semibold text-sm mb-3">Add Fields</h4>
      <div className="flex gap-1 mb-3 border-b border-border">
        {FIELD_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 -mb-px ${
              cat === c.key ? "border-primary text-primary" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {active.types.map((t) => (
          <button
            key={t.type}
            onClick={() => onAdd(t.type)}
            className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-ink/70">{t.label}</span>
          </button>
        ))}
      </div>
      {showAI && (
        <button
          onClick={onAskAI}
          className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 rounded-lg px-2.5 py-2 hover:bg-primary/10"
        >
          <Sparkles size={13} /> Ask AI to add a field
        </button>
      )}
    </div>
  );
}

// Click straight on a field's label to rename it in place — no need to
// open the full field editor just to fix a typo in the label text.
function EditableLabel({ field, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  useEffect(() => {
    setValue(field.label);
  }, [field.label]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== field.label) onChange({ ...field, label: trimmed });
    else setValue(field.label);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="block w-full text-sm font-medium mb-1.5 border border-primary rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(field.label);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <label
      className="block text-sm font-medium mb-1.5 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 cursor-text hover:bg-base"
      title="Click to rename this field"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {field.label} {field.required && <span className="text-danger">*</span>}
    </label>
  );
}

// The center canvas doubles as the live preview — what you see while
// editing is exactly what a respondent sees. Edit/delete/drag controls are
// always visible on touch devices (no hover to reveal them there) and only
// fade in on hover for pointer devices, so the canvas stays usable on
// tablets — a plausible device for building a form on.
function CanvasField({ field, expanded, onToggle, onChange, onDelete, dragHandleProps }) {
  return (
    <div className="group relative border border-border rounded-lg p-3.5 bg-white hover:border-primary/40 transition-colors" {...dragHandleProps}>
      {/* Tablets/touchscreens have no hover, so opacity-0-until-hover would
          make these controls permanently unreachable there — only hide by
          default on devices that can actually hover (fine pointer + hover
          capability), never based on screen width alone. */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
        <button onClick={onToggle} className="p-1.5 rounded bg-base text-ink/50 hover:text-primary"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded bg-base text-ink/50 hover:text-danger"><Trash2 size={13} /></button>
        <span className="p-1.5 rounded bg-base text-ink/30 cursor-grab"><GripVertical size={13} /></span>
      </div>
      <EditableLabel field={field} onChange={onChange} />
      <FormFieldInput field={field} value={field.type === "checkbox" ? [] : ""} onChange={() => {}} />
      {field.helpText && <p className="text-xs text-ink/40 mt-1">{field.helpText}</p>}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          <FieldEditor field={field} onChange={onChange} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function AI_REPLY_INTRO() {
  return "I can add fields to this form right now — try \"Add a field for email\" or \"Add a phone number field\". Full AI-generated forms from a single prompt need an LLM API key; ask your admin to add one so I can do more.";
}

// Pattern-matches simple "add a field for X" / "add an X field" style
// requests locally (no LLM required) so the assistant does *something*
// real without a key configured, rather than only ever stubbing replies.
function matchAddFieldIntent(text) {
  const lower = text.toLowerCase();
  if (!/\badd\b/.test(lower) || !/\bfield\b/.test(lower)) return null;
  for (const t of FIELD_TYPES) {
    const needle = t.label.toLowerCase();
    if (lower.includes(needle)) return t;
  }
  // Fallback keyword matches for common phrasings ("add a field for email").
  const keywordMap = {
    email: "email", phone: "phone", number: "number", date: "date", time: "time",
    rating: "rating", file: "file", upload: "file", "yes/no": "yesno", "yes or no": "yesno",
    dropdown: "dropdown", "long text": "longtext", paragraph: "longtext", checkbox: "checkbox", radio: "radio",
  };
  for (const [kw, type] of Object.entries(keywordMap)) {
    if (lower.includes(kw)) return FIELD_TYPES.find((t) => t.type === type);
  }
  return null;
}

// Calls the real backend AI endpoint (POST /forms/:id/ai/build) first. If
// it comes back 503 "not configured" (no ANTHROPIC_API_KEY set yet), falls
// back to the local "add a field for X" pattern-matcher so the panel still
// does something useful before a key is wired up.
function AIAssistantPanel({ formId, formName, onApplyResult, onAddField, onClose }) {
  const [messages, setMessages] = useState([
    { role: "ai", text: AI_REPLY_INTRO() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const { data } = await api.post(`/forms/${formId}/ai/build`, { prompt: text });
      onApplyResult(data);
      setMessages((m) => [...m, { role: "ai", text: data.message || "Updated the form." }]);
    } catch (err) {
      if (err.response?.status === 503) {
        const match = matchAddFieldIntent(text);
        if (match) {
          onAddField(match.type);
          setMessages((m) => [...m, { role: "ai", text: `Added a "${match.label}" field to ${formName}. (Full AI generation needs an API key — not configured yet.)` }]);
        } else {
          setMessages((m) => [...m, { role: "ai", text: err.response?.data?.error || AI_REPLY_INTRO() }]);
        }
      } else {
        setMessages((m) => [...m, { role: "ai", text: err.response?.data?.error || "Something went wrong talking to the AI Assistant." }]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-card bg-white flex flex-col h-[min(600px,70vh)]">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Sparkles size={15} className="text-primary" />
          <h4 className="font-display font-semibold text-sm">AI Assistant</h4>
          <Badge>Beta</Badge>
        </div>
        <button onClick={onClose} className="text-ink/40 hover:text-ink"><XIcon size={16} /></button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${m.role === "user" ? "bg-primary text-white" : "bg-base text-ink/80"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[85%] bg-base text-ink/50 italic">Thinking…</div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 bg-base rounded-lg px-2.5 py-1.5">
          <input
            className="bg-transparent outline-none text-sm flex-1"
            placeholder="Ask AI to create or modify your form…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={busy}
          />
          <button onClick={send} className="text-primary shrink-0" disabled={busy}><Send size={15} /></button>
        </div>
        <p className="text-[11px] text-ink/35 mt-1.5">Examples: "Add a signature field", "Create an employee leave request form"</p>
      </div>
    </div>
  );
}

function FormBuilder({ form, onSave, planLimits }) {
  // Hidden outright rather than shown-then-erroring — a Starter account
  // clicking into the AI Assistant only to get a 403 is worse than never
  // seeing the option in the first place. Unknown (still loading) treated
  // as allowed so the UI doesn't flash the panel away after first paint.
  const aiAllowed = !planLimits || planLimits.aiAssistant;
  const [fields, setFields] = useState(form.fields || []);
  const [expandedId, setExpandedId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dirty, setDirty] = useState(false);
  // Closed by default — most sessions never touch it (especially with no
  // LLM key configured yet), and it costs 320px of width every time.
  const [aiOpen, setAiOpen] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(!!form.workflow?.enabled);
  const [approverIds, setApproverIds] = useState(
    (form.workflow?.steps?.[0]?.approvers || []).filter((a) => a.type === "user").map((a) => a.value)
  );
  const [branding, setBranding] = useState(form.settings?.branding || {});

  useEffect(() => {
    setFields(form.fields || []);
    setApprovalEnabled(!!form.workflow?.enabled);
    setApproverIds((form.workflow?.steps?.[0]?.approvers || []).filter((a) => a.type === "user").map((a) => a.value));
    setBranding(form.settings?.branding || {});
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const addField = (type) => {
    const f = newField(type);
    setFields((prev) => [...prev, f]);
    setExpandedId(f.id);
    markDirty();
  };
  const updateField = (id, updated) => {
    setFields((f) => f.map((x) => (x.id === id ? updated : x)));
    markDirty();
  };
  const removeField = (id) => {
    setFields((f) => f.filter((x) => x.id !== id));
    markDirty();
  };

  const handleDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    setFields((f) => {
      const next = [...f];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    markDirty();
  };

  // One Save button for everything on this tab (fields, approval, branding)
  // — separate per-section buttons were confusing when nothing indicated
  // which one applied to which change.
  const save = () => {
    const cleanBranding = {
      logoType: branding.logoType || (branding.logoDataUrl ? "image" : "none"),
      logoDataUrl: branding.logoDataUrl || "",
      logoText: branding.logoText || "",
      theme: branding.theme || "",
      accentColor: branding.accentColor || "",
      backgroundCss: branding.backgroundCss || "",
      backgroundColor: branding.backgroundColor || "",
      backgroundImageDataUrl: (branding.backgroundImageDataUrl || "").trim(),
      backgroundImageFit: branding.backgroundImageFit || "cover",
      backgroundImagePosition: branding.backgroundImagePosition || "center",
      backgroundImageOverlay: branding.backgroundImageOverlay || 0,
    };
    onSave({
      fields,
      settings: { ...form.settings, branding: cleanBranding },
      workflow: {
        enabled: approvalEnabled,
        steps: approvalEnabled
          ? [{ id: "approval", name: "Approval", mode: "any", approvers: approverIds.map((id) => ({ type: "user", value: id })) }]
          : [],
      },
    });
    setDirty(false);
  };

  // Applies an AI-generated result: "add" appends only the new fields
  // (assigning ids), "replace" swaps in the full list the AI returned,
  // preserving ids it echoed back for unchanged fields and assigning new
  // ones only where it omitted an id.
  const applyAIResult = (result) => {
    const withIds = (result.fields || []).map((f) => ({
      id: f.id || `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: f.type,
      label: f.label || fieldTypeLabel(f.type),
      placeholder: f.placeholder || "",
      defaultValue: f.defaultValue || "",
      helpText: f.helpText || "",
      required: !!f.required,
      options: OPTION_TYPES.includes(f.type) ? (f.options?.length ? f.options : ["Option 1", "Option 2"]) : undefined,
      validation: f.validation || {},
    }));
    setFields((prev) => (result.action === "add" ? [...prev, ...withIds] : withIds));
    markDirty();
  };

  return (
    <div
      className={`grid grid-cols-1 ${
        aiOpen && aiAllowed ? "lg:grid-cols-[300px_1fr_320px]" : "lg:grid-cols-[300px_1fr]"
      } gap-4 items-start`}
    >
      <div className="space-y-4">
        <FieldPalette onAdd={addField} onAskAI={() => setAiOpen(true)} showAI={aiAllowed} />

        <ApprovalRequirementEditor
          enabled={approvalEnabled}
          approverIds={approverIds}
          onChange={({ enabled, approverIds: next }) => {
            setApprovalEnabled(enabled);
            setApproverIds(next);
            markDirty();
          }}
        />

        <BrandingEditor branding={branding} onChange={(next) => { setBranding(next); markDirty(); }} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-semibold text-sm">Canvas</h4>
          {aiAllowed && !aiOpen && (
            <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 rounded-lg px-2.5 py-1.5">
              <Sparkles size={13} /> AI Assistant
            </button>
          )}
        </div>

        <div className="border border-border rounded-card bg-base/30 p-4">
          {fields.length === 0 ? (
            <div className="text-sm text-ink/40 border border-dashed border-border rounded-lg p-8 text-center bg-white">
              No fields yet — add one from the palette on the left{aiAllowed ? ", or ask the AI Assistant" : ""}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={f.id} draggable onDragStart={() => setDragIndex(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(i)}>
                  <CanvasField
                    field={f}
                    expanded={expandedId === f.id}
                    onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                    onChange={(updated) => updateField(f.id, updated)}
                    onDelete={() => removeField(f.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={save} disabled={!dirty}>Save Changes</Button>
        </div>
      </div>

      {aiAllowed && aiOpen && (
        <AIAssistantPanel
          formId={form.id}
          formName={form.name}
          onApplyResult={applyAIResult}
          onAddField={addField}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}

// Name/description + branding, split out of the field canvas so "Settings"
// is its own left-rail destination, matching the studio layout.
// Every submission to this form needs a sign-off before the owner treats it
// as accepted — the owner (authRole "admin") can always approve/reject
// regardless of who's picked here (see resolveApprovers in
// workflowEngine.js), so this list is really "who ELSE, besides me, can
// also approve" — not the exclusive set.
const emptyTeammateForm = { name: "", email: "", password: "", permission: "edit" };

// Quick-add teammate, inline in the approval picker so "there's no one to
// pick" isn't a dead end — no need to leave the form builder and go to
// Settings → Team just to create the account. Owner-only (same as
// Team.jsx's Add Teammate flow), since POST /auth/team is owner-gated.
function AddTeammateInlineModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyTeammateForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyTeammateForm);
      setError("");
    }
  }, [open]);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Name, email, and password are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/auth/team", form);
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't create that account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Team Member">
      <Field label="Full Name">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
      </Field>
      <Field label="Email">
        <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Password">
        <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
      </Field>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={create} disabled={saving}>{saving ? "Creating…" : "Create Login"}</Button>
      </div>
    </Modal>
  );
}

function ApprovalRequirementEditor({ enabled, approverIds, onChange }) {
  const { isOwner } = useAuth();
  const [teammates, setTeammates] = useState(null);
  const [addingTeammate, setAddingTeammate] = useState(false);

  const loadTeammates = () => api.get("/auth/team").then((r) => setTeammates(r.data)).catch(() => setTeammates([]));
  useEffect(() => {
    loadTeammates();
  }, []);

  const toggleApprover = (id) => {
    onChange({
      enabled,
      approverIds: approverIds.includes(id) ? approverIds.filter((x) => x !== id) : [...approverIds, id],
    });
  };

  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ enabled: e.target.checked, approverIds })}
        />
        Require approval before submissions are accepted
      </label>
      <p className="text-xs text-ink/40 mt-1 mb-3">
        The account owner can always approve or reject. Optionally pick other teammates who should be able to as well.
      </p>

      {enabled && (
        teammates === null ? (
          <p className="text-xs text-ink/40">Loading teammates…</p>
        ) : teammates.length === 0 ? (
          <div className="text-xs text-ink/40">
            <p className="mb-2">No other teammates yet — only the account owner will be able to approve.</p>
            {isOwner && (
              <button type="button" onClick={() => setAddingTeammate(true)} className="text-primary font-medium hover:underline">
                + Add Team Member
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="space-y-1.5">
              {teammates.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={approverIds.includes(t.id)} onChange={() => toggleApprover(t.id)} />
                  {t.name} <span className="text-ink/40 text-xs">({t.authRole})</span>
                </label>
              ))}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setAddingTeammate(true)}
                className="text-xs text-primary font-medium hover:underline mt-2"
              >
                + Add Team Member
              </button>
            )}
          </div>
        )
      )}

      <AddTeammateInlineModal
        open={addingTeammate}
        onClose={() => setAddingTeammate(false)}
        onCreated={(newMember) => {
          setAddingTeammate(false);
          loadTeammates();
          onChange({ enabled, approverIds: [...approverIds, newMember.id] });
        }}
      />
    </div>
  );
}

// Branding (background/logo) lives on the Build tab now, alongside the
// field canvas — see FormBuilder's BrandingEditor block — so Settings is
// just the form's identity (name/description).
function FormSettingsPanel({ form, onSave }) {
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description || "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(form.name);
    setDescription(form.description || "");
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const save = () => {
    onSave({ name, description });
    setDirty(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Form Name">
          <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} />
        </Field>
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={save} disabled={!dirty}>Save Settings</Button>
      </div>
    </div>
  );
}


// Cross-form inbox of everything waiting on the current user's decision —
// opened from the header button on the Forms list page.
function ApprovalsModal({ open, onClose, onDecided }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // A single in-flight flag (not per-item) disables every row's buttons
  // while any decision is submitting — prevents firing a second decision
  // on a different row before the first one has finished and the pending
  // list has refreshed.
  const [busy, setBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/forms/approvals/pending").then((r) => {
      setItems(r.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    if (open) load();
  }, [open]);

  const decide = async (item, action, comment = "") => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/forms/${item.formId}/responses/${item.id}/workflow/decide`, { action, comment });
      load();
      onDecided?.();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record decision.");
    } finally {
      setBusy(false);
      setRejectTarget(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="My Approvals" wide>
      {error && <p className="text-xs text-danger mb-3">{error}</p>}
      {loading ? (
        <div className="text-sm text-ink/40">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing pending" subtitle="You have no approvals waiting on you right now." />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const step = item.workflow.steps[item.workflow.currentStep];
            return (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm">{item.formName}</span>
                  <span className="text-xs text-ink/40">{timeAgo(item.submittedAt)}</span>
                </div>
                <p className="text-xs text-ink/50 mb-2">Step: {step?.name}</p>
                <div className="text-xs space-y-0.5 mb-2.5">
                  {item.formFields.slice(0, 3).map((f) => (
                    <div key={f.id} className="flex gap-1.5">
                      <span className="text-ink/40">{f.label}:</span>
                      <span className="truncate">{Array.isArray(item.answers?.[f.id]) ? item.answers[f.id].join(", ") : String(item.answers?.[f.id] ?? "—")}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => decide(item, "approve")} disabled={busy}>Approve</Button>
                  <Button variant="danger" onClick={() => setRejectTarget(item)} disabled={busy}>Reject</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        title={`Reject this submission?`}
        withReason
        reasonLabel="Reason for rejecting (optional)"
        confirmLabel="Reject"
        danger
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => decide(rejectTarget, "reject", reason)}
      />
    </Modal>
  );
}

function ShareLink({ form }) {
  const [copied, setCopied] = useState(false);
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/forms/${form.id}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 bg-base border border-border rounded-lg px-3 py-2 mb-4">
      <Share2 size={15} className="text-ink/40 shrink-0" />
      <input readOnly value={url} className="bg-transparent outline-none text-sm flex-1 text-ink/70" onFocus={(e) => e.target.select()} />
      <Button variant="secondary" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function TemplateGallery({ templates, onPick }) {
  const categories = [...new Set(templates.map((t) => t.category))];
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-1.5">{cat}</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.filter((t) => t.category === cat).map((t) => (
              <button
                key={t.key}
                onClick={() => onPick(t)}
                className="text-left border border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-ink/40 mt-0.5">{t.description}</p>
                {t.fieldCount > 0 && <p className="text-xs text-primary/70 mt-1.5">{t.fieldCount} fields</p>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewFormModal({ open, onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.get("/forms/templates").then((r) => setTemplates(r.data));
      setSelected(null);
      setName("");
      setError("");
    }
  }, [open]);

  const pick = (template) => {
    setSelected(template);
    setName(template.key === "blank" ? "" : template.name);
  };

  const create = async () => {
    if (!name.trim() || !selected) return;
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/forms/from-template", { templateKey: selected.key, name });
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't create that form.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={selected ? "Name Your Form" : "Choose a Template"} wide={!selected}>
      {!selected ? (
        <TemplateGallery templates={templates} onPick={pick} />
      ) : (
        <div>
          <button onClick={() => setSelected(null)} className="text-xs text-primary font-medium mb-3 hover:underline">
            ← Choose a different template
          </button>
          <Field label="Form Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Contact Us" autoFocus />
          </Field>
          {error && <p className="text-xs text-danger mb-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={create} disabled={creating || !name.trim()}>{creating ? "Creating…" : "Create Form"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FormAnalyticsPanel({ form, recentResponses }) {
  // Match by id, not name — two forms can share a name (e.g. via
  // Duplicate), which would otherwise cross-contaminate this list.
  const forThisForm = recentResponses.filter((r) => r.formId === form.id);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink/50">Total Responses</p>
          <p className="text-2xl font-display font-bold mt-1.5">{form.responseCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink/50">Status</p>
          <p className="text-2xl font-display font-bold mt-1.5">{form.status}</p>
        </Card>
      </div>
      <Card className="p-4">
        <p className="text-xs font-medium text-ink/50 mb-1.5">Recent Activity</p>
        {forThisForm.length === 0 ? (
          <p className="text-xs text-ink/40">No responses yet.</p>
        ) : (
          <div className="space-y-1">
            {forThisForm.map((r) => (
              <div key={r.id} className="flex justify-between text-xs">
                <span className="text-ink/70">New submission</span>
                <span className="text-ink/40">{timeAgo(r.submittedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Forms() {
  const { canManage } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState(null);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("builder");
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [approvalsCount, setApprovalsCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Disables Publish/Duplicate/Delete while any one of them is in flight,
  // so a double-click can't fire the same mutation twice.
  const [actionBusy, setActionBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Used to proactively disable actions (New Form, workflow toggle, etc.)
  // with a tooltip instead of letting the request fail after the fact.
  // null while loading — treated as "no limit" so buttons aren't briefly
  // disabled before the real plan is known.
  const [planLimits, setPlanLimits] = useState(null);

  const load = () => {
    Promise.all([api.get("/forms"), api.get("/forms/stats")]).then(([f, s]) => {
      setForms(f.data);
      setStats(s.data);
      setActive((prev) => f.data.find((x) => x.id === prev?.id) || f.data[0] || null);
      setLoading(false);
    });
  };
  const loadApprovalsCount = () => api.get("/forms/approvals/pending").then((r) => setApprovalsCount(r.data.length));
  const loadPlanLimits = () => api.get("/settings").then((r) => setPlanLimits(limitsFor(r.data.subscription?.plan))).catch(() => {});
  useEffect(() => {
    load();
    loadApprovalsCount();
    loadPlanLimits();
  }, []);
  useLiveCollection(["forms", "form_responses"], () => { load(); loadApprovalsCount(); });
  useLiveCollection(["settings"], loadPlanLimits);

  const atFormLimit = planLimits && forms.length >= planLimits.maxForms;

  const handleFormCreated = (data) => {
    setModal(false);
    load();
    setActive(data);
  };

  const duplicateForm = async (form) => {
    setActionBusy(true);
    try {
      await api.post(`/forms/${form.id}/duplicate`);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't duplicate that form.");
    } finally {
      setActionBusy(false);
    }
  };

  const deleteForm = async () => {
    const form = deleteTarget;
    setActionBusy(true);
    try {
      await api.delete(`/forms/${form.id}`);
      setActive(null);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't delete that form.");
    } finally {
      setActionBusy(false);
    }
  };

  const togglePublish = async (form) => {
    setActionBusy(true);
    try {
      const endpoint = form.status === "Published" ? "unpublish" : "publish";
      await api.put(`/forms/${form.id}/${endpoint}`);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't update that form's publish status.");
    } finally {
      setActionBusy(false);
    }
  };

  const saveBuilder = async (patch) => {
    setSaveError("");
    try {
      await api.put(`/forms/${active.id}`, patch);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't save that change.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Forms"
        subtitle="Build custom forms and collect responses."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setApprovalsOpen(true)}>
              <ClipboardCheck size={15} /> My Approvals{approvalsCount > 0 ? ` (${approvalsCount})` : ""}
            </Button>
            {canManage && (
              <Button
                onClick={() => {
                  if (atFormLimit) {
                    setSaveError(`Your plan (${planLimits.label}) allows up to ${planLimits.maxForms} forms. Upgrade to create more.`);
                  } else {
                    setModal(true);
                  }
                }}
              >
                <Plus size={15} /> New Form
              </Button>
            )}
          </div>
        }
      />

      <ApprovalsModal open={approvalsOpen} onClose={() => setApprovalsOpen(false)} onDecided={loadApprovalsCount} />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Forms" value={stats.totalForms} />
          <StatCard label="Total Responses" value={stats.totalResponses} />
          <Card className="p-4">
            <p className="text-xs font-medium text-ink/50 mb-1.5">Recent Responses</p>
            {stats.recentResponses.length === 0 ? (
              <p className="text-xs text-ink/40">None yet</p>
            ) : (
              <div className="space-y-1">
                {stats.recentResponses.map((r) => (
                  <div key={r.id} className="flex justify-between text-xs">
                    <span className="text-ink/70 truncate">{r.formName}</span>
                    <span className="text-ink/40 shrink-0 ml-2">{timeAgo(r.submittedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : forms.length === 0 ? (
        <Card><EmptyState icon={FormInput} title="No forms yet" subtitle="Create your first form to start collecting responses." /></Card>
      ) : (
        <div>
          {active && (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={active.id}
                      onChange={(e) => {
                        setActive(forms.find((f) => f.id === e.target.value) || active);
                        setTab("builder");
                      }}
                      className="font-display font-semibold text-lg bg-transparent border-none outline-none cursor-pointer -ml-1 max-w-[420px] truncate"
                    >
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>{f.name} — {f.responseCount} response{f.responseCount === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                    <Badge>{active.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={() => window.open(`/forms/${active.id}?preview=1`, "_blank")}
                    >
                      <Eye size={14} /> Preview
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="secondary" onClick={() => togglePublish(active)} disabled={actionBusy}>
                          {active.status === "Published" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button variant="secondary" onClick={() => duplicateForm(active)} disabled={actionBusy}><Copy size={14} /></Button>
                        <Button variant="danger" onClick={() => setDeleteTarget(active)} disabled={actionBusy}><Trash2 size={14} /></Button>
                      </>
                    )}
                  </div>
                </div>

                {active.status === "Published" && <ShareLink form={active} />}

                {/* Below lg: a horizontal scrollable tab row above the
                    content instead of a narrow 76px vertical rail, which
                    would otherwise squeeze into an unusable column next
                    to the canvas on tablet/mobile widths. */}
                <div className="flex flex-col lg:grid lg:grid-cols-[76px_1fr] gap-4">
                  <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible border-b lg:border-b-0 lg:border-r border-border pb-2 lg:pb-0 lg:pr-2">
                    {STUDIO_NAV.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        className={`flex flex-row lg:flex-col items-center gap-1.5 lg:gap-1 shrink-0 px-3 lg:px-0 py-2 lg:py-2.5 rounded-lg text-xs lg:text-[11px] font-medium ${
                          tab === item.key ? "bg-primary/8 text-primary" : "text-ink/50 hover:bg-base hover:text-ink"
                        }`}
                      >
                        <item.icon size={17} />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    {tab === "responses" && (
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => router.push(`/app/forms/${active.id}/responses`)}
                          className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
                        >
                          View Details <ExternalLink size={12} />
                        </button>
                      </div>
                    )}

                    {tab === "builder" ? (
                      <FormBuilder form={active} onSave={saveBuilder} planLimits={planLimits} />
                    ) : tab === "responses" ? (
                      <FormResponses formId={active.id} headerless />
                    ) : tab === "whatsapp" ? (
                      <WhatsAppSurveyPanel form={active} />
                    ) : tab === "settings" ? (
                      <FormSettingsPanel form={active} onSave={saveBuilder} />
                    ) : (
                      <FormAnalyticsPanel form={active} recentResponses={stats?.recentResponses || []} />
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      <NewFormModal open={modal} onClose={() => setModal(false)} onCreated={handleFormCreated} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This also deletes its responses. This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteForm}
      />

      <ErrorModal open={!!saveError} message={saveError} onClose={() => setSaveError("")} />
    </div>
  );
}
