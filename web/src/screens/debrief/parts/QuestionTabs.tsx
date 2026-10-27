/* The question switcher (layout D, 2026-10-27; owner: "what if there are more than 10 questions"). A sticky tab bar at the
 * top of <main>: one row, always. The server caps a session at 10 (`questions_per_session` 1–10); the bar is designed for
 * 10 and degrades past it:
 *  1. labels (number + the question's text, clamped to 2 lines) while every tab gets at least `--tab-min` (8rem) of the bar;
 *  2. otherwise numbers only, ‹ › at the bar's ends (the text stays the tab's name for screen readers);
 *  3. when the numbers do not fit either, the strip scrolls sideways with a fade on the side that has more, and the
 *     selected tab is always scrolled into view.
 * ←/→/Home/End move between tabs (roving tabindex, `nextIndex`). DS candidate: Tabs with an overflow rule (ds/components.md). */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { IconButton, scrollBehavior } from "../../../ds";
import { cssPx } from "../../../ds/overlay";
import { nextIndex } from "../../../ds/roving";
import { t } from "../../../i18n";
import type { QuestionModel } from "../types";
import s from "./questionTabs.module.css";

function useSwitcherLayout(count: number) {
  const bar = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [fade, setFade] = useState({ start: false, end: false });
  const updateFade = () => {
    const el = list.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((f) => (f.start === start && f.end === end ? f : { start, end }));
  };
  useLayoutEffect(() => {
    const b = bar.current;
    if (!b) return;
    const measure = () => {
      const min = cssPx(b, "--tab-min", 128);
      setCompact(b.clientWidth / count < min);
      updateFade();
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(b);
    return () => ro?.disconnect();
  }, [count]);
  useLayoutEffect(updateFade, [compact]);
  return { bar, list, compact, fade, updateFade };
}

export interface QuestionTabsProps {
  questions: QuestionModel[];
  /** Index of the selected question. */
  index: number;
  /** Prefix of the tab and panel ids (`${base}-tab-${n}`, `${base}-panel`). */
  base: string;
  onSelect: (n: number) => void;
}

export function QuestionTabs({ questions: qs, index, base, onSelect }: QuestionTabsProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { bar, list, compact, fade, updateFade } = useSwitcherLayout(qs.length);

  // Keep the selected tab in view inside a scrolling strip (sideways only: the page never jumps).
  useLayoutEffect(() => {
    const el = list.current;
    const tab = tabs.current[index];
    if (!el || !tab || el.scrollWidth <= el.clientWidth) return;
    const pad = cssPx(el, "--space-10", 40);
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    let to = el.scrollLeft;
    if (left - pad < el.scrollLeft) to = left - pad;
    else if (right + pad > el.scrollLeft + el.clientWidth) to = right + pad - el.clientWidth;
    if (to !== el.scrollLeft) el.scrollTo({ left: Math.max(0, to), behavior: scrollBehavior() });
  }, [index, compact, list]);

  const prev = qs[index - 1];
  const next = qs[index + 1];
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = nextIndex(e.key, i, qs.length);
    if (n < 0) return;
    e.preventDefault();
    const q = qs[n];
    if (!q) return;
    onSelect(q.n);
    tabs.current[n]?.focus({ preventScroll: true });
  };
  const fadeClass = fade.start && fade.end ? s.fadeBoth : fade.start ? s.fadeStart : fade.end ? s.fadeEnd : "";
  return (
    <div ref={bar} className={`${s.bar} ${compact ? s.barCompact : ""}`} data-review-id="Debrief/QuestionTabs">
      {compact ? (
        <IconButton icon="chevronLeft" size="sm" label={t("debrief.tabs.prev")} disabled={!prev} onClick={() => prev && onSelect(prev.n)} className={s.step} />
      ) : null}
      <div ref={list} role="tablist" aria-label={t("debrief.tabs.label")} className={`${s.tabs} ${compact ? s.tabsCompact : ""} ${fadeClass}`} onScroll={updateFade}>
        {qs.map((q, i) => (
          <button
            key={q.n}
            ref={(el) => { tabs.current[i] = el; }}
            type="button"
            role="tab"
            id={`${base}-tab-${q.n}`}
            aria-selected={i === index}
            aria-controls={`${base}-panel`}
            tabIndex={i === index ? 0 : -1}
            className={s.tab}
            data-track="debrief-question-tab"
            onClick={() => onSelect(q.n)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className={s.num}>{q.n}</span>
            <span className={s.text}>{q.question}</span>
          </button>
        ))}
      </div>
      {compact ? (
        <IconButton icon="chevronRight" size="sm" label={t("debrief.tabs.next")} disabled={!next} onClick={() => next && onSelect(next.n)} className={s.step} />
      ) : null}
    </div>
  );
}
