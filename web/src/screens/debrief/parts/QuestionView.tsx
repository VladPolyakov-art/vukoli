/* One question of the interview Debrief view (layout D, 2026-10-27): the meta line and "Lost points on …", then two
 * columns. Left: what you said (follow-up, your answer, "Edit what I said", the follow-up answer, "Show a stronger answer"
 * behind a fold). Right: ONE "Feedback" list in the configured layer order, a small layer tag on each note:
 *  - the weak spot whose first evidence question this is opens the list: What you said / How it lands / How to fix
 *    (a language spot skips "What you said": its correction below shows the same words);
 *  - content notes; language corrections inline as "heard → say" + why, with "Not what you said?" and "Dismiss"
 *    (the real flags: dismissed = one line with Undo, editing = the inline editor); delivery numbers and the tip.
 * The misheard notes close the list. Local state lives in DebriefView; this part is pure. */
import type { ReactNode } from "react";
import { Badge, Button, Callout, Disclosure, Icon, Skeleton, TextShimmer } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { Layer, QuestionModel, ScoreRowModel, WeakSpotModel } from "../types";
import { Editor } from "./Correction";
import { LayerTag, rowLabel, rowsLostIn } from "./debriefShared";
import type { RowContext } from "./Layers";
import { RemovedLines } from "./Layers";
import { Marked, plain } from "./Marked";
import { Said } from "./Sections";
import s from "./questionView.module.css";

export interface QuestionViewProps {
  q: QuestionModel;
  /** Position among the questions (0-based) and how many there are. */
  index: number;
  total: number;
  /** Layer order of the notes (GR8). */
  seq: Layer[];
  /** The weak spots in that order; each shows on its first evidence question. */
  spots: WeakSpotModel[];
  /** Absent (older debrief, partial session): no "Lost points on" line. */
  scorecard?: readonly ScoreRowModel[];
  headingId: string;
  /** Prefix for the ids inside the question. */
  uid: string;
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
  strongerOpen: boolean;
  onStrongerOpenChange: (open: boolean) => void;
}

export function QuestionView(p: QuestionViewProps) {
  const { q, scorecard } = p;
  const lost = rowsLostIn(scorecard, q.n);
  return (
    <article className={s.q} data-question={q.n} data-review-id="Debrief/Question">
      <header className={s.head}>
        <p className={s.facts}>
          <span className={s.of}>{t("debrief.q.of", { n: p.index + 1, total: p.total })}</span>
          {q.duration ? <span className={s.fact}><Icon name="clock" size="sm" />{q.duration}</span> : null}
          {q.startsAt ? <span>{t("debrief.q.startsAt", { time: q.startsAt })}</span> : null}
          <span>{q.followUps ? tp("debrief.q.followUps", q.followUps) : t("debrief.q.noFollowUp")}</span>
          {q.misheard ? <span>{t("debrief.q.misheard", { n: q.misheard })}</span> : null}
          {q.suggestion ? <Badge icon="sparkle">{t("debrief.q.suggestion")}</Badge> : null}
        </p>
        <h3 id={p.headingId} tabIndex={-1} className={s.title}>
          <span className="visually-hidden">{t("debrief.q.number", { n: q.n })}: </span>{q.question}
        </h3>
        {scorecard ? (
          <p className={s.lostLine}>
            {lost.length ? <><span className={s.lead}>{t("debrief.q.lostOn")}:</span> {lost.map(rowLabel).join(", ")}</> : t("debrief.q.noLoss")}
          </p>
        ) : null}
      </header>

      <div className={s.cols}>
        <section className={s.answerCol} aria-label={t("debrief.q.yourAnswer")}>
          {q.followUp ? <p className={s.muted}><span className={s.lead}>{t("debrief.q.followUp")}</span> {q.followUp}</p> : null}
          <div className={s.part} data-review-id="Debrief/Answer">
            <h4 className={s.partLabel}>
              {t("debrief.q.yourAnswer")}
              {q.edited ? <Badge icon="edit">{t("debrief.q.edited")}</Badge> : null}
            </h4>
            {p.answerEditing ? (
              <Editor start={p.answerDraft ?? plain(q.answer)} label={t("debrief.lang.editorLabel")} focus={p.focusEditor} onSave={p.onSaveAnswer} onCancel={p.onCancelAnswer} />
            ) : (
              <>
                <p className={s.answer}><Marked parts={q.answer} /></p>
                {p.onEditAnswer ? (
                  <span className={s.ghostRow}><Button variant="ghost" size="sm" icon="edit" data-track="edit-what-i-said" onClick={p.onEditAnswer}>{t("debrief.q.edit")}</Button></span>
                ) : null}
              </>
            )}
          </div>
          {q.followUpAnswer ? (
            <div className={s.part}>
              <h4 className={s.partLabel}>{t("debrief.q.yourFollowUp")}</h4>
              <p className={s.answer}>{q.followUpAnswer}</p>
            </div>
          ) : null}
          {!q.unavailable && !p.rechecking ? <Stronger q={q} open={p.strongerOpen} onOpenChange={p.onStrongerOpenChange} /> : null}
        </section>

        <section className={s.notesCol} aria-labelledby={`${p.uid}-fb-${q.n}`}>
          <h4 id={`${p.uid}-fb-${q.n}`} className={s.partLabel}>{t("debrief.q.feedback")}</h4>
          {q.unavailable ? (
            <Callout tone="info">{t("debrief.q.unavailable")}</Callout>
          ) : p.rechecking ? (
            <div className={s.part} data-review-id="Debrief/Rechecking">
              <TextShimmer as="p" status>{t("debrief.q.rechecking")}</TextShimmer>
              <Skeleton variant="card" lines={3} label={t("debrief.q.rechecking")} />
            </div>
          ) : (
            <Notes q={q} seq={p.seq} spots={p.spots} rows={p.rows} />
          )}
        </section>
      </div>
    </article>
  );
}

/** "Show a stronger answer": a fold; opening it asks for the text (the container does), then shows it. */
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
    >
      {st.status === "loading" || st.status === "idle" ? (
        <div className={s.part}>
          <TextShimmer as="p" status>{t("feedback.stronger.loading")}</TextShimmer>
          <Skeleton lines={3} label={t("feedback.stronger.loading")} />
        </div>
      ) : st.status === "unavailable" ? (
        <p className={s.muted}>{t("feedback.stronger.unavailable")}</p>
      ) : (
        <div className={`${s.part} ${s.stronger}`} data-review-id="Debrief/Stronger">
          <p className={s.answer}><Marked parts={st.text ?? []} /></p>
          {st.placeholders ? <p className={s.muted}><Icon name="info" size="sm" />{t("debrief.stronger.note")}</p> : null}
        </div>
      )}
    </Disclosure>
  );
}

/** One list of notes for the question, in the configured layer order, each with a small layer tag. */
function Notes({ q, seq, spots: allSpots, rows }: { q: QuestionModel; seq: Layer[]; spots: WeakSpotModel[]; rows: RowContext }) {
  const spots = allSpots.filter((w) => w.evidence?.ids[0] === q.n && (w.said || w.lands || w.fix));
  const content = q.layers.content?.items ?? [];
  const lang = q.layers.language;
  const del = q.layers.delivery;
  const delParts = del ? [
    del.fillers !== undefined ? tp("debrief.sum.fillers", del.fillers) : null,
    del.length ? t("debrief.delivery.lengthValue", { time: del.length, words: del.words !== undefined ? tp("common.words", del.words) : "" }) : null,
    del.textMode && del.words !== undefined ? tp("common.words", del.words) : null,
    del.pace ? t("debrief.delivery.paceValue", { wpm: del.pace.wpm, verdict: t(`feedback.delivery.${del.pace.verdict}`) }) : null,
  ].filter(Boolean) : [];
  const corrections = lang?.corrections ?? [];
  const empty = !spots.length && !content.length && !corrections.length && !delParts.length;

  const byLayer: Record<Layer, ReactNode[]> = {
    content: content.map((it, i) => (
      <li key={`c${i}`} className={s.note}>
        <LayerTag layer="content" />
        <p className={s.noteLine}>{it.lead ? <strong className={s.lead}>{it.lead} </strong> : null}{it.text}</p>
      </li>
    )),
    language: corrections.map((c) => {
      const dismissed = rows.isDismissed(c.id, c.dismissed);
      if (dismissed) {
        return (
          <li key={c.id} className={`${s.note} motion-fade`} data-review-id="Debrief/CorrectionRow/dismissed">
            <LayerTag layer="language" />
            <p className={s.why}>
              {t("debrief.lang.dismissed")}
              {rows.onRestore ? <> <Button variant="link" size="sm" data-track="correction-undo" onClick={() => rows.onRestore?.(c.id)}>{t("common.undo")}</Button></> : null}
            </p>
          </li>
        );
      }
      if (rows.editing === c.id) {
        return (
          <li key={c.id} className={s.note} data-review-id="Debrief/CorrectionEditor">
            <LayerTag layer="language" />
            <Editor start={rows.draft ?? plain(c.heard)} label={t("debrief.lang.editorLabel")} focus={rows.focusEditor} onSave={(text) => rows.onSave?.(c.id, text)} onCancel={rows.onCancel} />
          </li>
        );
      }
      return (
        <li key={c.id} className={`${s.note} ${rows.isLeaving(c.id) ? "motion-row-out" : ""}`} data-review-id="Debrief/CorrectionRow">
          <LayerTag layer="language" />
          <div className={s.noteText}>
            <p className={s.fixLine}>
              <span className={s.heard}><span className="visually-hidden">{c.typed ? t("feedback.language.youTyped") : t("feedback.language.heardAs")}: </span><Marked parts={c.heard} quoted /></span>
              <Icon name="arrowRight" size="sm" className={s.arrow} />
              <span><span className="visually-hidden">{t("feedback.language.say")}: </span><Marked parts={c.say} quoted /></span>
            </p>
            <p className={s.why}>{c.why}</p>
            {rows.onEdit || rows.onDismiss ? (
              <span className={s.fixActions}>
                {rows.onEdit ? <Button variant="ghost" size="sm" data-track="not-what-i-said" onClick={() => rows.onEdit?.(c.id)}>{t("debrief.lang.notWhatISaid")}</Button> : null}
                {rows.onDismiss ? <Button variant="ghost" size="sm" icon="x" data-track="correction-dismiss" onClick={() => rows.onDismiss?.(c.id)}>{t("debrief.lang.dismiss")}</Button> : null}
              </span>
            ) : null}
          </div>
        </li>
      );
    }),
    delivery: delParts.length ? [
      <li key="d" className={s.note}>
        <LayerTag layer="delivery" />
        <div className={s.noteText}>
          <p className={s.metrics}>{delParts.join(" · ")}</p>
          {del?.mostFillers ? <p className={s.why}>{t("debrief.delivery.tip", { list: del.mostFillers })}</p> : null}
          {del?.textMode ? <p className={s.why}>{t("feedback.delivery.textMode")}</p> : null}
          {del?.engineNote ? <p className={s.why}>{t("debrief.delivery.engineNote")}</p> : null}
        </div>
      </li>,
    ] : [],
  };

  return (
    <>
      <ul className={s.notes}>
        {spots.map((w) => (
          <li key={w.id} className={`${s.note} ${s.spot}`}>
            <LayerTag layer={w.layer} />
            <div className={s.noteText}>
              <p className={s.spotTitle}><span className="visually-hidden">{t("debrief.q.weakSpot")}: </span>{w.title}</p>
              <dl className={s.lines}>
                {w.said && w.layer !== "language" ? <div><dt>{t(w.said.kind === "metric" ? "debrief.measuredLead" : "debrief.saidLead")}</dt><dd><Said said={w.said} /></dd></div> : null}
                {w.lands ? <div><dt>{t("debrief.landsLead")}</dt><dd>{w.lands}</dd></div> : null}
                {w.fix ? <div><dt>{t("debrief.fixLead")}</dt><dd>{w.fix}</dd></div> : null}
              </dl>
            </div>
          </li>
        ))}
        {seq.flatMap((layer) => byLayer[layer])}
      </ul>
      {empty ? <p className={s.muted}>{t("debrief.lang.nothing")}</p> : null}
      {lang?.removed.length ? <div className={s.removed}><RemovedLines lines={lang.removed} /></div> : null}
    </>
  );
}
