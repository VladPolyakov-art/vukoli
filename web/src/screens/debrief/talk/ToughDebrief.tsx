/* Tough questions debrief (ds/screens/tough-talk.md §6): Summary · Questions, one question at a time (tabs, ←/→,
 * Previous / Next, `?q=n`). Code signals have no quote; a model signal wears "May be wrong". A failed after-call check
 * leaves the answer shape and a quiet note, never a made-up verdict. Personal questions get the lawful-note callout. */
import { useId, useRef } from "react";
import { Badge, Button, Callout, Swap, TacticCard, scrollBehavior } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { ToughDebrief as Debrief, ToughDebriefQuestion } from "../../../lib/types";
import { Frame } from "../parts/Frame";
import { QuestionTabs } from "../parts/QuestionTabs";
import type { QuestionModel, ToughTalkDebriefProps } from "../types";
import { conversationTurns, hurtItems, themeName, toughMeta, toughSummary, toughTitle, type TalkContent } from "./model";
import { TalkPage } from "./TalkPage";
import s from "./talk.module.css";

const stub = (q: ToughDebriefQuestion): QuestionModel => ({ n: q.n, question: q.question, summary: {}, followUps: 0, answer: [], layers: {} });

function QuestionBody({ q, total, content, headingId }: { q: ToughDebriefQuestion; total: number; content?: TalkContent; headingId: string }) {
  const hurt = hurtItems(q);
  const cards = q.card_ids.flatMap((id) => (content?.cards[id] ? [content.cards[id]] : []));
  const answer = q.answers.map((a) => a.text).join(" ");
  return (
    <div className={s.block} data-review-id="Debrief/Tough/Question">
      <p className={s.questionMeta}>
        {t("debrief.tough.q.meta", { n: q.n, total, theme: themeName(content, q.theme), pushes: tp("debrief.tough.q.pushes", q.pushes.length) })}
      </p>
      <h3 id={headingId} className={s.questionText} tabIndex={-1}>{q.question}</h3>
      {q.pushes.length ? (
        <div className={s.block}>
          <h4 className={s.blockTitle}>{t("debrief.tough.q.pushed")}</h4>
          <ul className={s.list}>{q.pushes.map((p, i) => <li key={i} className={s.said}>{"“"}{p.text}{"”"}</li>)}</ul>
        </div>
      ) : null}
      <div className={s.block}>
        <h4 className={s.blockTitle}>{t("debrief.tough.q.answer")}</h4>
        <p className={s.body}>{answer}</p>
      </div>
      {q.model_checked || hurt.length ? (
        <div className={s.block}>
          <h4 className={s.blockTitle}>{t("debrief.tough.q.hurt")}</h4>
          {hurt.length ? (
            <ul className={s.list}>
              {hurt.map((h) => (
                <li key={h.id} className={s.item}>
                  <div className={s.itemHead}>
                    <span className={s.itemTitle}>{h.label}</span>
                    {h.mayBeWrong ? <Badge tone="outline">{t("debrief.talk.mayBeWrong")}</Badge> : null}
                  </div>
                  {h.quote ? <p className={s.said}>{"“"}{h.quote}{"”"}</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className={s.body}>{t("debrief.tough.q.calm")}</p>}
        </div>
      ) : null}
      {q.calmer_answer ? (
        <div className={s.block}>
          <h4 className={s.blockTitle}>{t("debrief.tough.q.calmer")}</h4>
          <p className={s.say}>{"“"}{q.calmer_answer}{"”"}</p>
        </div>
      ) : null}
      {q.shape ? (
        <div className={s.block}>
          <h4 className={s.blockTitle}>{t("debrief.tough.q.shape")}</h4>
          <p className={s.body}>{q.shape}</p>
          {q.model_checked ? null : <p className={s.quiet}>{t("debrief.tough.q.noCheck")}</p>}
        </div>
      ) : null}
      {q.personal || q.lawful_note ? <Callout tone="info">{q.lawful_note || t("debrief.tough.q.personal")}</Callout> : null}
      {cards.length ? (
        <div className={s.block}>
          {cards.map((c) => <TacticCard key={c.id} size="inline" title={c.title} rule={c.rule} example={c.example} evidence={c.evidence} headingLevel={4} />)}
        </div>
      ) : null}
    </div>
  );
}

export function ToughDebrief(p: ToughTalkDebriefProps<Debrief> & { content?: TalkContent }) {
  const { record, debrief: d } = p;
  const uid = useId();
  const section = useRef<HTMLElement>(null);
  const qs = d?.questions ?? [];
  const index = Math.max(0, qs.findIndex((q) => q.n === p.question));
  const q = qs[index];
  const sum = d ? toughSummary(d) : null;
  const select = (n: number) => {
    p.onQuestionChange?.(n);
    window.requestAnimationFrame(() => {
      if ((section.current?.getBoundingClientRect().top ?? 0) < 0) section.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  };
  const jump = (n: number) => {
    p.onQuestionChange?.(n);
    window.requestAnimationFrame(() => {
      section.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      document.getElementById(`${uid}-h-${n}`)?.focus({ preventScroll: true });
    });
  };
  const prev = qs[index - 1];
  const next = qs[index + 1];
  const many = qs.length > 1;
  return (
    <TalkPage
      variant="tough"
      title={toughTitle(record, d)}
      meta={toughMeta(record, d)}
      turns={conversationTurns(record, d)}
      view={p.view}
      onViewChange={p.onViewChange}
      buildUp={p.buildUp}
      storageError={p.storageError}
      notice={p.notice}
      onRename={p.onRename}
      onDownload={p.onDownload}
      onArchive={p.onArchive}
      onTrash={p.onTrash}
      onPractise={p.onPractise}
    >
      {d && sum && q ? (
        <>
          <Frame id="tough-summary" title={t("debrief.tough.summary.title")} data-review-id="Debrief/Tough/Summary" data-review-section="Debrief · Summary" data-comment-target="">
            <p className={s.headline}>{sum.headline}</p>
            {sum.hurt ? (
              <div className={s.block}>
                <h3 className={s.blockTitle}>{t("debrief.tough.summary.hurt")}</h3>
                <div className={s.hurtLine}>
                  <span className={s.itemTitle}>{sum.hurt.label}</span>
                  <span className={s.itemMeta}>{t("debrief.q.number", { n: sum.hurt.n })}</span>
                </div>
                <p className={s.said}>{sum.hurt.question}</p>
                {sum.hurt.quote ? <p className={s.said}>{"“"}{sum.hurt.quote}{"”"}</p> : null}
                <div>
                  <Button variant="ghost" data-track="tough-go-to-question" onClick={() => jump(sum.hurt!.n)}>{t("debrief.tough.summary.go", { n: sum.hurt.n })}</Button>
                </div>
              </div>
            ) : sum.none ? <p className={s.body}>{sum.none}</p> : null}
            <p className={s.quiet}>{d.practice_note || t("debrief.talk.footer")}</p>
          </Frame>
          <Frame ref={section} id="tough-questions" title={t("debrief.tough.questions.title")} data-review-id="Debrief/Tough/Questions" data-review-section="Debrief · Questions" data-comment-target="">
            {many ? <QuestionTabs questions={qs.map(stub)} index={index} base={`${uid}-qt`} onSelect={select} /> : null}
            <div role={many ? "tabpanel" : undefined} id={`${uid}-qt-panel`} aria-labelledby={many ? `${uid}-qt-tab-${q.n}` : undefined}>
              <Swap swapKey={String(q.n)} focusTarget={() => document.getElementById(`${uid}-h-${q.n}`)}>
                <QuestionBody q={q} total={qs.length} content={p.content} headingId={`${uid}-h-${q.n}`} />
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
          </Frame>
        </>
      ) : null}
    </TalkPage>
  );
}
