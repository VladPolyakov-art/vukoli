/* Theme: "system" follows prefers-color-scheme; light/dark set data-theme on <html> (index.html applies it before paint). */
import { useCallback, useSyncExternalStore } from "react";
import { prefs, type ThemePref } from "./prefs";

const listeners = new Set<() => void>();

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

export function setTheme(pref: ThemePref) {
  prefs.setTheme(pref);
  applyTheme(pref);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const value = useSyncExternalStore(subscribe, () => prefs.theme(), () => "system" as ThemePref);
  const set = useCallback((p: ThemePref) => setTheme(p), []);
  return [value, set];
}
