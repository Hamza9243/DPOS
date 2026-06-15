import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 2500);
    const t3 = setTimeout(() => onDone(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{
        background: "#ffffff",
        opacity: phase === 2 ? 0 : 1,
        transition: "opacity 0.6s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "translateY(0) scale(1)" : "translateY(30px) scale(0.85)",
          transition: "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <img
          src="/logo.png"
          style={{
            width: "110px",
            height: "110px",
            objectFit: "contain",
            marginBottom: "20px",
            filter: "drop-shadow(0 4px 16px rgba(13,71,161,0.2))",
          }}
        />
        <h1
          style={{
            fontSize: "38px",
            fontWeight: "900",
            color: "#0D47A1",
            letterSpacing: "10px",
            margin: 0,
          }}
        >
          DPOS
        </h1>
        <p
          style={{
            color: "#1565C0",
            fontSize: "12px",
            marginTop: "8px",
            letterSpacing: "3px",
            opacity: 0.6,
          }}
        >
          Point of Sale System
        </p>

        {/* Loading bar */}
        <div
          style={{
            marginTop: "48px",
            width: "120px",
            height: "3px",
            background: "#e8f0fe",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "10px",
              background: "linear-gradient(90deg, #1565C0, #0D47A1)",
              width: phase >= 1 ? "100%" : "0%",
              transition: "width 1.6s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}