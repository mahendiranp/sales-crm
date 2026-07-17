import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Plus, FormInput, Copy, Trash2, GripVertical, Pencil, Share2, Check, ExternalLink, Eye, ClipboardCheck,
  LayoutGrid, Inbox, BarChart3, Plug, Settings as SettingsIcon, Sparkles, Send, X as XIcon,
  Type, AlignLeft, Mail, Phone, Hash, Calendar, Clock, ChevronDownSquare, CircleDot, CheckSquare,
  Paperclip, Star, ToggleLeft, CalendarClock, Search, UserPlus, Briefcase, ShoppingBag, Users,
  LifeBuoy, Bug, Plane, UserCheck, LogOut, HeartPulse, Receipt, Home, RotateCcw, GraduationCap,
  TrendingUp, FileText, Palette, Columns3, Navigation as NavigationIcon, Image as FormImageIcon, Target,
  ArrowRight, ChevronDown, ArrowLeft,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState, ConfirmDialog, ErrorModal } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import FormResponses from "./FormResponses";
import WhatsAppSurveyPanel from "./WhatsAppSurveyPanel";
import FormFieldInput from "../components/FormFieldInput";
import { FORM_THEMES, FORM_THEME_CATEGORIES } from "../lib/formThemes";
import {
  FORM_LAYOUTS, FORM_LAYOUT_CATEGORIES, getLayoutStyleClasses, findFormLayout,
  LABEL_POSITIONS, CONTENT_ALIGNMENTS, PRESENTATION_TEMPLATES, getFieldRowClasses, findPresentationTemplate,
} from "../lib/formLayouts";
import { limitsFor } from "../lib/plans";
import { LAYOUT_GRID_COLS_CLASS, fieldColSpanClass } from "../lib/formLayout";

const FIELD_TYPES = [
  { type: "text", label: "Short Text", icon: Type },
  { type: "longtext", label: "Long Text", icon: AlignLeft },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "time", label: "Time", icon: Clock },
  { type: "dropdown", label: "Dropdown", icon: ChevronDownSquare },
  { type: "radio", label: "Radio Button", icon: CircleDot },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "file", label: "File Upload", icon: Paperclip },
  { type: "rating", label: "Rating", icon: Star },
  { type: "yesno", label: "Yes/No", icon: ToggleLeft },
  { type: "booking", label: "Meeting Booking", icon: CalendarClock },
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
  { key: "whatsapp", label: "Workflow", icon: Plug },
  { key: "settings", label: "Settings", icon: SettingsIcon },
  { key: "responses", label: "Responses", icon: Inbox },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const OPTION_TYPES = ["dropdown", "radio", "checkbox"];

// Per-template icon so the "Choose a Template" gallery scans visually
// instead of reading as a wall of near-identical text cards. Falls back to
// a generic FileText icon for anything not explicitly mapped (new templates
// added on the backend without a matching icon here).
const TEMPLATE_ICONS = {
  blank: FileText,
  "customer-feedback": Star,
  "nps-survey": TrendingUp,
  "contact-lead": UserPlus,
  "event-registration": Calendar,
  "job-application": Briefcase,
  "order-form": ShoppingBag,
  "appointment-booking": CalendarClock,
  "meeting-request": Users,
  "it-support-ticket": LifeBuoy,
  "bug-report": Bug,
  "leave-request": Plane,
  "employee-onboarding": UserCheck,
  "exit-interview": LogOut,
  "patient-intake": HeartPulse,
  "expense-reimbursement": Receipt,
  "property-inquiry": Home,
  rsvp: Mail,
  "return-refund-request": RotateCcw,
  "newsletter-signup": Send,
  "course-feedback": GraduationCap,
  "employee-engagement-survey": BarChart3,
};

// Hand-picked, not derived from usage stats (no such tracking exists yet)
// — surfaces the templates most tenants reach for first, ahead of scrolling
// every category. Revisit once real "times used" data exists.
const POPULAR_TEMPLATE_KEYS = ["appointment-booking", "customer-feedback", "contact-lead", "leave-request", "job-application", "nps-survey"];

// One icon per template category (Sales, HR, Marketing, …) for the
// category-first "Add Form" page — falls back to FileText for any category
// added on the backend without a matching icon here.
const CATEGORY_ICONS = {
  General: FileText,
  Feedback: Star,
  Sales: Briefcase,
  Marketing: Send,
  HR: UserCheck,
  Services: CalendarClock,
  Support: LifeBuoy,
  Healthcare: HeartPulse,
  Finance: Receipt,
  "Real Estate": Home,
  Education: GraduationCap,
};

function categoryIcon(category) {
  return CATEGORY_ICONS[category] || FileText;
}

function templateIcon(key) {
  return TEMPLATE_ICONS[key] || FileText;
}

function templateMinutes(fieldCount) {
  return Math.max(1, Math.ceil((fieldCount || 0) / 6));
}

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
    appearance: { width: "auto" },
    logic: { enabled: false, fieldId: "", operator: "equals", value: "" },
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

// The field-editing controls, shared by both the old inline-in-canvas
// layout and the FieldPropertiesPanel (right-side dedicated panel) —
// `bare` skips the outer card chrome since FieldPropertiesPanel supplies
// its own.
// Accordion section for grouping a long settings form (e.g. FieldEditor
// below) into named chunks instead of one continuous scroll. Open state is
// owned by the parent (a single `openSection` there) so opening one section
// closes the others, rather than each section toggling independently.
function CollapsibleSection({ title, open, onToggle, children }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-ink/70 bg-base/40 hover:bg-base/70 transition-colors"
      >
        {title}
        <ChevronDownSquare size={14} className={`text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-3 space-y-2.5">{children}</div>}
    </div>
  );
}

function FieldEditor({ field, fields, onChange, onDelete, bare }) {
  const update = (patch) => onChange({ ...field, ...patch });
  // Placeholder/Default Value don't mean anything for a booking field
  // (there's no text box to place text in, and no sensible "default"
  // meeting time) — hiding them instead of leaving irrelevant, empty-
  // looking inputs in the editor.
  const isBooking = field.type === "booking";
  const [openSection, setOpenSection] = useState("General");
  const section = (name) => ({ open: openSection === name, onToggle: () => setOpenSection(openSection === name ? null : name) });
  const body = (
    <div className="space-y-2">
      <CollapsibleSection title="General" {...section("General")}>
        <Field label="Label">
          <input className={inputCls} value={field.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>
        {!isBooking && (
          <Field label="Placeholder">
            <input className={inputCls} value={field.placeholder || ""} onChange={(e) => update({ placeholder: e.target.value })} />
          </Field>
        )}
        {!isBooking && (
          <Field label="Default Value">
            <input className={inputCls} value={field.defaultValue || ""} onChange={(e) => update({ defaultValue: e.target.value })} />
          </Field>
        )}
        <Field label="Help Text">
          <input className={inputCls} value={field.helpText || ""} onChange={(e) => update({ helpText: e.target.value })} />
        </Field>

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
      </CollapsibleSection>

      <CollapsibleSection title="Validation" {...section("Validation")}>
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

        <label className="flex items-center gap-2 text-sm text-ink/70 pt-1">
          <input type="checkbox" checked={!!field.required} onChange={(e) => update({ required: e.target.checked })} />
          Required field
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Appearance" {...section("Appearance")}>
        <Field label="Width">
          <select
            className={inputCls}
            value={field.appearance?.width || "auto"}
            onChange={(e) => update({ appearance: { ...field.appearance, width: e.target.value } })}
          >
            <option value="auto">Auto (default for field type)</option>
            <option value="full">Full width</option>
          </select>
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Logic" {...section("Logic")}>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={!!field.logic?.enabled}
            onChange={(e) => update({ logic: { ...field.logic, enabled: e.target.checked } })}
          />
          Only show this field conditionally
        </label>
        {field.logic?.enabled && (
          <>
            {(fields || []).filter((f) => f.id !== field.id).length === 0 ? (
              <p className="text-xs text-ink/40">Add another field first to reference it here.</p>
            ) : (
              <>
                <Field label="Show this field if">
                  <select
                    className={inputCls}
                    value={field.logic?.fieldId || ""}
                    onChange={(e) => update({ logic: { ...field.logic, fieldId: e.target.value } })}
                  >
                    <option value="">Select a field…</option>
                    {(fields || []).filter((f) => f.id !== field.id).map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Condition">
                  <select
                    className={inputCls}
                    value={field.logic?.operator || "equals"}
                    onChange={(e) => update({ logic: { ...field.logic, operator: e.target.value } })}
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Does not equal</option>
                    <option value="contains">Contains</option>
                    <option value="not_contains">Does not contain</option>
                    <option value="greater_than">Greater than</option>
                    <option value="less_than">Less than</option>
                    <option value="is_empty">Is empty</option>
                    <option value="is_not_empty">Is not empty</option>
                  </select>
                </Field>
                {!["is_empty", "is_not_empty"].includes(field.logic?.operator) && (
                  <Field label="Value">
                    {(() => {
                      const targetField = (fields || []).find((f) => f.id === field.logic?.fieldId);
                      const operator = field.logic?.operator || "equals";
                      if (targetField && OPTION_TYPES.includes(targetField.type) && ["equals", "not_equals"].includes(operator)) {
                        return (
                          <select
                            className={inputCls}
                            value={field.logic?.value || ""}
                            onChange={(e) => update({ logic: { ...field.logic, value: e.target.value } })}
                          >
                            <option value="">Select a value…</option>
                            {(targetField.options || []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        );
                      }
                      return (
                        <input
                          type={["greater_than", "less_than"].includes(operator) ? "number" : "text"}
                          className={inputCls}
                          value={field.logic?.value || ""}
                          onChange={(e) => update({ logic: { ...field.logic, value: e.target.value } })}
                        />
                      );
                    })()}
                  </Field>
                )}
              </>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Permissions" {...section("Permissions")}>
        <p className="text-xs text-ink/40">Field-level visibility/edit permissions are coming soon.</p>
      </CollapsibleSection>

      <button onClick={onDelete} className="text-danger text-xs font-medium flex items-center gap-1 hover:underline pt-1">
        <Trash2 size={13} /> Remove field
      </button>
    </div>
  );

  if (bare) return body;
  return <div className="border border-border rounded-lg p-3 bg-base/40">{body}</div>;
}

// Right-side panel for editing the currently-selected canvas field — the
// field-properties-panel pattern (vs. expanding the editor inline inside
// the canvas card, which pushed every field below it down the page).
function FieldPropertiesPanel({ field, fields, onChange, onDelete, onClose }) {
  return (
    <div className="border border-border rounded-card bg-white h-fit lg:sticky lg:top-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h4 className="font-display font-semibold text-sm">Field Properties</h4>
          <p className="text-xs text-ink/40 mt-0.5">{fieldTypeLabel(field.type)}</p>
        </div>
        <button onClick={onClose} className="text-ink/30 hover:text-ink p-1" title="Close">
          <XIcon size={16} />
        </button>
      </div>
      <div className="p-4">
        <FieldEditor field={field} fields={fields} onChange={onChange} onDelete={onDelete} bare />
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
  const activeCategory = FORM_THEMES.find((t) => t.key === activeTheme)?.category || "classic";
  const [cat, setCat] = useState(activeCategory);
  const themes = FORM_THEMES.filter((t) => t.category === cat);
  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">
        Design Theme {!activeTheme && <span className="text-ink/35">(none active — using a plain color/image below)</span>}
      </p>
      <div className="flex gap-1.5 mb-2">
        {FORM_THEME_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              cat === c.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {themes.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            title={t.name}
            className={`rounded-lg overflow-hidden border-2 ${activeTheme === t.key ? "border-primary" : "border-transparent"}`}
          >
            <div className="h-10" style={{ background: t.background }} />
            <div className="text-[10px] py-1 text-center bg-white text-ink/60 truncate px-1">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Structural layout (corners/shadow/spacing/label style) — separate from
// ThemePicker's colors above. See lib/formLayouts.js for what each preset
// actually changes; applied identically here (canvas) and on the public
// form page so the builder preview matches what respondents see.
// A real miniature form (fake Name/Email/Message lines) rather than a flat
// color block — lets users see corners/shadow/density/label-style at a
// glance instead of guessing what a name like "Tribunal" looks like.
function MiniFormPreview({ layoutKey }) {
  const s = getLayoutStyleClasses(layoutKey);
  const l = findFormLayout(layoutKey);
  const labelBar = l?.labelStyle === "bold-large" ? "h-2" : "h-1.5";
  return (
    <div className={`bg-white p-2.5 ${s.cardClass}`}>
      <div className="space-y-2">
        {["w-8", "w-10", "w-7"].map((w, i) => (
          <div key={i}>
            <div className={`${labelBar} ${w} rounded-full bg-ink/25 mb-1`} />
            <div className="h-2.5 w-full rounded border border-ink/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LayoutStylePicker({ activeLayout, onPick }) {
  const activeCategory = FORM_LAYOUTS.find((l) => l.key === activeLayout)?.category || "classic";
  const [cat, setCat] = useState(activeCategory);
  const layouts = FORM_LAYOUTS.filter((l) => l.category === cat);
  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">
        Layout Style {!activeLayout && <span className="text-ink/35">(none active — using the default layout)</span>}
      </p>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {FORM_LAYOUT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              cat === c.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {layouts.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => onPick(l)}
            title={l.name}
            className={`text-left p-2 border-2 rounded-lg bg-base/60 transition-all hover:shadow-md hover:-translate-y-0.5 ${
              activeLayout === l.key ? "border-primary" : "border-transparent"
            }`}
          >
            <MiniFormPreview layoutKey={l.key} />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] font-medium text-ink/70 truncate">{l.name}</p>
              {l.recommended && (
                <span className="text-[9px] font-semibold text-accent shrink-0">★ Recommended</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Divider-style accordion header shared by the three left-column sections
// (Add Fields / Form Style / Branding) — open state is owned by the parent
// (FormBuilder) so opening one section closes the others, and each header
// shows a one-line summary of its current settings so users don't have to
// open a section just to check what's set.
function SidebarSection({ icon: Icon, title, summary, badge, open, onToggle, children }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-3 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon size={14} className="text-primary shrink-0" />
            <h4 className="font-display font-semibold text-sm">{title}</h4>
            {badge && <span className="text-[9px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">{badge}</span>}
          </div>
          {!open && summary && <p className="text-[11px] text-secondary truncate mt-0.5 ml-[21px]">{summary}</p>}
        </div>
        <ChevronDownSquare size={14} className={`text-ink/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function BrandingEditor({ branding, onChange, open, onToggle }) {
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

  const themeName = FORM_THEMES.find((t) => t.key === branding.theme)?.name;
  const logoLabel = logoType === "none" ? null : logoType === "image" ? "Logo ✓" : "Text Logo ✓";
  const summary = [themeName, logoLabel].filter(Boolean).join(" • ") || "Not customized yet";

  return (
    <SidebarSection icon={Palette} title="Branding" summary={summary} open={open} onToggle={onToggle}>
      <div className="space-y-4">

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
    </SidebarSection>
  );
}

// Column-count picker for the canvas grid, pulled out of the Canvas header
// into its own collapsible section (matches Branding's expand/collapse
// pattern) so the header stays focused on the AI Assistant entry point.
function LayoutEditor({ layoutColumns, onChange, branding, onBrandingChange, open, onToggle }) {
  const layoutName = findFormLayout(branding.layoutStyle)?.name || "Standard";
  const navName = findPresentationTemplate(branding.presentationMode).name;
  const summary = `${layoutName} • ${layoutColumns} Column${layoutColumns === 1 ? "" : "s"} • ${navName}`;

  return (
    <SidebarSection icon={FormImageIcon} title="Form Style" summary={summary} badge="NEW" open={open} onToggle={onToggle}>
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40 mb-2 flex items-center gap-1"><Palette size={11} /> Appearance</p>
            <LayoutStylePicker activeLayout={branding.layoutStyle} onPick={(l) => onBrandingChange({ ...branding, layoutStyle: l.key })} />
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40 flex items-center gap-1"><Type size={11} /> Typography</p>
            <SegmentedPicker
              label="Label position"
              options={LABEL_POSITIONS}
              value={branding.labelPosition || "top"}
              onChange={(key) => onBrandingChange({ ...branding, labelPosition: key })}
            />

            <SegmentedPicker
              label="Content alignment"
              options={CONTENT_ALIGNMENTS}
              value={branding.contentAlign || "left"}
              onChange={(key) => onBrandingChange({ ...branding, contentAlign: key })}
            />
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40 mb-2 flex items-center gap-1"><Columns3 size={11} /> Layout</p>
            <p className="text-xs font-medium text-ink/60 mb-1.5">Canvas columns (all-on-one-page only)</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => onChange(n)}
                  title={`${n} column${n === 1 ? "" : "s"}`}
                  className={`text-left p-2 border-2 rounded-lg ${layoutColumns === n ? "border-primary" : "border-transparent"}`}
                >
                  <div className="bg-base rounded-md h-10 p-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                    {Array.from({ length: n }).map((_, i) => (
                      <div key={i} className="rounded-sm bg-ink/15" />
                    ))}
                  </div>
                  <p className="text-[11px] font-medium text-ink/70 text-center mt-1.5">{n} column{n === 1 ? "" : "s"}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40 mb-2 flex items-center gap-1"><NavigationIcon size={11} /> Navigation</p>
            <NavigationPicker
              presentationMode={branding.presentationMode || "single-page"}
              onChange={(key) => onBrandingChange({ ...branding, presentationMode: key })}
            />
          </div>
        </div>
    </SidebarSection>
  );
}

// One Page vs. Multi Step first — the sub-style grid (progress bar, dots,
// arrows, …) only appears once "Multi Step" is chosen, instead of always
// showing all 10 stepped variants alongside the single-page option. Keeps
// the common case (single-page) a one-click toggle instead of scanning
// past 10 cards to find it.
function NavigationPicker({ presentationMode, onChange }) {
  const current = findPresentationTemplate(presentationMode);
  const isMultiStep = current.stepped;
  const steppedTemplates = PRESENTATION_TEMPLATES.filter((p) => p.stepped);

  return (
    <div>
      <div className="flex gap-1 border border-border rounded-lg p-0.5 w-fit mb-3">
        <button
          type="button"
          onClick={() => onChange("single-page")}
          className={`px-3 py-1.5 rounded text-xs font-medium ${!isMultiStep ? "bg-primary text-white" : "text-ink/50 hover:bg-white"}`}
        >
          One Page
        </button>
        <button
          type="button"
          onClick={() => onChange(isMultiStep ? presentationMode : steppedTemplates[0].key)}
          className={`px-3 py-1.5 rounded text-xs font-medium ${isMultiStep ? "bg-primary text-white" : "text-ink/50 hover:bg-white"}`}
        >
          Multi Step
        </button>
      </div>

      {isMultiStep && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {steppedTemplates.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onChange(p.key)}
                className={`text-left p-2 border-2 rounded-lg ${presentationMode === p.key ? "border-primary" : "border-transparent"}`}
              >
                <PresentationPreview template={p} />
                <p className="text-[11px] font-medium text-ink/70 truncate mt-1.5">{p.name}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink/40 mt-1.5">
            The canvas still shows every field for editing — respondents will see this stepped experience.
          </p>
        </>
      )}
    </div>
  );
}

// Small mockup rendered above each Respondent-experience option's label —
// same "show, don't just name" idea as LayoutStylePicker's swatch.
function PresentationPreview({ template }) {
  if (!template.stepped) {
    return (
      <div className="bg-base rounded-md h-10 p-1.5 flex flex-col gap-1">
        <div className="h-1 w-3/4 rounded-full bg-ink/15" />
        <div className="h-1 w-full rounded-full bg-ink/15" />
        <div className="h-1 w-2/3 rounded-full bg-ink/15" />
      </div>
    );
  }
  return (
    <div className="bg-base rounded-md h-10 p-1.5 flex flex-col items-center justify-between">
      {template.indicator === "bar" && <div className="h-1 w-full rounded-full bg-ink/15 overflow-hidden"><div className="h-full w-1/3 bg-primary" /></div>}
      {template.indicator === "dots" && (
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => <span key={i} className={`w-1 h-1 rounded-full ${i === 0 ? "bg-primary" : "bg-ink/15"}`} />)}
        </div>
      )}
      {template.indicator === "counter" && <span className="text-[8px] text-ink/40">1 / 3</span>}
      {template.indicator === "percent" && <span className="text-[8px] text-ink/40">33%</span>}
      {template.indicator === "none" && <span className="h-1" />}
      <div className="h-1 w-2/3 rounded-full bg-ink/15" />
      {template.nav === "arrows" ? (
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full border border-ink/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
        </div>
      ) : (
        <div className="flex gap-1 self-end">
          <span className="w-3 h-1.5 rounded-sm bg-primary" />
        </div>
      )}
    </div>
  );
}

function SegmentedPicker({ label, options, value, onChange }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">{label}</p>
      <div className="flex gap-1 border border-border rounded-lg p-0.5 w-fit">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium ${
              value === o.key ? "bg-primary text-white" : "text-ink/50 hover:bg-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldPalette({ onAdd, onAskAI, showAI, open, onToggle }) {
  const [cat, setCat] = useState("basic");
  const active = FIELD_CATEGORIES.find((c) => c.key === cat);
  const summary = `${FIELD_TYPES.length} field types available`;
  return (
    <SidebarSection icon={Plus} title="Add Fields" summary={summary} open={open} onToggle={onToggle}>
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
            <t.icon size={16} className="text-ink/50" />
            <span className="text-heading">{t.label}</span>
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
    </SidebarSection>
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
      className="block text-sm font-semibold text-heading mb-1.5 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 cursor-text hover:bg-base"
      title="Click to rename this field"
      onClick={() => setEditing(true)}
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
function CanvasField({ field, accentColor, selected, onSelect, onChange, onDelete, dragHandleProps, labelPosition, contentAlign }) {
  const row = getFieldRowClasses(labelPosition, contentAlign);
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-lg py-3 px-3.5 -mx-3.5 transition-colors cursor-pointer ${row.formAlignClass} ${
        selected ? "bg-primary/5 ring-1 ring-primary/30" : "hover:bg-base/60"
      }`}
      {...dragHandleProps}
    >
      {/* Tablets/touchscreens have no hover, so opacity-0-until-hover would
          make these controls permanently unreachable there — only hide by
          default on devices that can actually hover (fine pointer + hover
          capability), never based on screen width alone. */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
        <button onClick={onSelect} className="p-1.5 rounded bg-base text-ink/50 hover:text-primary"><Pencil size={13} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded bg-base text-ink/50 hover:text-danger"><Trash2 size={13} /></button>
        <span className="p-1.5 rounded bg-base text-ink/30 cursor-grab"><GripVertical size={13} /></span>
      </div>
      <div className={row.rowClass}>
        <div className={row.labelWrapClass}>
          <EditableLabel field={field} onChange={onChange} />
        </div>
        <div className={row.inputWrapClass}>
          <FormFieldInput field={field} value={field.type === "checkbox" ? [] : ""} onChange={() => {}} accentColor={accentColor} />
          {field.helpText && <p className="text-xs text-ink/40 mt-1">{field.helpText}</p>}
        </div>
      </div>
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

export function FormBuilder({ form, onSave, planLimits }) {
  // Hidden outright rather than shown-then-erroring — a Starter account
  // clicking into the AI Assistant only to get a 403 is worse than never
  // seeing the option in the first place. Unknown (still loading) treated
  // as allowed so the UI doesn't flash the panel away after first paint.
  // Master admin bypasses plan limits on the backend (routes/forms.js's
  // /ai/build route) regardless of their own tenant's plan — this has to
  // match, or a master admin whose tenant happens to be on Starter would
  // never see the button for a feature they can actually use.
  const { isMasterAdmin } = useAuth();
  const aiAllowed = isMasterAdmin || !planLimits || planLimits.aiAssistant;
  const [fields, setFields] = useState(form.fields || []);
  const [selectedId, setSelectedId] = useState(null);
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
  const [layoutColumns, setLayoutColumns] = useState(form.settings?.layoutColumns || 1);
  // Accordion: only one of Add Fields / Form Style / Branding open at a
  // time, owned here (not per-section local state) so opening one closes
  // the others instead of all three being independently toggleable.
  const [openSidebarSection, setOpenSidebarSection] = useState("fields");

  useEffect(() => {
    setFields(form.fields || []);
    setApprovalEnabled(!!form.workflow?.enabled);
    setApproverIds((form.workflow?.steps?.[0]?.approvers || []).filter((a) => a.type === "user").map((a) => a.value));
    setBranding(form.settings?.branding || {});
    setLayoutColumns(form.settings?.layoutColumns || 1);
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const addField = (type) => {
    const f = newField(type);
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
    markDirty();
  };
  const updateField = (id, updated) => {
    setFields((f) => f.map((x) => (x.id === id ? updated : x)));
    markDirty();
  };
  const removeField = (id) => {
    if (selectedId === id) setSelectedId(null);
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
      layoutStyle: branding.layoutStyle || "",
      labelPosition: branding.labelPosition || "top",
      contentAlign: branding.contentAlign || "left",
      presentationMode: branding.presentationMode || "single-page",
    };
    onSave({
      fields,
      settings: { ...form.settings, branding: cleanBranding, layoutColumns },
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

  const selectedField = fields.find((f) => f.id === selectedId) || null;
  const showAiPanel = aiAllowed && aiOpen;

  // Same branding-to-style logic as the public form page (pages/forms/[id].jsx)
  // — the canvas is a live preview, so it should actually look like what
  // respondents will see instead of a plain gray box, right as branding
  // choices are made rather than only after publishing.
  const hasBackgroundImage = !!branding.backgroundImageDataUrl?.trim();
  const canvasBgStyle = hasBackgroundImage
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
  const canvasOverlayOpacity = hasBackgroundImage ? (branding.backgroundImageOverlay || 0) / 100 : 0;
  const canvasAccentColor = branding.accentColor || "";
  const canvasLogoType = branding.logoType || (branding.logoDataUrl ? "image" : "none");
  const canvasLayoutStyle = getLayoutStyleClasses(branding.layoutStyle);
  // Fixed 3-column studio layout — Field Library (280px) | Canvas (flexible,
  // should dominate the page) | Properties (340px), always reserving the
  // properties column so the canvas doesn't reflow width when a field is
  // selected. The AI Assistant, when open, adds a 4th column.
  // Tailwind's JIT only picks up class names that appear literally in the
  // source, so this has to be an explicit lookup of full strings rather
  // than building the arbitrary-value string at runtime.
  const gridColsClass = showAiPanel
    ? "lg:grid-cols-[280px_1fr_340px_320px]"
    : "lg:grid-cols-[280px_1fr_340px]";

  return (
    <div className={`grid grid-cols-1 ${gridColsClass} gap-4 items-start relative`}>
      <div className="border border-border rounded-card bg-white px-3">
        <FieldPalette
          onAdd={addField}
          onAskAI={() => setAiOpen(true)}
          showAI={aiAllowed}
          open={openSidebarSection === "fields"}
          onToggle={() => setOpenSidebarSection(openSidebarSection === "fields" ? null : "fields")}
        />

        <LayoutEditor
          layoutColumns={layoutColumns}
          onChange={(n) => { setLayoutColumns(n); markDirty(); }}
          branding={branding}
          onBrandingChange={(next) => { setBranding(next); markDirty(); }}
          open={openSidebarSection === "style"}
          onToggle={() => setOpenSidebarSection(openSidebarSection === "style" ? null : "style")}
        />

        <BrandingEditor
          branding={branding}
          onChange={(next) => { setBranding(next); markDirty(); }}
          open={openSidebarSection === "branding"}
          onToggle={() => setOpenSidebarSection(openSidebarSection === "branding" ? null : "branding")}
        />
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

        <div className={`relative bg-white overflow-hidden ${canvasLayoutStyle.cardClass} ${canvasLayoutStyle.cardPaddingClass}`} style={canvasBgStyle}>
          {canvasOverlayOpacity > 0 && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${canvasOverlayOpacity})` }} />
          )}
          <div className="relative">
            {canvasLogoType === "image" && branding.logoDataUrl && (
              <img src={branding.logoDataUrl} alt="" className="h-12 mb-3 object-contain" />
            )}
            {canvasLogoType === "text" && branding.logoText && (
              <div className="font-display font-bold text-lg mb-3">{branding.logoText}</div>
            )}
            {fields.length === 0 ? (
              <div className="text-sm text-ink/40 border border-dashed border-border rounded-lg p-8 text-center bg-white">
                No fields yet — add one from the palette on the left{aiAllowed ? ", or ask the AI Assistant" : ""}.
              </div>
            ) : (
              <div className={`grid grid-cols-1 ${LAYOUT_GRID_COLS_CLASS[layoutColumns]} ${canvasLayoutStyle.gapClass}`}>
                {fields.map((f, i) => (
                  <div
                    key={f.id}
                    className={fieldColSpanClass(f)}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(i)}
                  >
                    <CanvasField
                      field={f}
                      accentColor={canvasAccentColor}
                      selected={selectedId === f.id}
                      onSelect={() => setSelectedId(f.id)}
                      onChange={(updated) => updateField(f.id, updated)}
                      onDelete={() => removeField(f.id)}
                      labelPosition={branding.labelPosition}
                      contentAlign={branding.contentAlign}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <ApprovalRequirementEditor
          enabled={approvalEnabled}
          approverIds={approverIds}
          onChange={({ enabled, approverIds: next }) => {
            setApprovalEnabled(enabled);
            setApproverIds(next);
            markDirty();
          }}
        />

        <div className="sticky bottom-4 flex justify-end mt-4 z-20">
          <Button onClick={save} disabled={!dirty} className="shadow-lg">Save Changes</Button>
        </div>
      </div>

      {selectedField ? (
        <FieldPropertiesPanel
          field={selectedField}
          fields={fields}
          onChange={(updated) => updateField(selectedField.id, updated)}
          onDelete={() => removeField(selectedField.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <div className="hidden lg:flex border border-dashed border-border rounded-card h-fit lg:sticky lg:top-4 p-8 text-center">
          <div className="m-auto">
            <Target size={22} className="text-ink/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-heading">Select a field</p>
            <p className="text-xs text-secondary mt-1">Click any field in the form to edit its properties.</p>
          </div>
        </div>
      )}

      {showAiPanel && (
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
  const [createLeadOnSubmit, setCreateLeadOnSubmit] = useState(!!form.createLeadOnSubmit);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(form.name);
    setDescription(form.description || "");
    setCreateLeadOnSubmit(!!form.createLeadOnSubmit);
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const save = () => {
    onSave({ name, description, createLeadOnSubmit });
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

      <label className="flex items-start gap-2.5 text-sm text-ink/70 border border-border rounded-lg p-3.5 mb-4">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={createLeadOnSubmit}
          onChange={(e) => { setCreateLeadOnSubmit(e.target.checked); markDirty(); }}
        />
        <span>
          <span className="font-medium text-ink">Create a Lead from every submission</span>
          <br />
          <span className="text-xs text-ink/40">
            Pulls a name from the first text field and matches email/phone-type fields into the new Lead —
            source is set to this form's name. Turn this on for lead-gen forms (contact us, get a quote, etc.).
          </span>
        </span>
      </label>

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

export function ShareLink({ form }) {
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

// Decorative mini-preview (icon + fake field lines) shown at the top of
// TemplateCard — makes the grid read as a library of actual documents
// instead of a flat icon+text list.
function MiniTemplatePreview({ templateKey }) {
  const Icon = templateIcon(templateKey);
  return (
    <div className="rounded-lg bg-primary/5 p-2.5 mb-2.5">
      <Icon size={16} className="text-primary mb-2" />
      <div className="space-y-1">
        <div className="h-1 w-full rounded-full bg-primary/15" />
        <div className="h-1 w-2/3 rounded-full bg-primary/15" />
      </div>
    </div>
  );
}

function TemplateCard({ template, selected, onClick }) {
  const isPopular = POPULAR_TEMPLATE_KEYS.includes(template.key);
  return (
    <button
      onClick={onClick}
      className={`group relative text-left border rounded-xl p-3.5 bg-white ${CARD_HOVER} ${
        selected ? "border-primary ring-1 ring-primary/30" : "border-[#E7E9EC]"
      }`}
    >
      <MiniTemplatePreview templateKey={template.key} />
      <p className="text-sm font-medium truncate">{template.name}</p>
      {isPopular && (
        <p className="flex items-center gap-1 text-[11px] text-accent mt-0.5">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={9} fill="currentColor" />)} Popular
        </p>
      )}
      <p className="text-xs text-ink/40 mt-0.5">{template.category}</p>
      <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity block mt-1.5">
        Use Template →
      </span>
    </button>
  );
}

// Compact card for the "Popular Templates" strip — icon + name + category,
// no description/metadata (that's what TemplateCard is for, used further
// down in the filtered/category template grid).
function PopularTemplateCard({ template, onClick }) {
  const Icon = templateIcon(template.key);
  return (
    <button
      onClick={onClick}
      className={`text-left border border-[#E7E9EC] rounded-xl p-3.5 bg-white ${CARD_HOVER}`}
    >
      <div className={`${ICON_BOX} w-9 h-9 rounded-lg mb-2.5`}>
        <Icon size={17} className="text-primary" />
      </div>
      <p className="text-sm font-medium truncate">{template.name}</p>
      <p className="text-xs text-ink/40 mt-0.5">{template.category}</p>
    </button>
  );
}

// Category overview card — icon, name, count, and up to 2 example template
// names with a "+N more" badge. Clicking it is equivalent to picking that
// category from the filter dropdown below (scrolls the filtered grid into
// view for it).
function CategoryCard({ category, templates, active, onClick }) {
  const Icon = categoryIcon(category);
  const examples = templates.slice(0, 2);
  const more = templates.length - examples.length;
  return (
    <button
      onClick={onClick}
      className={`text-left border rounded-xl p-4 bg-white ${CARD_HOVER} ${active ? "border-primary" : "border-[#E7E9EC]"}`}
    >
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
          <Icon size={17} />
        </div>
        {more > 0 && <span className="text-[10px] font-medium text-ink/35 bg-base rounded-full px-1.5 py-0.5">+{more} more</span>}
      </div>
      <p className="text-sm font-medium">{category}</p>
      <p className="text-xs text-ink/40 mb-2">{templates.length} template{templates.length === 1 ? "" : "s"}</p>
      <div className="space-y-0.5">
        {examples.map((t) => <p key={t.key} className="text-[11px] text-ink/45 truncate">{t.name}</p>)}
      </div>
    </button>
  );
}

// Icon rotation for the "Try these examples" chips — purely decorative,
// matched loosely to what each example implies (leave -> plane, feedback ->
// star, etc.) rather than tied to real template keys.
const EXAMPLE_PROMPTS = [
  { label: "Leave Request", icon: Sparkles },
  { label: "Customer Feedback", icon: Star },
  { label: "Event Registration", icon: Calendar },
  { label: "Meeting Booking", icon: CalendarClock },
  { label: "Job Application", icon: Briefcase },
  { label: "Contact Form", icon: Mail },
];

const CARD_HOVER = "transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:border-primary/40";
const ICON_BOX = "w-12 h-12 rounded-[14px] bg-[#F5F7F9] flex items-center justify-center";

const GEN_STEPS = [
  "Understanding your request",
  "Creating form fields",
  "Adding validation rules",
  "Configuring approval workflow",
  "Setting up notifications",
  "Finalizing your form",
];

function StepHeader({ n, label, reached }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 ${reached ? "bg-primary" : "bg-ink/15"}`}>
        {n}
      </span>
      <span className={`text-sm font-medium ${reached ? "text-heading" : "text-ink/35"}`}>{label}</span>
    </div>
  );
}

// Replaces the normal 3-card row while an AI generation is in flight or
// just finished — "You describe" recaps the prompt, "AI is building" shows
// a simulated step checklist + progress bar, "Form is ready" shows a
// summary with Preview/Edit actions once genPhase reaches "ready".
function AIGenerationStepper({
  prompt, onPromptChange, genPhase, genStep, genResult, onReset, onPreview, onEdit, onRegenerate,
  modifyPrompt, onModifyPromptChange, onModify, modifying,
}) {
  const percent = Math.round(((genStep + 1) / GEN_STEPS.length) * 100);
  const ready = genPhase === "ready" && genResult;

  return (
    <div className="mb-14">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-center">
        <StepHeader n={1} label="You describe" reached />
        <StepHeader n={2} label="AI is building your form" reached />
        <StepHeader n={3} label="Form is ready" reached={ready} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="border border-[#E7E9EC] rounded-2xl p-6 bg-white">
          <p className="text-base font-display font-semibold flex items-center gap-1.5 mb-3">
            <Sparkles size={16} className="text-primary" /> Generate with AI
          </p>
          <div className="relative">
            <textarea
              className={`${inputCls} resize-none text-sm`}
              rows={3}
              maxLength={500}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              disabled={genPhase === "generating"}
            />
            <span className="absolute right-3 bottom-2 text-[10px] text-ink/30">{prompt.length}/500</span>
          </div>
          {ready && (
            <div className="my-3">
              <Button onClick={onRegenerate} disabled={!prompt.trim()} className="w-full justify-center h-12 rounded-xl text-base">
                <Sparkles size={14} /> Regenerate <ArrowRight size={14} />
              </Button>
            </div>
          )}
          <p className="text-[11px] font-medium text-ink/40 mt-3 mb-2">Popular prompts</p>
          <div className="grid grid-cols-2 gap-1.5">
            {EXAMPLE_PROMPTS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => onPromptChange(label)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-white text-ink/60 hover:bg-primary hover:border-primary hover:text-white transition-colors truncate"
              >
                <Icon size={12} className="shrink-0" /> <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-[#E7E9EC] rounded-2xl p-6 bg-white">
          <p className="text-base font-display font-semibold flex items-center gap-1.5">
            <Sparkles size={16} className="text-primary" /> AI is creating your form…
          </p>
          <p className="text-xs text-ink/40 mt-1 mb-4">This usually takes less than 10 seconds.</p>
          <div className="space-y-2.5">
            {GEN_STEPS.map((step, i) => (
              <div key={step} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {i < genStep || ready ? (
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0"><Check size={12} /></span>
                  ) : (
                    <span className={`w-5 h-5 rounded-full border-2 shrink-0 ${i === genStep ? "border-primary" : "border-ink/15"}`} />
                  )}
                  <span className={`text-sm ${i <= genStep || ready ? "text-heading" : "text-ink/35"}`}>{step}</span>
                </div>
                {(i < genStep || ready) && <span className="text-xs font-medium text-primary">Done</span>}
              </div>
            ))}
          </div>
          <div className="h-1.5 rounded-full bg-base overflow-hidden mt-4">
            <div className="h-full bg-primary transition-all" style={{ width: `${ready ? 100 : percent}%` }} />
          </div>
          <p className="text-right text-xs text-ink/40 mt-1">{ready ? 100 : percent}%</p>

          {!ready ? (
            <div className="border border-border rounded-lg p-3 mt-4 bg-base/40">
              <p className="text-xs font-semibold flex items-center gap-1"><Sparkles size={11} className="text-primary" /> Did you know?</p>
              <p className="text-xs text-ink/50 mt-1">You can always ask AI to add, remove or modify fields later.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg p-3 mt-4">
              <p className="text-xs font-semibold flex items-center gap-1"><ClipboardCheck size={12} className="text-primary" /> Modify your form with AI</p>
              <p className="text-[11px] text-ink/40 mt-0.5 mb-2">Tell AI what to change or add.</p>
              <div className="flex gap-1.5">
                <input
                  className={`${inputCls} text-xs py-1.5`}
                  placeholder="e.g. Add a phone number field"
                  value={modifyPrompt}
                  onChange={(e) => onModifyPromptChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onModify()}
                />
                <Button variant="secondary" onClick={onModify} disabled={modifying || !modifyPrompt.trim()} className="shrink-0 text-xs px-3">
                  {modifying ? "Working…" : <><Sparkles size={12} /> Modify with AI</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="border border-[#E7E9EC] rounded-2xl p-6 bg-white flex flex-col items-center text-center">
          {!ready ? (
            <div className="m-auto text-ink/30">
              <Sparkles size={28} className="mx-auto mb-2" />
              <p className="text-sm">Waiting for your form…</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center mb-3">
                <Check size={24} />
              </div>
              <p className="font-display font-bold text-lg">Your form is ready! 🎉</p>
              <p className="text-xs text-ink/40 mt-1 mb-4">We've created a form based on your description.</p>
              <div className="w-full border border-border rounded-lg p-3.5 text-left mb-4">
                <p className="text-xs font-semibold mb-2">AI Generated Summary</p>
                <div className="space-y-1.5 text-xs text-ink/60">
                  <div className="flex justify-between"><span>Fields Added</span><span className="font-medium text-heading">{genResult.summary.fieldsAdded}</span></div>
                  <div className="flex justify-between"><span>Sections</span><span className="font-medium text-heading">{genResult.summary.sections}</span></div>
                  <div className="flex justify-between"><span>Validation Rules</span><span className="font-medium text-heading">{genResult.summary.validationRules}</span></div>
                  <div className="flex justify-between"><span>Approval Workflow</span><span className="font-medium text-heading">{genResult.summary.approvalWorkflow}</span></div>
                  <div className="flex justify-between"><span>Estimated Completion Time</span><span className="font-medium text-heading">{genResult.summary.eta}</span></div>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="secondary" onClick={onPreview} className="flex-1 justify-center">Preview Form</Button>
                <Button onClick={onEdit} className="flex-1 justify-center">Edit in Builder <ArrowRight size={14} /></Button>
              </div>
            </>
          )}
        </div>
      </div>

      <button onClick={onReset} className="text-xs font-medium text-primary hover:underline mt-3">← Start over</button>
    </div>
  );
}

export function AddFormPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [prompt, setPrompt] = useState("");
  // idle -> generating -> ready, driving the 3-step "You describe / AI is
  // building / Form is ready" panel that replaces the normal 3-card row
  // while an AI generation is in flight or just finished.
  const [genPhase, setGenPhase] = useState("idle");
  const [genStep, setGenStep] = useState(0);
  const [genResult, setGenResult] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [aiUsage, setAiUsage] = useState(null);
  const gridRef = useRef(null);
  const { isMasterAdmin } = useAuth();

  const loadAiUsage = () => api.get("/settings").then((r) => setAiUsage(r.data.aiUsage)).catch(() => {});

  useEffect(() => {
    api.get("/forms/templates").then((r) => setTemplates(r.data));
    loadAiUsage();
  }, []);

  const goToBuild = (form) => router.push(`/app/forms/${form.id}/build`);

  const createFromTemplate = async (template) => {
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/forms/from-template", { templateKey: template.key, name: "Untitled Form" });
      goToBuild(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't create that form.");
      setCreating(false);
    }
  };

  const startFromScratch = () => createFromTemplate({ key: "blank" });

  // Fake step-by-step progress — the backend does this in one request, not
  // 6 discrete phases, but a flat spinner for several seconds reads as
  // "is this stuck?" whereas a checklist that advances on a timer (and
  // snaps to "done" the moment the real response lands) reads as active
  // work happening, which is what actually keeps a user waiting patiently.
  const stepTimerRef = useRef(null);
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [modifying, setModifying] = useState(false);

  const buildSummary = (fields, savedForm) => {
    const validationRules = fields.filter(
      (f) => f.validation?.min !== undefined || f.validation?.max !== undefined || f.validation?.minLength || f.validation?.maxLength
    ).length;
    return {
      fieldsAdded: fields.length,
      sections: Math.max(1, Math.ceil(fields.length / 4)),
      validationRules,
      approvalWorkflow: savedForm.workflow?.enabled ? 1 : 0,
      eta: "2 mins",
    };
  };

  // `formId` is set when regenerating an already-created form (from the
  // "Regenerate" button) instead of the first-time flow, which creates a
  // fresh blank form first — regenerating reuses the same form rather than
  // abandoning the old one and creating another.
  const runGeneration = async (formId) => {
    setError("");
    setGenPhase("generating");
    setGenStep(0);
    stepTimerRef.current = setInterval(() => {
      setGenStep((s) => (s < GEN_STEPS.length - 2 ? s + 1 : s));
    }, 900);
    try {
      const { data: result } = await api.post(`/forms/${formId}/ai/build`, { prompt });
      const fields = result.fields || [];
      const { data: saved } = await api.put(`/forms/${formId}`, { fields });
      clearInterval(stepTimerRef.current);
      setGenStep(GEN_STEPS.length - 1);
      setGenResult({ form: saved, summary: buildSummary(fields, saved) });
      loadAiUsage();
      setTimeout(() => setGenPhase("ready"), 400);
    } catch (err) {
      clearInterval(stepTimerRef.current);
      setError(err.response?.data?.error || "Couldn't generate that form.");
      setGenPhase("idle");
    }
  };

  const generate = async () => {
    if (!prompt.trim() || genPhase === "generating") return;
    const { data: form } = await api.post("/forms/from-template", { templateKey: "blank", name: prompt.slice(0, 60) });
    runGeneration(form.id);
  };

  const regenerate = () => {
    if (!prompt.trim() || genPhase === "generating" || !genResult) return;
    runGeneration(genResult.form.id);
  };

  // Follow-up tweak without leaving the "ready" panel — sends the existing
  // fields as context so the model edits/extends them instead of starting
  // over, same pattern as the in-builder AI Assistant.
  const modifyWithAI = async () => {
    if (!modifyPrompt.trim() || modifying || !genResult) return;
    setModifying(true);
    setError("");
    try {
      const { data: result } = await api.post(`/forms/${genResult.form.id}/ai/build`, {
        prompt: modifyPrompt,
        currentFields: genResult.form.fields || [],
      });
      const fields = result.fields || [];
      const { data: saved } = await api.put(`/forms/${genResult.form.id}`, { fields });
      setGenResult({ form: saved, summary: buildSummary(fields, saved) });
      setModifyPrompt("");
      loadAiUsage();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't modify that form.");
    } finally {
      setModifying(false);
    }
  };

  const resetGenerate = () => {
    setGenPhase("idle");
    setGenResult(null);
    setPrompt("");
    setModifyPrompt("");
  };

  const realTemplates = templates.filter((t) => t.key !== "blank");
  const categories = [...new Set(realTemplates.map((t) => t.category))];
  const popular = POPULAR_TEMPLATE_KEYS.map((k) => realTemplates.find((t) => t.key === k)).filter(Boolean);

  const q = query.trim().toLowerCase();
  const filterActive = q || category !== "All Categories";
  const filtered = realTemplates.filter((t) => {
    if (category !== "All Categories" && t.category !== category) return false;
    if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    return true;
  });

  // Generate-with-AI is a premium (Team/Enterprise) capability — Free plan
  // shows no trace of it, not just a disabled button, hence hiding the
  // whole card rather than dimming it.
  const aiAllowed = isMasterAdmin || !aiUsage || aiUsage.limit > 0;

  const jumpToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const pickCategory = (cat) => {
    setCategory(category === cat ? "All Categories" : cat);
    jumpToGrid();
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="font-display font-bold text-4xl leading-tight text-heading">Add Form</h1>
          <p className="text-base text-secondary mt-1.5">Create a form in the way that works best for you.</p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/app/forms")}>
          <ArrowLeft size={14} /> Back to Forms
        </Button>
      </div>

      {genPhase === "idle" ? (
      <div className={`grid grid-cols-1 gap-5 mb-14 ${aiAllowed ? "lg:grid-cols-[2fr_1fr_1fr]" : "lg:grid-cols-2"}`}>
        {aiAllowed && (
        <div
          className="rounded-[20px] p-7"
          style={{
            background: "#FFFFFF",
            border: "2px solid #2F5D50",
            boxShadow: "0 1px 2px rgba(0,0,0,.05), 0 12px 40px rgba(47,93,80,.08)",
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-[22px] font-display font-semibold flex items-center gap-2">
              <Sparkles size={19} className="text-primary" /> Generate with AI
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Recommended</span>
            </p>
            {aiUsage && (
              <div className="border border-border rounded-lg px-3 py-2 min-w-[150px]" title="Resets on the 1st of each month">
                {isMasterAdmin || !Number.isFinite(aiUsage.limit) ? (
                  <p className="text-xs font-medium text-ink/60">AI Left: Unlimited{isMasterAdmin ? " (Admin)" : ""}</p>
                ) : (
                  <>
                    <p className="text-xs font-medium text-ink/60 flex items-center gap-1">
                      AI Left: {Math.max(0, aiUsage.limit - aiUsage.used)} / {aiUsage.limit}
                    </p>
                    <div className="h-1.5 rounded-full bg-base overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-[15px] text-secondary mt-1.5 mb-4">Describe your form and let AI build it for you in seconds.</p>

          <p className="text-xs font-medium text-ink/50 mb-1.5">✨ Describe your form...</p>
          <div className="relative">
            <textarea
              className={`${inputCls} resize-none pr-9`}
              rows={3}
              maxLength={500}
              placeholder="Create an employee leave request form with manager approval and emergency contact"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate(); }}
            />
            <Sparkles size={15} className="absolute right-3 top-3 text-primary/40" />
            <span className="absolute right-3 bottom-2 text-[10px] text-ink/30">{prompt.length}/500</span>
          </div>
          <p className="text-[11px] text-ink/35 mt-1">⌘ Enter to generate</p>

          {(() => {
            const quotaExhausted = !isMasterAdmin && aiUsage && Number.isFinite(aiUsage.limit) && aiUsage.used >= aiUsage.limit;
            return (
              <div className="my-4">
                <Button onClick={generate} disabled={!prompt.trim() || quotaExhausted} className="h-12 px-6 rounded-xl text-base">
                  Generate Form <ArrowRight size={15} />
                </Button>
                {quotaExhausted && (
                  <p className="text-xs text-danger mt-2">You've used all {aiUsage.limit} AI generations this month. It resets on the 1st.</p>
                )}
              </div>
            );
          })()}

          <p className="text-[11px] font-medium text-ink/40 mb-2">Try these examples:</p>
          <div className="grid grid-cols-3 gap-2">
            {EXAMPLE_PROMPTS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setPrompt(label)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-white text-ink/60 hover:bg-primary hover:border-primary hover:text-white transition-colors truncate"
              >
                <Icon size={12} className="shrink-0" /> <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        <div className={`border border-[#E7E9EC] rounded-2xl p-6 flex flex-col bg-white ${CARD_HOVER}`}>
          <div className={`${ICON_BOX} mb-4`}>
            <LayoutGrid size={22} className="text-ink/60" />
          </div>
          <p className="text-[22px] font-display font-semibold">Browse Templates</p>
          <p className="text-[15px] text-secondary mt-1.5 mb-4">Choose from {realTemplates.length}+ professionally designed templates across categories.</p>
          <div className="flex-1 relative h-24 mb-4 overflow-hidden">
            {[
              { icon: Calendar, bg: "bg-primary/10", text: "text-primary" },
              { icon: FileText, bg: "bg-accent/10", text: "text-accent" },
              { icon: Receipt, bg: "bg-danger/10", text: "text-danger" },
            ].map((c, i) => (
              <div
                key={i}
                className={`absolute top-0 w-24 h-24 rounded-lg border border-border ${c.bg} p-2.5`}
                style={{ left: `${i * 34}px`, zIndex: 3 - i }}
              >
                <c.icon size={16} className={c.text} />
                <div className="space-y-1 mt-2">
                  <div className={`h-1 w-full rounded-full ${c.bg}`} />
                  <div className={`h-1 w-3/4 rounded-full ${c.bg}`} />
                  <div className={`h-1 w-full rounded-full ${c.bg}`} />
                </div>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={jumpToGrid} className="h-12 px-6 rounded-xl text-base">Browse Templates <ArrowRight size={15} /></Button>
        </div>

        <div className={`border border-[#E7E9EC] rounded-2xl p-6 flex flex-col bg-white ${CARD_HOVER}`}>
          <div className={`${ICON_BOX} mb-4`}>
            <Pencil size={22} className="text-ink/60" />
          </div>
          <p className="text-[22px] font-display font-semibold">Start from Scratch</p>
          <p className="text-[15px] text-secondary mt-1.5 mb-4">Create a blank form and add fields yourself.</p>
          <button
            onClick={startFromScratch}
            disabled={creating}
            className="flex-1 h-24 mb-4 border border-dashed border-border rounded-lg p-3 hover:border-primary/50 hover:bg-base/40 transition-colors disabled:opacity-50 text-left"
          >
            <p className="text-[10px] font-medium text-ink/50 mb-1">Name</p>
            <div className="h-1.5 w-full rounded-full bg-ink/10 mb-2" />
            <p className="text-[10px] font-medium text-ink/50 mb-1">Email</p>
            <div className="h-1.5 w-2/3 rounded-full bg-ink/10" />
          </button>
          <Button variant="secondary" onClick={startFromScratch} disabled={creating} className="h-12 px-6 rounded-xl text-base">Start Blank Form <ArrowRight size={15} /></Button>
        </div>
      </div>
      ) : (
        <AIGenerationStepper
          prompt={prompt}
          onPromptChange={setPrompt}
          genPhase={genPhase}
          genStep={genStep}
          genResult={genResult}
          onReset={resetGenerate}
          onPreview={() => window.open(`/forms/${genResult.form.id}?preview=1`, "_blank")}
          onEdit={() => goToBuild(genResult.form)}
          onRegenerate={regenerate}
          modifyPrompt={modifyPrompt}
          onModifyPromptChange={setModifyPrompt}
          onModify={modifyWithAI}
          modifying={modifying}
        />
      )}

      {popular.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-lg flex items-center gap-1.5"><Star size={16} className="text-primary" /> Popular Templates</h2>
            <button onClick={() => { setCategory("All Categories"); setQuery(""); jumpToGrid(); }} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View all templates <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {popular.map((t) => <PopularTemplateCard key={t.key} template={t} onClick={() => createFromTemplate(t)} />)}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search templates by name or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${inputCls} pr-8 appearance-none cursor-pointer`}
          >
            <option>All Categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none" />
        </div>
      </div>

      <div ref={gridRef}>
        {filterActive ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => { setCategory("All Categories"); setQuery(""); }}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                <ArrowLeft size={12} /> All Categories
              </button>
              <h2 className="font-display font-semibold text-base">
                {filtered.length} template{filtered.length === 1 ? "" : "s"}
              </h2>
            </div>
            {creating ? (
              <p className="text-sm text-ink/40 text-center py-10">Creating your form…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-ink/40 text-center py-10">No templates match your search.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filtered.map((t) => <TemplateCard key={t.key} template={t} onClick={() => createFromTemplate(t)} />)}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="font-display font-semibold text-base mb-3">Categories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <CategoryCard
                  key={cat}
                  category={cat}
                  templates={realTemplates.filter((t) => t.category === cat)}
                  active={false}
                  onClick={() => pickCategory(cat)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger mt-4">{error}</p>}
    </div>
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
  const { canManage, isMasterAdmin } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState(null);
  // Which form's inline panel (Workflow/Settings/Responses/Analytics) is
  // expanded — Build now lives on its own page (/app/forms/[id]/build), so
  // there's no "active form" driving a single shared canvas anymore, just
  // an accordion of per-row panels.
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState(null);
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

  // TODO: suspected culprit behind a Cypress "element covered by another
  // element" flake on the New Form modal — a socket db:change event firing
  // load() while the modal is open may be causing a stray re-render/second
  // fixed-position paint. Not confirmed yet; revisit if the flake persists
  // after ruling out stale dev-server HMR state. Will fix later.
  useLiveCollection(["forms", "form_responses"], () => { load(); loadApprovalsCount(); });
  useLiveCollection(["settings"], loadPlanLimits);

  const atFormLimit = !isMasterAdmin && planLimits && forms.length >= planLimits.maxForms;

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

  const saveFor = async (formId, patch) => {
    setSaveError("");
    try {
      await api.put(`/forms/${formId}`, patch);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't save that change.");
    }
  };

  // Accordion: clicking an already-open panel on the same form closes it;
  // clicking a different panel/form switches to that one.
  const togglePanel = (form, tabKey) => {
    if (active?.id === form.id && tab === tabKey) {
      setActive(null);
      setTab(null);
    } else {
      setActive(form);
      setTab(tabKey);
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
                    router.push("/app/forms/new");
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
        <Card className="divide-y divide-border">
          {forms.map((f) => (
            <div key={f.id} className="px-5">
              <div className="py-4 flex items-center justify-between gap-4">
                {/* Left column: name + description */}
                <div className="min-w-0 flex-1">
                  <Link href={`/app/forms/${f.id}/build`} className="font-display font-semibold text-heading hover:text-primary truncate block">
                    {f.name}
                  </Link>
                  <p className="text-xs text-secondary truncate mt-0.5">
                    {f.description || "No description"} · {f.responseCount} response{f.responseCount === 1 ? "" : "s"}
                  </p>
                </div>

                {/* Right column: status, quick links, actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge>{f.status}</Badge>
                  {STUDIO_NAV.filter((item) => item.key !== "builder").map((item) => (
                    <button
                      key={item.key}
                      onClick={() => (item.key === "responses" ? router.push(`/app/forms/${f.id}/responses`) : togglePanel(f, item.key))}
                      title={item.label}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active?.id === f.id && tab === item.key
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-secondary hover:text-heading hover:border-primary/30"
                      }`}
                    >
                      <item.icon size={13} /> {item.label}
                    </button>
                  ))}
                  <Button variant="secondary" onClick={() => window.open(`/forms/${f.id}?preview=1`, "_blank")} title="Preview">
                    <Eye size={14} />
                  </Button>
                  {canManage && (
                    <>
                      <Button variant="secondary" onClick={() => togglePublish(f)} disabled={actionBusy} title={f.status === "Published" ? "Unpublish" : "Publish"}>
                        {f.status === "Published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button variant="secondary" onClick={() => duplicateForm(f)} disabled={actionBusy} title="Duplicate"><Copy size={14} /></Button>
                      <Button variant="danger" onClick={() => setDeleteTarget(f)} disabled={actionBusy} title="Delete"><Trash2 size={14} /></Button>
                    </>
                  )}
                </div>
              </div>

              {active?.id === f.id && tab && (
                <div className="pb-5">
                  {f.status === "Published" && <ShareLink form={f} />}
                  {tab === "whatsapp" ? (
                    <WhatsAppSurveyPanel form={f} />
                  ) : tab === "settings" ? (
                    <FormSettingsPanel form={f} onSave={(patch) => saveFor(f.id, patch)} />
                  ) : (
                    <FormAnalyticsPanel form={f} recentResponses={stats?.recentResponses || []} />
                  )}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

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
