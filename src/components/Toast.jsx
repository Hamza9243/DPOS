import { useEffect, useState } from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";

const icons = {
  success: <Check size={16} />,
  error: <X size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const colors = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", icon: "#22c55e" },
  error: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", icon: "#ef4444" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#d97706", icon: "#f59e0b" },
  info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", icon: "#3b82f6" },
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
              className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border"
              style={{ background: c.bg, borderColor: c.border }}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#eff6ff" }}
            >
              <AlertTriangle size={24} color="#1565C0" />
            </div>
            <h3 className="text-base font-extrabold text-gray-800 text-center mb-2">Are you sure?</h3>
            <p className="text-sm text-gray-400 text-center mb-6">{confirm.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { confirm.resolve(false); setConfirm(null); }}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-100 text-gray-500 font-bold text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirm.resolve(true); setConfirm(null); }}
                className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition active:scale-95"
                style={{ background: "linear-gradient(90deg, #1565C0, #0D47A1)" }}
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