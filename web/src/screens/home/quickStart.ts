/* Quick start (D51 item 1, "Start right away"): one click on Home starts an interview with the last settings, no setup chat.
 * - returning user: the remembered job (only if it is still saved), the remembered round, the default strictness;
 * - first visit (no interview yet): general questions, the unseen mix, the default strictness.
 * Questions = the questions-per-session setting; voice or text follows the text-mode preference. English has no
 * quick start (its start needs a level and a topic), so the start screen shows none on the English track.
 * Pure: HomeScreen builds the session config from the result, the review harness only shows it. */
import { t, tp } from "../../i18n";
import type { ScriptContext } from "./script";
import type { RoundType, Strictness } from "./types";

export interface QuickStartPlan {
  /** null = general questions. */
  jobId: string | null;
  round: RoundType;
  /** What the server is sent: it knows three round types, "technical" runs as the mix (home.md §9 B2). */
  roundType: "hr" | "behavioural" | "mix";
  strictness: Strictness;
  questions: number;
  answer: "voice" | "text";
  /** The quiet line next to the button: "Kestrel Pay · Behavioural · 5 questions · voice". */
  detail: string;
}

export function quickStartFor(ctx: ScriptContext, textMode: boolean): QuickStartPlan | null {
  if (ctx.track === "english") return null;
  const last = ctx.firstVisit ? undefined : ctx.last;
  const job = last?.jobId ? ctx.jobs.find((j) => j.id === last.jobId) ?? null : null;
  const round: RoundType = last?.round ?? "mix";
  const answer = textMode ? "text" : "voice";
  const detail = [
    job ? job.company || job.role : t("chat.suggest.general"),
    t(`home.round.${round}`),
    tp("chat.quick.questions", ctx.questions),
    t(answer === "text" ? "chat.quick.text" : "chat.quick.voice"),
  ].join(" · ");
  return {
    jobId: job?.id ?? null,
    round,
    roundType: round === "technical" ? "mix" : round,
    strictness: last?.strictness ?? ctx.strictness,
    questions: ctx.questions,
    answer,
    detail,
  };
}
