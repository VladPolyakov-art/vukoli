/* Session fixtures (ds/screens/session.md §3, §4): docs/ia.md §6 as is: Alex Morgan, Kestrel Pay · Senior Product
 * Designer, Question 2 of 5, 07:12, 11 fillers, 289 words, 2:20, 124 wpm, two phrasings and a check. Same fixture as
 * Home and Debrief. Used by the stories and the review page only; the live app never imports this file. */
import type { FeedbackRecord, LanguageItem } from "../../lib/types";
import type { Thread } from "../../session/reducer";
import { t } from "../../i18n";
import type { SessionData, SessionHandlers, SessionViewProps, TopBadge, TranscriptTurn } from "./types";

const noop = () => undefined;

/** Every action present, none doing anything: the review frames show each button. */
export const noopHandlers: SessionHandlers = {
  onEnd: noop, onToggleMute: noop, onInterrupt: noop, onSendNow: noop, onRedo: noop, onTypeInstead: noop, onUseVoice: noop,
  onSendText: () => true, onNext: noop, onSeeDebrief: noop, onFlag: noop, onSaveHeard: noop, onStronger: noop,
  onEdit: noop, onSaveEdit: noop, onCancelEdit: noop, onSetSuggest: noop, onDismissBanner: noop, onUseText: noop,
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
const STRONGER = "Two weeks before launch, legal asked us to add a consent step to checkout. I cut two lower-priority items from the sprint, agreed the new scope with legal and engineering in one meeting, and we tested the step with five merchants in two days. We shipped on time, and drop-off at that step stayed under 2%.";
const STRONGER_LONG = "Three weeks before launch, legal told us a new regulation required a consent step in checkout. I stopped the sprint for a day, listed what the step touched, and cut three lower-priority items so the date could hold. I agreed the wording with legal in one meeting and rebuilt the flow with one engineer. We tested it with five merchants in two days and fixed two unclear labels. We shipped on time, drop-off at that step stayed under 2%, and legal reused our flow for two other products.";

const flag1: LanguageItem = {
  id: "f1", tag: "tense", original: "I have led the redesign last spring", heard_as: "I have led the redesign last spring",
  better: ["I led the redesign last spring"], reason: "A finished time (\"last spring\") takes the past simple.", level: "B1", severity: 2, status: "active",
};
const flag2: LanguageItem = {
  id: "f2", tag: "word_choice", original: "we made it more easier for merchants", heard_as: "we made it more easier for merchants",
  better: ["we made it much easier for merchants"], reason: "\"Easier\" is already a comparative.", level: "A2", severity: 2, status: "active",
};
const flag3: LanguageItem = {
  id: "f3", tag: "tense", original: "we decide to cut two items", heard_as: "we decide to cut two items",
  better: ["we decided to cut two items"], reason: "The story is in the past, so the verb takes the past simple.", level: "B1", severity: 1, status: "active",
};
const check: LanguageItem = {
  id: "c1", tag: "tense", original: "legal give us two weeks", heard_as: "legal give us two weeks", better: ["legal gave us two weeks"],
  reason: "", level: "B1", severity: 1, possibly_misheard: true, status: "unconfirmed",
};
const figure: LanguageItem = {
  id: "f4", tag: "word_choice", original: "figure file", heard_as: "figure file", better: ["Figma file"], reason: "", severity: 1, status: "dismissed",
};

interface Opts {
  withChecks: boolean;
  dismissedFlag?: boolean;
  openFlag?: boolean;
  overflow?: boolean;
  text?: boolean;
}

function mainRecord(o: Opts): FeedbackRecord {
  const items: LanguageItem[] = [
    o.openFlag ? { ...flag1, status: "dismissed" } : flag1,
    flag2,
    ...(o.overflow ? [flag3] : []),
    ...(o.withChecks && !o.text ? [check] : []),
    ...(o.dismissedFlag ? [figure] : []),
  ];
  return {
    id: "fb-q2-main", turn_id: 3, question: Q2, question_id: "q2", competency: "adaptability", answer_kind: "main",
    answer: ANSWER_Q2, source: o.text ? "text" : "voice", complete: true,
    stronger: { rewrite: o.overflow ? STRONGER_LONG : STRONGER, placeholders: [] },
    layers: {
      content: {
        status: "fix", fix: "End with what changed: a number or a decision.", missing: ["no_result"],
        tips: ["\"we\" → \"I\" ×2 in the action part. Say \"I\" for what you did."],
      },
      language: { status: "fix", items },
      delivery: o.text
        ? { status: "ok", metrics: { words: 289, mode: "text" } }
        : {
          status: "fix", fix: "Most fillers were \"uh\" (6) and \"like\" (4) at the start of a sentence. Pause silently instead.",
          metrics: {
            words: 289, fillers: 11, seconds: 140, wpm: 124, mode: "voice",
            fillers_note: "Filler counts may be low: the local recogniser can drop some \"um\"s.",
          },
        },
    },
  };
}

const followRecord: FeedbackRecord = {
  id: "fb-q2-follow", turn_id: 5, question: FOLLOW_UP, question_id: "q2", competency: "adaptability", answer_kind: "follow_up",
  answer: ANSWER_FOLLOW, source: "voice", complete: true,
  layers: { content: { status: "ok" }, language: { status: "ok", items: [] }, delivery: { status: "ok" } },
};

const q1Record: FeedbackRecord = {
  id: "fb-q1-main", turn_id: 1, question: Q1, question_id: "q1", competency: "ownership", answer_kind: "main",
  answer: "I led the redesign of the merchant onboarding flow at my last company.", source: "voice", complete: true,
  layers: {
    content: { status: "fix", fix: "Name what you decided yourself, not what the team did.", missing: [] },
    language: { status: "ok", items: [] },
    delivery: { status: "ok", metrics: { words: 120, fillers: 3, seconds: 62, wpm: 116, mode: "voice" } },
  },
};

const english1: FeedbackRecord = {
  id: "fb-turn4", turn_id: 7, question: "", question_id: "", competency: "", answer_kind: "turn",
  answer: "We discussed about the roadmap and I work here since three years.", source: "voice", complete: true,
  layers: {
    language: {
      status: "fix",
      items: [
        { id: "e1", tag: "preposition", original: "we discussed about the roadmap", heard_as: "we discussed about the roadmap", better: ["we discussed the roadmap"], reason: "\"Discuss\" takes no \"about\".", level: "B1", severity: 2, status: "active" },
        { id: "e2", tag: "tense", original: "I work here since three years", heard_as: "I work here since three years", better: ["I have worked here for three years"], reason: "\"Since\" and \"for\" with a period of time take the present perfect.", level: "B1", severity: 2, status: "active" },
      ],
    },
  },
};

function thread(key: string, number: number, question: string, records: FeedbackRecord[]): Thread {
  return { key, number, question, records, pendingIds: [], unavailable: [] };
}

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
  | "q1-start" | "follow-up" | "listening" | "thinking" | "feedback" | "that-not-said" | "edit" | "edit-failed" | "rechecking" | "text" | "drill" | "english"
  | "connecting" | "interrupted-engine" | "interrupted-voice" | "mic-help" | "storage" | "browser" | "overflow"
  | "preparing" | "unavailable" | "layers-unavailable" | "muted" | "muted-talking" | "suggester";

export interface FixtureOptions {
  scene: FixtureScene;
  layerOrder?: SessionViewProps["layerOrder"];
  withChecks?: boolean;
}

const SUGGESTION: SessionData["suggestion"] = {
  status: "ready", story: "Checkout consent step",
  answer: "Two weeks before launch, legal asked for a consent step in checkout. I stopped the sprint for a day, cut the two smallest items and agreed the wording with legal in one meeting. We tested it with five merchants and shipped on time.",
  points: ["The situation and the deadline", "What you decided yourself", "A number or a result"],
};

/** A complete SessionViewProps for one scene of the review page / Storybook. */
export function fixtureProps({ scene, layerOrder = "content-first", withChecks = true }: FixtureOptions): SessionViewProps {
  const base: SessionViewProps = {
    variant: "interview", input: "voice", phase: "mike-speaking", overlay: "none", firstTime: false, muted: false,
    micLevel: 0, layerOrder, withChecks, suggester: "off", handlers: noopHandlers,
    data: {
      title: TITLE, sub: "Behavioural · Standard", progress: "Question 2 of 5", elapsed: 432, question: Q2, transcript: FULL,
      answered: true, thread: null, earlier: [thread("q1", 1, Q1, [q1Record])], nextNumber: 3, pauseSec: 5,
    },
  };
  const q2 = (o: Partial<Opts> = {}) => thread("q2", 2, Q2, [mainRecord({ withChecks, ...o }), followRecord]);
  const withThread = (data: Partial<SessionData>, props: Partial<SessionViewProps>): SessionViewProps => {
    const merged = { ...base.data, ...data };
    // The island's short form "2 of 5" comes from the same fixture line as the aria-label "Question 2 of 5".
    const m = /(\d+) of (\d+)/.exec(merged.progress);
    return { ...base, ...props, data: { ...merged, step: m ? { n: Number(m[1]), of: Number(m[2]) } : undefined } };
  };
  switch (scene) {
    case "q1-start":
      return withThread({
        progress: "Question 1 of 5", elapsed: 6, question: Q1, answered: false, earlier: [], nextNumber: 2,
        transcript: [tt("m-q1", "mike", "00:04", ["Tell me about a design project you're proud of.", " What was your role?"], { question: 1 })],
      }, { phase: "mike-speaking", firstTime: true });
    case "follow-up":
      return withThread({
        followUp: FOLLOW_UP, thread: null,
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
    case "feedback":
      return withThread({ thread: q2() }, { phase: "feedback", defaultStrongerOpen: true });
    case "that-not-said":
      return withThread({ thread: q2({ openFlag: true, dismissedFlag: true }) }, { phase: "feedback", initialOpenHeard: "f1" });
    case "edit":
      return withThread({ thread: q2(), edit: { answer: ANSWER_Q2, followUp: ANSWER_FOLLOW } }, { phase: "editing" });
    case "edit-failed":
      return withThread({
        thread: q2(),
        edit: { answer: ANSWER_Q2, followUp: ANSWER_FOLLOW, error: "Your answer was not changed. Try again in a moment." },
      }, { phase: "editing" });
    case "rechecking":
      return withThread({ thread: q2() }, { phase: "rechecking" });
    case "text": {
      const th = q2({ text: true });
      th.records = th.records.map((r) => ({ ...r, source: "text" }));
      return withThread({
        thread: th,
        transcript: typed([
          ...Q1_TURNS, Q2_ASK,
          tt("u-q2", "user", "07:03", "Two weeks before launch legal asked us to add a consent step to checkout. We re-planned the sprint and tested it with five merchants in two days."),
          Q2_FOLLOW, Q2_FOLLOW_ANSWER,
        ]),
        followUp: FOLLOW_UP,
      }, { input: "text", phase: "feedback", withChecks: false });
    }
    case "drill":
      return withThread({
        title: "Drill · Kestrel Pay · Product Manager", sub: "Focus: no result, we instead of I", progress: "Question 1 of 3", elapsed: 8, answered: false, earlier: [], nextNumber: 2,
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
        thread: thread("t4", 4, "", [english1]), earlier: [thread("t3", 3, "", [])], nextNumber: null,
        transcript: [
          tt("m-e1", "mike", "04:02", "So, what are you working on at the moment?"),
          tt("u-e1", "user", "04:10", "I work on the roadmap for our payments team. We plan the next two quarters."),
          tt("m-e2", "mike", "04:31", "Nice. What changed in the plan this quarter?"),
          tt("u-e2", "user", "04:40", english1.answer),
          tt("m-e3", "mike", "05:12", "That sounds like a big change. How did your team react to the new roadmap?"),
        ],
      }, { variant: "english", phase: "feedback", withChecks: false });
    case "connecting":
      return withThread({ progress: "Question 1 of 5", elapsed: 0, question: "", answered: false, earlier: [], nextNumber: 2, transcript: [] }, { phase: "connecting", firstTime: true });
    case "interrupted-engine":
      return withThread({ thread: q2() }, { phase: "interrupted", overlay: "interrupted-engine" });
    case "interrupted-voice":
      return withThread({ thread: q2() }, { phase: "interrupted", overlay: "interrupted-voice" });
    case "mic-help":
      return withThread({
        progress: "Question 1 of 5", elapsed: 6, question: Q1, answered: false, earlier: [], nextNumber: 2,
        transcript: [Q1_TURNS[0]!],
      }, { phase: "your-turn", overlay: "mic-help", firstTime: true, muted: true });
    case "storage":
      return withThread({ thread: q2() }, { phase: "between", overlay: "storage" });
    case "browser":
      return withThread({ thread: q2() }, { phase: "between", overlay: "browser" });
    case "overflow":
      return withThread({
        title: TITLE_LONG, question: Q2_LONG, thread: q2({ overflow: true }), elapsed: 3734,
        transcript: [...Q1_TURNS, { ...Q2_ASK, text: Q2_LONG }, Q2_ANSWER, Q2_FOLLOW, Q2_FOLLOW_ANSWER],
        stronger: undefined,
      }, { phase: "feedback", defaultStrongerOpen: true });
    case "preparing":
      return withThread({ thread: { ...q2(), records: [], pendingIds: ["fb-q2-main"] } }, { phase: "preparing" });
    case "unavailable":
      return withThread({ thread: { ...q2(), records: [], unavailable: [{ id: "fb-q2-main", code: "unavailable", message: "" }] } }, { phase: "unavailable" });
    case "layers-unavailable": {
      // The engine failed on content and language; delivery is measured locally and still reports.
      const main = mainRecord({ withChecks });
      const record: FeedbackRecord = { ...main, stronger: undefined, layers: { content: { status: "unavailable" }, language: { status: "unavailable" }, delivery: main.layers.delivery } };
      return withThread({ thread: thread("q2", 2, Q2, [record]) }, { phase: "feedback" });
    }
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
        progress: "Question 1 of 5", elapsed: 6, question: Q1, answered: false, earlier: [], nextNumber: 2, suggestion: SUGGESTION,
        transcript: [Q1_TURNS[0]!],
      }, { phase: "your-turn", suggester: "on" });
  }
}
