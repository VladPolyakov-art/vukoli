/* A layout stress set for the question switcher: more questions than the fixtures have. The server caps a session at 10
 * (`questions_per_session` 1-10); 12 is the degrade case. Questions 6+ reuse the answers and notes of 1-5 with new,
 * plausible question texts: not a real session. Used by stories and the review page only. */
import type { DebriefModel } from "./types";

const MORE_QUESTIONS = [
  "Tell me about a launch that did not go to plan.",
  "How do you decide what to cut when the deadline does not move?",
  "Walk me through how you measured whether a redesign worked.",
  "Tell me about feedback on your work that you disagreed with.",
  "How do you get up to speed in a product area you do not know?",
  "Describe a time you simplified a flow that had grown too complex.",
  "What would you focus on in your first 90 days on this team?",
];
export function withQuestions(model: DebriefModel, count: number): DebriefModel {
  const base = model.questions;
  const questions = Array.from({ length: count }, (_, i) => {
    const src = base[i % base.length]!;
    return i < base.length ? src : { ...src, n: i + 1, question: MORE_QUESTIONS[i - base.length] ?? src.question };
  });
  return { ...model, questions };
}
