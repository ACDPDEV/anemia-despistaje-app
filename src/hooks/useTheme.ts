import { useCallback, useEffect, useState } from "react";

// Theme mode: the single source for light/dark. Persisted per-device in
// localStorage under "theme-mode" — same per-device precedent as
// padron-storage and register-draft-storage (no user keying; the local
// device owns the choice, matching PRODUCT offline-first). Default follows
// the OS (prefers-color-scheme) until the user picks explicitly; an
// explicit choice always wins over the OS. Applies the `.dark` class on
// documentElement, which is what the Tailwind custom-variant in index.css
// keys off (night-shift field use is the reason PRODUCT mandates it).
export const THEME_STORAGE_KEY = "theme-mode";

export type ThemeMode = "light" | "dark";

function readStoredTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    // Private mode / blocked storage: fall through to the OS default.
    return null;
  }
}

function readSystemTheme(): ThemeMode {
  try {
    if (typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

// Startup resolution: explicit choice first, OS signal otherwise. Shared by
// the App shell effect and the early <script> in index.html so first paint
// and React agree (no flash, no fight).
export function getInitialTheme(): ThemeMode {
  return readStoredTheme() ?? readSystemTheme();
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

// Toggle state for the sidebar control. Only an explicit toggle writes
// storage — mounting never does, so the OS default keeps being honored
// across reloads until the user actually chooses.
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  // Follow the OS while the user has no explicit choice.
  useEffect(() => {
    if (readStoredTheme() !== null) return;
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => {
      setMode(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Choice still applies to this session via the effect above.
      }
      return next;
    });
  }, []);

  return { mode, toggle };
}
