/* The step of the verdict scale (D99, rubric §9.4), computed from the scorecard rows the page shows.
 * The server computes the same thing for live sessions (`debrief_view.verdict_step`) and sends it as `debrief.step`;
 * this is the one web-side copy, for the built-in example (no server). Both are tested against the same cases
 * (`server/tests/verdict_step_cases.json`), so the rule cannot drift quietly.
 *
 * A row is shown when its score is not null. Content rows: structure, own_part, result, relevance.
 *  - Not ready yet (0): any content row scores 1 or 2.
 *  - Ready (2): every shown row scores 4 or more.
 *  - Getting there (1): everything else (reflection, language and delivery can never cause 0, but below 4 they hold 1).
 *  - No shown row: no step.
 * `gap` = the rows that stand between the user and the next step, lowest score first, ties in scorecard order:
 * step 0 → the content rows at 1–2 (target 3); step 1 → every shown row at 1–3 (target 4); step 2 → none. */
import { t } from "../../i18n";
import type { ScoreKey } from "../../lib/types";
import type { ScaleStep, ScoreRowModel, VerdictModel } from "./types";

export const CONTENT_ROWS: readonly ScoreKey[] = ["structure", "own_part", "result", "relevance"];

export interface VerdictStep { value: ScaleStep; gap: ScoreKey[]; target: 3 | 4 | null }

export function verdictStep(rows: readonly { key: ScoreKey; score: number | null }[] | undefined): VerdictStep | undefined {
  const shown = (rows ?? []).flatMap((r, i) => (typeof r.score === "number" ? [{ i, key: r.key, score: r.score }] : []));
  if (!shown.length) return undefined;
  const notReady = shown.some((r) => CONTENT_ROWS.includes(r.key) && r.score <= 2);
  if (!notReady && shown.every((r) => r.score >= 4)) return { value: 2, gap: [], target: null };
  const value: ScaleStep = notReady ? 0 : 1;
  const limit = notReady ? 2 : 3;
  const gap = shown
    .filter((r) => r.score <= limit && (value === 1 || CONTENT_ROWS.includes(r.key)))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((r) => r.key);
  return { value, gap, target: notReady ? 3 : 4 };
}

const STEP_NAME = ["debrief.scale.notReady", "debrief.scale.gettingThere", "debrief.scale.ready"] as const;

/** "Not ready yet" · "Getting there" · "Ready": the headline of a verdict that has a step. */
export const stepName = (value: ScaleStep): string => t(STEP_NAME[value]);

/** The verdict model for a step: the step's name as the headline, the model's sentence under it. */
export function verdictModel(step: VerdictStep, sentence: string, strength?: string): VerdictModel {
  return { step: step.value, gap: step.gap, target: step.target ?? undefined, headline: stepName(step.value), line: sentence || undefined, strength };
}

/** The example debrief has no server: its verdict is derived from its scorecard with the same rule. */
export function verdictFromRows(rows: readonly ScoreRowModel[], sentence: string, strength?: string): VerdictModel {
  const step = verdictStep(rows);
  if (!step) throw new Error("verdictFromRows: the scorecard has no scored row");
  return verdictModel(step, sentence, strength);
}
