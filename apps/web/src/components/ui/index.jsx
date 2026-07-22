import { useEffect, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-border rounded-card shadow-card ${className}`}>
      {children}
    </div>
  );
}

const BADGE_COLORS = {
  // status / priority colors
  New: "bg-blue-50 text-blue-700",
  Contacted: "bg-amber-50 text-amber-700",
  Qualified: "bg-purple-50 text-purple-700",
  Converted: "bg-emerald-50 text-emerald-700",
  Lost: "bg-red-50 text-red-700",
  High: "bg-red-50 text-red-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
  Pending: "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  "New Lead": "bg-blue-50 text-blue-700",
  "Meeting Scheduled": "bg-purple-50 text-purple-700",
  "Quotation Sent": "bg-amber-50 text-amber-700",
  Negotiation: "bg-orange-50 text-orange-700",
  Won: "bg-emerald-50 text-emerald-700",
  Draft: "bg-slate-100 text-slate-600",
  Sent: "bg-blue-50 text-blue-700",
  Paid: "bg-emerald-50 text-emerald-700",
  Overdue: "bg-red-50 text-red-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
};

export function Badge({ children }) {
  const cls = BADGE_COLORS[children] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark",
    secondary: "bg-white text-ink border border-border hover:bg-base",
    danger: "bg-danger text-white hover:brightness-95",
    ghost: "text-ink/70 hover:bg-base",
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    // Wraps instead of squeezing on narrow screens — an `action` with its
    // own width (a button, a "Last analyzed" block) was fighting the
    // title/subtitle for space at phone widths under the old plain
    // justify-between row.
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4 sm:mb-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink/50 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, wide, xl }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-card shadow-xl w-full ${xl ? "max-w-6xl" : wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
          <div>
            <h3 className="font-display font-semibold text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-ink/45 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">
            <X size={19} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, required, children }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium text-ink/60 mb-1.5">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function SectionHeading({ children }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mt-1 mb-2.5">{children}</h4>;
}

export const inputCls =
  "w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors";

// A password <input> with a show/hide toggle — same inputCls styling as
// every other field, just with an eye icon button overlaid so it doesn't
// need its own wrapper markup at every call site (login, signup, reset).
export function PasswordInput({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${inputCls} pr-9 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/60"
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${
        checked ? "bg-primary" : "bg-ink/15"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

// Custom replacement for window.confirm()/prompt() — those block the JS
// thread, can't be styled, and are jarring next to an otherwise custom UI.
// Set `withReason` for a prompt-style dialog (e.g. "reason for rejecting",
// optional); omit it for a plain yes/no confirm.
export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger,
  withReason, reasonLabel = "Reason (optional)", onConfirm, onCancel,
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-semibold text-[16px] mb-1.5">{title}</h3>
        {message && <p className="text-sm text-ink/60 mb-3">{message}</p>}
        {withReason && (
          <textarea
            className={`${inputCls} mb-3`}
            rows={3}
            placeholder={reasonLabel}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => onConfirm(reason)}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// A single-button "OK" modal for surfacing an error message — used instead
// of window.alert() (blocks the JS thread, can't be styled) for errors
// that can't be prevented in advance by disabling the triggering control
// (see the disabled+title-tooltip pattern used elsewhere for the cases
// that can be predicted, e.g. a plan's form/user limit already being hit).
export function ErrorModal({ open, title = "Something went wrong", message, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-semibold text-[16px] mb-1.5 text-danger">{title}</h3>
        <p className="text-sm text-ink/70 mb-4">{message}</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </div>
  );
}

// `action` is kept as an alias for `primaryAction` — existing call sites
// that only pass `action` keep working unchanged.
export function EmptyState({ icon: Icon, title, subtitle, action, primaryAction, secondaryAction, tip }) {
  const primary = primaryAction || action;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-base flex items-center justify-center mb-3">
          <Icon size={20} className="text-ink/30" />
        </div>
      )}
      <p className="font-medium text-ink/70">{title}</p>
      {subtitle && <p className="text-sm text-ink/40 mt-1 max-w-sm">{subtitle}</p>}
      {(primary || secondaryAction) && (
        <div className="flex items-center gap-2 mt-4">
          {primary}
          {secondaryAction}
        </div>
      )}
      {tip && (
        <div className="mt-6 pt-4 border-t border-border w-full max-w-sm text-left">
          <p className="text-xs text-ink/50 leading-relaxed">{tip}</p>
        </div>
      )}
    </div>
  );
}
