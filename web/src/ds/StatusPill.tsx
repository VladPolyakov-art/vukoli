/* Status pill (G11, docs/motion.md 3.2 P6/P7 + 3.7): the one state text above the island (session.md O5, V2.1).
 * It is the live region for Mike's state (Presence is aria-hidden) (role="status", polite): colour never tells Mike's states apart (P6).
 * - Dot: always --color-mic-live (D93: the dot stays blue in every state); the label tells the states apart.
 *   It pulses (`pulse-dot`, .motion-loop) while thinking / connecting, and is still otherwise (rule 3: nothing pulses
 *   while the user speaks). Muted shows the slashed mic icon instead of a dot.
 * - Label cross-fades (fast) on change, except into Listening (the user has just started talking).
 * - `sub`: one static line under the pill ("Take your time. Mike waits for 5 s of quiet."). `subFadeMs`: a hint that
 *   has been read fades and folds away after that long (D91), so the dock gives its line back to the transcript; a new
 *   state or hint brings it back.
 * - `surface="glass"` (D93, the Session over the glow): a see-through pill, the glow shows through it. */
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import s from "./StatusPill.module.css";

export type StatusPillState =
  | "connecting" | "speaking" | "your-turn" | "listening" | "thinking" | "between" | "muted" | "offline" | "paused";

export interface StatusPillProps {
  state: StatusPillState;
  /** Visible label from the locale file ("Listening", "Mike is speaking"). */
  label: string;
  /** The user's mic is open (voice input, not muted); marks the review id (the dot is blue in every state, D93). */
  live?: boolean;
  /** Static sub line under the pill. */
  sub?: ReactNode;
  /** Fold the sub line away after this long (a hint, not a state). */
  subFadeMs?: number;
  /** "glass": a see-through fill, for a busy background (default "pill"). */
  surface?: "pill" | "glass";
  /** Be the polite live region (default true). Turn off when another element already announces the state. */
  announce?: boolean;
  className?: string;
}

const PULSE = new Set<StatusPillState>(["connecting", "thinking"]);

export function StatusPill({ state, label, live, sub, subFadeMs, surface = "pill", announce = true, className }: StatusPillProps) {
  const subKey = `${state}:${typeof sub === "string" ? sub : ""}`;
  const [faded, setFaded] = useState<string | null>(null);
  useEffect(() => {
    if (!subFadeMs || !sub) return;
    const id = window.setTimeout(() => setFaded(subKey), subFadeMs);
    return () => window.clearTimeout(id);
  }, [subKey, subFadeMs, sub]);
  const dotTone = PULSE.has(state) ? `${s.dotLive} ${s.dotPulse} motion-loop` : s.dotLive;
  return (
    <div className={`${s.root} ${className ?? ""}`} data-review-id={`StatusPill/${state}${live ? "-live" : ""}`}>
      <span className={`${s.pill} ${surface === "glass" ? s.glass : ""}`} role={announce ? "status" : undefined} aria-live={announce ? "polite" : undefined}>
        {state === "muted"
          ? <span className={s.icon} aria-hidden="true"><Icon name="micOff" size="sm" /></span>
          : <span className={`${s.dot} ${dotTone}`} aria-hidden="true" />}
        <span key={`${state}:${label}`} className={state === "listening" ? s.label : `${s.label} ${s.labelIn}`}>{label}</span>
      </span>
      {sub ? (
        <div className={`${s.subWrap} ${faded === subKey ? s.subGone : ""}`} aria-hidden={faded === subKey || undefined}>
          <p className={s.sub}>{sub}</p>
        </div>
      ) : null}
    </div>
  );
}
