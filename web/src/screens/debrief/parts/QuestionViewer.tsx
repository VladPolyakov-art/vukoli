/* The question viewer (layout D, 2026-10-27): the sticky switcher, ONE question at a time, and "Previous / Next: question n"
 * at the foot. Switching by the tabs, ←/→ or the footer keeps the reader's place (when the viewer's top is already
 * scrolled past, it comes back to the top, under the sticky bar); the links from the plan and the skills card scroll the
 * viewer into view and move focus to the question's heading (done by DebriefView, which owns the section ref). */
import type { RefObject } from "react";
import { Button, Swap, scrollBehavior } from "../../../ds";
import { t } from "../../../i18n";
import type { QuestionModel } from "../types";
import { questionHeadingId } from "./debriefShared";
import { QuestionTabs } from "./QuestionTabs";
import { QuestionView, type QuestionViewProps } from "./QuestionView";
import s from "./questionViewer.module.css";

export interface QuestionViewerProps {
  questions: QuestionModel[];
  /** The question shown (a number from `questions`). */
  current: number;
  /** Switch by the tabs, ←/→ or Previous / Next. */
  onSelect: (n: number) => void;
  uid: string;
  id: string;
  sectionRef: RefObject<HTMLElement | null>;
  /** Everything a question needs except the question itself. */
  view: Omit<QuestionViewProps, "q" | "index" | "total" | "headingId" | "uid">;
}

export function QuestionViewer({ questions: qs, current, onSelect, uid, id, sectionRef, view }: QuestionViewerProps) {
  const index = Math.max(0, qs.findIndex((q) => q.n === current));
  const q = qs[index];
  if (!q) return null;
  const base = `${uid}-qv`;
  const prev = qs[index - 1];
  const next = qs[index + 1];
  const many = qs.length > 1;

  /** Switch, keeping the reader's place. */
  const select = (n: number) => {
    onSelect(n);
    window.requestAnimationFrame(() => {
      const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) sectionRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  };

  return (
    <section ref={sectionRef} className={s.viewer} aria-labelledby={id} data-review-id="Debrief/Questions" data-review-section="Debrief · Question by question" data-comment-target="">
      <h2 id={id} className="visually-hidden">{t("debrief.qSection")}</h2>
      {many ? <QuestionTabs questions={qs} index={index} base={base} onSelect={select} /> : null}
      <div role={many ? "tabpanel" : undefined} id={`${base}-panel`} aria-labelledby={many ? `${base}-tab-${q.n}` : undefined} className={s.panel}>
        <Swap swapKey={String(q.n)} focusTarget={() => document.getElementById(questionHeadingId(uid, q.n))}>
          <QuestionView {...view} q={q} index={index} total={qs.length} uid={uid} headingId={questionHeadingId(uid, q.n)} />
        </Swap>
        {many ? (
          <div className={s.nav}>
            <Button variant="ghost" icon="chevronLeft" data-track="debrief-question-prev" disabled={!prev} onClick={() => prev && select(prev.n)}>{t("debrief.q.prev")}</Button>
            <Button variant="secondary" iconRight="chevronRight" data-track="debrief-question-next" disabled={!next} onClick={() => next && select(next.n)}>
              {next ? t("debrief.q.next", { n: next.n }) : t("debrief.q.last")}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
