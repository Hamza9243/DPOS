import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { TrendingUp, ShoppingBag, BarChart2, ArrowUp, ArrowDown } from "lucide-react";

export default function Dashboard({ businessId, business }) {
  const themeColor = "#1565C0";
  const [todayOrders, setTodayOrders] = useState([]);
  const [yesterdayOrders, setYesterdayOrders] = useState([]);

  useEffect(() => {
    if (businessId) {
      loadOrders();
      const interval = setInterval(loadOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [businessId]);

  const loadOrders = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: todayData } = await supabase.from("orders").select("*, order_items(*)").eq("business_id", businessId).gte("created_at", today.toISOString()).lte("created_at", todayEnd.toISOString());
    const { data: yesterdayData } = await supabase.from("orders").select("*, order_items(*)").eq("business_id", businessId).gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString());

    if (todayData) setTodayOrders(todayData);
    if (yesterdayData) setYesterdayOrders(yesterdayData);
  };

  const todaySales = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const yesterdaySales = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = todayOrders.length;
  const avgOrder = totalOrders > 0 ? Math.round(todaySales / totalOrders) : 0;
  const salesDiff = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : null;

  const cards = [
    { label: "Today's Sales", value: `Rs. ${todaySales.toLocaleString()}`, icon: <TrendingUp size={22} /> },
    { label: "Total Orders", value: totalOrders, icon: <ShoppingBag size={22} /> },
    { label: "Avg Order Value", value: `Rs. ${avgOrder.toLocaleString()}`, icon: <BarChart2 size={22} /> },
  ];

  return (
    <div className="p-4 md:p-6 bg-[#f4f7ff] min-h-screen pb-24 md:pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Dashboard</h2>
        <p className="text-gray-400 text-xs mt-0.5">Live overview of today's performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-500">{card.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${themeColor}15`, color: themeColor }}>
                {card.icon}
              </div>
            </div>
            <div className="text-2xl font-extrabold text-gray-800">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Sales Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-600 mb-4">Today vs Yesterday</h3>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">Today</p>
              <p className="text-xl font-extrabold text-gray-800">Rs. {todaySales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Yesterday</p>
              <p className="text-xl font-extrabold text-gray-800">Rs. {yesterdaySales.toLocaleString()}</p>
            </div>
          </div>
          {salesDiff !== null && (
            <div className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${salesDiff >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
              {salesDiff >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {Math.abs(salesDiff)}% vs yesterday
            </div>
          )}
          {salesDiff === null && <p className="mt-4 text-xs text-gray-300">No data for yesterday</p>}

          <div className="mt-5 flex items-end gap-3 h-16">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full rounded-t-lg transition-all" style={{ height: todaySales > 0 ? `${Math.min(100, (todaySales / Math.max(todaySales, yesterdaySales)) * 60)}px` : "4px", background: `linear-gradient(180deg, ${themeColor}, ${themeColor}cc)` }} />
              <span className="text-xs text-gray-400">Today</span>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full rounded-t-lg transition-all" style={{ height: yesterdaySales > 0 ? `${Math.min(100, (yesterdaySales / Math.max(todaySales, yesterdaySales)) * 60)}px` : "4px", background: "#e2e8f0" }} />
              <span className="text-xs text-gray-400">Yesterday</span>
            </div>
          </div>
        </div>

        {/* Live Counter */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-600">Live Sales Counter</h3>
            <span className="flex items-center gap-1.5 text-xs text-green-500 font-semibold">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-5xl font-extrabold mb-1" style={{ color: themeColor }}>
              Rs. {todaySales.toLocaleString()}
            </div>
            <p className="text-gray-400 text-xs">Total revenue today</p>
            <div className="mt-4 flex gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-gray-700">{totalOrders}</p>
                <p className="text-xs text-gray-400">Orders</p>
              </div>
              <div className="w-px bg-gray-100" />
              <div>
                <p className="text-lg font-bold text-gray-700">Rs. {avgOrder}</p>
                <p className="text-xs text-gray-400">Avg/Order</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-300 text-center mt-3">Updates every 5 seconds</p>
        </div>
      </div>

      {/* Today's Orders */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-600 mb-4">Today's Orders</h3>
        {todayOrders.length === 0 ? (
          <p className="text-center text-gray-300 text-sm py-8">No orders yet today</p>
        ) : (
          <div className="space-y-2">
            {[...todayOrders].reverse().map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl border" style={{ background: `${themeColor}08`, borderColor: `${themeColor}20` }}>
                <div>
                  <p className="text-sm font-bold text-gray-700">{order.receipt_no}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })} · {order.order_items?.length || 0} item(s)
                  </p>
                </div>
                <p className="font-extrabold text-sm" style={{ color: themeColor }}>Rs. {Number(order.total).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 