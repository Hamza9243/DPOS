import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Search, X, Printer, RotateCcw, ChevronRight, Download, Plus, Minus, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { showToast } from "../components/Toast";
import { printThermalReceipt } from "../lib/printReceipt";

const statusStyles = {
  Completed: "bg-green-50 text-green-600 border-green-100",
  Pending: "bg-yellow-50 text-yellow-600 border-yellow-100",
  Cancelled: "bg-red-50 text-red-500 border-red-100",
};

const statusIcons = { Completed: "✅", Pending: "⏳", Cancelled: "❌" };

export default function Orders({ businessId, business, role = "admin" }) {
  const themeColor = "#1565C0";
  // Cashier gets the same Orders powers as admin (status, return, edit items).
  const isAdmin = true;
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDate, setFilterDate] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [products, setProducts] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (businessId) {
      loadOrders();
      loadProducts();
    }
  }, [businessId]);

  const loadOrders = async () => {
    const { data } = await supabase.from("orders").select("*, order_items(*)").eq("business_id", businessId).order("created_at", { ascending: false });
    if (data) {
      setOrders(data);
      // keep the open modal in sync with fresh data after edits
      setSelectedOrder((prev) => (prev ? data.find((o) => o.id === prev.id) || null : null));
    }
  };

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").eq("business_id", businessId);
    if (data) setProducts(data);
  };

  // Recalculate the order total from its current items, then refresh the list/modal.
  const recalcAndReload = async (orderId) => {
    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    const total = (items || []).reduce((s, i) => s + i.price * i.quantity, 0);
    await supabase.from("orders").update({ total }).eq("id", orderId);
    await loadOrders();
  };

  // Adjust a product's stock by `delta` (matched by name, same as handleReturn).
  const adjustStock = async (productName, delta) => {
    const { data: product } = await supabase.from("products").select("stock").eq("business_id", businessId).ilike("name", productName).maybeSingle();
    if (product && product.stock != null) {
      await supabase.from("products").update({ stock: product.stock + delta }).eq("business_id", businessId).ilike("name", productName);
    }
  };

  const changeItemQty = async (order, item, newQty) => {
    if (newQty < 1) return deleteOrderItem(order, item);
    const delta = newQty - item.quantity; // +ve = more sold, restore -delta to stock
    await adjustStock(item.product_name, -delta);
    await supabase.from("order_items").update({ quantity: newQty }).eq("id", item.id);
    await recalcAndReload(order.id);
    await loadProducts();
  };

  const deleteOrderItem = async (order, item) => {
    await adjustStock(item.product_name, item.quantity); // return all units to stock
    await supabase.from("order_items").delete().eq("id", item.id);
    await recalcAndReload(order.id);
    await loadProducts();
    showToast("Item removed", "info");
  };

  const addItemToOrder = async (order, product) => {
    const existing = order.order_items?.find((i) => i.product_name.toLowerCase() === product.name.toLowerCase());
    if (existing) {
      await supabase.from("order_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("order_items").insert({ order_id: order.id, product_name: product.name, quantity: 1, price: product.price });
    }
    await adjustStock(product.name, -1);
    await recalcAndReload(order.id);
    await loadProducts();
    showToast(`${product.name} added`, "success");
  };

  const updateOrderStatus = async (orderId, status) => {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    await loadOrders();
    setSelectedOrder((prev) => prev ? { ...prev, status } : null);
  };

  const handleReturn = async (order) => {
    await supabase.from("orders").update({ status: "Cancelled" }).eq("id", order.id);
    for (const item of order.order_items) {
      const { data: product } = await supabase.from("products").select("stock, name").eq("business_id", businessId).ilike("name", item.product_name).maybeSingle();
      if (product) await supabase.from("products").update({ stock: product.stock + item.quantity }).eq("business_id", businessId).ilike("name", item.product_name);
    }
    await loadOrders();
    setSelectedOrder(null);
  };

  const handlePrint = (order) => {
    printThermalReceipt({
      businessName: business?.business_name || "DPOS",
      receiptNo: order.receipt_no,
      date: new Date(order.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }),
      time: new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
      customer: order.customer || "Walk-in",
      payment: order.payment || "Cash",
      items: (order.order_items || []).map((i) => ({ name: i.product_name, qty: i.quantity, price: i.price })),
      total: order.total,
    });
  };

  const filterOrders = () => {
    let result = [...orders];
    if (search) result = result.filter((o) => o.receipt_no?.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "All") result = result.filter((o) => (o.status || "Completed") === filterStatus);
    if (filterDate === "Today") {
      const today = new Date().toDateString();
      result = result.filter((o) => new Date(o.created_at).toDateString() === today);
    } else if (filterDate === "Week") {
      const week = new Date();
      week.setDate(week.getDate() - 7);
      result = result.filter((o) => new Date(o.created_at) >= week);
    }
    return result;
  };

  const filtered = filterOrders();

  const exportOrdersPDF = async () => {
    const doc = new jsPDF();
    const businessName = business?.business_name || "DPOS";
    const now = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

    doc.setFillColor(21, 101, 192);
    doc.rect(0, 0, 210, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(businessName, 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Orders History Report", 14, 24);
    doc.text(`Generated: ${now}`, 14, 31);

    const completed = filtered.filter(o => (o.status || "Completed") === "Completed");
    const totalRevenue = completed.reduce((s, o) => s + Number(o.total), 0);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Orders: ${filtered.length}`, 14, 56);
    doc.text(`Completed: ${completed.length}`, 80, 56);
    doc.text(`Total Revenue: Rs. ${totalRevenue.toLocaleString()}`, 14, 63);

    autoTable(doc, {
      startY: 72,
      head: [["Order ID", "Date & Time", "Items", "Total", "Status"]],
      body: filtered.map(o => [
        o.receipt_no,
        new Date(o.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) + " " +
        new Date(o.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
        `${o.order_items?.length || 0} item(s)`,
        `Rs. ${Number(o.total).toLocaleString()}`,
        o.status || "Completed",
      ]),
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const dailySales = {};
    filtered.forEach(o => {
      if ((o.status || "Completed") !== "Cancelled") {
        const day = new Date(o.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
        if (!dailySales[day]) dailySales[day] = { orders: 0, revenue: 0 };
        dailySales[day].orders++;
        dailySales[day].revenue += Number(o.total);
      }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Daily Sales Summary", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [["Date", "Orders", "Revenue"]],
      body: Object.entries(dailySales).map(([date, data]) => [
        date,
        data.orders,
        `Rs. ${data.revenue.toLocaleString()}`,
      ]),
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount} — Powered by DPOS`, 14, 290);
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      try {
        const base64 = doc.output("datauristring").split(",")[1];
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const fileName = `orders-report-${Date.now()}.pdf`;
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({ title: "Orders Report", files: [fileUri.uri] });
      } catch (e) {
        console.error(e);
      }
    } else {
      doc.save(`${businessName}-orders-${now}.pdf`);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-[#f4f7ff] min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Orders</h2>
          <p className="text-gray-400 text-xs mt-0.5">All transactions and order history</p>
        </div>
        <button
          onClick={exportOrdersPDF}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-md hover:opacity-90 transition active:scale-95"
          style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}
        >
          <Download size={15} /> Export PDF
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex items-center bg-white rounded-2xl px-3 py-2.5 gap-2 border border-gray-100 shadow-sm flex-1">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input type="text" placeholder="Search order ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm outline-none text-gray-700 w-full" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border border-gray-100 shadow-sm rounded-2xl px-3 py-2.5 text-sm text-gray-600 outline-none">
          {["All", "Completed", "Pending", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-5">
        {["All", "Today", "Week"].map((d) => (
          <button key={d} onClick={() => setFilterDate(d)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterDate === d ? "text-white shadow-md" : "bg-white text-gray-500 border border-gray-100"}`} style={filterDate === d ? { background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` } : {}}>
            {d}
          </button>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Order ID</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Date & Time</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Items</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Total</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Status</th>
              <th className="text-left px-5 py-3.5 text-white font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order, i) => (
              <tr key={order.id} className={`border-t border-gray-50 transition cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                onClick={() => setSelectedOrder(order)}
                onMouseEnter={e => e.currentTarget.style.background = `${themeColor}08`}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f9fafb"}
              >
                <td className="px-5 py-3.5 font-bold text-gray-700">{order.receipt_no}</td>
                <td className="px-5 py-3.5 text-gray-500">
                  {new Date(order.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })} {new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-5 py-3.5 text-gray-500">{order.order_items?.length || 0} item(s)</td>
                <td className="px-5 py-3.5 font-bold" style={{ color: themeColor }}>Rs. {order.total}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusStyles[order.status || "Completed"]}`}>
                    {statusIcons[order.status || "Completed"]} {order.status || "Completed"}
                  </span>
                </td>
                <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setSelectedOrder(order); setShowInvoice(true); }} className="px-3 py-1.5 text-xs font-bold rounded-lg border transition hover:opacity-80" style={{ background: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                    Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-16"><p className="text-sm font-semibold text-gray-400">No orders found</p></div>}
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 cursor-pointer active:scale-95 transition-all" onClick={() => setSelectedOrder(order)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-gray-800 text-sm">{order.receipt_no}</p>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${statusStyles[order.status || "Completed"]}`}>{order.status || "Completed"}</span>
              </div>
              <p className="text-xs text-gray-400 mb-1">
                {new Date(order.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{order.order_items?.length || 0} item(s)</p>
                <p className="font-extrabold text-sm" style={{ color: themeColor }}>Rs. {order.total}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-16"><p className="text-sm font-semibold text-gray-400">No orders found</p></div>}
      </div>

      {selectedOrder && !showInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-800">{selectedOrder.receipt_no}</h3>
                <p className="text-xs text-gray-400">{new Date(selectedOrder.created_at).toLocaleDateString("en-PK")} · {new Date(selectedOrder.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
            </div>
            <div className="p-5 overflow-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-xs text-gray-400">Customer</p><p className="font-semibold text-sm text-gray-700">{selectedOrder.customer || "Walk-in"}</p></div>
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-xs text-gray-400">Payment</p><p className="font-semibold text-sm text-gray-700">{selectedOrder.payment || "Cash"}</p></div>
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-xs text-gray-400">Status</p><p className="font-bold text-sm">{statusIcons[selectedOrder.status || "Completed"]} {selectedOrder.status || "Completed"}</p></div>
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-xs text-gray-400">Total</p><p className="font-bold text-sm" style={{ color: themeColor }}>Rs. {selectedOrder.total}</p></div>
              </div>
              {isAdmin && (
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Change Status</p>
                  <div className="flex gap-2">
                    {["Completed", "Pending", "Cancelled"].map((s) => (
                      <button key={s} onClick={() => updateOrderStatus(selectedOrder.id, s)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${(selectedOrder.status || "Completed") === s ? statusStyles[s] : "bg-gray-50 text-gray-400 border-gray-100"}`}>
                        {statusIcons[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Items</p>
                  {isAdmin && (selectedOrder.status || "Completed") !== "Cancelled" && (
                    <button onClick={() => { setShowAddItem(true); setProductSearch(""); }} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border transition hover:opacity-80" style={{ background: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                      <Plus size={13} /> Add Item
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item) => {
                    const editable = isAdmin && (selectedOrder.status || "Completed") !== "Cancelled";
                    return (
                      <div key={item.id} className="flex justify-between items-center gap-2 rounded-2xl px-4 py-3 border" style={{ background: `${themeColor}08`, borderColor: `${themeColor}20` }}>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-gray-800 truncate">{item.product_name}</p>
                          <p className="text-xs text-gray-400">Rs. {item.price} each · Rs. {item.price * item.quantity}</p>
                        </div>
                        {editable ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => changeItemQty(selectedOrder, item, item.quantity - 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center border" style={{ color: themeColor, borderColor: `${themeColor}30` }}>
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-gray-700">{item.quantity}</span>
                            <button onClick={() => changeItemQty(selectedOrder, item, item.quantity + 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center border" style={{ color: themeColor, borderColor: `${themeColor}30` }}>
                              <Plus size={12} />
                            </button>
                            <button onClick={() => deleteOrderItem(selectedOrder, item)} className="w-7 h-7 bg-red-50 text-red-400 rounded-lg flex items-center justify-center border border-red-100 ml-1">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="font-bold text-sm flex-shrink-0" style={{ color: themeColor }}>x{item.quantity}</p>
                        )}
                      </div>
                    );
                  })}
                  {selectedOrder.order_items?.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-3">No items in this order</p>
                  )}
                </div>
              </div>
              <div className="flex justify-between font-extrabold text-base pt-2 border-t border-gray-100" style={{ color: themeColor }}>
                <span>Total</span><span>Rs. {selectedOrder.total}</span>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-100">
              {isAdmin && (
                <button onClick={() => handleReturn(selectedOrder)} className="flex-1 py-3 rounded-2xl bg-red-50 text-red-400 border border-red-100 font-bold text-sm flex items-center justify-center gap-2">
                  <RotateCcw size={14} /> Return
                </button>
              )}
              <button onClick={() => setShowInvoice(true)} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
                <Printer size={14} /> Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddItem && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[60] p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800">Add Item</h3>
              <button onClick={() => setShowAddItem(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center bg-gray-100 rounded-2xl px-3 py-2.5 gap-2">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="bg-transparent text-sm outline-none text-gray-700 w-full" />
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-2">
              {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((product) => (
                <button key={product.id} onClick={() => addItemToOrder(selectedOrder, product)} className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border text-left transition hover:opacity-80" style={{ background: `${themeColor}08`, borderColor: `${themeColor}20` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border" style={{ borderColor: `${themeColor}20` }}>
                      {product.image_url ? <img src={product.image_url} className="w-full h-full object-contain p-1" /> : <span className="text-xl">{product.emoji || "📦"}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">Rs. {product.price}{product.stock != null ? ` · ${product.stock} in stock` : ""}</p>
                    </div>
                  </div>
                  <Plus size={16} style={{ color: themeColor }} className="flex-shrink-0" />
                </button>
              ))}
              {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-10">No products found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showInvoice && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800">Invoice</h3>
              <button onClick={() => { setShowInvoice(false); setSelectedOrder(null); }} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[60vh]">
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#000", width: "100%", padding: "8px" }}>
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <h1 style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px", margin: 0 }}>{business?.business_name || "DPOS"}</h1>
                  <p style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>Point of Sale System</p>
                </div>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Receipt: {selectedOrder.receipt_no}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Date: {new Date(selectedOrder.created_at).toLocaleDateString("en-PK")}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Customer: {selectedOrder.customer || "Walk-in"}</p>
                <p style={{ fontSize: "10px", marginBottom: "3px" }}>Payment: {selectedOrder.payment || "Cash"}</p>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <td style={{ color: "#666", fontSize: "10px", paddingBottom: "4px", width: "50%" }}>ITEM</td>
                      <td style={{ color: "#666", fontSize: "10px", textAlign: "center", paddingBottom: "4px", width: "20%" }}>QTY</td>
                      <td style={{ color: "#666", fontSize: "10px", textAlign: "right", paddingBottom: "4px", width: "30%" }}>AMOUNT</td>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.order_items?.map((item) => (
                      <tr key={item.id}>
                        <td style={{ paddingTop: "3px", wordBreak: "break-word" }}>{item.product_name}</td>
                        <td style={{ textAlign: "center", paddingTop: "3px" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right", paddingTop: "3px" }}>Rs.{item.price * item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                <table style={{ width: "100%", fontSize: "11px", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold", fontSize: "13px", paddingTop: "4px" }}>TOTAL</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "13px", paddingTop: "4px" }}>Rs. {selectedOrder.total}</td>
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
            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button onClick={() => { setShowInvoice(false); setSelectedOrder(null); }} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm">Close</button>
              <button onClick={() => handlePrint(selectedOrder)} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md" style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)` }}>
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}