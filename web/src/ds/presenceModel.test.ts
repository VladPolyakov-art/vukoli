import { describe, expect, it } from "vitest";
// node:fs exists under vitest (node environment); the app tsconfig carries no node types.
// @ts-expect-error -- no @types/node in this project
import { readFileSync } from "node:fs";
import {
  columnAt, glowAlphaAt, initialFrame, isDark, parseHex, staticFrame, stepFrame, sweepDir, sweepPos,
  PRESENCE_STATES, WAITING_ON, type PresenceFrame, type PresenceState, type Rgb,
} from "./presenceModel";

const REACH = 220;
const REACH_SM = 170;
const FADE = 64;
const MASK = 0.12;
const PERIOD = 2.8;

function run(f: PresenceFrame, seconds: number, target: PresenceState, level = 0.6, fadeS = 0.42) {
  for (let t = 0; t < seconds; t += 1 / 60) stepFrame(f, 1 / 60, { target, level, fadeS });
  return f;
}

const heights = (f: PresenceFrame, reach = REACH, n = 97) => Array.from({ length: n }, (_, i) => columnAt(i / (n - 1), f, PERIOD, reach).h);

describe("Presence state model", () => {
  it("idle has no glow and fades out over --duration-slow", () => {
    const f = initialFrame("speaking", true);
    expect(f.on).toBe(1);
    run(f, 0.2, "idle");
    expect(f.on).toBeGreaterThan(0.4);
    expect(f.on).toBeLessThan(0.6);
    run(f, 0.25, "idle");
    expect(f.on).toBe(0);
    expect(isDark(f, "idle")).toBe(true);
    expect(initialFrame("idle", true).on).toBe(0);
  });

  it("every talking state turns the glow on; coming out of no glow takes the new shape at once", () => {
    for (const s of PRESENCE_STATES.filter((x) => x !== "idle")) {
      const f = initialFrame("idle", true);
      stepFrame(f, 1 / 60, { target: s, level: 0.5, fadeS: 0.42 });
      expect(f.w[s]).toBe(1);
      run(f, 0.5, s);
      expect(f.on).toBe(s === "waiting" ? WAITING_ON : 1);
    }
  });

  it("cross-fades between talking states instead of jumping", () => {
    const f = run(initialFrame("speaking", true), 0.1, "speaking");
    stepFrame(f, 1 / 60, { target: "thinking", level: 0, fadeS: 0.42 });
    expect(f.w.thinking).toBeGreaterThan(0);
    expect(f.w.thinking).toBeLessThan(0.2);
    run(f, 2, "thinking");
    expect(f.w.thinking).toBeGreaterThan(0.99);
  });

  it("instant fade with fadeS 0 (reduced motion tokens)", () => {
    const f = initialFrame("speaking", true);
    stepFrame(f, 1 / 60, { target: "idle", level: 0, fadeS: 0 });
    expect(f.on).toBe(0);
  });

  it("listening follows the mic smoothed (~450ms), slower than Mike's voice", () => {
    const a = run(initialFrame("listening", true), 0.15, "listening", 1);
    const b = run(initialFrame("speaking", true), 0.15, "speaking", 1);
    expect(b.voice).toBeGreaterThan(0.8);
    expect(a.micS).toBeLessThan(0.4);
    run(a, 1.5, "listening", 1);
    expect(a.micS).toBeGreaterThan(0.9);
  });

  it("louder means taller", () => {
    const quiet = run(initialFrame("speaking", true), 1, "speaking", 0.05);
    const loud = run(initialFrame("speaking", true), 1, "speaking", 1);
    const max = (f: PresenceFrame) => Math.max(...heights(f));
    expect(max(loud)).toBeGreaterThan(max(quiet) + 30);
  });
});

describe("Presence shapes", () => {
  it("speaking and listening move across the width: several lobes (centre and both sides)", () => {
    for (const s of ["speaking", "listening"] as const) {
      const h = heights(staticFrame(s));
      const peaks = h.filter((v, i) => i > 0 && i < h.length - 1 && v > h[i - 1]! && v >= h[i + 1]!);
      expect(peaks.length).toBeGreaterThanOrEqual(3);
      const third = Math.floor(h.length / 3);
      // Each third of the width has a raised part, not only the centre.
      for (const part of [h.slice(0, third), h.slice(third, 2 * third), h.slice(2 * third)]) {
        expect(Math.max(...part) - Math.min(...h)).toBeGreaterThan(8);
      }
    }
  });

  it("speaking: the centre goes deeper than the sides (D51)", () => {
    const h = heights(staticFrame("speaking"));
    const n = h.length - 1;
    const centre = Math.max(...h.slice(Math.round(0.4 * n), Math.round(0.6 * n)));
    const side = Math.max(...h.slice(0, Math.round(0.2 * n)), ...h.slice(Math.round(0.8 * n)));
    const floor = Math.min(...h);
    // Lift above the resting edge: the centre goes about twice as deep as the sides, which still move.
    expect(centre - floor).toBeGreaterThan(2 * (side - floor));
    expect(side - floor).toBeGreaterThan(8);
  });

  it("thinking is one broad crest sweeping side to side (ping-pong)", () => {
    expect(sweepPos(0, PERIOD)).toBeCloseTo(0);
    expect(sweepPos(PERIOD, PERIOD)).toBeCloseTo(1);
    expect(sweepPos(2 * PERIOD, PERIOD)).toBeCloseTo(0);
    expect(sweepDir(PERIOD / 2, PERIOD)).toBeGreaterThan(0.99);
    expect(sweepDir(PERIOD * 1.5, PERIOD)).toBeLessThan(-0.99);
    const f = run(initialFrame("thinking", true), 0.5, "thinking");
    f.sweepT = PERIOD / 2; // crest in the middle
    const h = heights(f);
    const top = h.indexOf(Math.max(...h));
    expect(top / (h.length - 1)).toBeCloseTo(0.5, 1);
    // Broad: still well raised a fifth of the width away; a wave, not a blob.
    expect(h[Math.round(0.3 * (h.length - 1))]! - h[0]!).toBeGreaterThan(10);
  });

  it("reduced motion: still frames per state", () => {
    expect(staticFrame("idle").on).toBe(0);
    const sp = staticFrame("speaking");
    expect(sp.on).toBe(1);
    expect(sp.voice).toBeGreaterThan(0.5);
    const li = staticFrame("listening");
    expect(Math.max(...heights(li))).toBeLessThan(Math.max(...heights(sp)));
    // Thinking: the crest held at one side.
    const th = heights(staticFrame("thinking"));
    const top = th.indexOf(Math.max(...th)) / (th.length - 1);
    expect(top).toBeLessThan(0.3);
  });
});

/* ---------- text safety: the glow never reaches the first text line, and the mask caps it anyway ---------- */

function tokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const css: string = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  const block = (sel: string) => {
    const i = css.indexOf(sel);
    const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
  };
  const root = block(":root {");
  return { light: root, dark: { ...root, ...block('[data-theme="dark"] {') } };
}

function resolve(vars: Record<string, string>, name: string): Rgb {
  let v = vars[name] ?? "";
  for (let i = 0; i < 8 && v.startsWith("var("); i++) v = vars[v.slice(4, -1).trim()] ?? "";
  const rgb = parseHex(v);
  if (!rgb) throw new Error(`${name} does not resolve to a hex colour: ${v}`);
  return rgb;
}

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: Rgb, b: Rgb) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };
const over = (bg: Rgb, fg: Rgb, a: number): Rgb => [0, 1, 2].map((i) => bg[i]! * (1 - a) + fg[i]! * a) as Rgb;
const screen = (bg: Rgb, fg: Rgb, a: number): Rgb => [0, 1, 2].map((i) => 255 - ((255 - bg[i]!) * (255 - fg[i]! * a)) / 255) as Rgb;

describe("Presence text safety", () => {
  it("no column reaches the first text line (the box bottom), at any level, desktop and phone", () => {
    for (const reach of [REACH, REACH_SM]) {
      for (const s of PRESENCE_STATES) {
        const f = run(initialFrame(s, true), 3, s, 1);
        for (const t of [0, 0.7, 1.4, 2.1]) {
          f.t = t;
          f.sweepT = t;
          const max = Math.max(...heights(f, reach));
          expect(max).toBeLessThan(reach);
        }
      }
    }
  });

  it("the mask caps the glow at the text line to <= 12% of its strength", () => {
    const col = { h: REACH * 2, a: 0.6 }; // a column taller than the box, on purpose
    const at = glowAlphaAt(REACH, col, 1, REACH, FADE, MASK);
    const top = glowAlphaAt(0, col, 1, REACH, FADE, MASK);
    expect(at / top).toBeLessThanOrEqual(MASK + 1e-9);
    expect(glowAlphaAt(REACH - FADE, col, 1, REACH, FADE, MASK)).toBeGreaterThan(at);
  });

  it("text stays >= 4.5:1 with the worst glow left at the text line (12%), light and dark", () => {
    const { light, dark } = tokens();
    for (const [theme, vars, blend] of [["light", light, over], ["dark", dark, screen]] as const) {
      const bg = resolve(vars, "--color-canvas");
      for (const glowVar of ["--color-presence-deep", "--color-presence-strong", "--color-presence-core", "--color-presence-soft"]) {
        const lit = blend(bg, resolve(vars, glowVar), MASK);
        for (const textVar of ["--color-text-primary", "--color-text-secondary"]) {
          const ratio = contrast(resolve(vars, textVar), lit);
          expect(ratio, `${theme} ${textVar} on ${glowVar} @${MASK}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
