import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ScrollText, Package, ClipboardList, Users as UsersIcon, Filter } from "lucide-react";

const entityIcons = {
  product: <Package size={14} />,
  order: <ClipboardList size={14} />,
  business_member: <UsersIcon size={14} />,
};

const actionColors = {
  insert: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  update: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

function actionTone(action) {
  if (action.startsWith("insert") || action === "order.create") return actionColors.insert;
  if (action.startsWith("delete")) return actionColors.delete;
  return actionColors.update;
}

const entityFilters = [
  { value: "All", label: "All" },
  { value: "order", label: "Orders" },
  { value: "product", label: "Products" },
  { value: "business_member", label: "Staff" },
];

export default function AuditLog({ businessId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("All");

  useEffect(() => {
    if (businessId) loadLogs();
  }, [businessId]);

  const loadLogs = async () => {
    setLoading(true);
    // RLS restricts this table to admins of the caller's own business —
    // see 003_reports_crm_audit.sql. Rows are written only by SECURITY
    // DEFINER triggers, never by the client, so this list can't be tampered with.
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setLogs(data);
    setLoading(false);
  };

  const filtered = entityFilter === "All" ? logs : logs.filter((l) => l.entity_type === entityFilter);

  const describe = (log) => {
    const d = log.details || {};
    if (log.entity_type === "product") return d.name ? `${d.name} — Rs. ${d.price ?? "?"} (${d.stock ?? "?"} in stock)` : "";
    if (log.entity_type === "order") return d.receipt_no ? `${d.receipt_no} — Rs. ${d.total ?? "?"}` : "";
    if (log.entity_type === "business_member") return d.email ? `${d.email} (${d.role || "cashier"})` : "";
    return "";
  };

  return (
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">Audit Log</h2>
          <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">Every product, order and staff change — automatic, tamper-proof</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-ink-800 rounded-2xl p-1 border border-black/10 dark:border-white/10">
          <Filter size={12} className="text-ink-500 ml-2" />
          {entityFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setEntityFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${entityFilter === f.value ? "bg-gradient-to-r from-brand-600 to-brand-700 text-white" : "text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><p className="text-sm font-semibold text-ink-600 dark:text-ink-400">Loading audit log...</p></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 text-center py-14 px-6">
          <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
            <ScrollText size={24} className="text-ink-600 dark:text-ink-400" />
          </div>
          <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-1">No activity yet</p>
          <p className="text-xs text-ink-600 dark:text-ink-400">Product, order and staff changes will show up here automatically.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="divide-y divide-white/5">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-black/5 dark:bg-white/5 text-ink-600 dark:text-ink-300">
                  {entityIcons[log.entity_type] || <ScrollText size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex-shrink-0 ${actionTone(log.action)}`}>{log.action}</span>
                    <span className="text-xs text-ink-600 dark:text-ink-400 truncate min-w-0">{describe(log)}</span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-0.5">{log.actor_email || "System"}</p>
                </div>
                <p className="text-[11px] text-ink-500 flex-shrink-0 text-right">
                  {new Date(log.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}
                  <br />
                  {new Date(log.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
