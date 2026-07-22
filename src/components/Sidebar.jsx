import { NavLink, useNavigate } from "react-router-dom";
import { ShoppingCart, ClipboardList, Package, LayoutDashboard, LogOut, User, Users, Contact, ScrollText } from "lucide-react";
import { showConfirm } from "../components/Toast";
import ThemeToggle from "./ThemeToggle";

// roles = which roles may see this link. Omitted = everyone.
const allLinks = [
  { to: "/", label: "Point of Sale", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "manager"] },
  { to: "/customers", label: "Customers", icon: Contact, roles: ["admin", "manager"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { to: "/staff", label: "Staff", icon: Users, roles: ["admin"] },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText, roles: ["admin"] },
];

export default function Sidebar({ onLogout, user, business, role = "admin" }) {
  const navigate = useNavigate();
  const logo = business?.logo_url || localStorage.getItem("dpos_logo") || "/logo-mark.png";
  const links = allLinks.filter((l) => !l.roles || l.roles.includes(role));
  const roleLabel = role === "admin" ? "Admin" : role === "manager" ? "Manager" : "Cashier";

  const handleLogout = async () => {
    const ok = await showConfirm("You will be logged out of DPOS.");
    if (ok) onLogout();
  };

  return (
    <>
      <div className="hidden md:flex w-64 flex-col h-screen text-white relative overflow-hidden bg-gradient-to-b from-brand-600 to-brand-700 dark:from-ink-900 dark:to-ink-950 shadow-[6px_0_32px_rgba(0,0,0,0.35)]">
        {/* Ambient brand glow */}
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-40 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,145,240,0.5) 0%, transparent 70%)" }}
        />

        <div className="relative flex flex-col items-center pt-9 pb-6 px-4">
          <div className="relative w-16 h-16 mb-3">
            <div className="absolute inset-0 rounded-2xl bg-brand-400/50 blur-xl scale-125" />
            <div className="relative w-16 h-16 rounded-2xl bg-ink-950 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
              <img src={logo} alt="DPOS" className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,145,240,0.5)]" />
            </div>
          </div>
          <h1 className="text-lg font-extrabold tracking-[0.25em] pl-[0.25em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">DPOS</h1>
          <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-brand-200 border border-white/10">
            {roleLabel}
          </span>
        </div>

        <div className="relative mx-4 border-t border-white/10 mb-3" />

        <nav className="relative flex-1 px-3 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                  isActive ? "bg-white shadow-lg" : "text-white/60 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? "text-brand-600" : "text-white/50 group-hover:text-white"} />
                  <span className={isActive ? "text-brand-700" : ""}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative mx-4 border-t border-white/10 mt-3" />
        <div className="relative px-3 py-4">
          <div className="flex items-center justify-between px-4 py-2 mb-1">
            <span className="text-xs font-semibold text-white/60">Light / Dark</span>
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white/50 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
          >
            <LogOut size={16} />
            Logout
          </button>
          <p className="text-center text-white/20 text-[10px] pt-3 tracking-wide">© 2026 DPOS v1.0.0</p>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center gap-0.5 py-2 px-2 overflow-x-auto bg-brand-600/95 dark:bg-ink-900/95 backdrop-blur-lg border-t border-white/10 shadow-[0_-8px_28px_rgba(0,0,0,0.35)]">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 ${
                isActive ? "bg-brand-500/20" : ""
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className={isActive ? "text-brand-300" : "text-white/40"} />
                <span className={`text-xs font-semibold whitespace-nowrap ${isActive ? "text-brand-200" : "text-white/40"}`}>
                  {label.split(" ")[0]}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => navigate("/profile")}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/40 hover:text-white transition-colors duration-200 flex-shrink-0"
        >
          <User size={20} />
          <span className="text-xs font-semibold">Profile</span>
        </button>
      </div>
    </>
  );
}