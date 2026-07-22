import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 2400);
    const t3 = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden bg-white dark:bg-ink-950 transition-opacity duration-500"
      style={{ opacity: phase === 2 ? 0 : 1 }}
    >
      {/* Ambient glow field */}
      <div
        className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[140vw] h-[140vw] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(21,101,192,0.2) 0%, rgba(13,71,161,0.06) 40%, transparent 70%)" }}
      />
      <div className="absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,10,20,0.6)_100%)]" />

      <div
        className={`relative flex flex-col items-center transition-all duration-700 ${phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Logo with halo + gentle float — solid dark card behind the mark so it
            never picks up a faded/see-through look against a light backdrop. */}
        <div className="relative mb-7">
          <div className="absolute inset-0 rounded-[2rem] bg-brand-500/10 dark:bg-brand-500/40 blur-2xl scale-125 animate-pulse-soft" />
          <div className="relative w-28 h-28 rounded-[1.75rem] bg-ink-950 p-3.5 shadow-elevated animate-float drop-shadow-[0_8px_20px_rgba(0,145,240,0.15)] dark:drop-shadow-[0_8px_30px_rgba(0,145,240,0.45)]">
            <img src="/logo-mark.png" className="w-full h-full object-contain" alt="DPOS" />
          </div>
        </div>

        <h1 className="text-4xl font-black text-ink-900 dark:text-white tracking-[0.35em] pl-[0.35em]">DPOS</h1>
        <p className="text-brand-600 dark:text-brand-300/80 text-[11px] font-semibold tracking-[0.25em] pl-[0.25em] mt-2 uppercase">
          Point of Sale System
        </p>

        {/* Modern loader: shimmering progress bar */}
        <div className="mt-12 w-40 h-1 rounded-full bg-ink-900/10 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-300 to-brand-500 transition-all ease-out"
            style={{ width: phase >= 1 ? "100%" : "0%", transitionDuration: "1.8s" }}
          />
        </div>
      </div>

      <p className="absolute bottom-8 text-ink-600 dark:text-ink-400 dark:text-white/25 text-[10px] font-semibold tracking-[0.2em] uppercase">
        Powered by Devorions
      </p>
    </div>
  );
}
