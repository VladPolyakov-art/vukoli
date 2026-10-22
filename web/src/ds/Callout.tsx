import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import s from "./Callout.module.css";

export interface CalloutProps {
  tone?: "info" | "success" | "warning" | "error";
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  /** "alert" for errors that appear in response to an action; "status" for passive notices. */
  live?: "alert" | "status";
}

const defaultIcon: Record<NonNullable<CalloutProps["tone"]>, IconName> = {
  info: "info",
  success: "check",
  warning: "alert",
  error: "alert",
};

export function Callout({ tone = "info", title, children, actions, icon, live }: CalloutProps) {
  return (
    <div className={`${s.callout} ${s[tone]}`} role={live}>
      <span className={s.icon}><Icon name={icon ?? defaultIcon[tone]} size="md" /></span>
      <div className={s.body}>
        {title ? <div className={s.title}>{title}</div> : null}
        {children ? <div>{children}</div> : null}
        {actions ? <div className={s.actions}>{actions}</div> : null}
      </div>
    </div>
  );
}
