import { NavLink, useNavigate } from "react-router-dom";
import { ShoppingCart, ClipboardList, Package, LayoutDashboard, LogOut, User, Users } from "lucide-react";
import { showConfirm } from "../components/Toast";

const THEME = "#1565C0";

// roles = which roles may see this link. Omitted = everyone.
const allLinks = [
  { to: "/", label: "Point of Sale", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/staff", label: "Staff", icon: Users, roles: ["admin"] },
];

export default function Sidebar({ onLogout, user, business, role = "admin" }) {
  const navigate = useNavigate();
  const logo = business?.logo_url || localStorage.getItem("dpos_logo") || "/logo.png";
  const links = allLinks.filter((l) => !l.roles || l.roles.includes(role));

  const handleLogout = async () => {
    const ok = await showConfirm("You will be logged out of DPOS.");
    if (ok) onLogout();
  };

  return (
    <>
      <div
        className="hidden md:flex w-60 flex-col h-screen text-white"
        style={{
          background: `linear-gradient(180deg, ${THEME} 0%, ${THEME}dd 50%, ${THEME}bb 100%)`,
          boxShadow: "4px 0 24px rgba(13,71,161,0.25)",
        }}
      >
        <div className="flex flex-col items-center pt-8 pb-5 px-4">
          <img src={logo} alt="DPOS" className="w-20 h-20 object-contain drop-shadow-lg mb-3" />
          <h1 className="text-lg font-extrabold tracking-widest text-white">DPOS</h1>
        </div>

        <div className="mx-4 border-t border-white/10 mb-3" />

        <nav className="flex-1 px-3 space-y-0.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? "bg-white shadow-lg" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} style={isActive ? { color: THEME } : {}} className={isActive ? "" : "text-white/60"} />
                  <span style={isActive ? { color: THEME } : {}}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mx-4 border-t border-white/10 mt-3" />
        <div className="px-3 py-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut size={16} />
            Logout
          </button>
          <p className="text-center text-white/20 text-xs pt-3">© 2026 DPOS v1.0.0</p>
        </div>
      </div>

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center py-2 px-2"
        style={{
          background: `linear-gradient(90deg, ${THEME}, ${THEME}dd)`,
          boxShadow: "0 -4px 20px rgba(13,71,161,0.3)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                isActive ? "bg-white/20" : ""
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className={isActive ? "text-white" : "text-white/50"} />
                <span className={`text-xs font-semibold ${isActive ? "text-white" : "text-white/50"}`}>
                  {label.split(" ")[0]}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => navigate("/profile")}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/50 hover:text-white transition-all"
        >
          <User size={20} />
          <span className="text-xs font-semibold">Profile</span>
        </button>
      </div>
    </>
  );
}