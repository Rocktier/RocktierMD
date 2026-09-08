import { useEffect } from "react";

type Theme = "dark" | "light" | "system";

const THEME_KEY = "rocktier-md-theme";
const THEMES: readonly Theme[] = ["dark", "light", "system"];

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  return stored && THEMES.includes(stored) ? stored : "system";
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(theme: Theme): "dark" | "light" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function useTheme() {
  useEffect(() => {
    applyTheme(readStoredTheme());

    // Listen for system theme changes
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      if (readStoredTheme() === "system") {
        applyResolved(getSystemTheme());
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
}

function applyTheme(theme: Theme) {
  applyResolved(resolveTheme(theme));
}

function applyResolved(resolved: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function toggleTheme() {
  const next: Theme = resolveTheme(readStoredTheme()) === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyResolved(next);
}
