/* Select (D78): our own dropdown instead of the native <select>, so it looks the same on macOS, Windows and Linux.
 * A button with the current value and a chevron opens a listbox popup (Menu kind "listbox"): ↑ ↓ Home End move,
 * Enter / Space choose, Esc closes and returns focus. The popup is at least as wide as the button and grows to the
 * longest option; on a narrow screen it is a sheet under the button. `width="content"` sizes the button to its text
 * (setting rows), the default fills the field (forms). */
import { useId } from "react";
import { describedBy, FieldShell, type Common } from "./Field";
import { Icon } from "./icons";
import { Menu, type MenuProps } from "./Menu";
import f from "./Field.module.css";
import s from "./Select.module.css";

export interface SelectOption { value: string; label: string; description?: string; disabled?: boolean }

export interface SelectProps extends Common {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Shown while no option matches `value`. */
  placeholder?: string;
  /** `fill` (default): as wide as the field. `content`: as wide as the current value. */
  width?: "fill" | "content";
  placement?: MenuProps["placement"];
  /** Stories and the review gallery: the popup open in the flow. */
  inline?: boolean;
  defaultOpen?: boolean;
  className?: string;
  /** User-test label (`data-track`, kebab-case, never user data). The button gets it as is, each option as `<track>-<value>`. */
  track?: string;
}

export function Select({
  label, hideLabel, hint, error, optionalText, id: idProp, options, value, onChange, disabled, placeholder,
  width = "fill", placement, inline, defaultOpen, className, track,
}: SelectProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const current = options.find((o) => o.value === value);
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} hint={hint} error={error} optionalText={optionalText}>
      <Menu
        kind="listbox"
        label={label}
        options={options.map((o) => ({
          id: o.value, label: o.label, description: o.description, disabled: o.disabled,
          track: track ? `${track}-${o.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : undefined,
        }))}
        value={current ? value : null}
        onChange={(v) => { if (v !== value) onChange(v); }}
        matchWidth="min"
        fit
        placement={placement ?? (width === "content" ? "bottom-end" : "bottom-start")}
        inline={inline}
        defaultOpen={defaultOpen}
        className={width === "content" ? s.wrapContent : s.wrapFill}
        trigger={(p) => (
          <button
            {...p}
            id={id}
            type="button"
            disabled={disabled}
            data-track={track}
            className={`${f.control} ${s.trigger} ${className ?? ""}`}
            aria-labelledby={`${id}-label ${id}-value`}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, hint, error)}
          >
            <span id={`${id}-value`} className={current ? s.value : `${s.value} ${s.placeholder}`}>{current?.label ?? placeholder ?? ""}</span>
            <span className={s.chev} aria-hidden="true"><Icon name="chevronDown" size="sm" /></span>
          </button>
        )}
      />
    </FieldShell>
  );
}
