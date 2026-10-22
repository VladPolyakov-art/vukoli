import { useId, type ReactNode } from "react";
import s from "./Toggle.module.css";

export interface ToggleProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Hide the visible label (still announced). */
  hideLabel?: boolean;
  /** User-test label on the switch (`data-track`, kebab-case, never user data). */
  track?: string;
}

/** On/off switch (role="switch"). The visible label is clickable; state is announced, not only coloured. */
export function Toggle({ label, description, checked, onChange, disabled, hideLabel, track }: ToggleProps) {
  const id = useId();
  return (
    <div className={s.row}>
      <div className={hideLabel ? "visually-hidden" : s.text}>
        <label htmlFor={id} className={s.label}>{label}</label>
        {description ? <span id={`${id}-d`} className={s.desc}>{description}</span> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        className={s.switch}
        data-track={track}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
