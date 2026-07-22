import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { TrendingUp, ShoppingBag, BarChart2, ArrowUp, ArrowDown, DollarSign, Package, Award, Warehouse } from "lucide-react";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function periodStart(period) {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "week") { d.setDate(d.getDate() - 7); return d; }
  if (period === "month") { d.setMonth(d.getMonth() - 1); return d; }
  d.setFullYear(d.getFullYear() - 1); return d;
}

export default function Dashboard({ businessId, business }) {
  const [todayOrders, setTodayOrders] = useState([]);
  const [yesterdayOrders, setYesterdayOrders] = useState([]);

  // Reports (Phase 3): profit & loss, top products, inventory valuation.
  const [period, setPeriod] = useState("today");
  const [periodOrders, setPeriodOrders] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    if (businessId) {
      loadOrders();
      const interval = setInterval(loadOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) loadReports();
  }, [businessId, period]);

  const loadReports = async () => {
    setReportsLoading(true);
    const since = periodStart(period).toISOString();
    const [{ data: orders }, { data: products }] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("business_id", businessId)
        .neq("status", "Cancelled")
        .gte("created_at", since),
      supabase.from("products").select("stock, cost_price").eq("business_id", businessId),
    ]);
    if (orders) setPeriodOrders(orders);
    if (products) {
      setInventoryValue(products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.cost_price) || 0), 0));
    }
    setReportsLoading(false);
  };

  const revenue = periodOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const cost = periodOrders.reduce(
    (s, o) => s + (o.order_items || []).reduce((si, i) => si + Number(i.cost_price || 0) * Number(i.quantity || 0), 0),
    0
  );
  const profit = revenue - cost;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const productAgg = {};
  periodOrders.forEach((o) => {
    (o.order_items || []).forEach((i) => {
      const key = i.product_name || "Unknown";
      if (!productAgg[key]) productAgg[key] = { name: key, qty: 0, revenue: 0 };
      productAgg[key].qty += Number(i.quantity || 0);
      productAgg[key].revenue += Number(i.price || 0) * Number(i.quantity || 0);
    });
  });
  const topProducts = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxTopRevenue = topProducts[0]?.revenue || 1;

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
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">Dashboard</h2>
        <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">Live overview of today's performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {cards.map((card, i) => (
          <div key={card.label} className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10 hover:border-brand-500/30 transition-colors animate-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink-600 dark:text-ink-300">{card.label}</span>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-brand-600 dark:text-brand-300 bg-brand-500/10">
                {card.icon}
              </div>
            </div>
            <div className="text-2xl font-extrabold text-ink-900 dark:text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Sales Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
          <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200 mb-4">Today vs Yesterday</h3>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-ink-600 dark:text-ink-400 mb-1">Today</p>
              <p className="text-xl font-extrabold text-ink-900 dark:text-white">Rs. {todaySales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-ink-600 dark:text-ink-400 mb-1">Yesterday</p>
              <p className="text-xl font-extrabold text-ink-900 dark:text-white">Rs. {yesterdaySales.toLocaleString()}</p>
            </div>
          </div>
          {salesDiff !== null && (
            <div className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${salesDiff >= 0 ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
              {salesDiff >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {Math.abs(salesDiff)}% vs yesterday
            </div>
          )}
          {salesDiff === null && <p className="mt-4 text-xs text-ink-500">No data for yesterday</p>}

          <div className="mt-5 flex items-end gap-3 h-16">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full rounded-t-lg transition-all duration-500 bg-gradient-to-t from-brand-700 to-brand-400" style={{ height: todaySales > 0 ? `${Math.min(100, (todaySales / Math.max(todaySales, yesterdaySales)) * 60)}px` : "4px" }} />
              <span className="text-xs text-ink-600 dark:text-ink-400">Today</span>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full rounded-t-lg transition-all duration-500 bg-ink-600" style={{ height: yesterdaySales > 0 ? `${Math.min(100, (yesterdaySales / Math.max(todaySales, yesterdaySales)) * 60)}px` : "4px" }} />
              <span className="text-xs text-ink-600 dark:text-ink-400">Yesterday</span>
            </div>
          </div>
        </div>

        {/* Live Counter */}
        <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10 flex flex-col relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-brand-500/10 blur-2xl" />
          <div className="relative flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200">Live Sales Counter</h3>
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse-soft" />
              Live
            </span>
          </div>
          <div className="relative flex-1 flex flex-col items-center justify-center">
            <div className="text-5xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-br from-brand-300 to-brand-500">
              Rs. {todaySales.toLocaleString()}
            </div>
            <p className="text-ink-600 dark:text-ink-400 text-xs">Total revenue today</p>
            <div className="mt-4 flex gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-ink-900 dark:text-white">{totalOrders}</p>
                <p className="text-xs text-ink-600 dark:text-ink-400">Orders</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-lg font-bold text-ink-900 dark:text-white">Rs. {avgOrder}</p>
                <p className="text-xs text-ink-600 dark:text-ink-400">Avg/Order</p>
              </div>
            </div>
          </div>
          <p className="relative text-xs text-ink-500 text-center mt-3">Updates every 5 seconds</p>
        </div>
      </div>

      {/* Today's Orders */}
      <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
        <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200 mb-4">Today's Orders</h3>
        {todayOrders.length === 0 ? (
          <p className="text-center text-ink-500 text-sm py-8">No orders yet today</p>
        ) : (
          <div className="space-y-2">
            {[...todayOrders].reverse().map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2.5 px-3 rounded-2xl border border-brand-500/20 bg-brand-500/10">
                <div>
                  <p className="text-sm font-bold text-ink-900 dark:text-white">{order.receipt_no}</p>
                  <p className="text-xs text-ink-600 dark:text-ink-400">
                    {new Date(order.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })} · {order.order_items?.length || 0} item(s)
                  </p>
                </div>
                <p className="font-extrabold text-sm text-brand-600 dark:text-brand-300">Rs. {Number(order.total).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reports */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-lg font-extrabold text-ink-900 dark:text-white tracking-tight">Reports</h3>
          <div className="flex items-center gap-1.5 bg-white dark:bg-ink-800 rounded-2xl p-1 border border-black/10 dark:border-white/10 overflow-x-auto max-w-full">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex-shrink-0 ${period === p.value ? "bg-gradient-to-r from-brand-600 to-brand-700 text-white" : "text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {reportsLoading ? (
          <div className="text-center py-10"><p className="text-sm font-semibold text-ink-600 dark:text-ink-400">Loading reports...</p></div>
        ) : (
          <>
            {/* Profit & Loss + Inventory Valuation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 bg-green-500/10 mb-3"><DollarSign size={18} /></div>
                <p className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Revenue</p>
                <p className="text-lg md:text-xl font-extrabold text-ink-900 dark:text-white truncate">Rs. {revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 bg-red-500/10 mb-3"><Package size={18} /></div>
                <p className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Cost of Goods</p>
                <p className="text-lg md:text-xl font-extrabold text-ink-900 dark:text-white truncate">Rs. {cost.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-brand-600 dark:text-brand-300 bg-brand-500/10 mb-3"><Award size={18} /></div>
                <p className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Profit ({margin}%)</p>
                <p className={`text-lg md:text-xl font-extrabold truncate ${profit >= 0 ? "text-ink-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}>Rs. {profit.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 bg-amber-500/10 mb-3"><Warehouse size={18} /></div>
                <p className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1">Inventory Value</p>
                <p className="text-lg md:text-xl font-extrabold text-ink-900 dark:text-white truncate">Rs. {inventoryValue.toLocaleString()}</p>
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white dark:bg-ink-800 rounded-3xl p-5 shadow-soft border border-black/10 dark:border-white/10">
              <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200 mb-4">Top Products</h3>
              {topProducts.length === 0 ? (
                <p className="text-center text-ink-500 text-sm py-8">No sales in this period</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-ink-500 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-ink-900 dark:text-white truncate">{p.name}</span>
                          <span className="text-xs font-bold text-brand-600 dark:text-brand-300 flex-shrink-0 ml-2">Rs. {p.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-700 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${Math.max(4, (p.revenue / maxTopRevenue) * 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-ink-600 dark:text-ink-400 flex-shrink-0 w-14 text-right">{p.qty} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
