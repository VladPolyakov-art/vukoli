import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  durationMs, EXIT_SLACK_MS, parseDuration, prefersReducedMotion, Presence, runExit, shouldBuildUp, smoothLevel,
  type ExitTarget, type PresenceState,
} from "./motion";

/** Minimal element: a class list and animationend listeners. */
function fakeEl() {
  const classes = new Set<string>();
  const listeners = new Set<(e: { target: unknown }) => void>();
  const el: ExitTarget & { classes: Set<string>; fire: (target?: unknown) => void; listeners: typeof listeners } = {
    classes,
    listeners,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    fire: (target) => [...listeners].forEach((fn) => fn({ target: target ?? el })),
  };
  return el;
}

const host = (reduced: boolean, value = "") => ({
  matchMedia: () => ({ matches: reduced }),
  getComputedStyle: () => ({ getPropertyValue: () => value }),
  document: { documentElement: {} as Element },
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("parseDuration", () => {
  it("reads ms and s", () => {
    expect(parseDuration("200ms")).toBe(200);
    expect(parseDuration(" 0.42s ")).toBe(420);
    expect(parseDuration("0ms", 99)).toBe(0);
  });
  it("falls back on garbage", () => {
    expect(parseDuration("", 160)).toBe(160);
    expect(parseDuration("fast", 160)).toBe(160);
    expect(parseDuration(undefined, 5)).toBe(5);
  });
});

describe("reduced motion", () => {
  it("is detected through matchMedia and is false without a window", () => {
    expect(prefersReducedMotion(host(true))).toBe(true);
    expect(prefersReducedMotion(host(false))).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(prefersReducedMotion({ matchMedia: () => { throw new Error("no"); } })).toBe(false);
  });
  it("turns every duration into 0", () => {
    expect(durationMs("--duration-exit", host(true, "200ms"))).toBe(0);
    expect(durationMs("--duration-slow", host(false, "420ms"))).toBe(420);
  });
  it("uses the token fallback when tokens.css is missing", () => {
    expect(durationMs("--duration-exit", host(false, ""))).toBe(200);
    expect(durationMs("--duration-exit", undefined)).toBe(200);
  });
});

describe("runExit", () => {
  it("finishes on the element's own animationend", () => {
    const el = fakeEl();
    const done = vi.fn();
    runExit(el, { className: "out", durationMs: 200, onDone: done });
    expect(el.classes.has("out")).toBe(true);
    el.fire({}); // a child's animationend bubbles up: ignored
    expect(done).not.toHaveBeenCalled();
    el.fire();
    expect(done).toHaveBeenCalledTimes(1);
    expect(el.classes.has("out")).toBe(false);
    expect(el.listeners.size).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("falls back to a timeout when animationend never fires (rule 5)", () => {
    const el = fakeEl();
    const done = vi.fn();
    runExit(el, { className: "out", durationMs: 200, onDone: done });
    vi.advanceTimersByTime(200);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(EXIT_SLACK_MS);
    expect(done).toHaveBeenCalledTimes(1);
    expect(el.classes.has("out")).toBe(false);
  });
  it("finishes at once under reduced motion (0ms)", () => {
    const el = fakeEl();
    const done = vi.fn();
    runExit(el, { className: "out", durationMs: 0, onDone: done });
    expect(done).toHaveBeenCalledTimes(1);
    expect(el.classes.has("out")).toBe(false);
  });
  it("can be cancelled without calling onDone", () => {
    const el = fakeEl();
    const done = vi.fn();
    const cancel = runExit(el, { className: "out", durationMs: 200, onDone: done });
    cancel();
    vi.advanceTimersByTime(1000);
    el.fire();
    expect(done).not.toHaveBeenCalled();
    expect(el.classes.has("out")).toBe(false);
  });
});

describe("Presence", () => {
  const make = (exitMs: number, initial: PresenceState = "entered") => {
    const seen: PresenceState[] = [];
    const p = new Presence(initial, () => exitMs, (s) => seen.push(s));
    return { p, seen };
  };
  it("exits, then unmounts after the exit duration", () => {
    const { p, seen } = make(200);
    p.set(false);
    expect(p.state).toBe("exiting");
    vi.advanceTimersByTime(199);
    expect(p.state).toBe("exiting");
    vi.advanceTimersByTime(1);
    expect(p.state).toBe("unmounted");
    expect(seen).toEqual(["exiting", "unmounted"]);
  });
  it("re-opening during the exit cancels it", () => {
    const { p, seen } = make(200);
    p.set(false);
    p.set(true);
    vi.advanceTimersByTime(1000);
    expect(p.state).toBe("entered");
    expect(seen).toEqual(["exiting", "entered"]);
  });
  it("unmounts at once under reduced motion", () => {
    const { p, seen } = make(0);
    p.set(false);
    expect(p.state).toBe("unmounted");
    expect(seen).toEqual(["unmounted"]);
  });
  it("mounts from unmounted and ignores repeated closes", () => {
    const { p, seen } = make(200, "unmounted");
    p.set(false);
    expect(seen).toEqual([]);
    p.set(true);
    expect(p.state).toBe("entered");
  });
  it("dispose stops a pending unmount", () => {
    const { p, seen } = make(200);
    p.set(false);
    p.dispose();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["exiting"]);
  });
});

describe("small rules", () => {
  it("Home build-up plays on the first visit and after a session only", () => {
    expect(shouldBuildUp({ homeSeen: false, returnFromSession: false })).toBe(true);
    expect(shouldBuildUp({ homeSeen: true, returnFromSession: false })).toBe(false);
    expect(shouldBuildUp({ homeSeen: true, returnFromSession: true })).toBe(false); // D59
  });
  it("mic level smoothing attacks fast, releases slowly, and clamps", () => {
    const up = smoothLevel(0, 1);
    const down = smoothLevel(1, 0);
    expect(up).toBeCloseTo(0.5);
    expect(down).toBeCloseTo(0.85);
    expect(smoothLevel(0, 5)).toBeLessThanOrEqual(1);
    expect(smoothLevel(0.4, Number.NaN)).toBeLessThan(0.4);
  });
});
