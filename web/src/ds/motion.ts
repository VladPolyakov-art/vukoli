/* Motion helpers (docs/motion.md). Pure CSS does the animating; these helpers only decide *when*:
 * - durations are read from the motion tokens at run time, so reduced motion (tokens = 0ms) needs no special case;
 * - exits never block (rule 5): every exit has a timeout fallback, even if `animationend` never fires;
 * - "animate once" registries keep re-renders and remounts from replaying an entrance.
 * No animation library: v1 was pure CSS, and so is this. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Extra time after an exit's duration before the fallback fires (animationend usually wins). */
export const EXIT_SLACK_MS = 50;

export type DurationToken =
  | "--duration-fast" | "--duration-base" | "--duration-slow" | "--duration-slower" | "--duration-exit"
  | "--duration-stagger" | "--duration-loop-dots" | "--duration-loop-skeleton" | "--duration-loop-shimmer";

/** Fallbacks match tokens/tokens.json; used when tokens.css is not loaded (unit tests, SSR). */
const FALLBACK_MS: Record<DurationToken, number> = {
  "--duration-fast": 160, "--duration-base": 240, "--duration-slow": 420, "--duration-slower": 560,
  "--duration-exit": 200, "--duration-stagger": 80, "--duration-loop-dots": 1200, "--duration-loop-skeleton": 1400,
  "--duration-loop-shimmer": 1800,
};

/** "200ms" → 200, "0.2s" → 200, "" / garbage → fallback. */
export function parseDuration(value: string | null | undefined, fallback = 0): number {
  const v = (value ?? "").trim();
  const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(v);
  if (!m) return fallback;
  const n = Number(m[1]) * (m[2] === "s" ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

interface MatchMediaHost { matchMedia?: (query: string) => { matches: boolean } }

/** True when the user asked the OS for reduced motion. Safe outside the browser (returns false). */
export function prefersReducedMotion(host: MatchMediaHost | undefined = typeof window !== "undefined" ? window : undefined): boolean {
  try {
    return Boolean(host?.matchMedia?.(REDUCED_MOTION_QUERY).matches);
  } catch {
    return false;
  }
}

interface StyleHost extends MatchMediaHost {
  getComputedStyle?: (el: Element) => { getPropertyValue: (name: string) => string };
  document?: { documentElement: Element };
}

/** A motion token in ms as the page currently resolves it: 0 under reduced motion. */
export function durationMs(token: DurationToken, host: StyleHost | undefined = typeof window !== "undefined" ? window : undefined): number {
  if (prefersReducedMotion(host)) return 0;
  const root = host?.document?.documentElement;
  const raw = root && host?.getComputedStyle ? host.getComputedStyle(root).getPropertyValue(token) : "";
  return parseDuration(raw, FALLBACK_MS[token]);
}

/** Scroll behaviour for programmatic scrolls (auto-scroll to the newest turn): never smooth under reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

export interface ExitTarget {
  classList: { add: (c: string) => void; remove: (c: string) => void };
  addEventListener: (type: "animationend", fn: (e: { target: unknown }) => void) => void;
  removeEventListener: (type: "animationend", fn: (e: { target: unknown }) => void) => void;
}

export interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Play an exit animation by adding `className`, then call `onDone` exactly once: on the element's own
 * `animationend`, or after `durationMs` + slack if that event never comes (rule 5). With a 0 duration
 * (reduced motion) it finishes synchronously. Returns a cancel function (no `onDone` after cancel). */
export function runExit(el: ExitTarget, opts: { className: string; durationMs: number; onDone?: () => void; timers?: Timers }): () => void {
  const timers = opts.timers ?? defaultTimers;
  if (opts.durationMs <= 0) {
    opts.onDone?.();
    return () => {};
  }
  let finished = false;
  let timer: unknown = null;
  const finish = (callDone: boolean) => {
    if (finished) return;
    finished = true;
    if (timer !== null) timers.clear(timer);
    el.removeEventListener("animationend", onEnd);
    el.classList.remove(opts.className);
    if (callDone) opts.onDone?.();
  };
  const onEnd = (e: { target: unknown }) => {
    if (e.target === el) finish(true);
  };
  el.classList.add(opts.className);
  el.addEventListener("animationend", onEnd);
  timer = timers.set(() => finish(true), opts.durationMs + EXIT_SLACK_MS);
  return () => finish(false);
}

export type PresenceState = "entered" | "exiting" | "unmounted";

/** Mount / exit / unmount state machine for an element that animates out before it is removed.
 * The exit always ends on a timer (never waits for an event), so a missing animation cannot keep it mounted. */
export class Presence {
  state: PresenceState;
  private timer: unknown = null;

  constructor(initial: PresenceState, private exitMs: () => number, private onChange: (s: PresenceState) => void,
    private timers: Timers = defaultTimers) {
    this.state = initial;
  }

  set(open: boolean) {
    if (open) {
      this.clear();
      this.emit("entered");
      return;
    }
    if (this.state !== "entered") return;
    const ms = this.exitMs();
    if (ms <= 0) {
      this.emit("unmounted");
      return;
    }
    this.emit("exiting");
    this.timer = this.timers.set(() => {
      this.timer = null;
      this.emit("unmounted");
    }, ms);
  }

  dispose() {
    this.clear();
  }

  private clear() {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  private emit(next: PresenceState) {
    if (this.state === next) return;
    this.state = next;
    this.onChange(next);
  }
}

/** Keep something mounted while it plays its exit. `leaving` is true during the exit; apply an exit class then. */
export function usePresence(open: boolean, token: DurationToken = "--duration-exit") {
  const [state, setState] = useState<PresenceState>(open ? "entered" : "unmounted");
  const presence = useRef<Presence | null>(null);
  if (!presence.current) presence.current = new Presence(state, () => durationMs(token), setState);
  useEffect(() => {
    presence.current?.set(open);
  }, [open]);
  useEffect(() => () => presence.current?.dispose(), []);
  return { mounted: state !== "unmounted", leaving: state === "exiting" };
}

function subscribeReduced(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener?.("change", cb);
  return () => mql.removeEventListener?.("change", cb);
}

/** Live `prefers-reduced-motion` value. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => prefersReducedMotion(), () => false);
}

/** "Has this entrance played already?" Keys survive re-renders and remounts, so an entrance runs once per key.
 * The answer is fixed for the lifetime of the component (a re-render never strips a running animation). */
export function useFreshOnce(registry: Set<string>, key: string): boolean {
  const [fresh] = useState(() => !registry.has(key));
  useEffect(() => {
    registry.add(key);
  }, [registry, key]);
  return fresh;
}

/** App-wide motion memory: the Home build-up plays on the first visit only (D59: less motion between pages; it no longer
 * replays after a session). `returnFromSession` stays for callers that track it. */
export const motionMemory = {
  homeSeen: false,
  returnFromSession: false,
};

/** Should the Home build-up play now? Pure, so the rule is testable. */
export function shouldBuildUp(memory: { homeSeen: boolean; returnFromSession: boolean }): boolean {
  return !memory.homeSeen;
}

/** Visual smoothing for the live mic level: fast attack, slower release (the disc never flickers). */
export function smoothLevel(prev: number, next: number): number {
  const target = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0));
  const k = target > prev ? 0.5 : 0.15;
  return prev + (target - prev) * k;
}
