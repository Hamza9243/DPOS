import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, UserPlus, Trash2, X, Mail, Lock, ShieldCheck } from "lucide-react";
import { showToast, showConfirm } from "../components/Toast";

const roleStyles = {
  admin: "bg-blue-50 text-blue-600 border-blue-100",
  cashier: "bg-green-50 text-green-600 border-green-100",
};

export default function Staff({ business }) {
  const themeColor = "#1565C0";
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (password.length < 6) return showToast("Password must be at least 6 characters", "error");
    setSaving(true);
    try {
      await invoke({ action: "create", email: email.trim(), password, role: "cashier" });
      showToast("Cashier account created", "success");
      setShowAdd(false);
      setEmail("");
      setPassword("");
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
    <div className="p-4 md:p-6 bg-[#f4f7ff] min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Staff</h2>
          <p className="text-gray-400 text-xs mt-0.5">Manage cashier logins for {business?.business_name || "your business"}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEmail(""); setPassword(""); }}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-md hover:opacity-90 transition active:scale-95"
          style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}
        >
          <UserPlus size={15} /> Add Cashier
        </button>
      </div>

      {/* Admin (owner) card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${themeColor}10` }}>
          <ShieldCheck size={18} style={{ color: themeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">You (Owner)</p>
          <p className="text-xs text-gray-400">Full access to all features</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleStyles.admin}`}>Admin</span>
      </div>

      {loading ? (
        <div className="text-center py-16"><p className="text-sm font-semibold text-gray-400">Loading staff...</p></div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500 mb-1">No cashiers yet</p>
          <p className="text-xs text-gray-400">Add a cashier so your staff can use the POS and view orders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50">
                <Users size={18} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{member.email}</p>
                <p className="text-xs text-gray-400">POS + Orders access</p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleStyles[member.role] || roleStyles.cashier}`}>
                {member.role === "admin" ? "Admin" : "Cashier"}
              </span>
              <button onClick={() => handleDelete(member)} className="w-8 h-8 rounded-xl bg-red-50 text-red-400 border border-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add cashier modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800">Add Cashier</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400">Cashier sirf POS aur Orders use kar sakega. Inventory, Dashboard aur Staff sirf aapko (admin) dikhenge.</p>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Email</label>
                <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 py-3.5 gap-2 bg-gray-50 focus-within:border-blue-500 transition-all">
                  <Mail size={16} className="text-gray-400 flex-shrink-0" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cashier@example.com" className="text-sm outline-none text-gray-700 w-full bg-transparent font-medium" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Password</label>
                <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 py-3.5 gap-2 bg-gray-50 focus-within:border-blue-500 transition-all">
                  <Lock size={16} className="text-gray-400 flex-shrink-0" />
                  <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="text-sm outline-none text-gray-700 w-full bg-transparent font-medium" />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Yeh email/password cashier ko de dein — wo isi se login karega.</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
                <UserPlus size={15} /> {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
