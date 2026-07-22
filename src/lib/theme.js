// Light/dark theme switch. Dark is the app's current default look (what's
// been designed/tested this whole session); light restores the original
// bright theme. Persisted so the choice survives restarts.
const STORAGE_KEY = "dpos_theme";

export function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY) || "dark";
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
