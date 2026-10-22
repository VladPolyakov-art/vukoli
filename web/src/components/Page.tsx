/* Page (pattern, components.md §5): the content column inside AppShell's <main> (container `page`).
 * Widths of the page container: wide ≥ 840 · medium 560–839 · narrow < 560 (docs/frontend.md). Rhythm: header and
 * blocks `--space-10` apart (narrow `--space-8`), groups `--space-4`, rows `--space-2`.
 * `layout="start"`: the Home start column — centred header, `--layout-narrow` column. `narrow`: a narrow column with
 * the normal header (Settings-like pages). */
import type { ReactNode } from "react";
import s from "./Page.module.css";

export interface PageProps {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  /** `page` (default): header row with actions; `start`: centred header, narrow column (Home). */
  layout?: "page" | "start";
  narrow?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Page({ title, sub, actions, layout = "page", narrow, className, children }: PageProps) {
  const start = layout === "start";
  return (
    <div
      className={[s.page, narrow || start ? s.narrow : "", start ? s.start : "", className ?? ""].filter(Boolean).join(" ")}
      data-review-id={`Page/${layout}`}
    >
      <div className={s.headerRow}>
        <div className={s.header}>
          <h1 className={s.title}>{title}</h1>
          {sub ? <p className={s.sub}>{sub}</p> : null}
        </div>
        {actions ? <div className={s.row}>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, id, children, action }: { title: ReactNode; id?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <div className={`${s.row} ${s.sectionHead}`}>
        <h2 id={id} className={s.sectionTitle}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const pageStyles = s;
