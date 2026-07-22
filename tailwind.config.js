export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand blue — matches the existing #1565C0/#0D47A1 accent used app-wide.
        // 600/700 are the app's existing brand blue (unchanged). 300/400/500
        // are calibrated from the actual app icon's "D" mark gradient
        // (#01affc light cyan-blue -> #005df8 vivid blue) so new dark/glow
        // UI (splash, glass panels) reads as one family with the icon.
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#b3ccff",
          300: "#5cc4ff",
          400: "#16b0fc",
          500: "#0091f0",
          600: "#1565C0",
          700: "#0D47A1",
          800: "#0a3679",
          900: "#082a5e",
          950: "#04162e",
        },
        // Deep navy/ink — sampled straight from the app icon's own dark
        // background (#000000 outer canvas, #022358 card navy) so splash /
        // sidebar dark surfaces blend seamlessly with the icon, no seam.
        ink: {
          50: "#f5f7fb",
          100: "#e9edf5",
          200: "#cfd8e6",
          300: "#a7b4c9",
          400: "#7c8ba3",
          500: "#5b6b85",
          600: "#3d4d6b",
          700: "#1f3050",
          800: "#0f1e3b",
          900: "#051328",
          950: "#010204",
        },
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.05)",
        card: "0 8px 24px -8px rgba(15,23,42,0.12), 0 2px 6px -2px rgba(15,23,42,0.06)",
        elevated: "0 20px 48px -12px rgba(13,71,161,0.28), 0 8px 20px -6px rgba(13,71,161,0.14)",
        glow: "0 0 0 1px rgba(79,142,255,0.18), 0 8px 30px -8px rgba(21,101,192,0.55)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "fade-up": { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "scale-in": { from: { opacity: 0, transform: "scale(0.94)" }, to: { opacity: 1, transform: "scale(1)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        "pulse-soft": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.55 } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease both",
        "fade-up": "fade-up 0.55s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        float: "float 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};