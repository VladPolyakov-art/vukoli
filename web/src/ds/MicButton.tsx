/* Live mic indicator (G10; docs/motion.md 3.7, moodboard Q1, session.md O4): the round mute button of the session
 * dock. D67: while the mic is open, a soft --color-mic-live glow inside the circle rises from the bottom with the real
 * voice level (opacity .35 + level × .65, lift and scale with it); no ring outside the face. A rAF loop reads
 * `getLevel` and writes the CSS variable --mic on the button — no React re-render per frame. `level` sets a static
 * value instead (review frames, stories). Muted: no glow, grey slashed mic icon, aria-pressed. Under reduced motion
 * the glow still follows the level (it is information), only without its transition. */
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { Icon } from "./icons";
import { smoothLevel } from "./motion";
import s from "./MicButton.module.css";

export interface MicButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name, e.g. "Mute" / "Unmute". */
  label: string;
  muted: boolean;
  /** The mic is open (session live, voice input). */
  live: boolean;
  /** Current level 0..1 (read every animation frame). */
  getLevel?: () => number;
  /** Static level 0..1 when there is no live source (review frames, stories). Ignored when `getLevel` is set. */
  level?: number;
}

export const MicButton = forwardRef<HTMLButtonElement, MicButtonProps>(function MicButton(
  { label, muted, live, getLevel, level: staticLevel, className, type, ...rest },
  ref,
) {
  const own = useRef<HTMLButtonElement | null>(null);
  const active = live && !muted;
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;
  const hasSource = Boolean(getLevel);

  useEffect(() => {
    const el = own.current;
    if (!el) return;
    if (!active) {
      el.style.setProperty("--mic", "0");
      return;
    }
    if (!hasSource) {
      el.style.setProperty("--mic", clamp01(staticLevel ?? 0).toFixed(3));
      return;
    }
    let raf = 0;
    let level = 0;
    const tick = () => {
      level = smoothLevel(level, getLevelRef.current?.() ?? 0);
      el.style.setProperty("--mic", level.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, staticLevel, hasSource]);

  return (
    <button
      ref={(el) => {
        own.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      type={type ?? "button"}
      className={`${s.mic} ${active ? s.live : ""} ${className ?? ""}`}
      data-review-id={`MicButton/${muted ? "muted" : active ? "live" : "idle"}`}
      aria-label={label}
      title={label}
      aria-pressed={muted}
      {...rest}
    >
      <span className={s.face}><Icon name={muted ? "micOff" : "mic"} /></span>
    </button>
  );
});

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}
