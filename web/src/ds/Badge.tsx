import { useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { useRovingRadios } from "./roving";
import s from "./Badge.module.css";

export type BadgeTone = "neutral" | "live" | "success" | "warning" | "error" | "outline" | "content" | "language" | "delivery";

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  dot?: boolean;
  /** Layer tones only: soft tint background. Debrief only (Session layers are monochrome). */
  tinted?: boolean;
  children: ReactNode;
  title?: string;
}

/** Static status label. Tone is never the only signal: always pair it with text. */
export function Badge({ tone = "neutral", icon, dot, tinted, children, title }: BadgeProps) {
  return (
    <span className={`${s.badge} ${s[tone]}${tinted ? ` ${s.tinted}` : ""}`} title={title} data-review-id={`Badge/${tone}${tinted ? "-tinted" : ""}`}>
      {dot ? <span className={s.dot} aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> {
  icon?: IconName;
  selected?: boolean;
  /** `toggle` (default): independent on / off, `aria-pressed`. `radio`: one choice in a ChipGroup, `role="radio"` + `aria-checked`. */
  role?: "toggle" | "radio";
  /** Optional count after the label ("Content 2"); part of the accessible name. */
  count?: number | string;
}

/** Toggleable or actionable pill (preset picker, filter, single-choice picker). Selected = inverted fill
 * (`--color-checked`) + aria state, never an action colour. */
export function Chip({ icon, selected, role = "toggle", count, children, className, ...rest }: ChipProps) {
  const aria = role === "radio"
    ? { role: "radio" as const, "aria-checked": Boolean(selected) }
    : { "aria-pressed": selected };
  return (
    <button
      type="button"
      className={`${s.chip} ${className ?? ""}`}
      data-review-id={`Chip/${role}`}
      {...rest}
      {...aria}
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
      {count !== undefined ? <span className={s.count}>{count}</span> : null}
    </button>
  );
}

export interface ChipGroupProps {
  /** Group name for assistive tech ("Round type"); shown when `hideLabel` is false. */
  label: string;
  hideLabel?: boolean;
  /** `radio`: single choice (radiogroup, roving focus, arrows select). `toggle`: independent chips (group). */
  role?: "toggle" | "radio";
  /** Centre the row (Home round type). */
  align?: "start" | "center";
  className?: string;
  children: ReactNode;
}

/** A row of chips that wraps (never scrolls sideways). For `role="radio"` the group owns the Tab stop. */
export function ChipGroup({ label, hideLabel, role = "toggle", align = "start", className, children }: ChipGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const onKeyDown = useRovingRadios(ref, role === "radio");
  return (
    <div className={`${s.group} ${className ?? ""}`} data-review-id={`ChipGroup/${role}`}>
      <span id={id} className={hideLabel ? "visually-hidden" : s.groupLabel}>{label}</span>
      <div
        ref={ref}
        role={role === "radio" ? "radiogroup" : "group"}
        aria-labelledby={id}
        className={`${s.groupRow} ${align === "center" ? s.center : ""}`}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
