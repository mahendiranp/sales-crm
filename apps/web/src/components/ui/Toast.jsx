import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

const ToastContext = createContext(() => {});

const AUTO_DISMISS_MS = 4000;

const STYLES = {
  success: { icon: CheckCircle2, iconCls: "text-emerald-600", barCls: "bg-emerald-500" },
  error: { icon: XCircle, iconCls: "text-red-600", barCls: "bg-red-500" },
};

const ToastViewport = memo(function ToastViewport({ toasts, dismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const { icon: Icon, iconCls, barCls } = STYLES[t.type] || STYLES.success;
        return (
          <div key={t.id} className="relative bg-white border border-border rounded-lg shadow-card overflow-hidden flex items-start gap-2 p-3 pr-8">
            <div className={`absolute inset-y-0 left-0 w-1 ${barCls}`} />
            <Icon size={18} className={`shrink-0 mt-0.5 ${iconCls}`} />
            <p className="text-sm text-ink leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="absolute top-2 right-2 text-ink/40 hover:text-ink" title="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
});

// App-wide toast host — mounted once in pages/_app.jsx. Anywhere else,
// `import { useToast } from "../components/ui/Toast"` and call
// toast.success("Saved") / toast.error("Couldn't save that.") after an
// API call resolves or rejects.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      if (!message) return;
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const contextValue = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// toast.success("Saved") / toast.error("Couldn't save that.")
export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };
}
