import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, UserPlus, Trash2, X, Mail, Lock, ShieldCheck } from "lucide-react";
import { showToast, showConfirm } from "../components/Toast";

const roleStyles = {
  admin: "bg-brand-500/10 text-brand-600 dark:text-brand-300 border-brand-500/20",
  manager: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  cashier: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const roleLabels = { admin: "Admin", manager: "Manager", cashier: "Cashier" };

export default function Staff({ business }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState("cashier");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  // Supabase Edge Function slug (deployed function name).
  const STAFF_FN = "clever-function";

  const invoke = async (body) => {
    const { data, error } = await supabase.functions.invoke(STAFF_FN, { body });
    if (error) {
      // On a non-2xx status supabase-js wraps the Response in error.context —
      // pull our JSON { error } message out of it for a useful toast.
      let msg = error.message || "Request failed";
      try {
        const res = error.context;
        if (res && typeof res.json === "function") {
          const j = await res.json();
          if (j?.error) msg = j.error;
        }
      } catch (_) { /* keep generic message */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: "list" });
      setStaff(data.staff || []);
    } catch (e) {
      showToast(e.message || "Could not load staff", "error");
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!email.trim() || !password) return showToast("Email and password required", "error");
    if (password.length < 8) return showToast("Password must be at least 8 characters", "error");
    setSaving(true);
    try {
      await invoke({ action: "create", email: email.trim(), password, role: newRole });
      showToast(`${roleLabels[newRole]} account created`, "success");
      setShowAdd(false);
      setEmail("");
      setPassword("");
      setNewRole("cashier");
      await loadStaff();
    } catch (e) {
      showToast(e.message || "Could not create account", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (member) => {
    const ok = await showConfirm(`Remove ${member.email}? They will no longer be able to log in.`);
    if (!ok) return;
    try {
      await invoke({ action: "delete", user_id: member.user_id });
      showToast("Staff removed", "info");
      await loadStaff();
    } catch (e) {
      showToast(e.message || "Could not remove staff", "error");
    }
  };

  return (
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">Staff</h2>
          <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5 truncate">Manage staff logins for {business?.business_name || "your business"}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEmail(""); setPassword(""); setNewRole("cashier"); }}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-elevated hover:brightness-110 transition-all active:scale-95 bg-gradient-to-r from-brand-600 to-brand-700 flex-shrink-0"
        >
          <UserPlus size={15} /> Add Staff
        </button>
      </div>

      {/* Admin (owner) card */}
      <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-soft border border-black/10 dark:border-white/10 p-4 flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <ShieldCheck size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink-900 dark:text-white text-sm truncate">You (Owner)</p>
          <p className="text-xs text-ink-600 dark:text-ink-400">Full access to all features</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleStyles.admin}`}>Admin</span>
      </div>

      {loading ? (
        <div className="text-center py-16"><p className="text-sm font-semibold text-ink-600 dark:text-ink-400">Loading staff...</p></div>
      ) : staff.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 text-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-ink-600 dark:text-ink-400" />
          </div>
          <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-1">No staff yet</p>
          <p className="text-xs text-ink-600 dark:text-ink-400">Add a cashier or manager so your team can use the POS.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member, i) => (
            <div key={member.id} className="bg-white dark:bg-ink-800 rounded-2xl shadow-soft border border-black/10 dark:border-white/10 p-4 flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${member.role === "manager" ? "bg-amber-500/10" : "bg-green-500/10"}`}>
                <Users size={18} className={member.role === "manager" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink-900 dark:text-white text-sm truncate">{member.email}</p>
                <p className="text-xs text-ink-600 dark:text-ink-400">{member.role === "manager" ? "Inventory + Orders + Reports" : "POS + Orders access"}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleStyles[member.role] || roleStyles.cashier}`}>
                {roleLabels[member.role] || "Cashier"}
              </span>
              <button onClick={() => handleDelete(member)} className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center flex-shrink-0 hover:bg-red-500/20 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[90vh] flex flex-col animate-fade-up border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
              <h3 className="font-extrabold text-ink-900 dark:text-white">Add Staff</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"><X size={16} className="text-ink-600 dark:text-ink-300" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole("cashier")}
                    className={`py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${newRole === "cashier" ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-400"}`}
                  >
                    Cashier
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole("manager")}
                    className={`py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${newRole === "manager" ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-400"}`}
                  >
                    Manager
                  </button>
                </div>
                <p className="text-xs text-ink-600 dark:text-ink-400 mt-1.5">
                  {newRole === "manager"
                    ? "Manager sees Inventory, Orders (full) and Dashboard/Reports — not Staff."
                    : "Cashier sirf POS aur Orders (view + print) use kar sakega."}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Email</label>
                <div className="flex items-center border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 gap-2 bg-ink-100 dark:bg-ink-700 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                  <Mail size={16} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" className="text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full bg-transparent font-medium" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Password</label>
                <div className="flex items-center border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 gap-2 bg-ink-100 dark:bg-ink-700 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                  <Lock size={16} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
                  <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full bg-transparent font-medium" />
                </div>
                <p className="text-xs text-ink-600 dark:text-ink-400 mt-1.5">Yeh email/password staff ko de dein — wo isi se login karega.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-black/10 dark:border-white/10 flex-shrink-0">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-2xl border border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 font-bold text-sm hover:bg-black/5 dark:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-elevated hover:brightness-110 transition-all disabled:opacity-50 bg-gradient-to-r from-brand-600 to-brand-700">
                <UserPlus size={15} /> {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
