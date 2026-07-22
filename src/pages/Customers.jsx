import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, UserPlus, Trash2, X, Search, Phone, Mail, Star, ShoppingBag, Pencil } from "lucide-react";
import { showToast, showConfirm } from "../components/Toast";

const emptyForm = { name: "", phone: "", email: "", notes: "" };

export default function Customers({ businessId, role = "admin" }) {
  const canManage = role === "admin" || role === "manager";
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId) loadCustomers();
  }, [businessId]);

  const loadCustomers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (data) setCustomers(data);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowAdd(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name || "", phone: c.phone || "", email: c.email || "", notes: c.notes || "" });
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast("Name is required", "error");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("customers").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("customers").insert({ ...payload, business_id: businessId }));
    }
    if (error) {
      showToast(error.message || "Could not save customer", "error");
    } else {
      showToast(editingId ? "Customer updated" : "Customer added", "success");
      setShowAdd(false);
      await loadCustomers();
    }
    setSaving(false);
  };

  const handleDelete = async (c) => {
    const ok = await showConfirm(`Remove ${c.name}? Their order history stays, but they'll no longer be linked for new sales.`);
    if (!ok) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) showToast(error.message || "Could not remove customer", "error");
    else {
      showToast("Customer removed", "info");
      await loadCustomers();
    }
  };

  const filtered = customers.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  return (
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">Customers</h2>
          <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">{customers.length} customer(s) · CRM &amp; loyalty</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-ink-800 rounded-2xl px-3 py-2.5 gap-2 w-48 md:w-64 border border-black/10 dark:border-white/10 focus-within:border-brand-500/40 transition-all">
            <Search size={14} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
            <input type="text" placeholder="Search name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full" />
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-elevated hover:brightness-110 transition-all active:scale-95 bg-gradient-to-r from-brand-600 to-brand-700 flex-shrink-0">
            <UserPlus size={15} /> <span className="hidden sm:inline">Add Customer</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><p className="text-sm font-semibold text-ink-600 dark:text-ink-400">Loading customers...</p></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 text-center py-14 px-6">
          <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-ink-600 dark:text-ink-400" />
          </div>
          <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-1">No customers yet</p>
          <p className="text-xs text-ink-600 dark:text-ink-400">Add customers here, or link them at checkout in POS.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c, i) => (
            <div key={c.id} className="bg-white dark:bg-ink-800 rounded-2xl shadow-soft border border-black/10 dark:border-white/10 p-4 animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-brand-500/10 text-brand-600 dark:text-brand-300 font-extrabold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900 dark:text-white text-sm truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-ink-600 dark:text-ink-400 flex items-center gap-1"><Phone size={10} />{c.phone}</p>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(c)} className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 text-ink-600 dark:text-ink-300 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(c)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-colors"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              {c.email && <p className="text-xs text-ink-600 dark:text-ink-400 flex items-center gap-1 mb-2"><Mail size={10} />{c.email}</p>}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <div className="text-center">
                  <p className="text-sm font-extrabold text-ink-900 dark:text-white">Rs. {Number(c.total_spent || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-ink-600 dark:text-ink-400">Spent</p>
                </div>
                <div className="text-center border-x border-white/5">
                  <p className="text-sm font-extrabold text-ink-900 dark:text-white flex items-center justify-center gap-1"><ShoppingBag size={11} className="text-brand-600 dark:text-brand-300" />{c.orders_count || 0}</p>
                  <p className="text-[10px] text-ink-600 dark:text-ink-400">Orders</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1"><Star size={11} />{c.loyalty_points || 0}</p>
                  <p className="text-[10px] text-ink-600 dark:text-ink-400">Points</p>
                </div>
              </div>
              {c.notes && <p className="text-xs text-ink-500 mt-2.5 pt-2.5 border-t border-white/5 line-clamp-2">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[90vh] flex flex-col animate-fade-up border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
              <h3 className="font-extrabold text-ink-900 dark:text-white">{editingId ? "Edit Customer" : "Add Customer"}</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"><X size={16} className="text-ink-600 dark:text-ink-300" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03XX-XXXXXXX" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Email (optional)</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@example.com" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Notes (optional)</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferences, allergies, etc." rows={2} className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-black/10 dark:border-white/10 flex-shrink-0">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-2xl border border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 font-bold text-sm hover:bg-black/5 dark:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-elevated hover:brightness-110 transition-all disabled:opacity-50 bg-gradient-to-r from-brand-600 to-brand-700">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
