/* Negotiation v3 (D118, P7): the five steps of the talk, shown as a quiet strip while the call runs (only when the
 * server sent `talk_step`, i.e. the course was taken). Labels follow the scenario's family: raise has its own. */
import { t } from "../../i18n";
import type { NegotiateScenario } from "../../lib/types";

export interface TalkStepsModel {
  /** 1..5 */
  current: number;
  steps: Array<{ n: number; label: string; state: "done" | "current" | "todo" }>;
  /** For assistive tech: "Step 3 of 5: Objection". */
  summary: string;
}

const NUMBERS = [1, 2, 3, 4, 5] as const;

export function talkStepsModel(step: number | null | undefined, scenario: NegotiateScenario | null | undefined): TalkStepsModel | null {
  if (step == null || !Number.isFinite(step) || step < 1 || step > 5) return null;
  const family = scenario === "raise" ? "raise" : "offer";
  const steps = NUMBERS.map((n) => ({
    n,
    label: t(`session.steps.${family}.${n}` as "session.steps.offer.1"),
    state: n < step ? ("done" as const) : n === step ? ("current" as const) : ("todo" as const),
  }));
  return { current: step, steps, summary: t("session.steps.current", { n: step, name: steps[step - 1]!.label }) };
}
