/* ScrollStrip (tough-talk map §9): a horizontal strip of cards (the tactics on a plan card). A list with scroll-snap,
 * chevron buttons at the ends (disabled when there is nothing more that way), a "1–2 of 9" counter (aria-live polite)
 * and a fade on the side that has more. The strip itself takes focus (tabindex 0) so the arrow keys scroll it.
 * Children are the items: pass elements that render `li` (TacticCard `as="li"`). Width of one item: `--strip-item`
 * (default 4.5 x --space-16; a caller may set it on the strip's className). Reduced motion: jumps instead of gliding. */
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../i18n";
import { IconButton } from "./Button";
import { scrollBehavior } from "./motion";
import s from "./ScrollStrip.module.css";

export interface ScrollStripProps {
  /** Heading of the row and accessible name of the list ("Tactics for this call"). */
  label: string;
  /** After the chevrons in the header row (the plan card puts "Hide tactics" here). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ScrollStrip({ label, actions, children, className }: ScrollStripProps) {
  const list = useRef<HTMLUListElement>(null);
  const total = Children.count(children);
  const [view, setView] = useState({ start: false, end: false, first: 1, last: Math.min(total, 1) });

  const measure = useCallback(() => {
    const el = list.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    const box = el.getBoundingClientRect();
    let first = 0;
    let last = 0;
    Array.from(el.children).forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const visible = Math.min(r.right, box.right) - Math.max(r.left, box.left);
      if (visible >= r.width * 0.5) {
        if (!first) first = i + 1;
        last = i + 1;
      }
    });
    setView((v) => (v.start === start && v.end === end && v.first === first && v.last === last ? v : { start, end, first, last }));
  }, []);

  useEffect(() => {
    measure();
    const el = list.current;
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    return () => ro?.disconnect();
  }, [measure, total]);

  const step = (dir: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: scrollBehavior() });
  };

  const fade = view.start && view.end ? s.fadeBoth : view.start ? s.fadeStart : view.end ? s.fadeEnd : "";
  const counter = view.first === view.last
    ? t("strip.one", { n: view.first, total })
    : t("strip.range", { from: view.first, to: view.last, total });

  return (
    <div className={[s.root, className ?? ""].filter(Boolean).join(" ")}>
      <div className={s.head}>
        <span className={s.label}>{label}</span>
        <span className={s.counter} aria-live="polite">{counter}</span>
        <IconButton icon="chevronLeft" size="sm" label={t("strip.prev")} disabled={!view.start} onClick={() => step(-1)} />
        <IconButton icon="chevronRight" size="sm" label={t("strip.next")} disabled={!view.end} onClick={() => step(1)} />
        {actions}
      </div>
      <ul ref={list} className={[s.list, fade].filter(Boolean).join(" ")} aria-label={label} tabIndex={0} onScroll={measure}>
        {children}
      </ul>
    </div>
  );
}
