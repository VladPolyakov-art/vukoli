/* Fictional fixtures for the Debrief (GR2). Real user: Alex Morgan, Product Designer; session S2 = Kestrel Pay,
 * Oct 19, 8:40 PM (docs/ia.md §6, invariants 3–5). English S3. Example = Sam Rivera, PM, Brightline (invariant 10).
 * Numbers must agree everywhere: fillers 8 · 11 · 6 · 12 · 8 = 45 → 9 per answer; lengths 1:50 · 2:20 · 1:35 · 3:40 · 2:05. */
import { t, tp } from "../../i18n";
import type {
  Correction, DebriefModel, DeliveryBlock, EnglishModel, MetaItem, QuestionModel, Segments, WeakSpotModel,
} from "./types";

const saved: MetaItem = { icon: "check", text: t("debrief.savedHere"), href: "/settings/storage" };
const counts = (questions: number, followUps: number) =>
  `${tp("debrief.meta.questions", questions)}, ${tp("debrief.meta.followUps", followUps)}`;

const fillersLabel = (n: number) => tp("debrief.sum.fillers", n);
const NOTHING_CONTENT = t("debrief.sum.contentNothing");
const NOTHING_LANGUAGE = t("debrief.sum.languageNothing");
const NO_RESULT = "No result";
const noResultBlock = { text: "End with what changed: a number or a decision. The result is missing." };

const delivery = (fillers: number, length: string, wpm: number, mostFillers?: string, extra: Partial<DeliveryBlock> = {}): DeliveryBlock => {
  const [m, s] = length.split(":").map(Number) as [number, number];
  return {
    fillers, length, words: Math.round((wpm * (m * 60 + s)) / 60), pace: { wpm, verdict: "comfortable" }, mostFillers, ...extra,
  };
};

/* ---------------------------------------------------------------- S2 · interview ---- */

const ledFix: Correction = {
  id: "q2-led",
  heard: ["…and ", { kind: "heard", text: "I have led" }, " the redesign last spring, so…"],
  say: ["I ", { kind: "fix", text: "led" }, " the redesign last spring"],
  why: "A finished time (“last spring”) takes the past simple.",
};
const easierFix: Correction = {
  id: "q2-easier",
  heard: ["…we made it ", { kind: "heard", text: "more easier" }, " for merchants…"],
  say: ["we made it ", { kind: "fix", text: "much easier" }],
  why: "“Easier” is already a comparative, so it doesn't take “more”.",
};

const q1: QuestionModel = {
  n: 1,
  question: "Tell me about yourself and your current role.",
  summary: { content: NO_RESULT, language: NOTHING_LANGUAGE, delivery: fillersLabel(8) },
  duration: "1:50", startsAt: "00:35", followUps: 1,
  followUp: "Can you give me one number from that onboarding project?",
  answer: [
    "I'm a product designer with six years of experience, mostly in fintech and healthcare. Right now I lead design for the merchant dashboard at a payments company. Uh, I work with two engineers and a PM, and I like to start with research. Last year I, like, rebuilt the onboarding and we got a lot of positive feedback.",
  ],
  followUpAnswer: "I don't remember exactly, maybe a bit higher completion. Uh, it felt much better for users.",
  layers: {
    content: { items: [noResultBlock] },
    language: { corrections: [], removed: [] },
    delivery: delivery(8, "1:50", 118, "“uh” (5), “like” (3)"),
  },
  stronger: {
    status: "ready", placeholders: true,
    text: ["I design the merchant dashboard at a payments company, with two engineers and a PM. Last year I rebuilt the onboarding after five merchant interviews; setup completion went from ", { kind: "fix", text: "[your number]" }, " to ", { kind: "fix", text: "[your number]" }, "."],
  },
};

const q2: QuestionModel = {
  n: 2,
  question: "Tell me about a time you had to change a design late in a project.",
  summary: { content: `${NO_RESULT} · “we” → “I” ×2`, language: tp("debrief.sum.phrasings", 2), delivery: fillersLabel(11) },
  duration: "2:20", startsAt: "03:35", followUps: 1, misheard: 1,
  followUp: "What was the result for the merchants?",
  answer: [
    "Two weeks before launch, legal ", { kind: "unsure", text: "give" },
    " us a new requirement: we needed an explicit consent step in checkout. Uh, we redesigned it, and I have led the redesign last spring, so I knew the flow really well. Like, the risk was that one more step kills conversion. We made it more easier for merchants — the consent is now inline with the pay button, not a separate screen. We tested it with five merchants and, uh, we shipped on time.",
  ],
  followUpAnswer: "We shipped on time and… I think merchants were happy. Support tickets about checkout didn't go up.",
  layers: {
    content: {
      items: [
        { text: "End with what changed: a number or a decision. The result is missing." },
        { lead: "“we” → “I” ×2:", text: "“we redesigned it”, “we tested it” — say “I” for what you did." },
      ],
    },
    language: {
      note: true,
      corrections: [ledFix, easierFix],
      removed: [{ kind: "misheard", text: "figure file" }, { kind: "unsure", n: 1 }],
    },
    delivery: delivery(11, "2:20", 124, "“uh” (6), “like” (4)", { engineNote: true }),
  },
  stronger: {
    status: "ready", placeholders: true,
    text: [
      "Two weeks before launch, legal asked for an explicit consent step in checkout. I led the redesign: instead of a new screen, I put the consent inline next to the pay button, so checkout stayed one step. I tested it with five merchants in three days, and we shipped on time. Checkout conversion stayed at ",
      { kind: "fix", text: "[your number]" }, ", and support tickets about checkout didn't rise.",
    ],
  },
};

const q3: QuestionModel = {
  n: 3,
  question: "How do you work with engineers during handoff?",
  summary: { content: NOTHING_CONTENT, language: NOTHING_LANGUAGE, delivery: fillersLabel(6) },
  duration: "1:35", startsAt: "07:55", followUps: 0,
  answer: [
    "I involve engineers early. I share the file in the first week, we walk through states together, and I write short notes for edge cases. After handoff I join their stand-up twice a week to catch drift. We cut design-related bugs in half last quarter.",
  ],
  layers: {
    content: { items: [] },
    language: { corrections: [], removed: [] },
    delivery: delivery(6, "1:35", 131, "“like” (3), “uh” (2)"),
  },
  stronger: { status: "ready", text: ["I bring engineers in during the first week, walk through every state together, and join their stand-up twice a week after handoff. That cut design-related bugs in half last quarter."] },
};

const q4: QuestionModel = {
  n: 4,
  question: "Describe a disagreement with a product manager. How did you resolve it?",
  summary: { content: `${NO_RESULT} · “we” → “I”`, language: NOTHING_LANGUAGE, delivery: fillersLabel(12) },
  duration: "3:40", startsAt: "10:05", followUps: 1,
  followUp: "What did you personally do to resolve it?",
  answer: [
    "We disagreed about the scope of the new merchant dashboard. The PM wanted to ship all twelve widgets, uh, but I thought it was too much for a first release. We talked about it, like, several times and in the end we compromised. We cut the widgets to six and we launched.",
  ],
  followUpAnswer: "We showed usage data from the old dashboard and, uh, agreed to start smaller.",
  layers: {
    content: {
      items: [
        { text: "End with what changed: a number or a decision. The result is missing." },
        { lead: "“we” → “I”:", text: "“we compromised”, “we showed” — say “I” for what you did." },
      ],
    },
    language: { corrections: [], removed: [] },
    delivery: delivery(12, "3:40", 109, "“uh” (7), “like” (5)"),
  },
  stronger: { status: "ready", placeholders: true, text: ["The PM wanted all twelve widgets in the first release. I pulled usage data from the old dashboard and showed that six widgets covered most visits, so we shipped those. The launch went out on time and ", { kind: "fix", text: "[your number]" }, " of merchants used the new view in week one."] },
};

const q5: QuestionModel = {
  n: 5,
  question: "Why do you want to join Kestrel Pay?",
  summary: { content: NOTHING_CONTENT, language: tp("debrief.sum.phrasings", 1), delivery: fillersLabel(8) },
  duration: "2:05", startsAt: "15:00", followUps: 1,
  followUp: "What would you want to improve first?",
  answer: [
    "Kestrel is moving into small-business payments, and I have led the design system rollout last year at my company, so I'd like to apply that to a product where the checkout is the whole experience. Uh, I also like that the design team is still small.",
  ],
  followUpAnswer: "The consent and error states in checkout. They are, like, the moments people lose trust.",
  layers: {
    content: { items: [] },
    language: {
      corrections: [{
        id: "q5-led",
        heard: ["…and ", { kind: "heard", text: "I have led" }, " the design system rollout last year…"],
        say: ["I ", { kind: "fix", text: "led" }, " the design system rollout last year"],
        why: "A finished time (“last year”) takes the past simple.",
      }],
      removed: [],
    },
    delivery: delivery(8, "2:05", 121, "“uh” (5), “like” (3)"),
  },
  stronger: { status: "ready", text: ["Kestrel is moving into small-business payments, where checkout is the whole experience. I led the design system rollout last year, and I'd like to apply that here, starting with consent and error states."] },
};

const interviewWeakSpots: WeakSpotModel[] = [
  {
    id: "ws-content", layer: "content", title: "No measurable result in 3 of 5 answers",
    evidence: { kind: "questions", ids: [1, 2, 4] },
    fix: "End every story with a number or a decision: “conversion stayed at 4.1%”, “we dropped the second screen”.",
    also: { text: "“we” instead of “I”", ids: [2, 4], fix: "say “I” for what you did." },
  },
  {
    id: "ws-language", layer: "language", title: "“I have led” for finished projects — 2 times",
    evidence: { kind: "questions", ids: [2, 5] },
    fix: "say “I led” when you name a finished time (“last spring”, “in 2023”).",
  },
  {
    id: "ws-delivery", layer: "delivery", title: "9 fillers per answer on average",
    evidence: { kind: "most", ids: [4], trail: "(12)" },
    fix: "pause silently instead of “uh” and “like”.",
  },
];

export const interviewS2: DebriefModel = {
  id: "s2",
  title: "Kestrel Pay · Senior Product Designer",
  meta: [
    { icon: "briefcase", text: "Behavioural · Standard" },
    { icon: "clock", text: "Oct 19, 8:40 PM · 24 min" },
    { icon: "chat", text: counts(5, 4) },
    // D88: requests this session sent, and the share of the plan where the plan reports one.
    { icon: "cpu", text: `${tp("debrief.meta.requests", 17)} · ${t("debrief.meta.spent", { used: t("engines.limits.underOne"), window: "monthly" })}` },
    saved,
  ],
  obsidian: true,
  saved: true,
  verdict: { step: 1, headline: "Getting there", line: "Clear stories, but 3 of 5 answers end before the result." },
  weakSpots: interviewWeakSpots,
  drill: { questions: 3, points: 4, minutes: 12 },
  questions: [q1, q2, q3, q4, q5],
};

/* ---------------------------------------------------------------- overflow (+30%) ---- */

const LONG_TITLE = "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools";
const LONG_TOKEN = "https://northwind-logistics.example.com/careers/senior-product-designer-platform-internal-tools-2026";

export const interviewLong: DebriefModel = {
  ...interviewS2,
  id: "s-long",
  title: LONG_TITLE,
  verdict: {
    step: 1, headline: "Getting there",
    line: "Clear, well-structured stories, but 3 of 5 answers end before the result, and two of them skip the part you personally did.",
  },
  weakSpots: [
    {
      ...interviewWeakSpots[0]!, title: "No measurable result in 3 of 5 answers, and in two of them no decision either",
      fix: "End every story with a number or a decision: “conversion stayed at 4.1%”, “we dropped the second screen”, “support tickets did not rise”.",
      also: { text: "“we” instead of “I” when you describe your own part", ids: [2, 4], fix: "say “I” for what you did and “we” for what the team shipped." },
    },
    {
      ...interviewWeakSpots[1]!, title: "“I have led” for finished projects — 2 times, once next to a date",
      fix: "say “I led” when you name a finished time (“last spring”, “in 2023”, “two quarters ago”). Keep “I have led” for things you still do.",
    },
    {
      ...interviewWeakSpots[2]!, title: "9 fillers per answer on average, most of them “uh” before a number",
      fix: "pause silently instead of “uh” and “like”; a short pause reads as confidence, not as a gap.",
    },
  ],
  questions: [
    { ...q1, question: "Tell me about yourself and your current role, and about the project you are proudest of so far." },
    {
      ...q2,
      question: "Tell me about a time you had to change a design late in a project, after the engineers had already started building it.",
      summary: { content: `${NO_RESULT} · “we” → “I” ×2 · no decision named`, language: tp("debrief.sum.phrasings", 2), delivery: `${fillersLabel(11)} · mostly “uh”` },
      answer: [...(q2.answer as Segments), ` Details are in the legal brief: ${LONG_TOKEN}.`],
    },
    { ...q3, unavailable: true, summary: { delivery: undefined }, layers: {}, stronger: undefined },
    q4,
    { ...q5, question: "Why do you want to join Northwind Logistics International, and why the Platform and Internal Tools team in particular?" },
  ],
};

/* ---------------------------------------------------------------- partial (US-20 AC4, Q11 = 3) ---- */

export const interviewPartial: DebriefModel = {
  id: "s-partial",
  title: "Kestrel Pay · Senior Product Designer",
  meta: [
    { icon: "briefcase", text: "Behavioural · Standard" },
    { icon: "clock", text: "Oct 20, 8:15 AM · 6 min" },
    { icon: "chat", text: t("debrief.meta.answered", { answered: 2, total: 5 }) },
    saved,
  ],
  saved: true,
  partial: { answered: 2, total: 5 },
  weakSpots: [],
  skipped: { from: 3, to: 5 },
  questions: [
    { ...q1, startsAt: "00:35", followUps: 0, followUp: undefined, followUpAnswer: undefined, stronger: { status: "idle" } },
    {
      n: 2,
      question: "Tell me about a time you had to change a design late in a project.",
      summary: { content: NO_RESULT, language: tp("debrief.sum.phrasings", 1), delivery: `${t("feedback.delivery.lengthText", { words: "96 words" })}` },
      startsAt: "02:40", followUps: 0,
      answer: ["Two weeks before launch legal asked for a consent step in checkout. I have led the redesign last spring and we shipped on time."],
      layers: {
        content: { items: [noResultBlock] },
        language: {
          corrections: [{
            id: "p2-led", typed: true,
            heard: ["Two weeks before launch legal asked for a consent step. ", { kind: "heard", text: "I have led" }, " the redesign last spring"],
            say: ["I ", { kind: "fix", text: "led" }, " the redesign last spring"],
            why: "A finished time (“last spring”) takes the past simple.",
          }],
          removed: [],
        },
        delivery: { textMode: true, words: 96 },
      },
      stronger: { status: "idle" },
    },
  ],
};

/* ---------------------------------------------------------------- S3 · English ---- */

const turn = (n: number, at: string, id: string, heard: Segments, say: Segments, why: string): Correction => ({ id, turn: { n, at }, heard, say, why });

export const englishS3: DebriefModel = {
  id: "s3",
  title: "English · Talk about your work",
  meta: [
    { icon: "language", text: "B2" },
    { icon: "clock", text: "Oct 18, 9:05 PM · 11 min" },
    { icon: "chat", text: tp("debrief.meta.turns", 9) },
    { icon: "cpu", text: tp("debrief.meta.requests", 13) },
    saved,
  ],
  saved: true,
  weakSpots: [],
  questions: [],
  english: {
    visible: 3,
    repeated: 2,
    practiseMinutes: 5,
    corrections: [
      turn(2, "01:40", "e1", ["we ", { kind: "heard", text: "discussed about" }, " the plan"], ["we ", { kind: "fix", text: "discussed" }, " the plan"], "“Discuss” takes no “about”."),
      turn(4, "03:55", "e2", ["I ", { kind: "heard", text: "work here since" }, " three years"], ["I", { kind: "fix", text: "'ve worked here for" }, " three years"], "A duration takes “for” and the present perfect."),
      turn(5, "05:10", "e3", ["it ", { kind: "heard", text: "depends of" }, " the client"], ["it ", { kind: "fix", text: "depends on" }, " the client"], "“Depend” takes “on”."),
      turn(7, "07:35", "e4", ["we should ", { kind: "heard", text: "discuss about" }, " the roadmap"], ["we should ", { kind: "fix", text: "discuss" }, " the roadmap"], "“Discuss” takes no “about”."),
      turn(8, "08:50", "e5", ["I live in this city ", { kind: "heard", text: "since three years" }], ["I've lived in this city ", { kind: "fix", text: "for three years" }], "A duration takes “for”, not “since”."),
    ],
    removed: [{ kind: "name", text: "Figma" }],
    phrases: [
      { from: "discuss about", to: "discuss", times: 2 },
      { from: "since three years", to: "for three years", times: 2 },
    ],
  } satisfies EnglishModel,
};

/* ---------------------------------------------------------------- example · Sam Rivera ---- */

const sq = (n: number, question: string, summary: QuestionModel["summary"], duration: string, startsAt: string, followUps: number, rest: Partial<QuestionModel> = {}): QuestionModel => ({
  n, question, summary, duration, startsAt, followUps,
  answer: ["I looked at the data we had, picked the option with the lowest risk, and told the team why."],
  layers: {
    content: { items: [] },
    language: { corrections: [], removed: [] },
    delivery: delivery(5, duration, 128, "“so” (3), “like” (2)"),
  },
  ...rest,
});

const q3Sam: QuestionModel = sq(
  3, "Tell me about a feature that failed. What did you learn?",
  { content: "Your own decision is missing", language: "1 phrasing", delivery: "Answers run long" },
  "4:05", "09:10", 1,
  {
    followUp: "Who decided to shut it down?",
    answer: [
      "Last year we launched a referral flow for small-business accounts. We expected around 15% of new sign-ups to come from referrals, but after six weeks it was under 3%. Honestly, the problem was we ",
      { kind: "unsure", text: "didn't make a research" },
      " before, we just copied what consumer apps do. So we interviewed twelve customers and found they don't want to refer their competitors, which is obvious now. We shut it down and moved the team to onboarding.",
    ],
    followUpAnswer: "The leadership team and me, together, after the interviews.",
    layers: {
      content: { items: [{ text: "Name the call you made and why. The decision to shut the flow down is described as “we”." }] },
      language: {
        corrections: [{
          id: "sq3-research",
          heard: ["…the problem was we ", { kind: "heard", text: "didn't make a research" }, " before…"],
          say: ["we ", { kind: "fix", text: "didn't do any research" }, " beforehand"],
          why: "“Research” takes “do” and is uncountable.",
        }],
        removed: [],
      },
      delivery: delivery(7, "4:05", 133, "“honestly” (3), “so” (3)"),
    },
    stronger: { status: "ready", placeholders: true, text: ["We launched a referral flow for small-business accounts and expected 15% of sign-ups from it; after six weeks it was under 3%. I skipped customer research and copied consumer apps. I interviewed twelve customers, saw they won't refer competitors, and chose to shut it down and move the team to ", { kind: "fix", text: "[your next project]" }, "."] },
  },
);

export const exampleSam: DebriefModel = {
  id: "example",
  title: "Brightline · Product Manager, Growth",
  meta: [
    { icon: "briefcase", text: "Behavioural · Standard" },
    { icon: "clock", text: "Oct 14, 7:30 PM · 22 min" },
    { icon: "chat", text: counts(5, 3) },
  ],
  verdict: { step: 1, headline: "Getting there", line: "Strong on the why, but 3 answers skip the decision you made yourself." },
  weakSpots: [
    {
      id: "ws-content", layer: "content", title: "Your own decision is missing in 3 of 5 answers",
      evidence: { kind: "questions", ids: [1, 3, 4] },
      fix: "Name the call you made and why: “I chose to cut the referral flow because…”.",
    },
    {
      id: "ws-language", layer: "language", title: "“make a research” instead of “do research” — 2 times",
      evidence: { kind: "questions", ids: [3, 4] },
      fix: "“research” takes “do” and has no plural.",
    },
    {
      id: "ws-delivery", layer: "delivery", title: "Answers run long: 3:10 on average",
      evidence: { kind: "most", ids: [3], trail: "(4:05)" },
      fix: "one sentence of context, then what you did.",
    },
  ],
  questions: [
    sq(1, "Tell me about a product decision you made with incomplete data.", { content: "Your own decision is missing", language: NOTHING_LANGUAGE, delivery: fillersLabel(5) }, "2:50", "00:30", 1, { followUp: "What would you have wanted to know?" }),
    sq(2, "Describe a time you had to say no to a senior stakeholder.", { content: NOTHING_CONTENT, language: NOTHING_LANGUAGE, delivery: fillersLabel(4) }, "2:40", "04:20", 0),
    q3Sam,
    sq(4, "How do you prioritise when everything is urgent?", { content: "Your own decision is missing", language: tp("debrief.sum.phrasings", 1), delivery: fillersLabel(6) }, "3:20", "13:25", 1, { followUp: "What do you drop first?" }),
    {
      ...sq(5, "Why Brightline?", { content: NOTHING_CONTENT, language: tp("debrief.sum.phrasings", 1), delivery: fillersLabel(5) }, "2:30", "17:15", 1, { followUp: "What worries you about the role?" }),
      layers: {
        content: { items: [] },
        language: {
          corrections: [{
            id: "sq5-since",
            heard: ["I ", { kind: "heard", text: "am working in" }, " Brightline since 2021"],
            say: ["I", { kind: "fix", text: "'ve worked at" }, " Brightline since 2021"],
            why: "“Since” + a start point takes the present perfect; use “at” for a company.",
          }],
          removed: [],
        },
        delivery: delivery(5, "2:30", 126, "“so” (3), “like” (2)"),
      },
    },
  ],
};

/** The question open by default in each variant (default-open in the `interview` and `example` stories). */
export const DEFAULT_OPEN: Record<string, number[]> = { s2: [2], example: [3], "s-long": [2], "s-partial": [2] };
