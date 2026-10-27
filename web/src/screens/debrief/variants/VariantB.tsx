/* Variant B · "Skills, weakest first" (ds/screens/debrief-variants.md §B).
 * The scorecard becomes the page's spine: one list of the seven skills, weakest first. Each row = the score, what to do
 * about it in one line, the questions that lost points, and (where a weak spot explains the row) the evidence behind a
 * fold: what you said and how it lands. The rows that hold the verdict back say so ("Needed for “Ready”"), so the line
 * under the scale and the list tell one story. The three layer columns and the separate scorecard are gone; the plan
 * sits next to the verdict as a small card with the drill. Question by question as today. */
import { Badge, Button, Card, Disclosure, Icon } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { ScoreKey } from "../../../lib/types";
import { drillHintText } from "../parts/drillHint";
import { QuestionLinks } from "../parts/QuestionLinks";
import { Said, SectionHead } from "../parts/Sections";
import { verdictLine } from "../parts/verdictLine";
import type { WeakSpotModel } from "../types";
import { COPY, ROW_LAYER, ROW_TIP } from "./copy";
import { LayerTag, QuestionPicker, ScaleBadges, ScoreMeter, VariantPage, orderedPlan, orderedSpots, rowLabel, spotRow, weakestFirst, type PageCtx } from "./shared";
import type { VariantProps } from "./VariantA";
import b from "./variantB.module.css";

export interface VariantBProps extends VariantProps {
  /** 🟡 Which content row the content weak spot explains (the server knows the rubric tag; fixtures do not). */
  contentRow?: ScoreKey;
}

export function VariantB({ contentRow, ...props }: VariantBProps) {
  return (
    <VariantPage {...props} reviewId="DebriefVariant/B">
      {(ctx) => (
        <>
          <Top ctx={ctx} />
          <Skills ctx={ctx} contentRow={contentRow} />
          <QuestionPicker ctx={ctx} />
        </>
      )}
    </VariantPage>
  );
}

/* ------------------------------------------------------------------ verdict + plan ---- */

function Top({ ctx }: { ctx: PageCtx }) {
  const v = ctx.model.verdict;
  const plan = orderedPlan(ctx.model.plan, ctx.seq);
  const drill = ctx.model.drill;
  const id = `${ctx.uid}-verdict`;
  const planId = `${ctx.uid}-plan`;
  const next = v ? verdictLine(v) : null;
  return (
    <div className={b.top}>
      {v ? (
        <section className={b.verdict} aria-labelledby={id} data-review-id="DebriefVariant/B/Verdict">
          <h2 id={id} className={b.label}>{t("debrief.verdict")}</h2>
          <p className={b.headline}>
            {v.headline}
            {v.step !== undefined ? <span className="visually-hidden">, {t("debrief.scale.sr", { n: v.step + 1 })}</span> : null}
          </p>
          {v.line ? <p className={b.line}>{v.line}</p> : null}
          {v.step !== undefined ? <ScaleBadges step={v.step} /> : null}
          {next ? <p className={b.next}>{next}</p> : null}
        </section>
      ) : null}
      {plan.length ? (
        <Card as="section" padding="md" className={b.plan} aria-labelledby={planId} data-review-id="DebriefVariant/B/Plan">
          <h2 id={planId} className={b.label}>{COPY.planCard}</h2>
          <ol className={b.steps}>
            {plan.map((p) => (
              <li key={p.id} className={b.step}>
                <span className={b.stepText}>{p.text}</span>
                <span className={b.stepLayer}><Icon name={p.layer} size="sm" />{t(`feedback.layer.${p.layer}`)}</span>
              </li>
            ))}
          </ol>
          <div className={b.drill}>
            <Button variant="primary" icon="play" data-track="drill-start" disabled={ctx.example}>{t("debrief.drill")}</Button>
            <p className={b.hint}>{ctx.example ? t("debrief.example.own") : drill ? drillHintText(drill) : null}</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ skills list ---- */

function Skills({ ctx, contentRow }: { ctx: PageCtx; contentRow?: ScoreKey }) {
  const rows = ctx.model.scorecard;
  if (!ctx.model.verdict || !rows?.some((r) => r.score !== null)) return null;
  const id = `${ctx.uid}-skills`;
  const v = ctx.model.verdict;
  const gap = new Set(v.gap ?? []);
  // Each weak spot explains one row; the row shows it instead of the generic tip.
  const bySpot = new Map<ScoreKey, WeakSpotModel>();
  for (const w of orderedSpots(ctx.model.weakSpots, ctx.seq)) {
    const key = spotRow(w, rows, contentRow);
    if (key && !bySpot.has(key)) bySpot.set(key, w);
  }
  const skipped = rows.filter((r) => r.score === null).map((r) => rowLabel(r.key));
  return (
    <section className={b.skills} aria-labelledby={id} data-review-id="DebriefVariant/B/Skills">
      <SectionHead id={id} title={COPY.skills} sub={COPY.skillsSub} note={t("debrief.misheard.note")} />
      <ul className={b.list} aria-label={t("debrief.score.list")}>
        {weakestFirst(rows).map((r) => {
          const spot = bySpot.get(r.key);
          const layer = ROW_LAYER[r.key];
          return (
            <li key={r.key} className={`${b.row} ${spot ? b.hasSpot : ""}`} data-score-key={r.key}>
              <div className={b.name}>
                <span className={b.rowLabel}>{rowLabel(r.key)}</span>
                <span className={b.layer}><Icon name={layer} size="sm" />{t(`feedback.layer.${layer}`)}</span>
                {gap.has(r.key) && v.step !== undefined && v.step < 2 ? (
                  <span className={b.holds}><Badge tone="outline" icon="target">{COPY.holds(v.step)}</Badge></span>
                ) : null}
              </div>
              <div className={b.meter}><ScoreMeter score={r.score} /></div>
              <div className={b.main}>
                {spot ? (
                  <>
                    <p className={b.spotTitle}><span className="visually-hidden">{COPY.weakSpot}: </span>{spot.title}</p>
                    {spot.fix ? <p className={b.fix}>{spot.fix}</p> : null}
                  </>
                ) : r.score < 5 ? (
                  <p className={b.fix}>{ROW_TIP[r.key]}</p>
                ) : (
                  <p className={b.muted}>{COPY.noPointsLost}</p>
                )}
                {r.lost.length ? (
                  <p className={b.lost}>{tp("debrief.score.lost", r.lost.length)} <QuestionLinks ids={r.lost} onJump={ctx.jump} /></p>
                ) : null}
                {spot && (spot.said || spot.lands) ? (
                  <Disclosure surface="plain" title={COPY.detail} className={b.more}>
                    <div className={b.detail}>
                      <LayerTag layer={spot.layer} />
                      <dl className={b.lines}>
                        {spot.said ? <div><dt>{t(spot.said.kind === "metric" ? "debrief.measuredLead" : "debrief.saidLead")}</dt><dd><Said said={spot.said} /></dd></div> : null}
                        {spot.lands ? <div><dt>{t("debrief.landsLead")}</dt><dd>{spot.lands}</dd></div> : null}
                        {spot.also ? (
                          <div><dt>{t("debrief.alsoLead")}</dt><dd>{spot.also.text} {tp("debrief.inQuestion", spot.also.ids.length)} <QuestionLinks ids={spot.also.ids} onJump={ctx.jump} /></dd></div>
                        ) : null}
                      </dl>
                    </div>
                  </Disclosure>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {skipped.length ? <p className={b.muted}>{t("debrief.score.notAsked", { labels: skipped.join(", ") })}</p> : null}
    </section>
  );
}
