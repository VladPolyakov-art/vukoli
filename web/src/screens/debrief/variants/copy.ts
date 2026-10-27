/* New chrome strings used only by the debrief variants (exploration, 2026-10-27). The live screen takes every string
 * from the locale file (GR3); when the owner picks a variant these move into `i18n/en.json` under `debrief.*` and this
 * file goes. Existing strings are still read through `t()`. */
import type { Layer, ScaleStep } from "../types";
import type { ScoreKey } from "../../../lib/types";

export const COPY = {
  // A · one main focus
  startHere: "Start here",
  planStep: (n: number, total: number) => `Step ${n} of ${total} in your plan`,
  seenIn: (n: number) => (n === 1 ? "Seen in question" : "Seen in questions"),
  youSaid: (q: number) => `You said in question ${q}`,
  measured: "Measured",
  stronger: (q: number) => `Stronger version of question ${q}`,
  firstStep: "Your first step",
  planStepLabel: (n: number) => `Plan, step ${n}`,
  then: "Then",
  thenSub: "In the order you set in Settings: content first.",
  thenSubDelivery: "In the order you set in Settings: delivery first.",
  detail: "What you said and how it lands",
  scorecardMeta: (rows: string) => `Lowest: ${rows}`,
  // B · skills list
  skills: "Your skills in this session",
  skillsSub: "Weakest first. Practice scores from this app's rubric, not a hiring prediction.",
  holds: (step: ScaleStep) => (step === 0 ? "Needed for “Getting there”" : "Needed for “Ready”"),
  noPointsLost: "No points lost.",
  weakSpot: "Weak spot",
  planCard: "Your plan for the next session",
  // C · question-led
  takeaways: "Three things to take away",
  takeawaysOne: "One thing to take away",
  scores: "Scores",
  scoresSub: "Practice scores out of 5, not a hiring prediction.",
  lostOn: "Lost points on",
  noLoss: "No points lost in this answer.",
  answerAndStronger: "Your answer and a stronger version",
  questionsSub: (n: number) => `${n} questions, in the order Mike asked them. Each one has its own notes.`,
  heardAs: "Heard as",
  say: "Say",
  // D · question switcher (owner's functional asks, 2026-10-27)
  average: (n: number) => `Average of ${n} skills`,
  averageSr: (score: string) => `Average score: ${score} out of 5.`,
  outOf: "/5",
  skillsTitle: "Your skills, weakest first",
  close: "Close",
  level: "Your level",
  levelSr: (name: string, n: number) => `Your level: ${name}, step ${n} of 3 (Not ready yet, Getting there, Ready).`,
  levelCaption: (step: number, done: number, total: number) =>
    step >= 2 ? `All ${total} skills at 4/5 or more` : step === 1 ? `${done} of ${total} skills at 4/5 or more` : `${done} of ${total} answer skills at 3/5 or more`,
  levelToGo: (n: number, next: string) => `${n} to go to “${next}”`,
  questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
  questionsNav: "Questions from this interview",
  feedback: "Feedback",
  prev: "Previous",
  nextQ: (n: number) => `Next: question ${n}`,
  prevQuestion: "Previous question",
  nextQuestion: "Next question",
  lastQuestion: "Last question",
  fromWeakSpot: "Weak spot",
  // Variant labels for the stories frame
  current: "Current (live)",
} as const;

/* A one-line tip per scorecard row for rows that carry no weak spot (B). Built in code from the rubric (§2.3, §9.3),
 * never by the model. 🟡 New content: needs the owner's yes and a rubric table before it ships. */
export const ROW_TIP: Record<ScoreKey, string> = {
  structure: "Tell it in order: the situation, what you did, what changed.",
  own_part: "Say “I” for what you did, “we” for what the team shipped.",
  result: "End with a number or a decision.",
  relevance: "Open with a one-sentence answer, then the story.",
  reflection: "Add one last sentence: what you would do differently.",
  language: "Drill this session's corrections out loud.",
  delivery: "Pause silently instead of “uh” and “like”.",
};

/* Which layer a scorecard row belongs to (rubric §9.1: five content rows, then English and Delivery). */
export const ROW_LAYER: Record<ScoreKey, Layer> = {
  structure: "content",
  own_part: "content",
  result: "content",
  relevance: "content",
  reflection: "content",
  language: "language",
  delivery: "delivery",
};
