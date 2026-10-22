/* Weak-spot strip (G18, US-22, GR8–GR10). One pattern, two contexts:
 * - `home`: "What to work on" on Home. Card `subtle`, monochrome layer Badges (Session-style, P5), rows
 *   badge · title · count. The first `visibleCount` rows show; "+ N more … Show all" reveals the rest with a short
 *   staggered rise (docs/motion.md §3.7 "Weak-spot Show all"). `footer` holds the Focus chips + Drill button.
 * - `debrief`: "What to work on" in Debrief. A `<ul>` grid of cards on the layer tint (--color-layer-*-tint, the
 *   only place tints appear), head = layer icon + name (never colour only, GR10), h3 title, evidence, fix, also.
 *   3 equal columns when the strip is wide, 1 column in a narrow parent (container query on the strip).
 * Order is the caller's: pass items already in the configured layer order (GR8). */
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./icons";
import { Skeleton } from "./Skeleton";
import s from "./WeakSpotStrip.module.css";

export type WeakSpotLayer = "content" | "language" | "delivery";

export interface WeakSpot {
  id: string;
  layer: WeakSpotLayer;
  /** Visible layer name ("Content"): the layer is always named in text. */
  layerLabel: string;
  title: ReactNode;
  /** Home: end-aligned count ("4 answers in 2 sessions"). */
  count?: ReactNode;
  /** Debrief: evidence row ("Questions 1, 2, 4" as links). */
  evidence?: ReactNode;
  /** Debrief: the fix line (caller renders the "Fix:" lead). */
  fix?: ReactNode;
  /** Debrief: secondary point under a hairline ("Also: “we” instead of “I” …"). */
  also?: ReactNode;
}

export interface WeakSpotStripProps {
  context: "home" | "debrief";
  items: WeakSpot[];
  /** Section title ("What to work on") and helper ("From your last 2 interviews"). */
  title?: ReactNode;
  sub?: ReactNode;
  headingLevel?: 2 | 3;
  /** Home: end of the header row ("Last session: Kestrel Pay · Oct 19" link). */
  headerAction?: ReactNode;
  /** Home: rows shown before "Show all" (default 2). */
  visibleCount?: number;
  /** Home: summary of the hidden rows ("+ 2 more: Language “I have led” · Delivery fillers"). */
  moreText?: ReactNode;
  showAllLabel?: string;
  showLessLabel?: string;
  /** Home: start expanded (stories, returning state). */
  defaultExpanded?: boolean;
  /** Below the rows (Home: Focus chips + Drill my weak spots). */
  footer?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  /** Shown instead of rows when `items` is empty. */
  empty?: ReactNode;
  className?: string;
}

export function WeakSpotStrip({
  context, items, title, sub, headingLevel = 2, headerAction, visibleCount = 2, moreText, showAllLabel, showLessLabel,
  defaultExpanded = false, footer, loading, loadingLabel, empty, className,
}: WeakSpotStripProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const H = headingLevel === 2 ? "h2" : "h3";
  const ItemH = headingLevel === 2 ? "h3" : "h4";
  const header = title || sub || headerAction ? (
    <div className={s.header}>
      <div className={s.heading}>
        {title ? <H id={`${id}t`} className={s.title}>{title}</H> : null}
        {sub ? <p className={s.sub}>{sub}</p> : null}
      </div>
      {headerAction ? <div className={s.headerAction}>{headerAction}</div> : null}
    </div>
  ) : null;

  let body: ReactNode;
  if (loading) {
    body = <Skeleton variant={context === "home" ? "row" : "card"} rows={2} label={loadingLabel} />;
  } else if (items.length === 0) {
    body = empty ? <div className={s.empty}>{empty}</div> : null;
  } else if (context === "home") {
    const hidden = items.length - visibleCount;
    const shown = expanded || hidden <= 0 ? items : items.slice(0, visibleCount);
    body = (
      <>
        <ul className={s.rows} id={`${id}r`}>
          {shown.map((it, i) => (
            <li
              key={it.id}
              className={`${s.row} ${i >= visibleCount ? s.rowIn : ""}`}
              style={i >= visibleCount ? ({ "--i": i - visibleCount } as CSSProperties) : undefined}
            >
              <Badge tone={it.layer} icon={it.layer}>{it.layerLabel}</Badge>
              <span className={s.rowTitle}>{it.title}</span>
              {it.count ? <span className={s.rowCount}>{it.count}</span> : null}
            </li>
          ))}
        </ul>
        {hidden > 0 && (showAllLabel || showLessLabel) ? (
          <div className={s.more}>
            {!expanded && moreText ? <span className={s.moreText}>{moreText}</span> : null}
            <Button
              variant="link"
              size="sm"
              data-track="weak-spots-toggle"
              aria-expanded={expanded}
              aria-controls={`${id}r`}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? showLessLabel ?? showAllLabel : showAllLabel}
            </Button>
          </div>
        ) : null}
      </>
    );
  } else {
    body = (
      <ul className={s.grid}>
        {items.map((it) => (
          <li key={it.id} className={s.card}>
            <span className={s.cardHead}>
              <Icon name={it.layer} size="sm" />
              {it.layerLabel}
            </span>
            <ItemH className={s.cardTitle}>{it.title}</ItemH>
            {it.evidence ? <div className={s.cardLine}>{it.evidence}</div> : null}
            {it.fix ? <div className={s.cardFix}>{it.fix}</div> : null}
            {it.also ? <div className={s.cardAlso}>{it.also}</div> : null}
          </li>
        ))}
      </ul>
    );
  }

  const labelled = title ? { "aria-labelledby": `${id}t` } : {};
  if (context === "home") {
    return (
      <Card as="section" tone="subtle" padding="md" className={`${s.root} ${s.home} ${className ?? ""}`} {...labelled}>
        <div className={s.stack} data-review-id="WeakSpotStrip/home" aria-busy={loading || undefined}>
          {header}
          {body}
          {footer && !loading ? <div className={s.footer}>{footer}</div> : null}
        </div>
      </Card>
    );
  }
  return (
    <section className={`${s.root} ${s.stack} ${className ?? ""}`} data-review-id="WeakSpotStrip/debrief" aria-busy={loading || undefined} {...labelled}>
      {header}
      {body}
      {footer && !loading ? <div className={s.footer}>{footer}</div> : null}
    </section>
  );
}
