import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "./lib/supabase";
import { resolveUserContext } from "./lib/business";
import { initTheme } from "./lib/theme";
import Sidebar from "./components/Sidebar";
import POS from "./pages/POS";
import Orders from "./pages/Orders";
import Inventory from "./pages/Inventory";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import SplashScreen from "./components/SplashScreen";
import Toast from "./components/Toast";
import Profile from "./pages/Profile";
import Staff from "./pages/Staff";
import Customers from "./pages/Customers";
import AuditLog from "./pages/AuditLog";

const THEME_COLOR = "#1565C0";
document.documentElement.style.setProperty("--theme-color", THEME_COLOR);
initTheme();

export default function App() {
  const [session, setSession] = useState(undefined);
  const [business, setBusiness] = useState(null);
  const [role, setRole] = useState("admin");
  const [showSplash, setShowSplash] = useState(true);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (business?.logo_url) {
      localStorage.setItem("dpos_logo", business.logo_url);
    }
  }, [business?.logo_url]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        resolveUserContext(data.session.user.id).then(({ business: b, role: r }) => {
          setBusiness(b);
          setRole(r);
          initialLoadDone.current = true;
        });
      } else {
        initialLoadDone.current = true;
      }
    });

    supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) {
        if (_e === "SIGNED_IN") {
          resolveUserContext(session.user.id).then(({ business: b, role: r }) => {
            setBusiness(b);
            setRole(r);
            if (!initialLoadDone.current) {
              initialLoadDone.current = true;
            }
          });
        }
      } else {
        setBusiness(null);
        setRole("admin");
        initialLoadDone.current = false;
        localStorage.removeItem("dpos_logo");
      }
    });
  }, []);

  if (session === undefined) return (
    <>
      <Toast />
      <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-900">
        <p className="text-ink-400 text-sm">Loading...</p>
      </div>
    </>
  );

  if (showSplash) return (
    <>
      <Toast />
      <SplashScreen onDone={() => setShowSplash(false)} />
    </>
  );

  if (!session) return (
    <>
      <Toast />
      <Login />
    </>
  );

  if (!business) return (
    <>
      <Toast />
      <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-900">
        <p className="text-ink-400 text-sm">Setting up your business...</p>
      </div>
    </>
  );

  const isAdmin = role === "admin";
  // Manager gets Inventory + Orders (full) + Reports/Dashboard, but not Staff.
  const canManageInventory = role === "admin" || role === "manager";

  return (
    <BrowserRouter>
      <Toast />
      <div className="flex h-screen bg-ink-50 dark:bg-ink-900">
        <Sidebar
          onLogout={() => supabase.auth.signOut()}
          user={session.user}
          business={business}
          themeColor={THEME_COLOR}
          role={role}
        />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<POS businessId={business.id} user={session.user} business={business} />} />
            <Route path="/profile" element={<Profile business={business} user={session.user} onUpdate={setBusiness} />} />
            {/* Cashier may view Orders; admin/manager-only actions are gated inside the page (and by RLS/RPCs server-side). */}
            <Route path="/orders" element={<Orders businessId={business.id} business={business} role={role} />} />
            {/* Inventory: admin + manager only — cashier is bounced back to POS. */}
            <Route path="/inventory" element={canManageInventory ? <Inventory businessId={business.id} business={business} /> : <Navigate to="/" replace />} />
            {/* Admin + manager screens — cashier is bounced back to POS. */}
            <Route path="/dashboard" element={canManageInventory ? <Dashboard businessId={business.id} business={business} /> : <Navigate to="/" replace />} />
            {/* Admin + manager: lightweight CRM. */}
            <Route path="/customers" element={canManageInventory ? <Customers businessId={business.id} role={role} /> : <Navigate to="/" replace />} />
            {/* Admin-only screen — manager/cashier bounced back to POS. */}
            <Route path="/staff" element={isAdmin ? <Staff business={business} /> : <Navigate to="/" replace />} />
            {/* Admin-only: automatic, trigger-written audit trail. */}
            <Route path="/audit-log" element={isAdmin ? <AuditLog businessId={business.id} /> : <Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}