/* 3-dot loader (v1 L5 / C4) and the connecting pill (G12, docs/motion.md 3.7 "Connecting pill").
 * - `variant="dots"`: grey dots wave while something is on its way; the label is for screen readers unless `showLabel`.
 * - `variant="pill"`: the dots + a visible label in a grey pill (`--control-h-lg`), the shape that replaces a button
 *   while it works (Start → "Connecting to Mike…", Save → "Saving…"). `role="status"` so the change is announced.
 * Static under reduced motion, paused while the user speaks (.motion-loop). Grey only, never blue. */
import s from "./Dots.module.css";

export interface DotsProps {
  label?: string;
  showLabel?: boolean;
  /** `dots` (default) inline loader · `pill` connecting / saving pill with a visible label. */
  variant?: "dots" | "pill";
  /** Pill only: the label carries the text shimmer ("One moment…"). */
  shimmer?: boolean;
  /** Pill only: stretch to the parent's width (narrow dock). */
  fullWidth?: boolean;
  className?: string;
}

export function Dots({ label, showLabel, variant = "dots", shimmer, fullWidth, className }: DotsProps) {
  const dots = <span className={`${s.dots} motion-loop`} aria-hidden="true"><i /><i /><i /></span>;
  if (variant === "pill") {
    return (
      <span
        className={`${s.pill} ${fullWidth ? s.full : ""} ${className ?? ""}`}
        role="status"
        data-review-id="Dots/pill"
      >
        {dots}
        {label ? <span className={`${s.pillLabel} ${shimmer ? "shimmer-text" : s.pillMuted}`}>{label}</span> : null}
      </span>
    );
  }
  return (
    <span className={`${s.wrap} ${className ?? ""}`} data-review-id="Dots/dots">
      {dots}
      {label ? <span className={showLabel ? s.label : "visually-hidden"}>{label}</span> : null}
    </span>
  );
}
