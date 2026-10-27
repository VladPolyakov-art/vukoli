/* Vukoli as an installed app (PWA): its own window and Dock / taskbar icon. Chrome and Edge fire `beforeinstallprompt`
 * when the page can be installed (manifest + service worker, public/); we keep that event and offer it quietly (a card
 * on Home, a row in Settings > General). Nothing is offered once the user said no to the card (remembered per browser)
 * or after `appinstalled`.
 * "Not installed yet" is the event itself: Chrome does not fire it when the app is installed, whether the page is opened
 * in a tab or in the installed window. `display-mode: standalone` is NOT used: the launcher's plain `--app=` window
 * reports standalone too (checked in Chromium 156), and that window is exactly where the offer is useful.
 * The offer is a small external store, created when this module loads, so an event that fires before React mounts is not missed. */
import { useSyncExternalStore } from "react";
import { prefs } from "./prefs";

/** Chrome's `beforeinstallprompt` event (not in lib.dom). `prompt()` works once per event. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallSnapshot {
  /** The browser can install Vukoli now (an event is waiting). */
  canInstall: boolean;
  /** The Home card: can install, and the user has not said no to the card. */
  showCard: boolean;
}

export interface InstallEnv {
  target: EventTarget;
  wasDismissed: () => boolean;
  saveDismissed: () => void;
}

export function createInstallOffer(env: InstallEnv) {
  let waiting: InstallPromptEvent | null = null;
  let installed = false;
  let dismissed = env.wasDismissed();
  const listeners = new Set<() => void>();

  const compute = (): InstallSnapshot => {
    const canInstall = waiting !== null && !installed;
    return { canInstall, showCard: canInstall && !dismissed };
  };
  let snapshot = compute();
  const update = () => {
    const next = compute();
    if (next.canInstall === snapshot.canInstall && next.showCard === snapshot.showCard) return;
    snapshot = next;
    listeners.forEach((l) => l());
  };

  env.target.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();                    // no browser mini-infobar: we offer it ourselves
    waiting = e as InstallPromptEvent;
    update();
  });
  env.target.addEventListener("appinstalled", () => {
    waiting = null;
    installed = true;
    update();
  });

  /** "No thanks" on the Home card: remembered, the Settings row stays. */
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    env.saveDismissed();
    update();
  };

  /** Shows the browser's install dialog. A cancelled dialog counts as "no thanks" (the event cannot be used twice). */
  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const event = waiting;
    if (!event || !snapshot.canInstall) return "unavailable";
    waiting = null;
    update();
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "dismissed") dismiss();
      return outcome;
    } catch {
      return "dismissed";
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    dismiss,
    install,
  };
}

const inBrowser = typeof window !== "undefined";

export const installOffer = createInstallOffer({
  target: inBrowser ? window : new EventTarget(),
  wasDismissed: () => prefs.installDismissed(),
  saveDismissed: () => prefs.setInstallDismissed(true),
});

export function useInstallOffer() {
  const snapshot = useSyncExternalStore(installOffer.subscribe, installOffer.getSnapshot, installOffer.getSnapshot);
  return { ...snapshot, install: installOffer.install, dismiss: installOffer.dismiss };
}

/** Where the installed app's icon lives, for the card's text. */
export function iconPlace(userAgent: string): "dock" | "taskbar" {
  return /Mac/i.test(userAgent) ? "dock" : "taskbar";
}

/** The service worker (public/sw.js) in the built app only. It is what makes the page installable and shows
 * "Vukoli isn't running" when a closed app is opened. Never in the dev server (it would sit in front of Vite). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* private window or blocked: the app works without it */ });
  });
}
