import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff } from "lucide-react";

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
    const saved = localStorage.getItem("dpos_credentials");
    if (saved) {
      const { email, password } = JSON.parse(saved);
      setEmail(email);
      setPassword(password);
      setRemember(true);
    }
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
          localStorage.setItem("dpos_credentials", JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem("dpos_credentials");
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%)" }}>
      {/* Top Section */}
      <div className="flex flex-col items-center justify-center pt-16 pb-8 px-6">
        <div className="w-20 h-20 rounded-3xl bg-white/15 border border-white/20 flex items-center justify-center mb-5 shadow-2xl">
          <img src="/logo.png" className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-widest mb-1">DPOS</h1>
        <p className="text-blue-200 text-xs tracking-widest">POINT OF SALE</p>
      </div>

      {/* Bottom Card */}
      <div className="flex-1 bg-white rounded-t-[2.5rem] px-6 pt-8 pb-8">
        <h2 className="text-2xl font-black text-gray-800 mb-1">
          {isForgot ? "Reset Password" : isSignup ? "Create Account" : "Sign In"}
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          {isForgot ? "We'll send you a reset link" : isSignup ? "Join DPOS today" : "Good to see you again"}
        </p>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 text-sm outline-none focus:border-blue-500 bg-gray-50 font-medium transition-all"
            />
          </div>

          {/* Password */}
          {!isForgot && (
            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Password</label>
              <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 py-4 gap-2 bg-gray-50 focus-within:border-blue-500 transition-all">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="text-sm outline-none text-gray-700 w-full bg-transparent font-medium"
                />
                <button onClick={() => setShowPass(!showPass)} className="text-gray-300 hover:text-gray-500 transition-colors">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Remember + Forgot */}
          {!isSignup && !isForgot && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setRemember(!remember)}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer"
                  style={remember ? { background: "#1565C0", borderColor: "#1565C0" } : { borderColor: "#e5e7eb" }}
                >
                  {remember && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-medium">Remember me</span>
              </label>
              <button onClick={() => { setIsForgot(true); setError(""); setSuccess(""); }} className="text-xs font-bold text-blue-600">
                Forgot password?
              </button>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">
              <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-500">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-3 rounded-2xl">
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-green-600">{success}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 text-white rounded-2xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95"
            style={{ background: "linear-gradient(90deg, #1565C0, #0D47A1)", boxShadow: "0 8px 24px rgba(13,71,161,0.35)" }}
          >
            {loading ? "Please wait..." : isForgot ? "Send Reset Link" : isSignup ? "Create Account" : "Sign In"}
          </button>

          {/* Toggle */}
          {isForgot ? (
            <p className="text-center text-xs text-gray-400 mt-2">
              <button onClick={() => { setIsForgot(false); setError(""); setSuccess(""); }} className="text-blue-600 font-bold">
                Back to Sign In
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-gray-400 mt-4">
              {isSignup ? "Already have an account? " : "Don't have an account? "}
              <button onClick={() => { setIsSignup(!isSignup); setError(""); setSuccess(""); }} className="text-blue-600 font-bold">
                {isSignup ? "Sign In" : "Sign Up"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}