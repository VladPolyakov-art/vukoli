/* D104: does this run of the wizard start with the "Install" step? Decided once, at the start, and then frozen, so
 * the stepper never grows under the user's hands.
 *  - the browser already holds the install event (`canInstall`)      -> "show" at once;
 *  - the browser has no install event at all (Safari, Firefox)        -> "skip" at once, no waiting;
 *  - the wizard resumes from stored progress (screens/setup/progress.ts)  -> "skip" at once;
 *  - otherwise the event may arrive a moment after load (the service worker registers on `load`): "waiting" up to
 *    INSTALL_WAIT_MS, then "skip". An event that comes later is not inserted mid-wizard (the Home card covers it). */
import { useEffect, useState } from "react";
import { useInstallOffer } from "../../lib/installApp";

export const INSTALL_WAIT_MS = 1500;

export type InstallGate = "waiting" | "show" | "skip";
export type InstallGateEvent = { type: "canInstall" } | { type: "timeout" };

/** The browser fires `beforeinstallprompt` at all (Chrome, Edge, Brave...): it has the `onbeforeinstallprompt` handler slot. */
export function browserCanOfferInstall(target: object = typeof window === "undefined" ? {} : window): boolean {
  return "onbeforeinstallprompt" in target;
}

export function initialInstallGate(canInstall: boolean, supported: boolean): InstallGate {
  if (canInstall) return "show";
  return supported ? "waiting" : "skip";
}

/** Where a run of the wizard starts: a resumed run (stored progress) never waits for or shows the Install step. */
export function startingInstallGate(canInstall: boolean, supported: boolean, resumed: boolean): InstallGate {
  return resumed ? "skip" : initialInstallGate(canInstall, supported);
}

/** Only "waiting" moves; "show" and "skip" are final. */
export function nextInstallGate(gate: InstallGate, event: InstallGateEvent): InstallGate {
  if (gate !== "waiting") return gate;
  return event.type === "canInstall" ? "show" : "skip";
}

/** `resumed`: the wizard resumes from stored progress (another window, a reload): Install was already offered, so no
 * waiting and no Install step ("skip" at once). */
export function useInstallGate(waitMs: number = INSTALL_WAIT_MS, resumed = false): InstallGate {
  const { canInstall } = useInstallOffer();
  const [gate, setGate] = useState<InstallGate>(() => startingInstallGate(canInstall, browserCanOfferInstall(), resumed));
  useEffect(() => {
    if (canInstall) setGate((g) => nextInstallGate(g, { type: "canInstall" }));
  }, [canInstall]);
  useEffect(() => {
    if (gate !== "waiting") return;
    const id = window.setTimeout(() => setGate((g) => nextInstallGate(g, { type: "timeout" })), waitMs);
    return () => window.clearTimeout(id);
  }, [gate, waitMs]);
  return gate;
}
