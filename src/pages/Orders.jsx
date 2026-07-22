import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Search, X, Printer, RotateCcw, ChevronRight, Download, Plus, Minus, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { showToast } from "../components/Toast";
import { printThermalReceipt } from "../lib/printReceipt";

const statusStyles = {
  Completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  Pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  Cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const statusIcons = { Completed: "✅", Pending: "⏳", Cancelled: "❌" };

export default function Orders({ businessId, business, role = "admin" }) {
  // Admin + Manager can change status, return, and edit items. Cashier is
  // view + invoice/print only (enforced server-side too — see the RPCs in
  // 002_full_rls_and_orders.sql, this is UI gating on top of that).
  const isAdmin = role === "admin" || role === "manager";
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

  // Every mutation below goes through an RPC (002_full_rls_and_orders.sql) so
  // stock/total are recalculated atomically and by product_id, not by
  // matching on product name. The RPC itself re-checks the caller's role.
  const runOrderRpc = async (fn, args, successMsg) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      showToast(error.message || "Action failed", "error");
      return false;
    }
    await loadOrders();
    await loadProducts();
    if (successMsg) showToast(successMsg, "success");
    return data;
  };

  const changeItemQty = async (order, item, newQty) => {
    await runOrderRpc("update_order_item", { p_order_item_id: item.id, p_new_qty: Math.max(0, newQty) });
  };

  const deleteOrderItem = async (order, item) => {
    await runOrderRpc("update_order_item", { p_order_item_id: item.id, p_new_qty: 0 }, "Item removed");
  };

  const addItemToOrder = async (order, product) => {
    await runOrderRpc("add_order_item", { p_order_id: order.id, p_product_id: product.id, p_qty: 1 }, `${product.name} added`);
  };

  const updateOrderStatus = async (orderId, status) => {
    const updated = await runOrderRpc("set_order_status", { p_order_id: orderId, p_status: status });
    if (updated) setSelectedOrder((prev) => (prev ? { ...prev, status: updated.status } : null));
  };

  const handleReturn = async (order) => {
    await runOrderRpc("set_order_status", { p_order_id: order.id, p_status: "Cancelled" });
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
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
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

    // DPOS dark theme — matches the app: near-black page, brand-blue accents,
    // light text. Every page (including ones autoTable adds for pagination)
    // gets the dark fill first, before any content is drawn on it.
    const PAGE_BG = [5, 19, 40];       // ink-900
    const PANEL_BG = [15, 30, 59];     // ink-800 (alternating rows)
    const BORDER = [42, 58, 90];       // ink-700-ish, visible on dark
    const TEXT_LIGHT = [226, 232, 240];
    const TEXT_MUTED = [148, 163, 184];
    const BRAND = [21, 101, 192];
    const BRAND_LIGHT = [92, 196, 255];

    const paintPageBg = () => {
      doc.setFillColor(...PAGE_BG);
      doc.rect(0, 0, 210, 297, "F");
    };
    const nativeAddPage = doc.addPage.bind(doc);
    doc.addPage = (...args) => {
      nativeAddPage(...args);
      paintPageBg();
      return doc;
    };
    paintPageBg();

    doc.setFillColor(...BRAND);
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
    const totalDiscount = completed.reduce((s, o) => s + Number(o.discount || 0), 0);
    const totalTax = completed.reduce((s, o) => s + Number(o.tax || 0), 0);
    doc.setTextColor(...TEXT_LIGHT);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Total Orders: ${filtered.length}`, 14, 56);
    doc.text(`Completed: ${completed.length}`, 80, 56);
    doc.text(`Discount Given: Rs. ${totalDiscount.toLocaleString()}`, 130, 56);
    doc.setTextColor(...BRAND_LIGHT);
    doc.text(`Total Revenue: Rs. ${totalRevenue.toLocaleString()}`, 14, 63);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Tax Collected: Rs. ${totalTax.toLocaleString()}`, 80, 63);

    autoTable(doc, {
      startY: 72,
      head: [["Order ID", "Date & Time", "Customer", "Payment", "Discount", "Tax", "Total", "Status"]],
      body: filtered.map(o => [
        o.receipt_no,
        new Date(o.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) + " " +
        new Date(o.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
        o.customer || "Walk-in",
        o.payment || "Cash",
        Number(o.discount) > 0 ? `Rs. ${Number(o.discount).toLocaleString()}` : "-",
        Number(o.tax) > 0 ? `Rs. ${Number(o.tax).toLocaleString()}` : "-",
        `Rs. ${Number(o.total).toLocaleString()}`,
        o.status || "Completed",
      ]),
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fillColor: PAGE_BG, textColor: TEXT_LIGHT, lineColor: BORDER },
      alternateRowStyles: { fillColor: PANEL_BG },
      styles: { fontSize: 9, cellPadding: 4, lineColor: BORDER, lineWidth: 0.1 },
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
    doc.setTextColor(...TEXT_LIGHT);
    doc.text("Daily Sales Summary", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [["Date", "Orders", "Revenue"]],
      body: Object.entries(dailySales).map(([date, data]) => [
        date,
        data.orders,
        `Rs. ${data.revenue.toLocaleString()}`,
      ]),
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fillColor: PAGE_BG, textColor: TEXT_LIGHT, lineColor: BORDER },
      alternateRowStyles: { fillColor: PANEL_BG },
      styles: { fontSize: 9, cellPadding: 4, lineColor: BORDER, lineWidth: 0.1 },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
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
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">Orders</h2>
          <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">All transactions and order history</p>
        </div>
        <button
          onClick={exportOrdersPDF}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-2xl shadow-elevated hover:brightness-110 transition-all active:scale-95 bg-gradient-to-r from-brand-600 to-brand-700"
        >
          <Download size={15} /> Export PDF
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex items-center bg-white dark:bg-ink-800 rounded-2xl px-3 py-2.5 gap-2 border border-black/10 dark:border-white/10 flex-1 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500/40 transition-all">
          <Search size={14} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
          <input type="text" placeholder="Search order ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-2xl px-3 py-2.5 text-sm text-ink-700 dark:text-ink-200 outline-none">
          {["All", "Completed", "Pending", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-5">
        {["All", "Today", "Week"].map((d) => (
          <button key={d} onClick={() => setFilterDate(d)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterDate === d ? "text-white shadow-elevated bg-gradient-to-r from-brand-600 to-brand-700" : "bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-black/10 dark:border-white/10 hover:border-brand-500/40"}`}>
            {d}
          </button>
        ))}
      </div>

      <div className="hidden md:block bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-brand-600 to-brand-700">
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Order ID</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Date & Time</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Items</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Total</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Status</th>
              <th className="text-left px-5 py-3.5 text-ink-900 dark:text-white font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order, i) => (
              <tr key={order.id} className={`border-t border-black/10 dark:border-white/10 transition-colors cursor-pointer hover:bg-brand-500/10 ${i % 2 === 0 ? "bg-white dark:bg-ink-800" : "bg-white dark:bg-ink-800/60"}`}
                onClick={() => setSelectedOrder(order)}
              >
                <td className="px-5 py-3.5 font-bold text-ink-900 dark:text-white">{order.receipt_no}</td>
                <td className="px-5 py-3.5 text-ink-600 dark:text-ink-300">
                  {new Date(order.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })} {new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-5 py-3.5 text-ink-600 dark:text-ink-300">{order.order_items?.length || 0} item(s)</td>
                <td className="px-5 py-3.5 font-bold text-brand-600 dark:text-brand-300">Rs. {order.total}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusStyles[order.status || "Completed"]}`}>
                    {statusIcons[order.status || "Completed"]} {order.status || "Completed"}
                  </span>
                </td>
                <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setSelectedOrder(order); setShowInvoice(true); }} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-500/20">
                    Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-16"><p className="text-sm font-semibold text-ink-600 dark:text-ink-400">No orders found</p></div>}
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((order, i) => (
          <div key={order.id} className="bg-white dark:bg-ink-800 rounded-2xl shadow-soft border border-black/10 dark:border-white/10 p-4 flex items-center gap-3 cursor-pointer active:scale-95 transition-all animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }} onClick={() => setSelectedOrder(order)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-ink-900 dark:text-white text-sm">{order.receipt_no}</p>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${statusStyles[order.status || "Completed"]}`}>{order.status || "Completed"}</span>
              </div>
              <p className="text-xs text-ink-600 dark:text-ink-400 mb-1">
                {new Date(order.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-600 dark:text-ink-400">{order.order_items?.length || 0} item(s)</p>
                <p className="font-extrabold text-sm text-brand-600 dark:text-brand-300">Rs. {order.total}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-ink-500 flex-shrink-0" />
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-16"><p className="text-sm font-semibold text-ink-600 dark:text-ink-400">No orders found</p></div>}
      </div>

      {selectedOrder && !showInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[90vh] flex flex-col animate-fade-up border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <div>
                <h3 className="font-extrabold text-ink-900 dark:text-white">{selectedOrder.receipt_no}</h3>
                <p className="text-xs text-ink-600 dark:text-ink-400">{new Date(selectedOrder.created_at).toLocaleDateString("en-PK")} · {new Date(selectedOrder.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"><X size={16} className="text-ink-600 dark:text-ink-300" /></button>
            </div>
            <div className="p-5 overflow-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ink-100 dark:bg-ink-700 rounded-2xl p-3"><p className="text-xs text-ink-600 dark:text-ink-400">Customer</p><p className="font-semibold text-sm text-ink-800 dark:text-ink-100">{selectedOrder.customer || "Walk-in"}</p></div>
                <div className="bg-ink-100 dark:bg-ink-700 rounded-2xl p-3"><p className="text-xs text-ink-600 dark:text-ink-400">Payment</p><p className="font-semibold text-sm text-ink-800 dark:text-ink-100">{selectedOrder.payment || "Cash"}</p></div>
                <div className="bg-ink-100 dark:bg-ink-700 rounded-2xl p-3"><p className="text-xs text-ink-600 dark:text-ink-400">Status</p><p className="font-bold text-sm text-ink-900 dark:text-white">{statusIcons[selectedOrder.status || "Completed"]} {selectedOrder.status || "Completed"}</p></div>
                <div className="bg-ink-100 dark:bg-ink-700 rounded-2xl p-3"><p className="text-xs text-ink-600 dark:text-ink-400">Total</p><p className="font-bold text-sm text-brand-600 dark:text-brand-300">Rs. {selectedOrder.total}</p></div>
              </div>
              {isAdmin && (
                <div>
                  <p className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 uppercase tracking-wider">Change Status</p>
                  <div className="flex gap-2">
                    {["Completed", "Pending", "Cancelled"].map((s) => (
                      <button key={s} onClick={() => updateOrderStatus(selectedOrder.id, s)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${(selectedOrder.status || "Completed") === s ? statusStyles[s] : "bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-400 border-black/10 dark:border-white/10 hover:bg-ink-200 dark:hover:bg-ink-600"}`}>
                        {statusIcons[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-ink-600 dark:text-ink-400 uppercase tracking-wider">Items</p>
                  {isAdmin && (selectedOrder.status || "Completed") !== "Cancelled" && (
                    <button onClick={() => { setShowAddItem(true); setProductSearch(""); }} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-300 transition-colors hover:bg-brand-500/20">
                      <Plus size={13} /> Add Item
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item) => {
                    const editable = isAdmin && (selectedOrder.status || "Completed") !== "Cancelled";
                    return (
                      <div key={item.id} className="flex justify-between items-center gap-2 rounded-2xl px-4 py-3 border border-brand-500/20 bg-brand-500/10">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-ink-900 dark:text-white truncate">{item.product_name}</p>
                          <p className="text-xs text-ink-600 dark:text-ink-400">Rs. {item.price} each · Rs. {item.price * item.quantity}</p>
                        </div>
                        {editable ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => changeItemQty(selectedOrder, item, item.quantity - 1)} className="w-9 h-9 bg-ink-100 dark:bg-ink-700 rounded-lg flex items-center justify-center border border-brand-500/30 text-brand-600 dark:text-brand-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition">
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-ink-900 dark:text-white">{item.quantity}</span>
                            <button onClick={() => changeItemQty(selectedOrder, item, item.quantity + 1)} className="w-9 h-9 bg-ink-100 dark:bg-ink-700 rounded-lg flex items-center justify-center border border-brand-500/30 text-brand-600 dark:text-brand-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition">
                              <Plus size={12} />
                            </button>
                            <button onClick={() => deleteOrderItem(selectedOrder, item)} className="w-9 h-9 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center border border-red-500/20 ml-1 hover:bg-red-500/20 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="font-bold text-sm flex-shrink-0 text-brand-600 dark:text-brand-300">x{item.quantity}</p>
                        )}
                      </div>
                    );
                  })}
                  {selectedOrder.order_items?.length === 0 && (
                    <p className="text-center text-xs text-ink-600 dark:text-ink-400 py-3">No items in this order</p>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1">
                <div className="flex justify-between text-xs text-ink-600 dark:text-ink-400">
                  <span>Subtotal</span><span>Rs. {selectedOrder.subtotal ?? selectedOrder.total}</span>
                </div>
                {Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-xs text-red-600 dark:text-red-400">
                    <span>Discount</span><span>-Rs. {selectedOrder.discount}</span>
                  </div>
                )}
                {Number(selectedOrder.tax) > 0 && (
                  <div className="flex justify-between text-xs text-ink-600 dark:text-ink-400">
                    <span>Tax</span><span>Rs. {selectedOrder.tax}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base text-brand-600 dark:text-brand-300">
                  <span>Total</span><span>Rs. {selectedOrder.total}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-black/10 dark:border-white/10">
              {isAdmin && (
                <button onClick={() => handleReturn(selectedOrder)} className="flex-1 py-3 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors">
                  <RotateCcw size={14} /> Return
                </button>
              )}
              <button onClick={() => setShowInvoice(true)} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-elevated hover:brightness-110 transition-all bg-gradient-to-r from-brand-600 to-brand-700">
                <Printer size={14} /> Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddItem && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[60] p-0 md:p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[80vh] flex flex-col animate-fade-up border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="font-extrabold text-ink-900 dark:text-white">Add Item</h3>
              <button onClick={() => setShowAddItem(false)} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"><X size={16} className="text-ink-600 dark:text-ink-300" /></button>
            </div>
            <div className="p-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center bg-ink-100 dark:bg-ink-700 rounded-2xl px-3 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-brand-500/30 transition-all">
                <Search size={14} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
                <input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="bg-transparent text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full" />
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-2">
              {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((product) => (
                <button key={product.id} onClick={() => addItemToOrder(selectedOrder, product)} className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border border-brand-500/20 bg-brand-500/10 text-left transition-colors hover:bg-brand-500/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border border-brand-500/20">
                      {product.image_url ? <img src={product.image_url} className="w-full h-full object-contain p-1" /> : <span className="text-xl">{product.emoji || "📦"}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink-900 dark:text-white truncate">{product.name}</p>
                      <p className="text-xs text-ink-600 dark:text-ink-400">Rs. {product.price}{product.stock != null ? ` · ${product.stock} in stock` : ""}</p>
                    </div>
                  </div>
                  <Plus size={16} className="flex-shrink-0 text-brand-600 dark:text-brand-300" />
                </button>
              ))}
              {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                <p className="text-center text-sm text-ink-600 dark:text-ink-400 py-10">No products found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showInvoice && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-fade-in">
          <div className="bg-white dark:bg-ink-800 rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-sm flex flex-col animate-fade-up border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="font-extrabold text-ink-900 dark:text-white">Invoice</h3>
              <button onClick={() => { setShowInvoice(false); setSelectedOrder(null); }} className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <X size={16} className="text-ink-600 dark:text-ink-300" />
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[60vh] bg-ink-50 dark:bg-ink-900/60">
              <div className="bg-white rounded-2xl p-2 shadow-inner">
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
                    <tr><td>Subtotal</td><td style={{ textAlign: "right" }}>Rs. {selectedOrder.subtotal ?? selectedOrder.total}</td></tr>
                    {Number(selectedOrder.discount) > 0 && (
                      <tr><td>Discount</td><td style={{ textAlign: "right" }}>-Rs. {selectedOrder.discount}</td></tr>
                    )}
                    {Number(selectedOrder.tax) > 0 && (
                      <tr><td>Tax</td><td style={{ textAlign: "right" }}>Rs. {selectedOrder.tax}</td></tr>
                    )}
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
            </div>
            <div className="flex gap-3 p-4 border-t border-black/10 dark:border-white/10">
              <button onClick={() => { setShowInvoice(false); setSelectedOrder(null); }} className="flex-1 py-3 rounded-2xl border border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-300 font-bold text-sm hover:bg-black/5 dark:bg-white/5 transition-colors">Close</button>
              <button onClick={() => handlePrint(selectedOrder)} className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-elevated hover:brightness-110 transition-all bg-gradient-to-r from-brand-600 to-brand-700">
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}