import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Trash2, Plus, Minus, ShoppingBag, Search, X, Printer, ShoppingCart, SlidersHorizontal, ChevronDown } from "lucide-react";
import useOrderStore from "../store/useOrderStore";
import useCartStore from "../store/useCartStore";
import { showToast, showConfirm } from "../components/Toast";
import { printThermalReceipt } from "../lib/printReceipt";

export default function POS({ businessId, user, business }) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCart, setShowCart] = useState(false);

  // Discounts / tax / payment method / customer link (Phase 3).
  const [customers, setCustomers] = useState([]);
  const [showOrderExtras, setShowOrderExtras] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerBox, setShowCustomerBox] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [payment, setPayment] = useState("Cash");

  const { addOrder } = useOrderStore();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getTotal } = useCartStore();

  useEffect(() => {
    if (businessId) {
      loadProducts();
      loadCategories();
      loadCustomers();
    }
  }, [businessId]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").eq("business_id", businessId);
    if (data) setProducts(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from("categories").select("*").eq("business_id", businessId);
    if (data) setCategories(data);
  };

  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("*").eq("business_id", businessId).order("name");
    if (data) setCustomers(data);
  };

  const filteredCustomers = customers.filter((c) =>
    !customerQuery || c.name.toLowerCase().includes(customerQuery.toLowerCase()) || c.phone?.includes(customerQuery)
  );

  const handleAddCustomer = async () => {
    const name = customerQuery.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("customers")
      .insert({ business_id: businessId, name, phone: newCustomerPhone.trim() || null })
      .select()
      .single();
    if (error) {
      showToast(error.message || "Could not add customer", "error");
      return;
    }
    setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCustomer(data);
    setCustomerQuery("");
    setNewCustomerPhone("");
    setShowCustomerBox(false);
    showToast("Customer added", "success");
  };

  const subtotal = getTotal();
  const discountAmt = Math.min(Number(discount) || 0, subtotal);
  const taxAmt = Math.round(((subtotal - discountAmt) * (Number(taxRate) || 0)) / 100 * 100) / 100;
  const grandTotal = subtotal - discountAmt + taxAmt;

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory ? p.category_id === selectedCategory : true;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Server computes the real total from DB prices and atomically checks +
    // decrements stock (see create_order in 002/003 migrations) — the
    // browser only sends product ids/quantities + the discount/tax the
    // cashier chose; the server re-derives subtotal from DB prices, never
    // trusts a client-computed total.
    const { data: order, error } = await supabase.rpc("create_order", {
      p_business_id: businessId,
      p_items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      p_payment: payment,
      p_customer: selectedCustomer?.name || null,
      p_discount: discountAmt,
      p_tax_rate: Number(taxRate) || 0,
      p_customer_id: selectedCustomer?.id || null,
    });

    if (error || !order) {
      showToast(error?.message || "Checkout failed", "error");
      return;
    }

    const now = new Date(order.created_at);
    const receipt = {
      items: [...cart],
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
      payment: order.payment,
      customer: selectedCustomer?.name || null,
      date: now.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }),
      time: now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
      receiptNo: order.receipt_no,
      createdAt: order.created_at,
    };

    addOrder(receipt);
    clearCart();
    setSelectedCustomer(null);
    setCustomerQuery("");
    setDiscount("");
    setTaxRate("");
    setPayment("Cash");
    await loadProducts(); // reflect the stock the server just decremented
    await loadCustomers(); // reflect updated loyalty points / total spent
    setReceiptData(receipt);
    setShowReceipt(true);
    setShowCart(false);
    showToast("Order placed successfully!", "success");
  };

  const handlePrint = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      try {
        const element = document.getElementById("receipt-content");
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 3, useCORS: true });
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const fileName = `${receiptData.receiptNo}.png`;
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({ title: "Receipt", files: [fileUri.uri] });
      } catch (e) {
        showToast("Failed to share receipt", "error");
      }
    } else {
      printThermalReceipt({
        businessName: business?.business_name || "DPOS",
        receiptNo: receiptData.receiptNo,
        date: receiptData.date,
        time: receiptData.time,
        customer: receiptData.customer,
        payment: receiptData.payment,
        items: receiptData.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price })),
        subtotal: receiptData.subtotal,
        discount: receiptData.discount,
        tax: receiptData.tax,
        total: receiptData.total,
      });
    }
  };

  const handleSaveReceipt = async () => {
    try {
      showToast("Saving receipt...", "info");
      const element = document.getElementById("receipt-content");
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff", scale: 3, useCORS: true,
        onclone: (doc) => {
          const el = doc.getElementById("receipt-content");
          el.style.width = "320px";
          el.style.padding = "20px";
        },
      });
      const dataUrl = canvas.toDataURL("image/png");
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const base64 = dataUrl.split(",")[1];
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const fileName = `${receiptData.receiptNo}.png`;
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({ title: "Receipt", text: receiptData.receiptNo, files: [fileUri.uri] });
        showToast("Receipt shared!", "success");
      } else {
        const link = document.createElement("a");
        link.download = `${receiptData.receiptNo}.png`;
        link.href = dataUrl;
        link.click();
        showToast("Receipt saved!", "success");
      }
    } catch (e) {
      showToast("Failed to save receipt", "error");
    }
  };

  const CartContent = () => (
    <>
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {cart.length === 0 && (
          <div className="text-center mt-16 text-ink-600 dark:text-ink-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Your cart is empty</p>
            <p className="text-xs mt-1 text-ink-500">Add products from the left</p>
          </div>
        )}
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl p-3 border border-brand-500/20 bg-brand-500/10 animate-fade-in">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border border-brand-500/20">
              {item.image ? <img src={item.image} className="w-full h-full object-contain p-1" /> : <span className="text-2xl">{item.emoji}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-ink-900 dark:text-white truncate">{item.name}</div>
              <div className="text-xs font-bold text-brand-600 dark:text-brand-300">Rs. {item.price * item.quantity}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1)} className="w-9 h-9 bg-ink-100 dark:bg-ink-700 rounded-lg flex items-center justify-center border border-brand-500/30 text-brand-600 dark:text-brand-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition">
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-bold text-ink-900 dark:text-white">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-9 h-9 bg-ink-100 dark:bg-ink-700 rounded-lg flex items-center justify-center border border-brand-500/30 text-brand-600 dark:text-brand-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition">
                <Plus size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-black/10 dark:border-white/10 space-y-3 bg-ink-100/60 dark:bg-ink-950/30">
        {/* Customer / Payment / Discount / Tax — collapsed by default to keep the cart clean */}
        <button
          onClick={() => setShowOrderExtras((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 text-xs font-bold">
            <SlidersHorizontal size={13} />
            {selectedCustomer ? selectedCustomer.name : "Customer"} · {payment}
            {discountAmt > 0 || taxAmt > 0 ? " · Discount/Tax" : ""}
          </span>
          <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${showOrderExtras ? "rotate-180" : ""}`} />
        </button>

        {showOrderExtras && (
        <div className="space-y-3 animate-fade-in">
        {/* Customer */}
        <div className="relative">
          <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-1 block">Customer</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-xl px-3 py-2 bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10">
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink-900 dark:text-white truncate">{selectedCustomer.name}</p>
                {selectedCustomer.phone && <p className="text-[10px] text-ink-600 dark:text-ink-400">{selectedCustomer.phone}</p>}
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white flex-shrink-0"><X size={14} /></button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                onFocus={() => setShowCustomerBox(true)}
                placeholder="Walk-in (tap to search/add)"
                className="w-full rounded-xl px-3 py-2 text-xs outline-none bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10 text-ink-900 dark:text-white placeholder:text-ink-500 focus:border-brand-500 transition-all"
              />
              {showCustomerBox && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-xl shadow-2xl max-h-48 overflow-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setShowCustomerBox(false); setCustomerQuery(""); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 dark:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0"
                    >
                      <span className="text-ink-900 dark:text-white font-semibold">{c.name}</span>
                      <span className="text-ink-600 dark:text-ink-400">{c.phone}</span>
                    </button>
                  ))}
                  {customerQuery.trim() && (
                    <div className="p-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10 text-ink-900 dark:text-white placeholder:text-ink-500"
                      />
                      <button onClick={handleAddCustomer} className="w-full py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-brand-700">
                        + Add "{customerQuery.trim()}"
                      </button>
                    </div>
                  )}
                  <button onClick={() => setShowCustomerBox(false)} className="w-full py-1.5 text-[10px] text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white">Close</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Payment method */}
        <div>
          <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-1 block">Payment</label>
          <div className="grid grid-cols-4 gap-1.5">
            {["Cash", "Card", "Wallet", "Bank"].map((m) => (
              <button
                key={m}
                onClick={() => setPayment(m)}
                className={`py-2.5 min-h-[40px] rounded-lg text-[10px] font-bold border transition-colors ${payment === m ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-400"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Discount / Tax */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-1 block">Discount (Rs)</label>
            <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="w-full rounded-xl px-3 py-2 text-xs outline-none bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10 text-ink-900 dark:text-white placeholder:text-ink-500 focus:border-brand-500 transition-all" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-1 block">Tax (%)</label>
            <input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" className="w-full rounded-xl px-3 py-2 text-xs outline-none bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10 text-ink-900 dark:text-white placeholder:text-ink-500 focus:border-brand-500 transition-all" />
          </div>
        </div>
        </div>
        )}

        <div className="flex justify-between text-sm text-ink-600 dark:text-ink-300">
          <span>Subtotal</span><span>Rs. {subtotal}</span>
        </div>
        {discountAmt > 0 && (
          <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
            <span>Discount</span><span>-Rs. {discountAmt}</span>
          </div>
        )}
        {taxAmt > 0 && (
          <div className="flex justify-between text-sm text-ink-600 dark:text-ink-300">
            <span>Tax</span><span>Rs. {taxAmt}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-base pt-2 border-t border-black/10 dark:border-white/10 text-brand-600 dark:text-brand-300">
          <span>Total</span><span>Rs. {grandTotal}</span>
        </div>
        <button
          onClick={async () => {
            if (cart.length === 0) return;
            const ok = await showConfirm("All items will be removed from cart.");
            if (ok) { clearCart(); showToast("Cart cleared", "info"); }
          }}
          className="w-full py-2.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl font-semibold text-sm border border-red-500/20 flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={14} /> Clear Cart
        </button>
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className="w-full py-3.5 text-white rounded-2xl font-bold text-sm disabled:opacity-40 shadow-elevated transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700"
        >
          <ShoppingBag size={16} /> Checkout — Rs. {grandTotal}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-ink-50 dark:bg-ink-900 relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white dark:bg-ink-800/90 backdrop-blur-sm border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex-shrink-0 overflow-hidden shadow-soft cursor-pointer ring-2 ring-white/10 hover:ring-brand-500/40 transition-all" onClick={() => navigate("/profile")}>
              {business?.avatar_url
                ? <img src={business.avatar_url} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-sm font-extrabold text-white bg-gradient-to-br from-brand-600 to-brand-700">
                    {user?.email?.charAt(0)?.toUpperCase() || "D"}
                  </div>
              }
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-xl font-extrabold text-ink-900 dark:text-white tracking-tight truncate">{business?.business_name || "Point of Sale"}</h2>
              <p className="text-ink-600 dark:text-ink-400 text-xs">Point of Sale</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-ink-100 dark:bg-ink-700 rounded-2xl px-3 py-2.5 gap-2 w-40 md:w-64 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500/40 border border-black/10 dark:border-white/10 transition-all">
              <Search size={14} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full" />
            </div>
            <button onClick={() => setShowCart(true)} className="md:hidden relative w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-elevated active:scale-95 transition-transform bg-gradient-to-br from-brand-600 to-brand-700">
              <ShoppingCart size={18} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-scale-in">{cart.length}</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 md:p-6">
          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => setSelectedCategory(null)} className={`px-4 md:px-5 py-2 rounded-2xl text-xs md:text-sm font-semibold transition-all active:scale-95 ${!selectedCategory ? "text-white shadow-elevated bg-gradient-to-r from-brand-600 to-brand-700" : "bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-black/10 dark:border-white/10 hover:border-brand-500/40 hover:text-brand-700 dark:hover:text-brand-300"}`}>All</button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 md:px-5 py-2 rounded-2xl text-xs md:text-sm font-semibold transition-all active:scale-95 ${selectedCategory === cat.id ? "text-white shadow-elevated bg-gradient-to-r from-brand-600 to-brand-700" : "bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-black/10 dark:border-white/10 hover:border-brand-500/40 hover:text-brand-700 dark:hover:text-brand-300"}`}>{cat.name}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-ink-500 animate-fade-in">
              <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">No products found</p>
              <p className="text-xs mt-1 text-ink-500">Try a different search or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((product, i) => (
                <button
                  key={product.id}
                  onClick={() => addToCart({ ...product, image: product.image_url })}
                  className="group bg-white dark:bg-ink-800 rounded-3xl shadow-soft hover:shadow-glow hover:-translate-y-0.5 transition-all text-left active:scale-95 overflow-hidden border border-black/10 dark:border-white/10 hover:border-brand-500/40 animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
                >
                  <div className="w-full h-24 md:h-36 bg-white flex items-center justify-center p-2 relative overflow-hidden">
                    {product.image_url ? <img src={product.image_url} className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300" /> : <span className="text-3xl md:text-4xl">{product.emoji}</span>}
                    {product.stock != null && product.stock <= 5 && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-50 text-red-500 border border-red-100">
                        {product.stock === 0 ? "Out" : `${product.stock} left`}
                      </span>
                    )}
                  </div>
                  <div className="px-3 pb-3 pt-2 border-t border-white/5">
                    <div className="font-bold text-ink-900 dark:text-white text-xs md:text-sm truncate">{product.name}</div>
                    <div className="font-extrabold text-xs md:text-sm mt-0.5 text-brand-600 dark:text-brand-300">Rs. {product.price}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart */}
      <div className="hidden md:flex w-80 bg-white dark:bg-ink-800 shadow-2xl flex-col border-l border-black/10 dark:border-white/10">
        <div className="p-5 text-white bg-gradient-to-br from-brand-600 to-brand-700 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-2"><ShoppingBag size={20} /><h2 className="text-lg font-bold tracking-wide">Cart</h2></div>
          <p className="relative text-white/70 text-xs mt-1">{cart.length} item(s) added</p>
        </div>
        {CartContent()}
      </div>

      {/* Mobile Cart Modal */}
      {showCart && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-black/60 animate-fade-in">
          <div className="flex-1" onClick={() => setShowCart(false)} />
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl flex flex-col animate-fade-up shadow-2xl border-t border-black/10 dark:border-white/10 overflow-y-auto overscroll-contain" style={{ maxHeight: "85vh" }}>
            <div className="p-4 text-white rounded-t-3xl flex items-center justify-between bg-gradient-to-br from-brand-600 to-brand-700 sticky top-0 z-10">
              <div className="flex items-center gap-2"><ShoppingBag size={18} /><h2 className="text-base font-bold">Cart ({cart.length} items)</h2></div>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"><X size={16} className="text-white" /></button>
            </div>
            {CartContent()}
          </div>
        </div>
      )}

      {/* Receipt Modal — the printable receipt itself stays paper-white/black (that's what it'll look like printed); only the surrounding modal chrome is dark-themed. */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col animate-scale-in border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="font-extrabold text-ink-900 dark:text-white text-base">Receipt</h3>
              <button onClick={() => setShowReceipt(false)} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <X size={16} className="text-ink-600 dark:text-ink-300" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh] bg-ink-100 dark:bg-ink-900/60">
              <div className="bg-white rounded-2xl shadow-inner">
              <div id="receipt-content" style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#000", width: "100%", padding: "8px" }}>
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <h1 style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px", margin: 0 }}>{business?.business_name || "DPOS"}</h1>
                  <p style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>Point of Sale System</p>
                </div>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Receipt: {receiptData.receiptNo}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Date: {receiptData.date}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Time: {receiptData.time}</p>
                {receiptData.customer && <p style={{ fontSize: "10px", marginBottom: "3px" }}>Customer: {receiptData.customer}</p>}
                {receiptData.payment && <p style={{ fontSize: "10px", marginBottom: "3px" }}>Payment: {receiptData.payment}</p>}
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", fontWeight: "normal", color: "#666", paddingBottom: "4px", width: "50%" }}>ITEM</th>
                      <th style={{ textAlign: "center", fontWeight: "normal", color: "#666", paddingBottom: "4px", width: "20%" }}>QTY</th>
                      <th style={{ textAlign: "right", fontWeight: "normal", color: "#666", paddingBottom: "4px", width: "30%" }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ paddingTop: "3px", wordBreak: "break-word" }}>{item.name}</td>
                        <td style={{ textAlign: "center", paddingTop: "3px" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right", paddingTop: "3px" }}>Rs.{item.price * item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <table style={{ width: "100%", fontSize: "11px", tableLayout: "fixed" }}>
                  <tbody>
                    <tr><td>Subtotal</td><td style={{ textAlign: "right" }}>Rs. {receiptData.subtotal ?? receiptData.total}</td></tr>
                    {receiptData.discount > 0 && (
                      <tr><td>Discount</td><td style={{ textAlign: "right" }}>-Rs. {receiptData.discount}</td></tr>
                    )}
                    {receiptData.tax > 0 && (
                      <tr><td>Tax</td><td style={{ textAlign: "right" }}>Rs. {receiptData.tax}</td></tr>
                    )}
                    <tr>
                      <td style={{ fontWeight: "bold", fontSize: "13px", paddingTop: "4px" }}>TOTAL</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "13px", paddingTop: "4px" }}>Rs. {receiptData.total}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <div style={{ textAlign: "center", marginTop: "12px", fontSize: "10px", color: "#555" }}>
                  <p>Thank you for your purchase!</p>
                  <p style={{ marginTop: "4px" }}>Powered by Devorions</p>
                </div>
              </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/5">
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 font-semibold text-sm hover:bg-black/5 dark:bg-white/5 transition-colors">Close</button>
              <button onClick={handleSaveReceipt} className="flex-1 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border-2 border-brand-500/40 text-brand-600 dark:text-brand-300 hover:bg-brand-500/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Save
              </button>
              <button onClick={handlePrint} className="flex-1 py-2.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-elevated hover:brightness-110 transition-all bg-gradient-to-r from-brand-600 to-brand-700">
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 