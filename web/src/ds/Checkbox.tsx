/* Checkbox (G7) and checkbox chip (briefing, motion.md 3.2 P8 adapted). A native <input type="checkbox">
 * (keyboard, form and assistive tech for free) under a drawn box. Checked = --color-checked fill (black / white,
 * a selection, never blue or an action colour) + the check icon scaling in. 44px row on coarse pointers.
 * - `variant="box"`: box + label + optional description (SetupProfile "untick stories").
 * - `variant="chip"`: a pill that inverts when checked, with the check icon (multi-select chips). */
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";
import s from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: ReactNode;
  description?: ReactNode;
  variant?: "box" | "chip";
  /** Mixed state (a parent of partly ticked items). */
  indeterminate?: boolean;
  /** Error under the control (role="alert"), e.g. "Keep at least one story." */
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, variant = "box", indeterminate, error, className, id, disabled, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const own = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => own.current as HTMLInputElement);
  useEffect(() => {
    if (own.current) own.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const describedBy = [description ? `${inputId}-d` : "", error ? `${inputId}-e` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`${s.root} ${variant === "chip" ? s.chip : s.boxed} ${className ?? ""}`} data-review-id={`Checkbox/${variant}`}>
      <label className={`${s.row} ${disabled ? s.disabled : ""}`} htmlFor={inputId}>
        <input
          ref={own}
          id={inputId}
          type="checkbox"
          className={s.input}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        <span className={s.box} aria-hidden="true">
          <span className={s.check}><Icon name="check" size="sm" /></span>
          <span className={s.dash} />
        </span>
        <span className={s.text}>
          <span className={s.label}>{label}</span>
          {description && variant === "box" ? <span id={`${inputId}-d`} className={s.description}>{description}</span> : null}
        </span>
      </label>
      {error ? <p id={`${inputId}-e`} className={s.error} role="alert"><Icon name="alert" size="sm" />{error}</p> : null}
    </div>
  );
});
