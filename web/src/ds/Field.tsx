import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "./icons";
import s from "./Field.module.css";

interface FieldShellProps {
  id: string;
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  optionalText?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Label + control + hint/error, wired with aria-describedby by the caller via ids. The label's id is `<id>-label`. */
export function FieldShell({ id, label, hideLabel, hint, error, optionalText, children, footer }: FieldShellProps) {
  return (
    <div className={s.field}>
      <label id={`${id}-label`} htmlFor={id} className={hideLabel ? "visually-hidden" : s.label}>
        {label}
        {optionalText ? <span className={s.optional}> · {optionalText}</span> : null}
      </label>
      {children}
      {hint && !error ? <div id={`${id}-hint`} className={s.hint}>{hint}</div> : null}
      {error ? (
        <div id={`${id}-error`} className={s.error} role="alert">
          <Icon name="alert" size="sm" />
          <span>{error}</span>
        </div>
      ) : null}
      {footer}
    </div>
  );
}

export function describedBy(id: string, hint: ReactNode, error: ReactNode) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export type Common = { label: string; hideLabel?: boolean; hint?: ReactNode; error?: ReactNode; optionalText?: string };

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, Common {
  /** Element rendered inside the right edge of the field (e.g. show/hide key). */
  adornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, optionalText, adornment, id: idProp, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const input = (
    <input
      ref={ref}
      id={id}
      className={`${s.control} ${className ?? ""}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...rest}
    />
  );
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} hint={hint} error={error} optionalText={optionalText}>
      {adornment ? <div className={s.inputWrap}>{input}<span className={s.adorn}>{adornment}</span></div> : input}
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, Common {
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel, hint, error, optionalText, id: idProp, className, showCount, value, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const count = typeof value === "string" ? value.length : 0;
  return (
    <FieldShell
      id={id}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      optionalText={optionalText}
      footer={showCount ? <div className={s.counter} aria-hidden="true">{count.toLocaleString("en-US")}</div> : null}
    >
      <textarea
        ref={ref}
        id={id}
        value={value}
        className={`${s.control} ${s.textarea} ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
});
