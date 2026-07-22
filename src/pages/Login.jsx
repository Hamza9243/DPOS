import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    // Only the email is ever remembered locally — Supabase's own session
    // token (set by signInWithPassword below) is what actually keeps the
    // user logged in across restarts. The password itself is never stored.
    const savedEmail = localStorage.getItem("dpos_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
    // One-time cleanup: older builds stored the plaintext password under this
    // key. Wipe it from any device that still has it.
    localStorage.removeItem("dpos_credentials");
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setError(error.message);
      else setSuccess("Reset email sent! Check your inbox.");
      setLoading(false);
      return;
    }

    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("Account created! Sign in now.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        if (remember) {
          localStorage.setItem("dpos_remember_email", email);
        } else {
          localStorage.removeItem("dpos_remember_email");
        }
      }
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-brand-600 to-brand-800 dark:from-ink-950 dark:to-ink-950 dark:bg-ink-950 relative overflow-hidden">
      {/* Ambient brand glow behind the hero */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[150vw] h-[70vh] rounded-full opacity-50 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,145,240,0.35) 0%, rgba(13,71,161,0.1) 45%, transparent 70%)" }}
      />

      {/* Top hero */}
      <div className="relative flex flex-col items-center justify-center pt-14 pb-10 px-6 animate-fade-up">
        <div className="w-24 h-24 rounded-[1.5rem] bg-ink-950 p-3 shadow-[0_8px_28px_rgba(0,0,0,0.35)] mb-5">
          <img src="/logo-mark.png" className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,145,240,0.4)]" alt="DPOS" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-[0.3em] pl-[0.3em]">DPOS</h1>
        <p className="text-brand-300/70 text-[11px] font-semibold tracking-[0.25em] pl-[0.25em] mt-1.5 uppercase">
          Point of Sale
        </p>
      </div>

      {/* Bottom card */}
      <div className="relative flex-1 bg-white dark:bg-ink-900 border-t border-black/5 dark:border-white/10 rounded-t-[2.5rem] px-6 pt-8 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_-20px_60px_rgba(0,0,0,0.5)] animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-2xl font-black text-ink-900 dark:text-white mb-1">
          {isForgot ? "Reset Password" : isSignup ? "Create Account" : "Welcome Back"}
        </h2>
        <p className="text-ink-600 dark:text-ink-400 text-sm mb-8">
          {isForgot ? "We'll send you a reset link" : isSignup ? "Join DPOS today" : "Good to see you again"}
        </p>

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Email */}
          <div>
            <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border-2 border-black/5 dark:border-white/10 rounded-2xl px-4 py-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 bg-ink-50 dark:bg-ink-800 text-ink-900 dark:text-white placeholder:text-ink-500 font-medium transition-all"
            />
          </div>

          {/* Password */}
          {!isForgot && (
            <div>
              <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Password</label>
              <div className="flex items-center border-2 border-black/5 dark:border-white/10 rounded-2xl px-4 py-4 gap-2 bg-ink-50 dark:bg-ink-800 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full bg-transparent font-medium"
                />
                <button onClick={() => setShowPass(!showPass)} className="text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 transition-colors">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Remember + Forgot */}
          {!isSignup && !isForgot && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${remember ? "bg-brand-600 border-brand-600" : "border-black/10 dark:border-white/20"}`}
                >
                  {remember && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-ink-500 dark:text-ink-300 font-medium">Remember me</span>
              </label>
              <button onClick={() => { setIsForgot(true); setError(""); setSuccess(""); }} className="text-xs font-bold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 transition-colors">
                Forgot password?
              </button>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl animate-scale-in">
              <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-2xl animate-scale-in">
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 text-white rounded-2xl font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98] hover:brightness-110 shadow-elevated flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700"
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                {isForgot ? "Send Reset Link" : isSignup ? "Create Account" : "Sign In"}
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Toggle */}
          {isForgot ? (
            <p className="text-center text-xs text-ink-600 dark:text-ink-400 mt-2">
              <button onClick={() => { setIsForgot(false); setError(""); setSuccess(""); }} className="text-brand-600 dark:text-brand-300 font-bold hover:text-brand-700 dark:hover:text-brand-200 transition-colors">
                Back to Sign In
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-ink-600 dark:text-ink-400 mt-4">
              {isSignup ? "Already have an account? " : "Don't have an account? "}
              <button onClick={() => { setIsSignup(!isSignup); setError(""); setSuccess(""); }} className="text-brand-600 dark:text-brand-300 font-bold hover:text-brand-700 dark:hover:text-brand-200 transition-colors">
                {isSignup ? "Sign In" : "Sign Up"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
