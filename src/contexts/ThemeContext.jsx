import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext();

const STORAGE_KEY = "elementmonitor-settings";

const defaults = {
  theme: "dark", // 'light' | 'dark' | 'system'
  compact: false,
};

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  const resolvedTheme =
    settings.theme === "system" ? getSystemTheme() : settings.theme;

  // Persist settings and apply data attributes on <html>
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.setAttribute(
      "data-compact",
      settings.compact ? "true" : "false",
    );
  }, [settings, resolvedTheme]);

  // Re-evaluate when the OS theme changes (only matters for "system" mode)
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSettings((s) => ({ ...s }));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <ThemeContext.Provider value={{ ...settings, resolvedTheme, updateSetting }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
