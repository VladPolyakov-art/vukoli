/* The summary of the interview Debrief view (layout D, 2026-10-27): the verdict (the step's name, the model's one line),
 * "Your level" as progress toward Ready, the rule's line ("To reach “Ready”: …") and, on the right, the one final score
 * with the skills card behind it. No scorecard block on the page: the skills open from the score.
 * The level needs a step; a verdict without one (too short, no scored row) shows the sentence alone. No scored row: no score. */
import type { ReactNode } from "react";
import { t } from "../../../i18n";
import type { ScoreRowModel, VerdictModel } from "../types";
import { verdictStep } from "../verdictStep";
import { averageScore } from "./debriefShared";
import { LevelProgress, levelProgress } from "./LevelProgress";
import { SkillsHoverCard } from "./SkillsHoverCard";
import { verdictLine } from "./verdictLine";
import s from "./summary.module.css";

export interface SummaryProps {
  verdict: VerdictModel;
  rows?: readonly ScoreRowModel[];
  id: string;
  /** For the ids of the skills card. */
  uid: string;
  /** Live only: a note under the sentence (the verdict was built without the model). */
  note?: ReactNode;
  onJump: (n: number) => void;
}

/** A verdict the server wrote before the steps existed (or the example without them) has no step: derive it from the rows
 * with the same rule (`verdictStep`); the headline stays the model's sentence. No scored row: no step, no level block. */
function withStep(verdict: VerdictModel, rows: readonly ScoreRowModel[] | undefined): VerdictModel {
  if (verdict.step !== undefined) return verdict;
  const step = verdictStep(rows);
  return step ? { ...verdict, step: step.value, gap: step.gap, target: step.target ?? undefined } : verdict;
}

export function Summary({ verdict: given, rows, id, uid, note, onJump }: SummaryProps) {
  const verdict = withStep(given, rows);
  const next = verdictLine(verdict);
  const avg = averageScore(rows);
  const progress = verdict.step !== undefined ? levelProgress(verdict.step, rows) : null;
  return (
    <section className={s.summary} aria-labelledby={id} data-skills-row="" data-review-id="Debrief/Summary" data-review-section="Debrief · Summary" data-comment-target="">
      <div className={s.verdict}>
        <h2 id={id} className="visually-hidden">{t("debrief.verdict")}</h2>
        <p className={s.headline}>{verdict.headline}</p>
        {verdict.line ? <p className={s.line}>{verdict.line}</p> : null}
        {note}
        {progress ? <LevelProgress data={progress} /> : null}
        {next ? <p className={s.next}>{next}</p> : null}
      </div>
      {avg && rows ? <SkillsHoverCard rows={rows} value={avg.value} n={avg.n} uid={uid} onJump={onJump} /> : null}
    </section>
  );
}
