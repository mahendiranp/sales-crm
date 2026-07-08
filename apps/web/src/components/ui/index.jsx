import { X } from "lucide-react";

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
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink/50 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-card shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">
            <X size={19} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium text-ink/60 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors";

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-base flex items-center justify-center mb-3">
          <Icon size={20} className="text-ink/30" />
        </div>
      )}
      <p className="font-medium text-ink/70">{title}</p>
      {subtitle && <p className="text-sm text-ink/40 mt-1">{subtitle}</p>}
    </div>
  );
}
