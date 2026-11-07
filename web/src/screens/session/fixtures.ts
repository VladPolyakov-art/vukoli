/* Session fixtures (ds/screens/session.md §3, §4): docs/ia.md §6 as is: Alex Morgan, Kestrel Pay · Senior Product
 * Designer, Question 2 of 5, 07:12, 11 fillers, 289 words, 2:20, 124 wpm, two phrasings and a check. Same fixture as
 * Home and Debrief. Used by the stories and the review page only; the live app never imports this file. */
import { t } from "../../i18n";
import type { SessionData, SessionHandlers, SessionViewProps, TopBadge, TranscriptTurn } from "./types";

const noop = () => undefined;

/** Every action present, none doing anything: the review frames show each button. */
export const noopHandlers: SessionHandlers = {
  onEnd: noop, onToggleMute: noop, onInterrupt: noop, onSendNow: noop, onRedo: noop, onTypeInstead: noop, onUseVoice: noop,
  onSendText: () => true, onNext: noop, onSeeDebrief: noop, onSetSuggest: noop, onDismissBanner: noop, onUseText: noop,
  onFixSettings: noop, onResume: noop, onEndAndDebrief: noop, onTryAgain: noop, onCloseMicHelp: noop,
};

export const Q1 = "Tell me about a design project you're proud of. What was your role?";
export const Q2 = "Tell me about a time you had to change your plan late in a project. What happened?";
export const FOLLOW_UP = "What was the result for the merchants?";
const Q2_LONG = "Tell me about a time you had to change your plan late in a project because of a requirement you didn't control, such as legal, security or a partner. What happened, and what did you decide?";
const TITLE = "Kestrel Pay · Senior Product Designer";
const TITLE_LONG = "Kestrel Pay Financial Services · Senior Product Designer, Merchant Payments and Risk";

const ANSWER_Q2 = "Two weeks before launch legal asked us to add a consent step to checkout. We re-planned the sprint, and I have led the redesign last spring, so I knew the flow. We tested it with five merchants in two days, and we made it more easier for merchants to understand what they agree to. Legal give us two weeks, uh, to get the wording approved, and we like cut two smaller items to keep the date.";
const ANSWER_FOLLOW = "We shipped on time and… I think merchants were happy.";

/** A transcript turn. Names: "Mike", "You" (voice) or "You typed" (text). */
const tt = (id: string, speaker: TranscriptTurn["speaker"], time: string, text: TranscriptTurn["text"], extra: Partial<TranscriptTurn> = {}): TranscriptTurn =>
  ({ id, speaker, name: speaker === "mike" ? "Mike" : "You", time, text, ...extra });

/* The whole dialogue so far (D49: the stage is the running transcript). Question 1 is done; question 2 is current. */
const ANSWER_Q1 = "I led the redesign of the merchant onboarding flow at my last company. I ran the research, set the scope with the PM and designed the new flow end to end.";
const Q1_TURNS: TranscriptTurn[] = [
  tt("m-q1", "mike", "00:04", Q1, { question: 1 }),
  tt("u-q1", "user", "00:12", ANSWER_Q1),
];
const Q2_ASK = tt("m-q2", "mike", "06:40", Q2, { question: 2 });
const Q2_ANSWER = tt("u-q2", "user", "06:48", ANSWER_Q2);
const Q2_FOLLOW = tt("m-f2", "mike", "07:10", FOLLOW_UP, { followUp: true });
const Q2_FOLLOW_ANSWER = tt("u-f2", "user", "07:12", ANSWER_FOLLOW);
const FULL: TranscriptTurn[] = [...Q1_TURNS, Q2_ASK, Q2_ANSWER, Q2_FOLLOW, Q2_FOLLOW_ANSWER];
const typed = (turns: TranscriptTurn[]) => turns.map((x) => (x.speaker === "user" ? { ...x, name: "You typed" } : x));

export type FixtureScene =
  | "q1-start" | "follow-up" | "listening" | "thinking" | "answered" | "text" | "drill" | "english"
  | "connecting" | "interrupted-engine" | "interrupted-voice" | "mic-help" | "storage" | "browser" | "overflow"
  | "muted" | "muted-talking" | "suggester";

export interface FixtureOptions {
  scene: FixtureScene;
}

const SUGGESTION: SessionData["suggestion"] = {
  status: "ready", story: "Checkout consent step",
  answer: "Two weeks before launch, legal asked for a consent step in checkout. I stopped the sprint for a day, cut the two smallest items and agreed the wording with legal in one meeting. We tested it with five merchants and shipped on time.",
  points: ["The situation and the deadline", "What you decided yourself", "A number or a result"],
};

/** A complete SessionViewProps for one scene of the review page / Storybook. */
export function fixtureProps({ scene }: FixtureOptions): SessionViewProps {
  const base: SessionViewProps = {
    variant: "interview", input: "voice", phase: "mike-speaking", overlay: "none", firstTime: false, muted: false,
    micLevel: 0, suggester: "off", handlers: noopHandlers,
    data: {
      title: TITLE, sub: "Behavioural · Standard", progress: "Question 2 of 5", elapsed: 432, question: Q2, transcript: FULL,
      answered: true, nextNumber: 3, pauseSec: 5,
    },
  };
  const withThread = (data: Partial<SessionData>, props: Partial<SessionViewProps>): SessionViewProps => {
    const merged = { ...base.data, ...data };
    // The island's short form "2 of 5" comes from the same fixture line as the aria-label "Question 2 of 5".
    const m = /(\d+) of (\d+)/.exec(merged.progress);
    return { ...base, ...props, data: { ...merged, step: m ? { n: Number(m[1]), of: Number(m[2]) } : undefined } };
  };
  switch (scene) {
    case "q1-start":
      return withThread({
        progress: "Question 1 of 5", elapsed: 6, question: Q1, answered: false, nextNumber: 2,
        transcript: [tt("m-q1", "mike", "00:04", ["Tell me about a design project you're proud of.", " What was your role?"], { question: 1 })],
      }, { phase: "mike-speaking", firstTime: true });
    case "follow-up":
      return withThread({
        followUp: FOLLOW_UP,
        transcript: [...Q1_TURNS, Q2_ASK, Q2_ANSWER, { ...Q2_FOLLOW, text: ["What was the result", " for the merchants?"] }],
      }, { phase: "mike-speaking" });
    case "listening":
      return withThread({
        transcript: [...Q1_TURNS, Q2_ASK, tt("u-q2", "user", "06:48", "Two weeks before launch legal asked us to add a consent step to checkout. We re-planned the sprint, and I have led the redesign last spring, so I knew the flow… we tested it with", { interim: "five merchants in two" })],
      }, { phase: "listening", micLevel: 0.6 });
    case "thinking":
      return withThread({
        transcript: [...Q1_TURNS, Q2_ASK, tt("u-q2", "user", "06:48", "Two weeks before launch legal asked us to add a consent step to checkout. We tested it with five merchants in two days.")],
      }, { phase: "thinking" });
    case "answered":
      return withThread({}, { phase: "feedback" });
    case "text": {
      return withThread({
        transcript: typed([
          ...Q1_TURNS, Q2_ASK,
          tt("u-q2", "user", "07:03", "Two weeks before launch legal asked us to add a consent step to checkout. We re-planned the sprint and tested it with five merchants in two days."),
          Q2_FOLLOW, Q2_FOLLOW_ANSWER,
        ]),
        followUp: FOLLOW_UP,
      }, { input: "text", phase: "feedback" });
    }
    case "drill":
      return withThread({
        title: "Drill · Kestrel Pay · Product Manager", sub: "Focus: no result, we instead of I", progress: "Question 1 of 3", elapsed: 8, answered: false, nextNumber: 2,
        question: "Tell me about a time you led a project from start to finish. What did you do, and what was the result?",
        badges: [
          { label: "No result", tone: "outline", icon: "content" },
          { label: "\"we\" instead of \"I\"", tone: "outline", icon: "content" },
        ] satisfies TopBadge[],
        transcript: [tt("m-d1", "mike", "00:05", ["Tell me about a time you led a project from start to finish.", " What did you do, and what was the result?"], { question: 1 })],
      }, { variant: "drill", phase: "mike-speaking" });
    case "english":
      return withThread({
        title: "English · Talk about your work", sub: undefined, progress: "Turn 4", elapsed: 318, answered: true,
        question: "That sounds like a big change. How did your team react to the new roadmap?",
        badges: [{ label: "B2", tone: "outline", icon: "language" }],
        nextNumber: null,
        transcript: [
          tt("m-e1", "mike", "04:02", "So, what are you working on at the moment?"),
          tt("u-e1", "user", "04:10", "I work on the roadmap for our payments team. We plan the next two quarters."),
          tt("m-e2", "mike", "04:31", "Nice. What changed in the plan this quarter?"),
          tt("u-e2", "user", "04:40", "We discussed about the roadmap and I work here since three years."),
          tt("m-e3", "mike", "05:12", "That sounds like a big change. How did your team react to the new roadmap?"),
        ],
      }, { variant: "english", phase: "feedback" });
    case "connecting":
      return withThread({ progress: "Question 1 of 5", elapsed: 0, question: "", answered: false, nextNumber: 2, transcript: [] }, { phase: "connecting", firstTime: true });
    case "interrupted-engine":
      return withThread({}, { phase: "interrupted", overlay: "interrupted-engine" });
    case "interrupted-voice":
      return withThread({}, { phase: "interrupted", overlay: "interrupted-voice" });
    case "mic-help":
      return withThread({
        progress: "Question 1 of 5", elapsed: 6, question: Q1, answered: false, nextNumber: 2,
        transcript: [Q1_TURNS[0]!],
      }, { phase: "your-turn", overlay: "mic-help", firstTime: true, muted: true });
    case "storage":
      return withThread({}, { phase: "between", overlay: "storage" });
    case "browser":
      return withThread({}, { phase: "between", overlay: "browser" });
    case "overflow":
      return withThread({
        title: TITLE_LONG, question: Q2_LONG, elapsed: 3734,
        transcript: [...Q1_TURNS, { ...Q2_ASK, text: Q2_LONG }, Q2_ANSWER, Q2_FOLLOW, Q2_FOLLOW_ANSWER],
      }, { phase: "feedback" });
    case "muted":
      return withThread({
        transcript: [...Q1_TURNS, Q2_ASK, Q2_ANSWER, Q2_FOLLOW], followUp: FOLLOW_UP,
      }, { phase: "your-turn", muted: true });
    case "muted-talking":
      return withThread({
        transcript: [...Q1_TURNS, Q2_ASK, Q2_ANSWER, Q2_FOLLOW], followUp: FOLLOW_UP, micTip: t("session.notice.mutedSpeech"),
      }, { phase: "your-turn", muted: true });
    case "suggester":
      return withThread({
        progress: "Question 1 of 5", elapsed: 6, question: Q1, answered: false, nextNumber: 2, suggestion: SUGGESTION,
        transcript: [Q1_TURNS[0]!],
      }, { phase: "your-turn", suggester: "on" });
  }
}
