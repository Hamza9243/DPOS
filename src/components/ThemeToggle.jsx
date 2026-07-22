import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getStoredTheme, applyTheme } from "../lib/theme";

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      className={`relative w-14 h-8 rounded-full flex items-center px-1 transition-colors duration-300 flex-shrink-0 ${
        theme === "dark" ? "bg-ink-700" : "bg-brand-100"
      } ${className}`}
    >
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-transform duration-300 ${
          theme === "dark" ? "translate-x-6 bg-ink-900 text-brand-300" : "translate-x-0 bg-white text-brand-600"
        }`}
      >
        {theme === "dark" ? <Moon size={13} /> : <Sun size={13} />}
      </span>
    </button>
  );
}
