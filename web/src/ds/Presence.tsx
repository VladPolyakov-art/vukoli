/* Presence (D49, docs/motion.md "Presence …"): Mike's presence as a glow along the top edge of the Session stage. It
 * replaces the Orb. The maths is in presenceModel.ts (tested); this file only draws.
 * - The glow exists only while someone talks: speaking follows Mike's level, listening the user's mic (smoothed ~450ms,
 *   calmer). Thinking = one broad crest sweeping side to side (ping-pong, --duration-presence-sweep per pass). Idle = no
 *   glow; it fades out over --duration-slow. No permanent line along the edge.
 * - Several lobes across the width (centre, both sides, two between), each breathing at its own moment.
 * - The owner's dot pattern (assets/presence-dots.webp, a seamless tile cut by scripts/presence-tile.mjs) shows only
 *   where the glow is, in the glow's own colour: two layers of the same glow, a soft field and a copy masked by the
 *   dots (CSS mask-image, done by the compositor).
 * - Colour from the presence palette (--color-presence-deep → soft, never paler than blue.400), drifting slowly.
 * - Text-safe: the glow fades to --presence-mask-stop over --presence-fade before the bottom of the box, where the first
 *   text line starts (the box's height is the safe line). Column heights stay below that line anyway (tested).
 * - Cost: one half-resolution canvas drawn in columns (+ one copy); the browser scales it up and applies the dot mask.
 *   The loop runs only while the box is on screen, the tab is visible and something is left to draw.
 * - Reduced motion (OS setting or `reducedMotion`): one still frame per state (presenceModel.staticFrame).
 * Decorative: aria-hidden; the state is always a text label next to it (StatusPill in the Session). */
import { useEffect, useRef } from "react";
import { durationMs, parseDuration, useReducedMotion } from "./motion";
import {
  columnAt, initialFrame, isDark, paletteAt, parseHex, speechEnvelope, staticFrame, stepFrame, toHex,
  COLUMN_STOPS, type PresenceFrame, type PresenceState, type Rgb,
} from "./presenceModel";
import s from "./Presence.module.css";

export type { PresenceState } from "./presenceModel";

export interface PresenceProps {
  state: PresenceState;
  /** Static level 0..1 of whoever talks (review frames, stories): Mike while speaking, the user while listening. */
  level?: number;
  /** Live level 0..1, read every frame (wins over `level`). No source while speaking → a speech-like envelope. */
  getLevel?: () => number;
  /** Force reduced motion on / off (stories, review); otherwise the OS setting. */
  reducedMotion?: boolean;
  className?: string;
}

const PALETTE_VARS = ["--color-presence-deep", "--color-presence-strong", "--color-presence-core", "--color-presence-soft"] as const;
/** Column width of the glow, CSS px (narrower boxes get finer columns). */
const STEP = 6;
const STEP_NARROW = 4;
/** The glow canvas is drawn at half the CSS resolution; the browser scales it up (a glow has no edges to lose). */
const SCALE = 0.5;

interface Theme { stops: Rgb[]; maskStop: number; fade: number; fadeS: number; periodS: number; dark: boolean }

function readTheme(el: Element): Theme {
  const cs = getComputedStyle(el);
  const stops = PALETTE_VARS.map((v) => parseHex(cs.getPropertyValue(v)) ?? ([0, 0, 0] as Rgb));
  const fadeRem = parseFloat(cs.getPropertyValue("--presence-fade")) || 4;
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const canvas = parseHex(cs.getPropertyValue("--color-canvas")) ?? [255, 255, 255];
  return {
    dark: (canvas[0] * 0.2126 + canvas[1] * 0.7152 + canvas[2] * 0.0722) / 255 < 0.5,
    stops,
    maskStop: Number(cs.getPropertyValue("--presence-mask-stop")) || 0.12,
    fade: fadeRem * rootPx,
    fadeS: durationMs("--duration-slow") / 1000,
    // 0 under reduced motion (tokens zeroed); a forced `reducedMotion={false}` still needs a real period.
    periodS: (parseDuration(cs.getPropertyValue("--duration-presence-sweep"), 2800) || 2800) / 1000,
  };
}

export function Presence({ state, level, getLevel, reducedMotion, className }: PresenceProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const osReduced = useReducedMotion();
  const reduced = reducedMotion ?? osReduced;
  // Inputs read by the loop without restarting it.
  const live = useRef({ state, level, getLevel });
  live.current = { state, level, getLevel };
  // The frame survives re-renders; a mount in a talking state starts settled (review frames show the glow at once).
  const frame = useRef<PresenceFrame | null>(null);
  if (!frame.current) frame.current = initialFrame(state, true);
  // Set by the drawing effect: re-read the theme and wake the loop (or redraw the still frame).
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    const box = boxRef.current;
    const field = fieldRef.current;
    const dotsCanvas = dotsRef.current;
    const ctx = field?.getContext("2d");
    const dctx = dotsCanvas?.getContext("2d");
    if (!box || !field || !dotsCanvas || !ctx || !dctx) return;

    let theme = readTheme(box);
    let W = 0, H = 0;
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let cost = 0;
    let costN = 0;
    // One vertical unit gradient (0..1), stretched per column with setTransform.
    const unit = ctx.createLinearGradient(0, 0, 0, 1);
    for (const [p, a] of COLUMN_STOPS) unit.addColorStop(p, toHex([255, 255, 255], a));

    const resize = () => {
      W = box.offsetWidth;
      H = box.offsetHeight;
      for (const c of [field, dotsCanvas]) {
        c.width = Math.max(1, Math.ceil(W * SCALE));
        c.height = Math.max(1, Math.ceil(H * SCALE));
      }
    };

    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, field.width, field.height);
      dctx.clearRect(0, 0, dotsCanvas.width, dotsCanvas.height);
    };

    const draw = () => {
      const f = frame.current;
      if (!f || !W || !H) return;
      const t0 = performance.now();
      clear();
      if (f.on <= 0.001) return;
      // 1. Alpha columns (white): each column's height and strength from the model.
      ctx.fillStyle = unit;
      const step = W < 560 ? STEP_NARROW : STEP;
      for (let x = 0; x < W; x += step) {
        const col = columnAt((x + step / 2) / W, f, theme.periodS, H);
        ctx.globalAlpha = Math.min(1, col.a * f.on);
        ctx.setTransform(SCALE, 0, 0, SCALE * col.h, SCALE * x, 0);
        ctx.fillRect(0, 0, step, 1); // exact width: an overlap would double the alpha into stripes
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // 2. Colour: the palette across the width, drifting.
      ctx.globalCompositeOperation = "source-in";
      const hue = ctx.createLinearGradient(0, 0, field.width, 0);
      for (let i = 0; i <= 8; i++) hue.addColorStop(i / 8, toHex(paletteAt(theme.stops, i / 8, f.drift)));
      ctx.fillStyle = hue;
      ctx.fillRect(0, 0, field.width, field.height);
      // 3. Text-safe mask: down to maskStop over `fade` px above the bottom (the first text line).
      ctx.globalCompositeOperation = "destination-out";
      const m0 = Math.max(0, H - theme.fade) * SCALE;
      const mask = ctx.createLinearGradient(0, m0, 0, H * SCALE);
      mask.addColorStop(0, toHex([0, 0, 0], 0));
      mask.addColorStop(1, toHex([0, 0, 0], 1 - theme.maskStop));
      ctx.fillStyle = mask;
      ctx.fillRect(0, m0, field.width, field.height - m0);
      ctx.globalCompositeOperation = "source-over";
      // 4. The dots layer: the same glow (CSS masks it with the pattern).
      dctx.drawImage(field, 0, 0);
      // Rolling frame cost, for the perf check (data-frame-ms on the box).
      cost += performance.now() - t0;
      if (++costN === 60) {
        box.dataset.frameMs = (cost / costN).toFixed(3);
        cost = 0;
        costN = 0;
      }
    };

    const levelNow = (now: number) => {
      const { state: st, level: lv, getLevel: get } = live.current;
      if (get) return get();
      if (lv !== undefined) return lv;
      return st === "speaking" ? speechEnvelope(now / 1000) : 0;
    };

    const schedule = () => {
      if (reduced || raf || !onScreen || document.hidden) return;
      raf = requestAnimationFrame(tick);
    };

    function tick(now: number) {
      raf = 0;
      const f = frame.current;
      if (!f) return;
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      stepFrame(f, dt, { target: live.current.state, level: levelNow(now), fadeS: theme.fadeS });
      draw();
      if (!isDark(f, live.current.state)) schedule();
      else last = 0;
    }

    const still = () => {
      frame.current = staticFrame(live.current.state);
      draw();
    };

    // Dark canvas: the glow adds light (screen) instead of covering. Read from --color-canvas, so a dark review frame
    // inside a light page works too.
    const applyBlend = () => {
      box.dataset.blend = theme.dark ? "screen" : "normal";
    };

    const refresh = () => {
      theme = readTheme(box);
      applyBlend();
      if (reduced) still();
      else { last = 0; schedule(); }
    };

    resize();
    applyBlend();
    if (reduced) still();
    else schedule();

    const ro = new ResizeObserver(() => { resize(); if (reduced) still(); else draw(); });
    ro.observe(box);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) { last = 0; schedule(); }
    });
    io.observe(box);
    const onVisibility = () => { if (!document.hidden) { last = 0; schedule(); } };
    document.addEventListener("visibilitychange", onVisibility);
    // Theme switch (data-theme on <html> or the OS scheme): re-read the palette.
    const mo = new MutationObserver(refresh);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    mql?.addEventListener?.("change", refresh);
    kick.current = refresh;

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mql?.removeEventListener?.("change", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      kick.current = () => undefined;
    };
  }, [reduced]);

  // A new state wakes the loop (it sleeps when idle and faded out); under reduced motion it redraws the still frame.
  useEffect(() => {
    kick.current();
  }, [state]);

  return (
    <div
      ref={boxRef}
      className={`${s.box} ${className ?? ""}`}
      aria-hidden="true"
      data-state={state}
      data-review-id={`Presence/${state}`}
    >
      <canvas ref={fieldRef} className={`${s.layer} ${s.field}`} />
      <canvas ref={dotsRef} className={`${s.layer} ${s.dots}`} />
    </div>
  );
}
