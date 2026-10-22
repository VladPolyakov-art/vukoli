/* One question card (debrief.md §3.5; G19 Disclosure as an <li> card, headingLevel 3). Collapsed: number, question,
 * summary badges per layer, facts (length, start time, follow-ups). Expanded: follow-up, your answer (clamped to 6
 * lines), layer blocks in the configured order, a stronger answer. Local state lives in DebriefView; this part is pure.
 * `fixed` (D71): the breakdown next to the chat, always open, no toggle; the follow-up lines stay in the chat.
 * Badges (D71): only layers with something to work on, each named ("Content: 1 fix"); all clear → one "Nothing to fix". */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Badge, Button, Callout, Disclosure, Icon, Skeleton, TextShimmer } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { Layer, QuestionModel } from "../types";
import { Editor } from "./Correction";
import { ContentLayer, DeliveryLayer, LanguageLayer, type RowContext } from "./Layers";
import { Marked, plain } from "./Marked";
import s from "./card.module.css";

export interface QuestionCardProps {
  q: QuestionModel;
  order: Layer[];
  headerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strongerOpen: boolean;
  onStrongerOpenChange: (open: boolean) => void;
  rows: RowContext;
  rechecking: boolean;
  /** The answer itself is being edited. */
  answerEditing: boolean;
  /** Reopen the answer editor with this text (after a failed check). */
  answerDraft?: string;
  onEditAnswer?: () => void;
  onSaveAnswer?: (text: string) => void;
  onCancelAnswer?: () => void;
  focusEditor: boolean;
  /** The breakdown panel next to the chat: an open card without the toggle. */
  fixed?: boolean;
}

/** True when the text is cut by the line clamp (measured while collapsed, so "Show full answer" appears only when needed). */
function useClamped(ref: RefObject<HTMLElement | null>, expanded: boolean): boolean {
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOver(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, expanded]);
  return over;
}

function Answer({ q, answerEditing, answerDraft, onEditAnswer, onSaveAnswer, onCancelAnswer, focusEditor }: Pick<QuestionCardProps, "q" | "answerEditing" | "answerDraft" | "onEditAnswer" | "onSaveAnswer" | "onCancelAnswer" | "focusEditor">) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const clamped = useClamped(ref, expanded);
  return (
    <section className={s.part} data-review-id="Debrief/Answer">
      <h4 className={s.label}>
        {t("debrief.q.yourAnswer")}
        {q.edited ? <Badge icon="edit">{t("debrief.q.edited")}</Badge> : null}
      </h4>
      {answerEditing ? (
        <Editor start={answerDraft ?? plain(q.answer)} label={t("debrief.lang.editorLabel")} focus={focusEditor} onSave={onSaveAnswer} onCancel={onCancelAnswer} />
      ) : (
        <>
          <p ref={ref} className={`${s.answer} ${expanded ? "" : s.clamp}`}><Marked parts={q.answer} /></p>
          {clamped || expanded || onEditAnswer ? (
            <div className={s.answerActions}>
              {clamped || expanded ? (
                <Button variant="link" size="sm" data-track="debrief-show-answer" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                  {expanded ? t("debrief.q.showLess") : t("debrief.q.showFull")}
                </Button>
              ) : null}
              {onEditAnswer ? <Button variant="ghost" size="sm" icon="edit" data-track="edit-what-i-said" onClick={onEditAnswer}>{t("debrief.q.edit")}</Button> : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Stronger({ q, open, onOpenChange }: { q: QuestionModel; open: boolean; onOpenChange: (open: boolean) => void }) {
  const st = q.stronger;
  if (!st) return null;
  return (
    <Disclosure
      surface="plain"
      track="debrief-stronger-toggle"
      open={open}
      onOpenChange={onOpenChange}
      leading={<Icon name="sparkle" size="sm" />}
      title={open ? t("feedback.stronger.hide") : t("feedback.stronger.show")}
      className={s.stronger}
    >
      {st.status === "loading" || st.status === "idle" ? (
        <div className={s.part}>
          <TextShimmer as="p" status>{t("feedback.stronger.loading")}</TextShimmer>
          <Skeleton lines={3} label={t("feedback.stronger.loading")} />
        </div>
      ) : st.status === "unavailable" ? (
        <p className={s.muted}>{t("feedback.stronger.unavailable")}</p>
      ) : (
        <div className={s.part} data-review-id="Debrief/Stronger">
          <p className={s.rewrite}><Marked parts={st.text ?? []} /></p>
          {st.placeholders ? <p className={s.muted}><Icon name="info" size="sm" />{t("debrief.stronger.note")}</p> : null}
        </div>
      )}
    </Disclosure>
  );
}

const QUIET = () => new Set([t("debrief.sum.contentNothing"), t("debrief.sum.languageNothing")]);

export function QuestionCard(p: QuestionCardProps) {
  const { q, order, headerId, open, onOpenChange } = p;
  const sum = q.summary;
  const quiet = QUIET();
  const work = (["content", "language"] as const).filter((l) => sum[l] && !quiet.has(sum[l]!));
  const clear = !q.unavailable && !work.length && Boolean(sum.content || sum.language);
  const named = (l: Layer, text: string) => `${t(`feedback.layer.${l}`)}: ${text}`;
  const meta = (
    <>
      {q.unavailable ? <Badge>{t("debrief.sum.noFeedback")}</Badge> : null}
      {!q.unavailable ? work.map((l) => <Badge key={l} tone={l} tinted icon={l}>{named(l, sum[l]!)}</Badge>) : null}
      {clear ? <Badge icon="check">{t("debrief.sum.languageNothing")}</Badge> : null}
      {!q.unavailable && sum.delivery ? <Badge tone="delivery" tinted icon="delivery">{named("delivery", sum.delivery)}</Badge> : null}
      {q.suggestion ? <Badge icon="sparkle">{t("debrief.q.suggestion")}</Badge> : null}
      {q.duration ? <span className={s.fact}><Icon name="clock" size="sm" />{q.duration}</span> : null}
      {q.startsAt ? <span className={s.fact}>{t("debrief.q.startsAt", { time: q.startsAt })}</span> : null}
      <span className={s.fact}>{q.followUps ? tp("debrief.q.followUps", q.followUps) : t("debrief.q.noFollowUp")}</span>
      {q.misheard ? <span className={s.fact}>{t("debrief.q.misheard", { n: q.misheard })}</span> : null}
    </>
  );

  const layerBlock = (layer: Layer) => {
    const b = q.layers[layer];
    if (!b) return null;
    if (layer === "content") return <ContentLayer key={layer} block={q.layers.content!} />;
    if (layer === "language") return <LanguageLayer key={layer} block={q.layers.language!} ctx={p.rows} />;
    return <DeliveryLayer key={layer} block={q.layers.delivery!} />;
  };

  const body = (
    <div className={s.body} data-review-id="Debrief/QuestionBody">
      {q.followUp && !p.fixed ? <p className={s.followUp}><span className={s.lead}>{t("debrief.q.followUp")}</span> {q.followUp}</p> : null}
      <Answer q={q} answerEditing={p.answerEditing} answerDraft={p.answerDraft} onEditAnswer={p.onEditAnswer} onSaveAnswer={p.onSaveAnswer} onCancelAnswer={p.onCancelAnswer} focusEditor={p.focusEditor} />
      {q.followUpAnswer && !p.fixed ? (
        <section className={s.part}>
          <h4 className={s.label}>{t("debrief.q.yourFollowUp")}</h4>
          <p className={s.answer}>{q.followUpAnswer}</p>
        </section>
      ) : null}
      {q.unavailable ? (
        <Callout tone="info">{t("debrief.q.unavailable")}</Callout>
      ) : p.rechecking ? (
        <div className={s.part} data-review-id="Debrief/Rechecking">
          <TextShimmer as="p" status>{t("debrief.q.rechecking")}</TextShimmer>
          <Skeleton variant="card" lines={3} label={t("debrief.q.rechecking")} />
        </div>
      ) : (
        <div className={s.layers}>{order.map(layerBlock)}</div>
      )}
      {!q.unavailable && !p.rechecking ? <Stronger q={q} open={p.strongerOpen} onOpenChange={p.onStrongerOpenChange} /> : null}
    </div>
  );

  if (p.fixed) {
    return (
      <article className={s.fixed} aria-labelledby={headerId} data-review-id="Debrief/Breakdown">
        <div className={s.fixedHead}>
          <span className={s.num} aria-hidden="true">{q.n}</span>
          <div className={s.fixedText}>
            <h3 id={headerId} tabIndex={-1} className={s.fixedTitle}>
              <span className="visually-hidden">{t("debrief.q.number", { n: q.n })}: </span>{q.question}
            </h3>
            <div className={s.fixedMeta}>{meta}</div>
          </div>
        </div>
        <div className={s.fixedBody}>{body}</div>
      </article>
    );
  }

  return (
    <Disclosure
      as="li"
      track="debrief-question-toggle"
      headingLevel={3}
      id={headerId}
      open={open}
      onOpenChange={onOpenChange}
      leading={<span className={s.num} aria-hidden="true">{q.n}</span>}
      title={<><span className="visually-hidden">{t("debrief.q.number", { n: q.n })}: </span>{q.question}</>}
      meta={meta}
    >
      {body}
    </Disclosure>
  );
}
