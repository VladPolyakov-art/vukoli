/* Variant A · "One main focus" (ds/screens/debrief-variants.md §A).
 * The debrief answers one question first: what to do before the next session. The top weak spot becomes a single hero
 * card ("Start here", step 1 of the plan) with what was said next to a stronger version from the same question, how it
 * lands, how to fix, and the drill. The other weak spots follow as a short ranked list (steps 2–3); layers are small
 * tags, not columns. The scorecard folds into one line ("Lowest: …") and opens on demand. Question by question as today.
 * Weak spot = plan step: one list instead of "What to work on" + "Plan" + "Scorecard" saying the same thing three times. */
import { Button, Card, Disclosure, Icon } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { LayerOrder } from "../../../lib/types";
import { drillHintText } from "../parts/drillHint";
import { Marked } from "../parts/Marked";
import { QuestionLinks } from "../parts/QuestionLinks";
import { Said } from "../parts/Sections";
import { verdictLine } from "../parts/verdictLine";
import type { DebriefModel, DebriefVariant, Evidence, PlanStepModel, Segments, WeakSpotModel } from "../types";
import card from "../parts/card.module.css";
import { COPY } from "./copy";
import { LayerTag, QuestionPicker, ScaleBadges, ScoreMeter, VariantPage, orderedPlan, orderedSpots, rowLabel, weakestFirst, type PageCtx } from "./shared";
import a from "./variantA.module.css";

export interface VariantProps {
  model: DebriefModel;
  variant?: DebriefVariant;
  layerOrder?: LayerOrder;
  selected?: number;
}

export function VariantA(props: VariantProps) {
  return (
    <VariantPage {...props} reviewId="DebriefVariant/A">
      {(ctx) => {
        const spots = orderedSpots(ctx.model.weakSpots, ctx.seq);
        const plan = orderedPlan(ctx.model.plan, ctx.seq);
        const [first, ...rest] = spots;
        return (
          <>
            <VerdictA ctx={ctx} />
            {first ? <Focus ctx={ctx} spot={first} step={plan[0]} total={spots.length} /> : null}
            {rest.length ? <Then ctx={ctx} spots={rest} plan={plan} /> : null}
            <ScoreFold ctx={ctx} />
            <QuestionPicker ctx={ctx} />
          </>
        );
      }}
    </VariantPage>
  );
}

/* ------------------------------------------------------------------ verdict ---- */

function VerdictA({ ctx }: { ctx: PageCtx }) {
  const v = ctx.model.verdict;
  if (!v) return null;
  const next = verdictLine(v);
  const id = `${ctx.uid}-verdict`;
  return (
    <section className={a.verdict} aria-labelledby={id} data-review-id="DebriefVariant/A/Verdict">
      <h2 id={id} className="visually-hidden">{t("debrief.verdict")}</h2>
      <p className={a.headline}>
        {v.headline}
        {v.step !== undefined ? <span className="visually-hidden">, {t("debrief.scale.sr", { n: v.step + 1 })}</span> : null}
      </p>
      {v.line ? <p className={a.line}>{v.line}</p> : null}
      {v.step !== undefined ? (
        <div className={a.scaleRow}>
          <ScaleBadges step={v.step} />
          {next ? <p className={a.next}>{next}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ hero ---- */

function EvidenceText({ e, onJump, lead }: { e: Evidence; onJump: (n: number) => void; lead?: string }) {
  return (
    <span className={a.evidence}>
      {e.kind === "most" ? t("debrief.evidence.mostIn") : lead ?? tp("debrief.evidence.questions", e.ids.length)}{" "}
      <QuestionLinks ids={e.ids} onJump={onJump} />
      {e.trail ? <> {e.trail}</> : null}
    </span>
  );
}

/** The "better" side of the example, from data already saved for the same question: the stronger answer for content,
 * the first correction for language; delivery has none (a number is not rewritten). Never made up. */
function betterFor(spot: WeakSpotModel, model: DebriefModel): { q: number; text: Segments; placeholders?: boolean; correction?: Segments } | null {
  const n = spot.evidence?.ids[0];
  const q = model.questions.find((x) => x.n === n);
  if (!q || !n) return null;
  if (spot.layer === "content" && q.stronger?.status === "ready" && q.stronger.text) return { q: n, text: q.stronger.text, placeholders: q.stronger.placeholders };
  if (spot.layer === "language") {
    const c = q.layers.language?.corrections[0];
    if (c) return { q: n, text: c.say, correction: c.heard };
  }
  return null;
}

function Focus({ ctx, spot, step, total }: { ctx: PageCtx; spot: WeakSpotModel; step?: PlanStepModel; total: number }) {
  const id = `${ctx.uid}-focus`;
  const better = betterFor(spot, ctx.model);
  const said = spot.said;
  const drill = ctx.model.drill;
  return (
    <Card as="section" padding="lg" className={a.focus} aria-labelledby={id} data-review-id="DebriefVariant/A/Focus">
      <div className={a.focusTop}>
        <p className={a.eyebrow}>
          <span className={a.eyebrowStrong}>{COPY.startHere}</span>
          {step ? <span> · {COPY.planStep(1, total)}</span> : null}
        </p>
        <LayerTag layer={spot.layer} />
      </div>
      <div className={a.titleBlock}>
        <h2 id={id} className={a.focusTitle}>{spot.title}</h2>
        {spot.evidence ? <EvidenceText e={spot.evidence} onJump={ctx.jump} lead={COPY.seenIn(spot.evidence.ids.length)} /> : null}
      </div>

      {said || better ? (
        <div className={`${a.pair} ${better ? "" : a.pairSingle}`}>
          {said ? (
            <figure className={a.said}>
              <figcaption className={a.pairLabel}>
                {said.kind === "metric" ? COPY.measured : COPY.youSaid(spot.evidence?.ids[0] ?? 1)}
              </figcaption>
              <p className={a.pairText}><Said said={said} /></p>
            </figure>
          ) : null}
          {said && better ? <Icon name="arrowRight" size="md" className={a.arrow} /> : null}
          {better ? (
            <figure className={a.better}>
              <figcaption className={a.pairLabel}><Icon name="sparkle" size="sm" />{COPY.stronger(better.q)}</figcaption>
              <p className={a.pairText}><Marked parts={better.text} quoted /></p>
              {better.placeholders ? <p className={a.note}>{t("debrief.stronger.note")}</p> : null}
            </figure>
          ) : null}
        </div>
      ) : null}

      <dl className={a.lines}>
        {spot.lands ? <div><dt>{t("debrief.landsLead")}</dt><dd>{spot.lands}</dd></div> : null}
        {spot.fix ? <div><dt>{t("debrief.fixLead")}</dt><dd>{spot.fix}</dd></div> : null}
        {spot.also ? (
          <div>
            <dt>{t("debrief.alsoLead")}</dt>
            <dd>{spot.also.text} {tp("debrief.inQuestion", spot.also.ids.length)} <QuestionLinks ids={spot.also.ids} onJump={ctx.jump} />{spot.also.fix ? <> — {spot.also.fix}</> : null}</dd>
          </div>
        ) : null}
      </dl>

      {step ? (
        <div className={a.action}>
          <div className={a.actionText}>
            <p className={a.pairLabel}>{COPY.firstStep}</p>
            <p className={a.stepText}>{step.text}</p>
          </div>
          {step.drill || drill ? (
            <div className={a.drill}>
              <Button variant="primary" icon="play" data-track="drill-start" disabled={ctx.example}>{t("debrief.drill")}</Button>
              <p className={a.hint}>{ctx.example ? t("debrief.example.own") : drill ? drillHintText(drill) : null}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ ranked list ---- */

function Then({ ctx, spots, plan }: { ctx: PageCtx; spots: WeakSpotModel[]; plan: PlanStepModel[] }) {
  const id = `${ctx.uid}-then`;
  return (
    <section className={a.then} aria-labelledby={id} data-review-id="DebriefVariant/A/Then">
      <h2 id={id} className={a.sectionLabel}>{COPY.then}</h2>
      <ol className={a.rank}>
        {spots.map((w, i) => {
          const step = plan.find((p) => p.layer === w.layer);
          return (
            <li key={w.id} className={a.rankItem}>
              <span className={card.num} aria-hidden="true">{i + 2}</span>
              <div className={a.rankBody}>
                <div className={a.rankHead}>
                  <h3 className={a.rankTitle}>{w.title}</h3>
                  <LayerTag layer={w.layer} />
                </div>
                {w.fix ? <p className={a.rankFix}>{w.fix}</p> : null}
                {step ? <p className={a.rankStep}><span className={a.lead}>{COPY.planStepLabel(plan.indexOf(step) + 1)}:</span> {step.text}</p> : null}
                <div className={a.rankFoot}>
                  {w.evidence ? <EvidenceText e={w.evidence} onJump={ctx.jump} /> : null}
                </div>
                {w.said || w.lands ? (
                  <Disclosure surface="plain" title={COPY.detail} className={a.more}>
                    <dl className={a.lines}>
                      {w.said ? <div><dt>{t(w.said.kind === "metric" ? "debrief.measuredLead" : "debrief.saidLead")}</dt><dd><Said said={w.said} /></dd></div> : null}
                      {w.lands ? <div><dt>{t("debrief.landsLead")}</dt><dd>{w.lands}</dd></div> : null}
                    </dl>
                    {w.layer === "language" ? <p className={a.note}>{t("debrief.misheard.note")}</p> : null}
                  </Disclosure>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}


/* ------------------------------------------------------------------ scorecard, folded ---- */

function ScoreFold({ ctx }: { ctx: PageCtx }) {
  const rows = ctx.model.scorecard;
  if (!ctx.model.verdict || !rows?.some((r) => r.score !== null)) return null;
  const scored = rows.filter((r) => r.score !== null) as (typeof rows[number] & { score: number })[];
  const lowest = weakestFirst(rows).slice(0, 3).map((r) => `${rowLabel(r.key)} ${t("debrief.score.value", { score: r.score })}`).join(" · ");
  const skipped = rows.filter((r) => r.score === null).map((r) => rowLabel(r.key));
  return (
    <Disclosure
      as="section"
      title={t("debrief.score.title")}
      meta={<span className={a.foldMeta}>{COPY.scorecardMeta(lowest)}</span>}
      leading={<Icon name="target" size="md" />}
      className={a.fold}
    >
      <div className={a.foldBody} data-review-id="DebriefVariant/A/Scorecard">
        <p className={a.note}>{t("debrief.score.sub")} {t("debrief.misheard.note")}</p>
        <ul className={a.grid} aria-label={t("debrief.score.list")}>
          {scored.map((r) => (
            <li key={r.key} className={a.cell}>
              <span className={a.cellLabel}>{rowLabel(r.key)}</span>
              <ScoreMeter score={r.score} compact />
              {r.lost.length ? (
                <span className={a.cellLost}>{tp("debrief.score.lost", r.lost.length)} <QuestionLinks ids={r.lost} onJump={ctx.jump} /></span>
              ) : null}
            </li>
          ))}
        </ul>
        {skipped.length ? <p className={a.note}>{t("debrief.score.notAsked", { labels: skipped.join(", ") })}</p> : null}
      </div>
    </Disclosure>
  );
}
