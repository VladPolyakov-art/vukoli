/* The line under a "Drill these weak spots" button: shared by the Actions block and the plan's first step (D98). */
import { t, tp } from "../../../i18n";
import type { DebriefModel } from "../types";

export function drillHintText(d: NonNullable<DebriefModel["drill"]>): string {
  if (d.questions === undefined) return tp("debrief.drillHintPoints", d.points);
  return d.minutes !== undefined
    ? t("debrief.drillHint", { questions: d.questions, points: d.points, minutes: d.minutes })
    : t("debrief.drillHintNoTime", { questions: d.questions, points: d.points });
}
