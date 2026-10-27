/* "What moves the verdict" (D99, rubric §9.4). One line under the verdict's scale, built in code, never by the model.
 *
 * The step is computed from the scorecard the user sees (server `debrief_view.verdict_step`; `verdictStep.ts` for the
 * built-in example), together with `gap`: the scorecard rows that stand between the user and the next step, lowest
 * score first. So the line states the rule exactly:
 * - Not ready yet: "To reach “Getting there”: get <rows> to 3 of 5 or more."
 * - Getting there: "To reach “Ready”: get <rows> to 4 of 5 or more."
 * - Ready: "Keep it: <strength>" when the debrief has one, else no line.
 * - No step (too short, no scored row, older server), or a step 0/1 without a gap: no line.
 * <rows> are the scorecard's own labels: one, "A and B", "A, B and C", or the first two and "N more". */
import { t } from "../../../i18n";
import type { VerdictModel } from "../types";

const STEP_KEY = ["scale.notReady", "scale.gettingThere", "scale.ready"] as const;

/** Rows named in the line; with more in the gap the rest become "and N more". Three are all named: a third name
 * takes no more room than "and 1 more". */
const NAMED = 3;

export function rowsText(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return t("debrief.verdictLine.two", { a: labels[0]!, b: labels[1]! });
  if (labels.length === NAMED) return t("debrief.verdictLine.three", { a: labels[0]!, b: labels[1]!, c: labels[2]! });
  return t("debrief.verdictLine.more", { a: labels[0]!, b: labels[1]!, n: labels.length - 2 });
}

export function verdictLine(verdict: VerdictModel): string | null {
  const step = verdict.step;
  if (step === undefined) return null;
  if (step === 2) {
    const strength = verdict.strength?.trim();
    return strength ? t("debrief.verdictLine.keep", { strength }) : null;
  }
  const labels = (verdict.gap ?? []).map((key) => t(`debrief.score.row.${key}`));
  if (!labels.length || !verdict.target) return null;
  return t("debrief.verdictLine.up", { next: t(`debrief.${STEP_KEY[step + 1]!}`), rows: rowsText(labels), target: verdict.target });
}
