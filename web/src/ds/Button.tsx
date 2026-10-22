import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import s from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

/** One primary button per view (Start). Loading keeps the label and disables the button. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconRight, loading, fullWidth, className, children, disabled, type, ...rest },
  ref,
) {
  const cls = [s.button, s[variant], size !== "md" ? s[size] : "", fullWidth ? s.full : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type ?? "button"} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={`${s.spin} motion-loop`} aria-hidden /> : icon ? <Icon name={icon} size="sm" /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size="sm" /> : null}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Required: the accessible name (also shown as a tooltip). */
  label: string;
  size?: "sm" | "md";
  outlined?: boolean;
  pressed?: boolean;
  /** Something new behind the button (13, QA-01): a small mark on the icon's corner. Monochrome, no animation. The
   * caller says it in `label` too: the dot is decoration (aria-hidden). */
  dot?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = "md", outlined, pressed, dot, className, type, ...rest },
  ref,
) {
  const cls = [s.iconButton, size === "sm" ? s.sm : "", outlined ? s.outlined : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type ?? "button"} className={cls} aria-label={label} title={label} aria-pressed={pressed} {...rest}>
      <Icon name={icon} size={size === "sm" ? "sm" : "md"} />
      {dot ? <span className={s.iconDot} aria-hidden="true" /> : null}
    </button>
  );
});
