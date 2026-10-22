/* User-test screen names (stage 13b). The dashboard tracker (tools/dashboard/tracker/track.js) reads
 * `<html data-ut-screen="...">` as "the screen the person is on" instead of `location.pathname`, because here one route
 * holds several states (Home: idle, setup chat, plan) and `/sessions/:id` would split every debrief into its own screen.
 * The attribute is harmless in normal builds: nothing reads it unless the user-test build injects the tracker.
 * Names carry no user data. "pending" = the app has not decided yet (server check): the tracker ignores it. */
import { useEffect } from "react";

export const UT_ATTR = "data-ut-screen";
export const UT_PENDING = "pending";

/** The part of `document.documentElement` we touch (a plain object stands in for it in tests). */
export interface UtRoot {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

/** Route (outside Home) -> screen name. `null` = a screen that names itself (Home). Old `/history` links redirect to the archive. */
export function utScreenForPath(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return null;
  if (path === "/archive" || path === "/history") return "/archive";
  if (path === "/archive/trash" || path === "/history/trash") return "/archive/trash";
  if (/^\/sessions\/[^/]+$/.test(path)) return "/debrief";
  return "/not-found";
}

/** Home: the start screen, the scripted setup chat, or the plan card (English has its own plan name). */
export function homeUtScreen(setup: { active: boolean; plan?: "interview" | "drill" | "english" | null }): string {
  if (!setup.active) return "/";
  if (setup.plan === "english") return "/home/plan-english";
  if (setup.plan) return "/home/plan";
  return "/home/setup-chat";
}

export function sessionUtScreen(mode: string | undefined): string {
  return mode === "english" ? "/session/english" : "/session";
}

/** Sets the name. `restore`: on release, put the previous name back (a popup over a page: Settings). Without `restore`
 * nothing is undone on release: the next screen has already set its own name (route swaps mount the new page before the
 * old one leaves). Returns the release function. */
export function claimUtScreen(name: string, root: UtRoot, restore = false): () => void {
  const prev = root.getAttribute(UT_ATTR);
  if (prev !== name) root.setAttribute(UT_ATTR, name);
  return () => {
    if (restore && prev && root.getAttribute(UT_ATTR) === name) root.setAttribute(UT_ATTR, prev);
  };
}

/** Marks the screen for the user-test tracker while it is mounted (`null` = do nothing). */
export function useUtScreen(name: string | null, restore = false) {
  useEffect(() => {
    if (name === null || typeof document === "undefined") return;
    return claimUtScreen(name, document.documentElement, restore);
  }, [name, restore]);
}
