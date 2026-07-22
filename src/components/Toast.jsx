import { useEffect, useState } from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";

const icons = {
  success: <Check size={16} />,
  error: <X size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

// Border/text colors come from CSS vars (see index.css) so they flip with
// the light/dark theme without needing JS to track theme state here.
const colors = {
  success: { border: "var(--toast-success-border)", text: "var(--toast-success-text)", icon: "#22c55e" },
  error: { border: "var(--toast-error-border)", text: "var(--toast-error-text)", icon: "#ef4444" },
  warning: { border: "var(--toast-warning-border)", text: "var(--toast-warning-text)", icon: "#f59e0b" },
  info: { border: "var(--toast-info-border)", text: "var(--toast-info-text)", icon: "#0091f0" },
};

let toastFn = null;
let confirmFn = null;

export const showToast = (message, type = "success") => {
  if (toastFn) toastFn(message, type);
};

export const showConfirm = (message) => {
  if (confirmFn) return confirmFn(message);
  return Promise.resolve(false);
};

export default function Toast() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    toastFn = (message, type) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    confirmFn = (message) => {
      return new Promise((resolve) => {
        setConfirm({ message, resolve });
      });
    };

    return () => {
      toastFn = null;
      confirmFn = null;
    };
  }, []);

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-xs w-full">
        {toasts.map((toast) => {
          const c = colors[toast.type];
          return (
            <div
              key={toast.id}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md animate-fade-up bg-white dark:bg-ink-800/95"
              style={{ borderColor: c.border }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.icon, color: "white" }}
              >
                {icons[toast.type]}
              </div>
              <p className="text-sm font-semibold" style={{ color: c.text }}>{toast.message}</p>
            </div>
          );
        })}
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-6 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-2xl w-full max-w-xs p-6 animate-scale-in border border-black/10 dark:border-white/10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-brand-500/10">
              <AlertTriangle size={24} className="text-brand-600 dark:text-brand-300" />
            </div>
            <h3 className="text-base font-extrabold text-ink-900 dark:text-white text-center mb-2">Are you sure?</h3>
            <p className="text-sm text-ink-600 dark:text-ink-400 text-center mb-6">{confirm.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { confirm.resolve(false); setConfirm(null); }}
                className="flex-1 py-3 rounded-2xl border-2 border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 font-bold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirm.resolve(true); setConfirm(null); }}
                className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 shadow-elevated hover:brightness-110 bg-gradient-to-r from-brand-600 to-brand-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}