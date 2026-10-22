/* Skeleton ("ghost loading", docs/motion.md 3.5): grey bars with a sweep, bars staggered 120ms.
 * Variants: lines (n bars), card (the feedback-card shape: title bar + lines), row (list row: circle + 2 bars).
 * The container is aria-busy with a visually hidden label; under reduced motion the bars are flat grey,
 * and while the user speaks the sweep pauses (.motion-loop, rule 3). */
import type { CSSProperties } from "react";
import { t } from "../i18n";
import s from "./Skeleton.module.css";

export interface SkeletonProps {
  variant?: "lines" | "card" | "row";
  /** Bars in `lines` / body bars in `card`. */
  lines?: number;
  /** Rows in `row`. */
  rows?: number;
  /** Announced text (default "Loading…"). */
  label?: string;
  className?: string;
}

const LINE_WIDTHS = ["100%", "86%", "62%"];
const CARD_WIDTHS = ["88%", "58%", "74%"];

function widthAt(list: string[], i: number, last: boolean) {
  return last ? list[list.length - 1]! : list[i % list.length]!;
}

export function Skeleton({ variant = "lines", lines = 3, rows = 3, label, className }: SkeletonProps) {
  let index = 0;
  const bar = (width: string, extra = "") => (
    <span key={index} className={`${s.bar} ${extra}`} style={{ "--bar-w": width, "--bar-i": index++ } as CSSProperties} />
  );
  let body;
  if (variant === "row") {
    body = Array.from({ length: rows }, (_, r) => (
      <span key={`r${r}`} className={s.row}>
        <span className={s.circle} style={{ "--bar-i": index++ } as CSSProperties} />
        <span className={s.rowBars}>{bar("42%", s.strong)}{bar("72%")}</span>
      </span>
    ));
  } else if (variant === "card") {
    body = (
      <span className={s.card}>
        {bar("32%", s.strong)}
        {Array.from({ length: lines }, (_, i) => bar(widthAt(CARD_WIDTHS, i, i === lines - 1 && lines > 1)))}
      </span>
    );
  } else {
    body = Array.from({ length: lines }, (_, i) => bar(widthAt(LINE_WIDTHS, i, i === lines - 1 && lines > 1)));
  }
  return (
    <div className={`${s.skeleton} ${s[`${variant}Wrap`] ?? ""} motion-loop ${className ?? ""}`} aria-busy="true">
      <span className="visually-hidden">{label ?? t("common.loading")}</span>
      {body}
    </div>
  );
}
