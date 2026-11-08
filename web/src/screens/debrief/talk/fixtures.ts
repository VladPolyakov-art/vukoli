/* Fixtures of the tough-talk debriefs for stories, the review page and unit tests. Numbers are practice numbers
 * (EUR, a fictional product designer role); the cards are the same texts the server serves. */
import type { NegotiateDebrief, SessionRecord, TacticCardData, ToughDebrief, ToughDebriefQuestion } from "../../../lib/types";
import { indexContent, type TalkContent } from "./model";

export const CARDS: TacticCardData[] = [
  { id: "N1", title: "Ask for their range first", rule: "Let the recruiter name a number before you do.", evidence: "Anchoring research (Galinsky and Mussweiler, 2001).", example: "Before we talk numbers, what range did you have in mind for this role?", modes: ["negotiate"] },
  { id: "N2", title: "Name your target with a reason", rule: "A number with a reason moves further than a bare number.", evidence: "Practice note: reasons make a counter easier to say yes to.", example: "Based on the scope and my last two years, I was aiming for 98,000.", modes: ["negotiate"] },
  { id: "N6", title: "Bridge a gap with a step-up", rule: "When the base is stuck, ask for a review at a date, with goals, in writing.", evidence: "Practice note: a promise only counts when it is in the offer letter.", example: "Could we agree a step to 98,000 after six months, with goals written into the offer?", modes: ["negotiate"] },
  { id: "T1", title: "Short, calm, back to the job", rule: "Answer in two sentences, then steer to the work.", evidence: "Interview coaching practice.", example: "I left because the role changed. What I want now is more product ownership.", modes: ["tough"] },
];
export const CONTENT: TalkContent = indexContent({ cards: CARDS, themes: [{ id: "gaps", name: "Gaps in your CV" }, { id: "leaving", name: "Why you left" }, { id: "personal", name: "Personal questions" }].map((x) => ({ ...x, id: x.id as never })) });

const base = (mode: "negotiate" | "tough", id: string, debrief: NegotiateDebrief | ToughDebrief | null, transcript: SessionRecord["transcript"]): SessionRecord => ({
  id, mode, engine: "scripted", started_at: "2026-11-07T10:00:00Z", ended_at: "2026-11-07T10:09:00Z", duration_s: 540,
  title: "", questions: [], transcript, feedback: [], debrief,
});

const neg = (over: Omit<Partial<NegotiateDebrief>, "summary"> & { summary?: Partial<NegotiateDebrief["summary"]> }): NegotiateDebrief => {
  const { summary, ...rest } = over;
  return {
    kind: "negotiate", verdict: "", practice_note: "Practice settings, not real recruiter data.", source: "code", cards: [], hints_used: [],
    style: "friendly", style_name: "Friendly", surprise: false, role: "Product Designer", currency: "EUR", period: "year",
    outcome: "accepted", outcome_label: "", no_offer: false,
    summary: {
      opening: 88000, final_offer: 94000, floor: null, ceiling: null, captured_pct: 50, position_pct: null, rounds_used: 4, round_cap: 6,
      captured_now_pct: 50, captured_later_pct: null, year_one: null, target: 98000, job_low: 85000, job_high: 105000, range_source: "job_range", ...summary,
    },
    hidden_range: { floor: 85000, ceiling: 100000, text: "" }, offer_path: [], shifts: [], deal: null, levers_won: [], missed_levers: [], say_it_better: [],
    signals: [], pressure_notes: [], flags: [], guard_replacements: 0, competing_offer_note: null, ...rest,
  };
};

export const negotiateTranscript: SessionRecord["transcript"] = [
  { role: "model", text: "Thanks for coming in. We would like to offer you 88,000 EUR a year.", kind: "question" },
  { role: "user", text: "Thank you. Based on the scope and my last two years, I was aiming for 98,000." },
  { role: "model", text: "I can move to 91,000 given that reason." },
  { role: "user", text: "Could we agree a step to 98,000 after six months, with goals written into the offer?" },
  { role: "model", text: "Yes, 91,000 now and 98,000 after six months, in the offer letter." },
];

/** Strong: a reasoned counter, then a step-up that is in writing. */
export const negotiateStrong: SessionRecord = base("negotiate", "neg-strong", neg({
  summary: { final_offer: 91000, captured_now_pct: 25, captured_later_pct: 83, year_one: 94500 },
  deal: { now: 91000, later: 98000, after_months: 6, in_writing: true, criteria_named: true, line: "" },
  shifts: [
    { turn: 1, from: 88000, to: 91000, cause: "justified_counter", cause_label: "Counter with a reason", quote: "Based on the scope and my last two years, I was aiming for 98,000." },
    { turn: 2, from: 91000, to: 91000, cause: "step_up", cause_label: "Step-up", quote: "Could we agree a step to 98,000 after six months, with goals written into the offer?" },
  ],
  levers_won: [{ lever: "bonus", label: "Signing bonus", value: "3,000 EUR", by: "ask", turn: 3 }],
  missed_levers: [{ lever: "leave", label: "Extra days of leave" }],
  pressure_notes: ["Mike used a 48-hour deadline. Real recruiters may or may not."],
  say_it_better: [{ id: "bare", title: "Name a reason with the number", what_happened: "Your first counter came without a reason.", you_said: "I want 98,000.", try: "Based on the scope, I was aiming for 98,000.", card_id: "N2" }],
  hints_used: [{ card_id: "N1", title: "Ask for their range first", turn: 1 }],
}), negotiateTranscript);

/** The step-up was agreed in words only. */
export const negotiateNotInWriting: SessionRecord = base("negotiate", "neg-verbal", neg({
  summary: { final_offer: 91000, captured_now_pct: 25, captured_later_pct: 83, year_one: 94500 },
  deal: { now: 91000, later: 98000, after_months: 6, in_writing: false, criteria_named: false, line: "" },
  shifts: [{ turn: 2, from: 91000, to: 91000, cause: "step_up", cause_label: "Step-up", quote: "Could we step to 98,000 after six months?" }],
  say_it_better: [{ id: "writing", title: "Ask for the step-up in writing", what_happened: "The step-up was agreed in conversation only.", you_said: null, try: "Could you put that step in the offer letter, with the goals?", card_id: "N6" }],
}), negotiateTranscript);

/** Accepted the first offer, no counter. */
export const negotiateAcceptedFirst: SessionRecord = base("negotiate", "neg-first", neg({
  outcome: "accepted", summary: { final_offer: 88000, captured_now_pct: 0 },
  signals: [{ id: "accepted_first_offer", label: "Accepted the first offer", good: false, quote: null }],
  say_it_better: [{ id: "first", title: "Count to three before you accept", what_happened: "You accepted the first number.", you_said: "That sounds great, I accept.", try: "Thank you. Can I ask whether there is room on the base?", card_id: "N2" }],
}), negotiateTranscript.slice(0, 2));

/** Ended before Mike made an offer. */
export const negotiateNoOffer: SessionRecord = base("negotiate", "neg-none", neg({
  no_offer: true, outcome: "ended", summary: { opening: null, final_offer: null, captured_now_pct: null, captured_pct: null }, hidden_range: null,
}), negotiateTranscript.slice(0, 1));

const tq = (n: number, over: Partial<ToughDebriefQuestion> = {}): ToughDebriefQuestion => ({
  n, question_id: `q${n}`, theme: "leaving", question: `Why did you leave your last job? (${n})`, personal: false,
  answers: [{ role: "answer", text: "The role changed and I wanted more product ownership." }], pushes: [{ kind: "follow_up", text: "Was it really only the role?" }],
  signals: [], calm: true, calmer_answer: null, shape: "Two sentences: the reason, then what you want now.", checking: "", trap: "", card_ids: ["T1"],
  lawful_note: null, model_checked: true, ...over,
});

const tough = (questions: ToughDebriefQuestion[], over: Partial<ToughDebrief> = {}): ToughDebrief => {
  const calm = questions.filter((q) => q.calm).length;
  return {
    kind: "tough", verdict: "", practice_note: "Practice settings, not real recruiter data.", theme: "leaving", theme_name: "Why you left", source: "code+model",
    summary: { answered: questions.length, calm, show_counts: questions.length >= 3, hurt_most: null }, questions, ...over,
  };
};

const toughTranscript = (n: number): SessionRecord["transcript"] => Array.from({ length: n }, (_, i): SessionRecord["transcript"] => [
  { role: "model", text: `Why did you leave your last job? (${i + 1})`, kind: "question", question_id: `q${i + 1}` },
  { role: "user", text: "The role changed and I wanted more product ownership." },
]).flat();

const hurtSignals = [
  { id: "blames_others", label: "Blamed others", bad: true, source: "model" as const, may_be_wrong: true, quote: "my manager never listened" },
  { id: "rambling", label: "Rambling", bad: true, source: "code" as const, quote: "" },
];

/** Five answers, a mix of calm and hurt. */
export const toughNormal: SessionRecord = base("tough", "tough-normal", tough([
  tq(1), tq(2, { calm: false, signals: hurtSignals, calmer_answer: "The role changed, and I wanted more product ownership." }),
  tq(3), tq(4, { personal: true, lawful_note: "In many places this may not be a lawful question to ask. A short answer that steers back to the job is enough.", theme: "personal" }), tq(5),
], { summary: { answered: 5, calm: 3, show_counts: true, hurt_most: { question_no: 2, question: "Why did you leave your last job? (2)", signal: "blames_others", label: "Blamed others", quote: "my manager never listened" } } }), toughTranscript(5));

/** The after-call check failed: only code signals, the shape of a good answer and a quiet note. */
export const toughModelFailed: SessionRecord = base("tough", "tough-code", tough([
  tq(1, { model_checked: false, calm: false, signals: [hurtSignals[1]!] }), tq(2, { model_checked: false }), tq(3, { model_checked: false }),
], { source: "code", summary: { answered: 3, calm: 2, show_counts: true, hurt_most: null } }), toughTranscript(3));

/** One or two answers: no counts. */
export const toughTwo: SessionRecord = base("tough", "tough-two", tough([tq(1), tq(2)], { summary: { answered: 2, calm: 2, show_counts: false, hurt_most: null } }), toughTranscript(2));
export const toughOne: SessionRecord = base("tough", "tough-one", tough([tq(1)], { summary: { answered: 1, calm: 1, show_counts: false, hurt_most: null } }), toughTranscript(1));

/* Negotiation v2 (protocol.md §7): one fixture per scenario, shaped like the captured server debriefs. */
const none = { mike: [], you: [], mike_total: 0, you_total: 0 };
const v2 = (scenario: NonNullable<NegotiateDebrief["scenario"]>, scenario_name: string, over: Parameters<typeof neg>[0]) =>
  neg({ version: 2, scenario, scenario_name, who_moved: none, check: null, deadline: null, objections: [], ...over });

const rt = (lines: Array<[("model" | "user"), string]>): SessionRecord["transcript"] =>
  lines.map(([role, text], i) => (role === "model" ? { role, text, kind: i === 0 ? ("question" as const) : undefined } : { role, text }));

/** Screening call: did you anchor, or deflect? No offer figures. */
export const negotiateScreening: SessionRecord = base("negotiate", "neg-screening", v2("screening", "Screening call", {
  outcome: "ended", no_offer: true,
  summary: { opening: null, final_offer: null, captured_now_pct: null, captured_pct: null, target: 95000, job_low: 85000, job_high: 105000 },
  section: { first_number: 95000, first_turn: 2, vs_band: "inside", asked_range: true, got_range: false, range_given: false, revealed_current: false, tied_to_scope: false, flexible_on_package: false },
  objections: [{ id: "SC2", turn: 2, mike_line: "Help me understand that a bit more.", user_reply: "ok thanks", answered: false, may_be_wrong: true }],
  say_it_better: [{ id: "scope", title: "Tie the number to the scope", what_happened: "You named a number without a reason.", you_said: "95,000.", try: "For a role with this scope, I am looking at 95,000.", card_id: "N2", why: "A number with a reason is harder to push down." }],
}), rt([["model", "Before we go further: what salary are you looking for?"], ["user", "95,000."], ["model", "Help me understand that a bit more."], ["user", "ok thanks"]]));

/** Raise with your lead: got now, at a date, or non-money; here a dated raise. */
export const negotiateRaise: SessionRecord = base("negotiate", "neg-raise", v2("raise", "Raise with your lead", {
  outcome: "accepted", style: "firm", style_name: "Firm",
  summary: { opening: 60000, final_offer: 60000, captured_now_pct: 0, captured_later_pct: 60, target: 72000, job_low: 60000, job_high: null },
  section: { asked: 72000, current: 60000, raise_now: null, dated: { amount: 66000, after_months: 6, criteria: true, in_writing: true }, results_named: true, other_levers: ["Title change"], threat_without_offer: false, captured_now_pct: 0, captured_later_pct: 60 },
  deal: { now: 60000, later: 66000, after_months: 6, in_writing: true, criteria_named: true, line: "" },
  check: { used: true, turn: 2, result: { kind: "lever", from: null, to: null, lever: "title" } },
  objections: [
    { id: "RA2", turn: 1, mike_line: "Budgets are tight this year.", user_reply: "I took over the design system and cut review time in half.", answered: true, may_be_wrong: true },
    { id: "RA4", turn: 3, mike_line: "I could look at a title change, but money is harder.", user_reply: null, answered: false, may_be_wrong: true },
  ],
  say_it_better: [{ id: "date", title: "Put a date on it", what_happened: "The review date was left open.", you_said: null, try: "Could we agree a review in six months, with the goals written down?", card_id: "N6", why: "A date and goals make it a plan, not a hope." }],
}), rt([["model", "Thanks for making the time. What did you want to talk about?"], ["user", "My pay. I took over the design system and cut review time in half."], ["model", "Budgets are tight this year."], ["user", "Could we agree 66,000 after six months, with goals in writing?"], ["model", "I will check with the hiring manager and come back."]]));

/** Counteroffer: two offers side by side. No stay or go verdict. */
export const negotiateCounter: SessionRecord = base("negotiate", "neg-counter", v2("counteroffer", "Counteroffer", {
  outcome: "ended",
  summary: { opening: 62000, final_offer: 66000, captured_now_pct: null, target: 70000, job_low: 60000, job_high: null },
  section: { reason_named: true, reason: "growth", counter_matched: false, counter_in_writing: true, time_asked: true, unwritten_promise_accepted: false, deadline_accepted: false, decision: "time", note: "Vukoli does not say whether to stay or leave." },
  objections: [{ id: "CO1", turn: 1, mike_line: "We can match the number, but not the title.", user_reply: "Growth matters most to me. Could I have until Friday?", answered: true, may_be_wrong: true }],
}), rt([["model", "I heard you have another offer."], ["user", "Growth matters most to me. Could I have until Friday?"]]));

/** Internship to full-time: the conversion terms. */
export const negotiateInternship: SessionRecord = base("negotiate", "neg-intern", v2("internship", "Internship to full-time", {
  outcome: "accepted",
  summary: { opening: 58000, final_offer: 62500, captured_now_pct: 40, target: 68000, job_low: 55000, job_high: 70000 },
  section: { level_asked: true, level_won: false, step_up_line: null, results_named: false },
  objections: [{ id: "IN2", turn: 1, mike_line: "I need something new to move on that. The offer is 62,500 EUR.", user_reply: "Could we revisit at 6 months with clear goals?", answered: false, may_be_wrong: true }],
}), rt([["model", "We would like to offer you a full-time role."], ["user", "Could we revisit at 6 months with clear goals?"]]));

/** The salary part of an interview: screening-shaped, noted by Mike. */
export const moneyTalkDebrief: NegotiateDebrief = v2("screening", "Salary talk", {
  outcome: "noted", no_offer: true, hidden_range: null,
  summary: { opening: null, final_offer: null, captured_now_pct: null, captured_pct: null, target: 95000, job_low: 85000, job_high: 105000 },
  section: { first_number: 90000, first_turn: 1, vs_band: "inside", asked_range: false, got_range: false, range_given: false, revealed_current: false, tied_to_scope: true, flexible_on_package: false },
  objections: [{ id: "SC2", turn: 1, mike_line: "That is a bit above what we planned.", user_reply: "For this scope, I would look at 90,000.", answered: true, may_be_wrong: true }],
});

/** Negotiation v3 (D118): an offer call where the same reason came up three times and the prep was skipped. */
export const negotiateHomework: SessionRecord = (() => {
  const r = base("negotiate", "neg-homework", {
    ...(negotiateStrong.debrief as NegotiateDebrief),
    homework: [
      { id: "results", text: "Write down 2–3 results with a number: what you did and what changed.", quote: null, card_id: null },
      { id: "range", text: "Find the range for this role: two or three job posts or a salary site.", quote: null, card_id: null },
      { id: "objection", text: "Prepare one answer to this: Mike said “That would put you above people on the team.”", quote: "That would put you above people on the team.", card_id: "X2" },
      { id: "prep_skipped", text: "Next time, take 3 minutes to prepare your case first.", quote: null, card_id: null },
    ],
    repeats: { count: 3, quote: "I'm still aiming for 60,000 based on the work I have done" },
    case: null,
  }, negotiateTranscript);
  return r;
})();
