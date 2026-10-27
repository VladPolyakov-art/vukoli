/* Plan for the next session + the one primary action (layout D, 2026-10-27; D98 US-20 AC8, rubric §9.3). One compact
 * block: a heading row with the hint and "Drill these weak spots" (the page's only primary button), then up to three
 * one-line steps, each with the weak spot it comes from (its title) and links to the questions where it showed. The
 * weak spots are folded into the steps; what was said / how it lands / how to fix sits on the first evidence question.
 * An older debrief with no plan lists its weak spots in the same shape under "What to work on". The example's button is
 * off and says why. */
import { Button, Card } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { DebriefModel, Layer, PlanStepModel, WeakSpotModel } from "../types";
import { drillHintText } from "./drillHint";
import { QuestionLinks } from "./QuestionLinks";
import s from "./plan.module.css";

export interface PlanProps {
  /** Up to three steps, in the configured layer order. Empty: the weak spots stand in (an older debrief). */
  steps: PlanStepModel[];
  /** The weak spots in the same order. */
  spots: WeakSpotModel[];
  id: string;
  drill?: DebriefModel["drill"];
  /** The drill action is offered (an interview with a verdict; not a too-short session). */
  showDrill: boolean;
  /** The example debrief: the drill is not available, the hint says it is in the user's own debrief. */
  example?: boolean;
  /** The storage is not writable: Download is the page's primary, so the drill is secondary. */
  storageError?: boolean;
  onDrill?: () => void;
  onJump: (n: number) => void;
}

interface Item { id: string; layer: Layer; text: string; spot?: WeakSpotModel }

export function Plan({ steps, spots, id, drill, showDrill, example, storageError, onDrill, onJump }: PlanProps) {
  const items: Item[] = steps.length
    ? steps.map((p) => ({ id: p.id, layer: p.layer, text: p.text, spot: spots.find((w) => w.layer === p.layer) }))
    : spots.map((w) => ({ id: w.id, layer: w.layer, text: w.fix ?? "", spot: w }));
  if (!items.length && !showDrill) return null;
  const hint = example ? t("debrief.example.own") : drill ? drillHintText(drill) : null;
  return (
    <Card as="section" padding="md" className={s.plan} aria-labelledby={id} data-review-id="Debrief/Plan" data-review-section="Debrief · Plan" data-comment-target="">
      <div className={s.head}>
        <h2 id={id} className={s.label}>{steps.length ? t("debrief.plan.card") : t("debrief.workOn")}</h2>
        {showDrill ? (
          <div className={s.drill}>
            {hint ? <p className={s.hint}>{hint}</p> : null}
            <Button variant={storageError ? "secondary" : "primary"} icon="play" data-track="drill-start" disabled={example} onClick={onDrill}>{t("debrief.drill")}</Button>
          </div>
        ) : null}
      </div>
      {items.length ? (
        <ol className={s.steps}>
          {items.map((p, i) => {
            const e = p.spot?.evidence;
            return (
              <li key={p.id} className={s.step}>
                <span className={s.num} aria-hidden="true">{i + 1}</span>
                <p className={s.text}>
                  {p.spot ? <span className={s.title}>{p.spot.title}{p.text ? ". " : ""}</span> : null}
                  {p.text ? <span className={s.do}>{p.text}</span> : null}
                </p>
                {e ? (
                  <span className={s.links}>
                    {e.kind === "most" ? t("debrief.evidence.mostIn") : tp("debrief.evidence.questions", e.ids.length)}{" "}
                    <QuestionLinks ids={e.ids} onJump={onJump} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </Card>
  );
}
