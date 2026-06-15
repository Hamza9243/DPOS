import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Trash2, Plus, Minus, ShoppingBag, Search, X, Printer, ShoppingCart } from "lucide-react";
import useOrderStore from "../store/useOrderStore";
import useCartStore from "../store/useCartStore";
import { showToast, showConfirm } from "../components/Toast";
import { printThermalReceipt } from "../lib/printReceipt";

export default function POS({ businessId, user, business }) {
  const navigate = useNavigate();
  const themeColor =  "#1565C0"
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCart, setShowCart] = useState(false);

  const { addOrder } = useOrderStore();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getTotal } = useCartStore();

  useEffect(() => {
    if (businessId) {
      loadProducts();
      loadCategories();
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

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory ? p.category_id === selectedCategory : true;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const now = new Date();
    const receipt = {
      items: [...cart],
      total: getTotal(),
      date: now.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }),
      time: now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
      receiptNo: "RCP-" + Math.floor(Math.random() * 90000 + 10000),
      createdAt: now.toISOString(),
    };

    const { data: order } = await supabase.from("orders").insert({
      receipt_no: receipt.receiptNo,
      total: receipt.total,
      status: "Completed",
      payment: "Cash",
      business_id: businessId,
      created_at: receipt.createdAt,
    }).select().single();

    if (order) {
      await supabase.from("order_items").insert(
        cart.map((item) => ({
          order_id: order.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
        }))
      );
    }

    addOrder(receipt);
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
        items: receiptData.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price })),
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
          <div className="text-center mt-16 text-gray-300">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold text-gray-400">Your cart is empty</p>
            <p className="text-xs mt-1 text-gray-300">Add products from the left</p>
          </div>
        )}
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl p-3 border" style={{ background: `${themeColor}10`, borderColor: `${themeColor}20` }}>
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border" style={{ borderColor: `${themeColor}20` }}>
              {item.image ? <img src={item.image} className="w-full h-full object-contain p-1" /> : <span className="text-2xl">{item.emoji}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-800 truncate">{item.name}</div>
              <div className="text-xs font-bold" style={{ color: themeColor }}>Rs. {item.price * item.quantity}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center border" style={{ color: themeColor, borderColor: `${themeColor}30` }}>
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-bold text-gray-700">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center border" style={{ color: themeColor, borderColor: `${themeColor}30` }}>
                <Plus size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 space-y-3 bg-gray-50">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Subtotal</span><span>Rs. {getTotal()}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Tax (0%)</span><span>Rs. 0</span>
        </div>
        <div className="flex justify-between font-extrabold text-base pt-2 border-t border-gray-200" style={{ color: themeColor }}>
          <span>Total</span><span>Rs. {getTotal()}</span>
        </div>
        <button
          onClick={async () => {
            if (cart.length === 0) return;
            const ok = await showConfirm("All items will be removed from cart.");
            if (ok) { clearCart(); showToast("Cart cleared", "info"); }
          }}
          className="w-full py-2 bg-red-50 text-red-400 rounded-xl font-semibold text-sm border border-red-100 flex items-center justify-center gap-2 hover:bg-red-100 transition"
        >
          <Trash2 size={14} /> Clear Cart
        </button>
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className="w-full py-3 text-white rounded-xl font-bold text-sm disabled:opacity-40 shadow-lg transition hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}
        >
          <ShoppingBag size={16} /> Checkout — Rs. {getTotal()}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#f4f7ff] relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden shadow cursor-pointer" onClick={() => navigate("/profile")}>
              {business?.avatar_url
                ? <img src={business.avatar_url} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-sm font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
                    {user?.email?.charAt(0)?.toUpperCase() || "D"}
                  </div>
              }
            </div>
            <div>
              <h2 className="text-base md:text-xl font-extrabold text-gray-800 tracking-tight">{business?.business_name || "Point of Sale"}</h2>
              <p className="text-gray-400 text-xs">Point of Sale</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2 gap-2 w-40 md:w-64">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm outline-none text-gray-700 w-full" />
            </div>
            <button onClick={() => setShowCart(true)} className="md:hidden relative w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
              <ShoppingCart size={18} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{cart.length}</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 md:p-6">
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setSelectedCategory(null)} className={`px-3 md:px-5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${!selectedCategory ? "text-white shadow-md" : "bg-white text-gray-500 border border-gray-200"}`} style={!selectedCategory ? { background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` } : {}}>All</button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3 md:px-5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${selectedCategory === cat.id ? "text-white shadow-md" : "bg-white text-gray-500 border border-gray-200"}`} style={selectedCategory === cat.id ? { background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` } : {}}>{cat.name}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <button key={product.id} onClick={() => addToCart({ ...product, image: product.image_url })} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all text-left active:scale-95 overflow-hidden border border-gray-100">
                <div className="w-full h-24 md:h-36 bg-gray-50 flex items-center justify-center p-2">
                  {product.image_url ? <img src={product.image_url} className="h-full w-full object-contain" /> : <span className="text-3xl md:text-4xl">{product.emoji}</span>}
                </div>
                <div className="px-3 pb-3 pt-2 border-t border-gray-50">
                  <div className="font-bold text-gray-800 text-xs md:text-sm truncate">{product.name}</div>
                  <div className="font-extrabold text-xs md:text-sm mt-0.5" style={{ color: themeColor }}>Rs. {product.price}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Cart */}
      <div className="hidden md:flex w-80 bg-white shadow-2xl flex-col border-l border-gray-100">
        <div className="p-5 text-white" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
          <div className="flex items-center gap-2"><ShoppingBag size={20} /><h2 className="text-lg font-bold tracking-wide">Cart</h2></div>
          <p className="text-white/70 text-xs mt-1">{cart.length} item(s) added</p>
        </div>
        <CartContent />
      </div>

      {/* Mobile Cart Modal */}
      {showCart && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="flex-1" onClick={() => setShowCart(false)} />
          <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="p-4 text-white rounded-t-3xl flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
              <div className="flex items-center gap-2"><ShoppingBag size={18} /><h2 className="text-base font-bold">Cart ({cart.length} items)</h2></div>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><X size={16} className="text-white" /></button>
            </div>
            <CartContent />
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800 text-base">Receipt</h3>
              <button onClick={() => setShowReceipt(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div id="receipt-content" style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#000", width: "100%", padding: "8px" }}>
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <h1 style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px", margin: 0 }}>{business?.business_name || "DPOS"}</h1>
                  <p style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>Point of Sale System</p>
                </div>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Receipt: {receiptData.receiptNo}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Date: {receiptData.date}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Time: {receiptData.time}</p>
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
                    <tr><td>Subtotal</td><td style={{ textAlign: "right" }}>Rs. {receiptData.total}</td></tr>
                    <tr><td>Tax (0%)</td><td style={{ textAlign: "right" }}>Rs. 0</td></tr>
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
            <div className="flex gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-semibold text-sm hover:bg-gray-50 transition">Close</button>
              <button onClick={handleSaveReceipt} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition border-2" style={{ borderColor: themeColor, color: themeColor }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Save
              </button>
              <button onClick={handlePrint} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 