import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { showToast, showConfirm } from "../components/Toast";

export default function Inventory({ businessId, business }) {
  const themeColor = "#1565C0";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "", category: "", costPrice: "", price: "", stock: "", emoji: "", image: "", imageFile: null,
  });

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
    const name = prompt("New category name:");
    if (!name) return;
    await supabase.from("categories").insert({ name, business_id: businessId });
    await loadCategories();
    showToast("Category added", "success");
  };

  const handleDeleteCategory = async (id) => {
    const ok = await showConfirm("This category will be deleted.");
    if (ok) { await supabase.from("categories").delete().eq("id", id); await loadCategories(); showToast("Category deleted", "info"); }
  };

  return (
    <div className="p-4 md:p-6 bg-[#f4f7ff] min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Inventory</h2>
          <p className="text-gray-400 text-xs mt-0.5">Manage your products and stock</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-md hover:opacity-90 transition active:scale-95" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Product</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Category</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Cost Price</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Selling Price</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Stock</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} className={`border-t border-gray-50 transition ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`} style={{ cursor: "default" }}
                onMouseEnter={e => e.currentTarget.style.background = `${themeColor}08`}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f9fafb"}
              >
                <td className="px-5 py-3.5 font-semibold text-gray-800">
                  <div className="flex items-center gap-2">
                    {p.image_url ? <img src={p.image_url} className="w-7 h-7 rounded-lg object-contain" /> : <span className="text-xl">{p.emoji}</span>}
                    {p.name}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border" style={{ background: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>{categoryName(p.category_id)}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-600">Rs. {p.cost_price}</td>
                <td className="px-5 py-3.5 font-bold" style={{ color: themeColor }}>Rs. {p.price}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.stock <= 5 ? "bg-red-50 text-red-500 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"}`}>{p.stock} units</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center border transition hover:opacity-80" style={{ background: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-400 border border-red-100 flex items-center justify-center hover:bg-red-100 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:hidden divide-y divide-gray-50">
          {products.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain rounded-xl" /> : <span className="text-2xl">{p.emoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{categoryName(p.category_id)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold" style={{ color: themeColor }}>Rs. {p.price}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${p.stock <= 5 ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>{p.stock} units</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-400 border border-red-100 flex items-center justify-center">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && <div className="text-center py-16"><p className="text-sm font-semibold text-gray-400">No products found</p></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-md max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-800 text-base">{editingId ? "Edit Product" : "Add Product"}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{editingId ? "Update product details" : "Fill in the product details"}</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-auto">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Product Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Burger" className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm outline-none bg-gray-50 font-medium transition-all" style={{ focusBorderColor: themeColor }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Image</label>
                  <input type="file" accept="image/*" id="img-upload" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (!file) return; setForm({ ...form, image: URL.createObjectURL(file), imageFile: file, emoji: "" }); }} />
                  <label htmlFor="img-upload" className="w-16 h-12 border-2 border-gray-100 rounded-2xl flex items-center justify-center cursor-pointer hover:opacity-80 transition overflow-hidden bg-gray-50">
                    {form.image ? <img src={form.image} className="w-full h-full object-cover rounded-2xl" /> : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Category</label>
                <div className="flex gap-2">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="flex-1 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm outline-none bg-gray-50 font-medium transition-all">
                    <option value="">-- Select --</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={handleAddCategory} className="px-4 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95" style={{ background: `${themeColor}15`, color: themeColor }}>
                    + New
                  </button>
                </div>
                {categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-gray-100 bg-gray-50">
                        <span className="text-gray-600">{c.name}</span>
                        <button onClick={() => handleDeleteCategory(c.id)} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Cost</label>
                  <input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0" className="w-full border-2 border-gray-100 rounded-2xl px-3 py-3 text-sm outline-none bg-gray-50 font-medium transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Price</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" className="w-full border-2 border-gray-100 rounded-2xl px-3 py-3 text-sm outline-none bg-gray-50 font-medium transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" className="w-full border-2 border-gray-100 rounded-2xl px-3 py-3 text-sm outline-none bg-gray-50 font-medium transition-all" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5 pt-2">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3 rounded-2xl border-2 border-gray-100 text-gray-500 font-bold text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)`, boxShadow: `0 4px 16px ${themeColor}40` }}>
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