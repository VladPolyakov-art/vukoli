/* Presence model (ds/Presence, D49): the pure maths behind Mike's glow along the top edge of the Session stage.
 * No DOM here, so vitest covers it: state weights and the fade, the voice followers, the height profile with lobes
 * across the width (speaking / listening), the side-to-side thinking crest, and the static reduced-motion frames.
 * Units: `u` is 0..1 across the width; heights are CSS px for a glow box of `reach` px (220 wide, 170 phone). */

/** `waiting` = your turn before the first word: a faint inviting glow (D50). */
export type PresenceState = "idle" | "waiting" | "listening" | "thinking" | "speaking";
export const PRESENCE_STATES: readonly PresenceState[] = ["idle", "waiting", "listening", "thinking", "speaking"];

export interface PresenceFrame {
  /** Cross-fade weights of the shapes (one-hot when settled). */
  w: Record<PresenceState, number>;
  /** Overall glow opacity 0..1: 0 at idle (no glow, D49 2), WAITING_ON on your turn (D50), 1 while someone talks or Mike thinks. */
  on: number;
  /** Seconds of running time (lobe breathing). */
  t: number;
  /** Seconds spent thinking (sweep phase). */
  sweepT: number;
  /** Colour drift across the width, in palette cycles. */
  drift: number;
  /** Mike's level follower (fast attack, slower release). */
  voice: number;
  /** The user's level follower, then `micS` = the same smoothed with τ 450ms (calm listening). */
  mic: number;
  micS: number;
  /** Thinking crest held still (reduced motion): position and direction override the sweep. */
  hold?: { pos: number; dir: number };
}

/** Speaking / listening lobes: centre, both sides and two in between, each breathing at its own moment (D49 6). */
export const LOBES = [
  { c: 0.1, a: 0.82, f: 0.29, ph: 0.4 },
  { c: 0.3, a: 0.66, f: 0.37, ph: 2.3 },
  { c: 0.5, a: 1, f: 0.21, ph: 4.1 },
  { c: 0.7, a: 0.66, f: 0.33, ph: 1.2 },
  { c: 0.9, a: 0.82, f: 0.25, ph: 5.2 },
] as const;
const LOBE_SIGMA = 0.085;
const TAU = Math.PI * 2;
/** Reference reach the amplitudes are designed for (desktop, 220px). */
const REF_REACH = 220;

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const oneHot = (s: PresenceState): Record<PresenceState, number> => ({ idle: 0, waiting: 0, listening: 0, thinking: 0, speaking: 0, [s]: 1 });

/** Strength of the inviting glow on your turn (D50: faint; brighter was not wanted for the rest). */
export const WAITING_ON = 0.35;

/** Glow target: none at idle, faint on your turn, full while someone is talking or Mike is thinking. */
export function glowTarget(state: PresenceState): number {
  return state === "idle" ? 0 : state === "waiting" ? WAITING_ON : 1;
}

export function initialFrame(state: PresenceState, settled = false): PresenceFrame {
  return { w: oneHot(state), on: settled ? glowTarget(state) : 0, t: 0, sweepT: 0, drift: 0, voice: 0, mic: 0, micS: 0 };
}

/** A procedural speech-like envelope (syllables + short pauses), for "speaking" with no level source yet. */
export function speechEnvelope(timeS: number): number {
  const syllable = Math.abs(Math.sin(timeS * 9.1)) * 0.6 + Math.abs(Math.sin(timeS * 3.7)) * 0.4;
  const phrase = Math.sin(timeS * 0.9) > -0.35 ? 1 : 0.08;
  return clamp01(syllable * phrase * 0.8);
}

export interface StepInput {
  target: PresenceState;
  /** Level 0..1 of whoever is talking (Mike when speaking, the user when listening). */
  level: number;
  /** Fade in / out time in seconds (`--duration-slow`; 0 under reduced motion = instant). */
  fadeS: number;
}

/** Advance the frame by dt seconds (mutates and returns `f`). */
export function stepFrame(f: PresenceFrame, dt: number, { target, level, fadeS }: StepInput): PresenceFrame {
  const d = Math.min(0.05, Math.max(0, dt));
  // Coming out of no glow: take the new shape at once (no ghost of the previous state fading in).
  if (f.on < 0.02) f.w = oneHot(target);
  else {
    const k = 1 - Math.exp(-d / 0.3);
    for (const s of PRESENCE_STATES) f.w[s] += ((s === target ? 1 : 0) - f.w[s]) * k;
  }
  const goal = glowTarget(target);
  if (fadeS <= 0) f.on = goal;
  else f.on += Math.sign(goal - f.on) * Math.min(Math.abs(goal - f.on), d / fadeS);
  f.t += d;
  f.sweepT += d * f.w.thinking;
  f.drift += d * (0.03 + 0.05 * f.w.thinking);
  const lv = clamp01(level);
  const v = target === "speaking" ? lv : 0;
  const m = target === "listening" ? lv : 0;
  f.voice += (v - f.voice) * Math.min(1, d * (v > f.voice ? 14 : 6));
  f.mic += (m - f.mic) * Math.min(1, d * (m > f.mic ? 14 : 6));
  f.micS += (f.mic - f.micS) * (1 - Math.exp(-d / 0.45));
  f.hold = undefined;
  return f;
}

/** Reduced motion: one still frame per state (speaking: lobes raised; listening: slightly raised; thinking: crest
 * held at the left side; waiting: low lobes, faint; idle: nothing). */
export function staticFrame(state: PresenceState): PresenceFrame {
  const f = initialFrame(state, true);
  f.t = 1.3;
  f.drift = 0.15;
  if (state === "speaking") f.voice = 0.6;
  if (state === "listening") { f.mic = 0.6; f.micS = 0.6; }
  if (state === "thinking") f.hold = { pos: 0.2, dir: 0.6 };
  return f;
}

/** Ping-pong crest position 0..1 for a sweep of `periodS` seconds per pass, eased at each side (cosine = ease-in-out sine). */
export function sweepPos(timeS: number, periodS: number): number {
  if (periodS <= 0) return 0.2;
  return 0.5 - 0.5 * Math.cos((Math.PI * timeS) / periodS);
}

/** Crest velocity, normalised -1..1 (+ = moving right). */
export function sweepDir(timeS: number, periodS: number): number {
  if (periodS <= 0) return 0.6;
  return Math.sin((Math.PI * timeS) / periodS);
}

/** Speaking only (D51 5): a steady deep tongue in the centre (gently breathing), over the lobes that keep the sides
 * moving. 0..1 at u. */
export function centreTongue(u: number, t: number): number {
  const d = (u - 0.5) / 0.15;
  return Math.exp(-(d * d)) * (0.8 + 0.2 * Math.sin(TAU * 0.5 * t));
}

/** Lobe sum 0..~1.2 at u (each lobe = amplitude × own breathing). `rate` slows the breathing (listening is calmer). */
function lobes(u: number, t: number, rate: number): number {
  let sum = 0;
  for (const l of LOBES) {
    const c = l.c + 0.012 * Math.sin(0.17 * t + l.ph);
    const breath = 0.55 + 0.45 * Math.sin(TAU * l.f * rate * t + l.ph);
    const d = u - c;
    sum += l.a * breath * Math.exp(-(d * d) / (LOBE_SIGMA * LOBE_SIGMA));
  }
  return sum;
}

/** Thinking crest: an asymmetric hump (steeper leading edge) + a wide low swell, centred on the sweep position. */
export function crest(u: number, pos: number, dir: number): { hump: number; swell: number } {
  const d = u - pos;
  const lead = d * dir > 0;
  const side = lead ? 0.11 : 0.22;
  const sigma = 0.16 + (side - 0.16) * Math.min(1, Math.abs(dir));
  return { hump: Math.exp(-(d * d) / (sigma * sigma)), swell: Math.exp(-(d * d) / (0.36 * 0.36)) };
}

export interface Column { h: number; a: number }

/** Height (CSS px) and alpha (0..1, before `on`) of the glow column at u. */
export function columnAt(u: number, f: PresenceFrame, periodS: number, reach: number): Column {
  const k = reach / REF_REACH;
  const base = 40 * k;
  const { w } = f;
  const speak = (24 + 96 * f.voice) * k * (0.5 * lobes(u, f.t, 1) + 0.9 * centreTongue(u, f.t));
  const listen = (14 + 70 * f.micS) * k * lobes(u, f.t, 0.6);
  const pos = f.hold ? f.hold.pos : sweepPos(f.sweepT, periodS);
  const dir = f.hold ? f.hold.dir : sweepDir(f.sweepT, periodS);
  const c = crest(u, pos, dir);
  const think = (92 * c.hump + 20 * c.swell) * k;
  // Your turn (D50): the same lobes, low and very slow, so the glow invites without reacting to anything.
  const wait = 10 * k * lobes(u, f.t, 0.35);
  const lift = w.speaking * speak + w.listening * listen + w.thinking * think + w.waiting * wait;
  const h = base + lift;
  // Stronger where it rises (D49: "less white, more blue"): .6 at rest height, up to .9 at the crest.
  const a = Math.min(0.9, 0.6 + 0.3 * Math.min(1, lift / (110 * k)));
  return { h, a };
}

/** Vertical alpha profile inside a column (A6): 1 at the edge, .45 at 40%, 0 at the column height. */
export const COLUMN_STOPS: readonly [number, number][] = [[0, 1], [0.4, 0.45], [1, 0]];

/** The column's vertical profile at p = depth / height (0..1). */
export function columnProfile(p: number): number {
  let prev: readonly [number, number] = [0, 1];
  for (const stop of COLUMN_STOPS) {
    if (p <= stop[0]) {
      const span = stop[0] - prev[0];
      return span <= 0 ? stop[1] : prev[1] + (stop[1] - prev[1]) * ((p - prev[0]) / span);
    }
    prev = stop;
  }
  return 0;
}

/** Alpha of the glow at depth y (CSS px) for a column, including the text-safe mask
 * (fades to `maskStop` over `fade` px down to `safeY`, the first text line). */
export function glowAlphaAt(y: number, col: Column, on: number, safeY: number, fade: number, maskStop: number): number {
  if (y >= col.h) return 0;
  const p = y / col.h;
  const v = columnProfile(p);
  const m0 = safeY - fade;
  const mask = y <= m0 ? 1 : y >= safeY ? maskStop : 1 - (1 - maskStop) * ((y - m0) / fade);
  return v * col.a * on * mask;
}

/** Triangle wave 0..1..0 (palette position that drifts back and forth, never jumps). */
export function tri(x: number): number {
  return 1 - Math.abs((((x % 2) + 2) % 2) - 1);
}

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb, alpha?: number): string {
  const h = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}${alpha === undefined ? "" : h(alpha * 255)}`;
}

/** Colour of the palette (deep → soft) at u for the current drift. */
export function paletteAt(stops: readonly Rgb[], u: number, drift: number): Rgb {
  const n = stops.length - 1;
  if (n < 1) return stops[0] ?? [0, 0, 0];
  const x = tri(u * 0.95 + drift) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const k = x - i;
  const a = stops[i] ?? [0, 0, 0];
  const b = stops[i + 1] ?? a;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** True when nothing is left to draw (idle and fully faded out). */
export function isDark(f: PresenceFrame, target: PresenceState): boolean {
  return target === "idle" && f.on <= 0.001;
}
