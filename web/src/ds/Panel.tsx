import type { ReactNode } from "react";
import { useScrollFocusable } from "./scrollFocus";
import s from "./Panel.module.css";

export interface PanelProps {
  title: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Landmark label: panels render as <aside> or <section>. */
  as?: "aside" | "section";
  labelId?: string;
  className?: string;
}

export function Panel({ title, actions, footer, children, as: Tag = "section", labelId, className }: PanelProps) {
  const bodyFocus = useScrollFocusable(typeof title === "string" ? title : "");
  return (
    <Tag className={`${s.panel} ${className ?? ""}`} aria-labelledby={labelId}>
      <header className={s.header}>
        <h2 className={s.title} id={labelId}>{title}</h2>
        {actions}
      </header>
      <div className={s.body} {...bodyFocus}>{children}</div>
      {footer ? <div className={s.footer}>{footer}</div> : null}
    </Tag>
  );
}
