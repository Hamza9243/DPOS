import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { showToast, showConfirm } from "../components/Toast";

export default function Inventory({ businessId, business }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "", category: "", costPrice: "", price: "", stock: "", emoji: "", image: "", imageFile: null,
  });
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || "Unknown";

  useEffect(() => {
    if (businessId) { loadProducts(); loadCategories(); }
  }, [businessId]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").eq("business_id", businessId);
    if (data) setProducts(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from("categories").select("*").eq("business_id", businessId);
    if (data) setCategories(data);
  };

  const resetForm = () => {
    setForm({ name: "", category: "", costPrice: "", price: "", stock: "", emoji: "", image: "", imageFile: null });
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };

  const openEdit = (p) => {
    setForm({ name: p.name, category: p.category_id || "", costPrice: p.cost_price, price: p.price, stock: p.stock, emoji: p.emoji || "", image: p.image_url || "", imageFile: null });
    setEditingId(p.id);
    setShowModal(true);
  };

  const uploadImage = async (file) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `public/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file);
    if (error) return null;
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name || form.price === "" || form.stock === "") return;
    let imageUrl = form.image;
    if (form.imageFile) {
      const uploaded = await uploadImage(form.imageFile);
      if (uploaded) imageUrl = uploaded;
    }
    if (editingId) {
      await supabase.from("products").update({ name: form.name, category_id: form.category || null, cost_price: Number(form.costPrice), price: Number(form.price), stock: Number(form.stock), emoji: form.emoji, image_url: imageUrl }).eq("id", editingId);
      showToast("Product updated!", "success");
    } else {
      await supabase.from("products").insert({ name: form.name, category_id: form.category || null, cost_price: Number(form.costPrice), price: Number(form.price), stock: Number(form.stock), emoji: form.emoji, image_url: imageUrl, business_id: businessId });
      showToast("Product added!", "success");
    }
    await loadProducts();
    setShowModal(false);
    resetForm();
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("This product will be deleted permanently.");
    if (ok) { await supabase.from("products").delete().eq("id", id); await loadProducts(); showToast("Product deleted", "info"); }
  };

  const handleAddCategory = async () => {
    const name = categoryInput.trim();
    if (!name) return setShowCategoryInput(false);
    await supabase.from("categories").insert({ name, business_id: businessId });
    await loadCategories();
    setCategoryInput("");
    setShowCategoryInput(false);
    showToast("Category added", "success");
  };

  const handleDeleteCategory = async (id) => {
    const ok = await showConfirm("This category will be deleted.");
    if (ok) { await supabase.from("categories").delete().eq("id", id); await loadCategories(); showToast("Category deleted", "info"); }
  };

  return (
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">Inventory</h2>
          <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">Manage your products and stock</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-elevated hover:brightness-110 transition-all active:scale-95 bg-gradient-to-r from-brand-600 to-brand-700">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 overflow-hidden">
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-brand-600 to-brand-700">
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Product</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Category</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Cost Price</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Selling Price</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Stock</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} className={`border-t border-white/5 transition-colors hover:bg-brand-500/10 ${i % 2 === 0 ? "bg-white dark:bg-ink-800" : "bg-white dark:bg-ink-800/60"}`}>
                <td className="px-5 py-3.5 font-semibold text-ink-900 dark:text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-black/10 dark:border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain" /> : <span className="text-lg">{p.emoji}</span>}
                    </div>
                    {p.name}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-300">{categoryName(p.category_id)}</span>
                </td>
                <td className="px-5 py-3.5 text-ink-600 dark:text-ink-300">Rs. {p.cost_price}</td>
                <td className="px-5 py-3.5 font-bold text-brand-600 dark:text-brand-300">Rs. {p.price}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${p.stock === 0 ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : p.stock <= 5 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"}`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} units`}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-500/20">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:hidden divide-y divide-white/5">
          {products.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-black/10 dark:border-white/10">
                {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain rounded-xl" /> : <span className="text-2xl">{p.emoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink-900 dark:text-white text-sm truncate">{p.name}</p>
                <p className="text-xs text-ink-600 dark:text-ink-400">{categoryName(p.category_id)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-300">Rs. {p.price}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${p.stock === 0 ? "bg-red-500/10 text-red-600 dark:text-red-400" : p.stock <= 5 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} units`}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-300">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
              <Plus size={22} className="text-ink-600 dark:text-ink-400" />
            </div>
            <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-1">No products yet</p>
            <p className="text-xs text-ink-600 dark:text-ink-400">Tap "Add Product" to start building your catalog.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[92vh] flex flex-col animate-fade-up border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <div>
                <h3 className="font-extrabold text-ink-900 dark:text-white text-base">{editingId ? "Edit Product" : "Add Product"}</h3>
                <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">{editingId ? "Update product details" : "Fill in the product details"}</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <X size={16} className="text-ink-600 dark:text-ink-300" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Product Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Burger" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Image</label>
                  <input type="file" accept="image/*" id="img-upload" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (!file) return; setForm({ ...form, image: URL.createObjectURL(file), imageFile: file, emoji: "" }); }} />
                  <label htmlFor="img-upload" className="w-16 h-12 border-2 border-black/10 dark:border-white/10 rounded-2xl flex items-center justify-center cursor-pointer hover:border-brand-500/40 transition-colors overflow-hidden bg-ink-100 dark:bg-ink-700">
                    {form.image ? <img src={form.image} className="w-full h-full object-cover rounded-2xl" /> : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c8ba3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Category</label>
                <div className="flex gap-2">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="flex-1 border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white font-medium transition-all">
                    <option value="">-- Select --</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={() => setShowCategoryInput((v) => !v)} className="px-4 py-3 rounded-2xl text-sm font-bold transition-colors active:scale-95 bg-brand-500/10 text-brand-600 dark:text-brand-300 hover:bg-brand-500/20">
                    + New
                  </button>
                </div>
                {showCategoryInput && (
                  <div className="mt-2 flex gap-2 animate-scale-in">
                    <input
                      autoFocus
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                      placeholder="Category name"
                      className="flex-1 border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all"
                    />
                    <button onClick={handleAddCategory} className="px-4 rounded-2xl text-white font-bold text-sm bg-gradient-to-r from-brand-600 to-brand-700 hover:brightness-110 transition-all">
                      <Check size={15} />
                    </button>
                  </div>
                )}
                {categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-black/10 dark:border-white/10 bg-ink-100 dark:bg-ink-700">
                        <span className="text-ink-700 dark:text-ink-200">{c.name}</span>
                        <button onClick={() => handleDeleteCategory(c.id)} className="text-ink-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Cost</label>
                  <input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-3 py-3 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Price</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-3 py-3 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" className="w-full border-2 border-black/10 dark:border-white/10 rounded-2xl px-3 py-3 text-sm outline-none focus:border-brand-500 bg-ink-100 dark:bg-ink-700 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5 pt-2">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3 rounded-2xl border-2 border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 font-bold text-sm hover:bg-black/5 dark:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-elevated hover:brightness-110 bg-gradient-to-r from-brand-600 to-brand-700">
                <Check size={15} />
                {editingId ? "Update Product" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}