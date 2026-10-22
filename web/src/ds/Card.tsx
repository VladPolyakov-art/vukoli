import { useId, useRef, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";
import { useRovingRadios } from "./roving";
import s from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "li";
  padding?: "sm" | "md" | "lg";
  tone?: "raised" | "subtle" | "flat";
  children?: ReactNode;
}

/** A surface that groups content. Radius `--radius-md` (10px, DS-1): cards and rows; composer and panels use 16px. */
export function Card({ as: Tag = "div", padding = "md", tone = "raised", className, children, ...rest }: CardProps) {
  const cls = [s.card, s[`pad-${padding}`], tone !== "raised" ? s[tone] : "", className ?? ""].filter(Boolean).join(" ");
  return <Tag className={cls} data-review-id={`Card/${tone}`} {...rest}>{children}</Tag>;
}

export interface SelectableCardProps extends Omit<HTMLAttributes<HTMLButtonElement>, "onSelect" | "role"> {
  selected?: boolean;
  padding?: "sm" | "md" | "lg";
  onSelect?: () => void;
  disabled?: boolean;
  /** `toggle` (default): `aria-pressed`. `radio`: one choice in a SelectableCardGroup, `role="radio"` + `aria-checked`. */
  role?: "toggle" | "radio";
  /** Draw the check icon in the top-end corner when selected (the non-colour cue). Default true;
   * pass false only when the content already shows its own check. */
  check?: boolean;
  children?: ReactNode;
}

/** A card that is one choice in a set (vacancy card, engine card, English level). Selected = 2px
 * `--color-border-selected` + check icon + aria state; never an action colour. */
export function SelectableCard({
  selected, padding = "md", onSelect, className, children, disabled, role = "toggle", check = true, ...rest
}: SelectableCardProps) {
  const cls = [s.card, s.interactive, s[`pad-${padding}`], selected ? s.selected : "", check ? s.withCheck : "", className ?? ""]
    .filter(Boolean).join(" ");
  const aria = role === "radio"
    ? { role: "radio" as const, "aria-checked": Boolean(selected) }
    : { "aria-pressed": selected };
  return (
    <button
      type="button"
      className={cls}
      onClick={onSelect}
      disabled={disabled}
      data-review-id={`SelectableCard/${role}`}
      {...rest}
      {...aria}
    >
      {children}
      {check && selected ? <span className={s.check} aria-hidden="true"><Icon name="check" size="sm" /></span> : null}
    </button>
  );
}

export interface SelectableCardGroupProps {
  /** Group name ("Your level"); visually hidden with `hideLabel` when the screen shows its own heading. */
  label: string;
  hideLabel?: boolean;
  /** Columns at full width. In narrow parents the grid drops to 2, then 1 column (container query on the group). */
  columns?: 1 | 2 | 3 | 4;
  /** Help text linked by aria-describedby ("Not sure? Pick B1 …"). */
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Radio group of SelectableCards (`role="radio"` children): one Tab stop, arrows move and select. */
export function SelectableCardGroup({ label, hideLabel, columns = 2, description, className, children }: SelectableCardGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const onKeyDown = useRovingRadios(ref, true);
  return (
    <div className={`${s.group} ${className ?? ""}`} data-review-id="SelectableCardGroup/radio">
      <span id={`${id}l`} className={hideLabel ? "visually-hidden" : s.groupLabel}>{label}</span>
      <div
        ref={ref}
        role="radiogroup"
        aria-labelledby={`${id}l`}
        aria-describedby={description ? `${id}d` : undefined}
        className={`${s.grid} ${s[`cols-${columns}`]}`}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
      {description ? <p id={`${id}d`} className={s.groupHint}>{description}</p> : null}
    </div>
  );
}
