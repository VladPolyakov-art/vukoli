/* Variant C · "Question by question first" (ds/screens/debrief-variants.md §C).
 * A short summary on top (verdict with the drill beside it, three takeaways = the weak spots with their plan step, and
 * the scores as one strip), then every question as an open card with its own content / language / delivery notes in
 * rows, the corrections inline, and which scores it cost. The answer and the stronger version fold inside the card.
 * The layer columns disappear: layers become the row labels inside each question. No picker: you read down the
 * interview the way it happened (Otter's outline, R5). */
import type { RefObject } from "react";
import { Button, Callout, Disclosure, Icon } from "../../../ds";
import { t, tp } from "../../../i18n";
import { drillHintText } from "../parts/drillHint";
import { RemovedLines } from "../parts/Layers";
import { Marked } from "../parts/Marked";
import { QuestionLinks } from "../parts/QuestionLinks";
import { SectionHead } from "../parts/Sections";
import { verdictLine } from "../parts/verdictLine";
import type { Layer, QuestionModel } from "../types";
import card from "../parts/card.module.css";
import { COPY } from "./copy";
import { LayerTag, ScaleBadges, VariantPage, orderedPlan, orderedSpots, questionHeadingId, rowLabel, rowsLostIn, type PageCtx } from "./shared";
import type { VariantProps } from "./VariantA";
import c from "./variantC.module.css";

export function VariantC(props: VariantProps) {
  return (
    <VariantPage {...props} reviewId="DebriefVariant/C">
      {(ctx) => (
        <>
          <Summary ctx={ctx} />
          <Questions ctx={ctx} />
        </>
      )}
    </VariantPage>
  );
}

/* ------------------------------------------------------------------ summary ---- */

function Summary({ ctx }: { ctx: PageCtx }) {
  const { model } = ctx;
  const v = model.verdict;
  const spots = orderedSpots(model.weakSpots, ctx.seq);
  const plan = orderedPlan(model.plan, ctx.seq);
  const drill = model.drill;
  const id = `${ctx.uid}-verdict`;
  const tkId = `${ctx.uid}-take`;
  const scId = `${ctx.uid}-scores`;
  const next = v ? verdictLine(v) : null;
  const rows = model.scorecard?.filter((r) => r.score !== null) ?? [];
  const skipped = model.scorecard?.filter((r) => r.score === null).map((r) => rowLabel(r.key)) ?? [];
  return (
    <div className={c.summary}>
      {v ? (
        <section className={c.verdict} aria-labelledby={id} data-review-id="DebriefVariant/C/Verdict">
          <div className={c.verdictText}>
            <h2 id={id} className="visually-hidden">{t("debrief.verdict")}</h2>
            <p className={c.headline}>
              {v.headline}
              {v.step !== undefined ? <span className="visually-hidden">, {t("debrief.scale.sr", { n: v.step + 1 })}</span> : null}
            </p>
            {v.line ? <p className={c.line}>{v.line}</p> : null}
            {v.step !== undefined ? (
              <div className={c.scaleRow}>
                <ScaleBadges step={v.step} />
                {next ? <p className={c.next}>{next}</p> : null}
              </div>
            ) : null}
          </div>
          {plan.length ? (
            <div className={c.drill}>
              <Button variant="primary" icon="play" data-track="drill-start" disabled={ctx.example}>{t("debrief.drill")}</Button>
              <p className={c.hint}>{ctx.example ? t("debrief.example.own") : drill ? drillHintText(drill) : null}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {spots.length ? (
        <section className={c.takeaways} aria-labelledby={tkId} data-review-id="DebriefVariant/C/Takeaways">
          <h2 id={tkId} className={c.label}>{spots.length === 1 ? COPY.takeawaysOne : COPY.takeaways}</h2>
          <ol className={c.takeList}>
            {spots.map((w, i) => {
              const step = plan.find((p) => p.layer === w.layer);
              return (
                <li key={w.id} className={c.take}>
                  <span className={card.num} aria-hidden="true">{i + 1}</span>
                  <div className={c.takeBody}>
                    <p className={c.takeTitle}>{w.title}</p>
                    {w.fix ? <p className={c.takeFix}>{w.fix}</p> : null}
                    <p className={c.takeMeta}>
                      <LayerTag layer={w.layer} />
                      {w.evidence ? (
                        <span>
                          {w.evidence.kind === "most" ? t("debrief.evidence.mostIn") : tp("debrief.evidence.questions", w.evidence.ids.length)}{" "}
                          <QuestionLinks ids={w.evidence.ids} onJump={ctx.jump} />{w.evidence.trail ? <> {w.evidence.trail}</> : null}
                        </span>
                      ) : null}
                    </p>
                    {step ? <p className={c.takeStep}><span className={c.lead}>{COPY.planStepLabel(plan.indexOf(step) + 1)}:</span> {step.text}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {rows.length ? (
        <section className={c.scores} aria-labelledby={scId} data-review-id="DebriefVariant/C/Scores">
          <div className={c.scoresHead}>
            <h2 id={scId} className={c.label}>{COPY.scores}</h2>
            <p className={c.muted}>{COPY.scoresSub} {t("debrief.misheard.note")}</p>
          </div>
          <ul className={c.strip} aria-label={t("debrief.score.list")}>
            {rows.map((r) => (
              <li key={r.key} className={c.cell}>
                <span className={c.cellLabel}>{rowLabel(r.key)}</span>
                <span className={c.cellValue} aria-hidden="true">{t("debrief.score.value", { score: r.score! })}</span>
                <span className="visually-hidden">{t("debrief.score.sr", { score: r.score! })}</span>
                {r.lost.length ? <span className={c.cellLost}><QuestionLinks ids={r.lost} onJump={ctx.jump} /></span> : <span className={c.cellLost}>—</span>}
              </li>
            ))}
          </ul>
          {skipped.length ? <p className={c.muted}>{t("debrief.score.notAsked", { labels: skipped.join(", ") })}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ questions ---- */

function Questions({ ctx }: { ctx: PageCtx }) {
  const id = `${ctx.uid}-questions`;
  return (
    <section className={c.questions} aria-labelledby={id} data-review-id="DebriefVariant/C/Questions">
      <SectionHead id={id} title={t("debrief.qSection")} sub={COPY.questionsSub(ctx.model.questions.length)} />
      <ol ref={ctx.detail as RefObject<HTMLOListElement | null>} className={c.qList}>
        {ctx.model.questions.map((q) => <QuestionBlock key={q.n} q={q} ctx={ctx} />)}
      </ol>
    </section>
  );
}

function QuestionBlock({ q, ctx }: { q: QuestionModel; ctx: PageCtx }) {
  const lost = rowsLostIn(ctx.model.scorecard, q.n);
  const headId = questionHeadingId(ctx.uid, q.n);
  return (
    <li className={c.q} data-question={q.n} data-review-id="DebriefVariant/C/Question">
      <div className={c.qHead}>
        <span className={card.num} aria-hidden="true">{q.n}</span>
        <div className={c.qHeadText}>
          <h3 id={headId} tabIndex={-1} className={c.qTitle}>
            <span className="visually-hidden">{t("debrief.q.number", { n: q.n })}: </span>{q.question}
          </h3>
          <p className={c.facts}>
            {q.duration ? <span className={c.fact}><Icon name="clock" size="sm" />{q.duration}</span> : null}
            {q.startsAt ? <span>{t("debrief.q.startsAt", { time: q.startsAt })}</span> : null}
            <span>{q.followUps ? tp("debrief.q.followUps", q.followUps) : t("debrief.q.noFollowUp")}</span>
            {q.misheard ? <span>{t("debrief.q.misheard", { n: q.misheard })}</span> : null}
          </p>
        </div>
      </div>

      {ctx.model.scorecard ? (
        <p className={c.lostLine}>
          {lost.length ? <><span className={c.lead}>{COPY.lostOn}:</span> {lost.map(rowLabel).join(", ")}</> : COPY.noLoss}
        </p>
      ) : null}

      {q.unavailable ? (
        <Callout tone="info">{t("debrief.q.unavailable")}</Callout>
      ) : (
        <dl className={c.notes}>
          {ctx.seq.map((layer) => <Note key={layer} layer={layer} q={q} />)}
        </dl>
      )}

      <Disclosure surface="plain" title={COPY.answerAndStronger} className={c.more}>
        <div className={c.answerBox}>
          {q.followUp ? <p className={c.muted}><span className={c.lead}>{t("debrief.q.followUp")}</span> {q.followUp}</p> : null}
          <div className={c.part}>
            <h4 className={c.partLabel}>{t("debrief.q.yourAnswer")}</h4>
            <p className={c.answer}><Marked parts={q.answer} /></p>
            <span><Button variant="ghost" size="sm" icon="edit">{t("debrief.q.edit")}</Button></span>
          </div>
          {q.followUpAnswer ? (
            <div className={c.part}>
              <h4 className={c.partLabel}>{t("debrief.q.yourFollowUp")}</h4>
              <p className={c.answer}>{q.followUpAnswer}</p>
            </div>
          ) : null}
          {q.stronger?.status === "ready" && q.stronger.text ? (
            <div className={`${c.part} ${c.stronger}`}>
              <h4 className={c.partLabel}><Icon name="sparkle" size="sm" />{t("feedback.stronger.title")}</h4>
              <p className={c.answer}><Marked parts={q.stronger.text} /></p>
              {q.stronger.placeholders ? <p className={c.muted}>{t("debrief.stronger.note")}</p> : null}
            </div>
          ) : null}
        </div>
      </Disclosure>
    </li>
  );
}

/** One layer row inside a question: the layer name (icon + text, monochrome) and its notes. */
function Note({ layer, q }: { layer: Layer; q: QuestionModel }) {
  const head = <dt className={c.noteHead}><Icon name={layer} size="sm" />{t(`feedback.layer.${layer}`)}</dt>;
  if (layer === "content") {
    const items = q.layers.content?.items ?? [];
    if (!q.layers.content) return null;
    return (
      <div className={c.note}>
        {head}
        <dd className={c.noteBody}>
          {items.length ? (
            <ul className={c.items}>
              {items.map((it, i) => <li key={i}>{it.lead ? <strong className={c.lead}>{it.lead} </strong> : null}{it.text}</li>)}
            </ul>
          ) : <span className={c.ok}>{t("feedback.content.nothing")}</span>}
        </dd>
      </div>
    );
  }
  if (layer === "language") {
    const b = q.layers.language;
    if (!b) return null;
    return (
      <div className={c.note}>
        {head}
        <dd className={c.noteBody}>
          {b.corrections.length ? (
            <ul className={c.fixes}>
              {b.corrections.map((x) => (
                <li key={x.id} className={c.fixRow}>
                  <p className={c.fixLine}>
                    <span className={c.heard}><span className="visually-hidden">{x.typed ? t("debrief.q.typed") : COPY.heardAs}: </span><Marked parts={x.heard} quoted /></span>
                    <Icon name="arrowRight" size="sm" className={c.fixArrow} />
                    <span><span className="visually-hidden">{COPY.say}: </span><Marked parts={x.say} quoted /></span>
                  </p>
                  <p className={c.why}>{x.why}</p>
                  <span className={c.fixActions}>
                    <Button variant="ghost" size="sm">{t("debrief.lang.notWhatISaid")}</Button>
                    <Button variant="ghost" size="sm" icon="x">{t("debrief.lang.dismiss")}</Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : <span className={c.ok}>{t("debrief.lang.nothing")}</span>}
          {b.removed.length ? <RemovedLines lines={b.removed} /> : null}
        </dd>
      </div>
    );
  }
  const d = q.layers.delivery;
  if (!d) return null;
  const parts = [
    d.fillers !== undefined ? tp("debrief.sum.fillers", d.fillers) : null,
    d.length ? t("debrief.delivery.lengthValue", { time: d.length, words: d.words !== undefined ? tp("common.words", d.words) : "" }) : null,
    d.textMode && d.words !== undefined ? tp("common.words", d.words) : null,
    d.pace ? t("debrief.delivery.paceValue", { wpm: d.pace.wpm, verdict: t(`feedback.delivery.${d.pace.verdict}`) }) : null,
  ].filter(Boolean);
  return (
    <div className={c.note}>
      {head}
      <dd className={c.noteBody}>
        <span className={c.metrics}>{parts.join(" · ")}</span>
        {d.textMode ? <span className={c.muted}>{t("feedback.delivery.textMode")}</span> : null}
        {d.mostFillers ? <span className={c.muted}>{t("debrief.delivery.tip", { list: d.mostFillers })}</span> : null}
        {d.engineNote ? <span className={c.muted}>{t("debrief.delivery.engineNote")}</span> : null}
      </dd>
    </div>
  );
}
