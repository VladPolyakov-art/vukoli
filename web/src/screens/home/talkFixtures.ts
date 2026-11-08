/* Fixture for the tough-talk setup: what `GET /api/tough-talk/content` returns (card texts copied from
 * app/server/content/tough_talk.json, theme counts from the question bank), plus remembered values. Stories, review
 * states and tests only. */
import type { CourseStep, NegotiatePrep, ToughTalkContent } from "../../lib/types";
import type { NumbersMemory, TalkContext } from "./types";

/** Negotiation v3: the mini-course as the server sends it (`course` of `GET /api/tough-talk/content`, prd-v3-prep §4). */
export const COURSE_OFFER: CourseStep[] = [
  { title: "Know your number and why.", rule: "Pick a number a little above your target, and one reason for it: results, scope or market.", example: "Based on the scope and two launches I led, I'm looking at 62,000." },
  { title: "Say it first, with the reason.", rule: "The first number anchors the talk.", example: "For this role I'm looking at 62,000, because I'd own onboarding end to end." },
  { title: "Answer the objection with a new fact.", rule: "Answer that exact concern; bring a fact you have not said yet. Repeating the same reason sounds stuck.", example: "Fair point. Last year I cut onboarding drop-off by a third, so 60,000 still feels right." },
  { title: "If base is stuck, trade.", rule: "Ask for a step-up after probation, a sign-on bonus or an earlier review.", example: "If 55,500 is the limit today, could we agree on 60,000 after the three-month probation?" },
  { title: "Close it in writing.", rule: "Amount, date, goals, in the offer letter.", example: "Great. Could you put the 60,000 at three months and the goals in the offer?" },
];
export const COURSE_RAISE: CourseStep[] = [
  { title: "Collect results since your last raise.", rule: "Two or three things you did, each with a number.", example: "Since my last raise I cut support tickets by a quarter and led the checkout redesign." },
  { title: "Open with the number and two results.", rule: "Say the number first, then the results that back it.", example: "I'd like to move to 72,000: I led the checkout redesign and cut tickets by a quarter." },
  { title: "Turn “not now” into a date and criteria.", rule: "Ask when you can talk again and what would need to be true.", example: "If not now, can we agree on a date in three months and what I need to show by then?" },
  { title: "Trade: a part now, title, or a dated raise.", rule: "If the full ask is stuck, ask for something that moves.", example: "Could we do a part now and the rest at the review in six months?" },
  { title: "Get it in writing.", rule: "Amount, date and criteria, by email.", example: "Could you confirm the new amount and the date in an email?" },
];

export const TALK_CONTENT: ToughTalkContent = {
  course: { offer: COURSE_OFFER, raise: COURSE_RAISE },
  cards: [
    {
        "id": "N1",
        "title": "Know your number, then pick who goes first",
        "rule": "If you know your number, say it first, a little above your target and precise (97,250, not 100,000). If you do not, ask for their range.",
        "evidence": "Lab studies on anchors and precise numbers. Who should go first is debated for job offers.",
        "example": "Based on the scope, I'm looking at 96,500.",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N2",
        "title": "Ask for their range",
        "rule": "Asking first is a fair move, not a dodge.",
        "evidence": "Common advice",
        "example": "Before I give a number, what range did you plan for this role?",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N3",
        "title": "Keep your current pay private",
        "rule": "Talk about what the role is worth. In some places employers may not be allowed to ask.",
        "evidence": "Law in some places, plus common advice",
        "example": "I'd rather focus on what this role is worth. What range did you plan for it?",
        "modes": [
            "negotiate",
            "tough"
        ]
    },
    {
        "id": "N4",
        "title": "Pause before you answer",
        "rule": "Two or three seconds help you think. It is not a pressure trick.",
        "evidence": "One field study",
        "example": "Thank you. Let me think about that for a second.",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N5",
        "title": "Give a reason with every number",
        "rule": "Tie the ask to results or scope, not to your costs. Keep it warm.",
        "evidence": "Common advice",
        "example": "I've led two launches like this one, so I'm asking for 98,000.",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N6",
        "title": "If base is stuck, ask about the package",
        "rule": "Sign-on, an earlier review, days off, remote days, title.",
        "evidence": "Studies on multi-issue offers, plus common advice",
        "example": "If base is fixed, could we add a sign-on bonus or a review at six months?",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N7",
        "title": "Only mention offers you really have",
        "rule": "Name the timing, not the amount. Bluffs get checked.",
        "evidence": "Studies on alternatives, plus common advice",
        "example": "I have another offer and need to answer by Friday.",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N8",
        "title": "Ask for time and the terms in writing",
        "rule": "A few days is a normal request.",
        "evidence": "Common advice, one study on short deadlines",
        "example": "Could you send the full terms? I'll reply by Thursday.",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N9",
        "title": "Bridge the gap with a step-up",
        "rule": "If they cannot reach your number now, agree on it later: the offer now, your number after the probation or in six months.",
        "evidence": "Common advice",
        "example": "If 90,000 is the limit today, could we agree on 98,000 after the three-month probation?",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "N10",
        "title": "Make the step-up real",
        "rule": "Amount, date, what you need to show, and in the offer letter. A promise said aloud is not a deal.",
        "evidence": "Common advice",
        "example": "Great. Can we write the 98,000 at three months and the goals into the offer?",
        "modes": [
            "negotiate"
        ]
    },
    {
        "id": "T1",
        "title": "Personal question: acknowledge, fact, redirect",
        "rule": "Stay calm and short, then go back to the job.",
        "evidence": "Common advice",
        "example": "My plans won't affect my work. Can I tell you about my availability?",
        "modes": [
            "tough"
        ]
    },
    {
        "id": "T2",
        "title": "Pushed back: say \"fair point\", then go shorter",
        "rule": "Restate the core of your answer with one result.",
        "evidence": "Common advice",
        "example": "Fair point. In short: I cut release time by a third.",
        "modes": [
            "tough"
        ]
    },
    {"id": "S1", "title": "Ask for the range first", "rule": "At a first screen, it is fair to ask what range they planned for the role before you name a number.", "evidence": "Common advice; knowing the range lowers the risk of anchoring too low.", "example": "Before I give a number, what range did you plan for this role?", "modes": ["negotiate"]},
    {"id": "S2", "title": "Put your number at the bottom of the band", "rule": "If you name a number, make it the lowest you would accept, not the middle of your hope.", "evidence": "Anchoring research: the first number frames the talk, and a low first number is hard to move up.", "example": "Based on the scope, I'm looking at 95,000 to 105,000.", "modes": ["negotiate"]},
    {"id": "I1", "title": "Ask for the level, not just the pay", "rule": "As an intern, ask for the title and level you have already worked at, and tie it to results you shipped.", "evidence": "Level sets the pay band for years; it is easier to fix at conversion than later.", "example": "I've owned the onboarding project end to end, so I'd like to be hired at mid level.", "modes": ["negotiate"]},
    {"id": "C1", "title": "Name the reason before the number", "rule": "When you got an outside offer, say the real reason you are leaving. If it is not only money, a match on money will not solve it.", "evidence": "Counteroffers often fail when the reason for leaving is not pay.", "example": "It's partly money, but mostly the growth path I don't see here.", "modes": ["negotiate"]},
    {"id": "C2", "title": "Get the counter in writing", "rule": "If the counter is fine, ask for it in writing with the date before you decide. A verbal promise is hard to hold.", "evidence": "Written terms are the only terms you can check later.", "example": "Could you send that in writing, with the date the promotion starts?", "modes": ["negotiate"]},
    {"id": "R1", "title": "Bring results and a number", "rule": "Open a raise talk with two or three results since your last raise and the number you ask for.", "evidence": "Raises are easier to approve when the manager can repeat your case to their own boss.", "example": "Since March I led the migration and cut support tickets by a third. I'm asking for 72,000.", "modes": ["negotiate"]},
    {"id": "R2", "title": "If it is not now, ask for a date and the goals", "rule": "When the answer is not now, ask for a specific date and the goals that unlock the raise, and ask for them in writing.", "evidence": "A dated, written commitment turns 'later' into a plan.", "example": "What would I need to show by the June review for a raise to 72,000? Could you confirm it by email?", "modes": ["negotiate"]}
  ],
  themes: [
    { id: "money", name: "Money", count: 5, personal: false },
    { id: "leaving", name: "Leaving and gaps", count: 4, personal: false },
    { id: "weakness", name: "Weak spots", count: 4, personal: false },
    { id: "fit", name: "Fit", count: 5, personal: false },
    { id: "english", name: "Speaking English at work", count: 3, personal: false },
    { id: "personal", name: "Personal questions", count: 4, personal: true },
    { id: "mix", name: "Mix", count: 5, personal: false },
  ],
  styles: [{"id": "friendly", "name": "Friendly", "difficulty": "Easy", "blurb": "Warm and open to a fair ask. Moves when you give a reason."}, {"id": "firm", "name": "Firm", "difficulty": "Medium", "blurb": "Polite but steady. Needs a reason, and stops moving if you repeat yourself."}, {"id": "tight", "name": "Tight budget", "difficulty": "Hard", "blurb": "Starts low, moves little, and pushes for a quick yes."}, {"id": "surprise", "name": "Surprise me", "difficulty": "?", "blurb": "Mike picks a style at random. You see which in the debrief."}],
  currencies: ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "PLN"],
  notes: { no_data: "Use a number you researched yourself. Vukoli has no salary data. Mike's budget is built from these numbers.", practice: "Practice settings, not real recruiter data.", personal: "In many places this may not be a lawful question. Rules differ by country, so check the rules where the job is." },
  tough_total: 5,
};

/** First time: nothing remembered, tactics shown. */
export const TALK_FIRST: TalkContext = {
  content: TALK_CONTENT,
  lastStyle: null,
  numbers: { last: null, byJob: {} },
  tacticsHidden: { tough: false, negotiate: false },
};

export const KESTREL_NUMBERS: NumbersMemory = { role: "Senior Product Designer", low: 85000, high: 98000, target: 96000, currency: "EUR", hasOffer: false };
/** Returning: last time Firm, Kestrel Pay's numbers remembered. */
export const TALK_RETURNING: TalkContext = {
  content: TALK_CONTENT,
  lastStyle: "firm",
  numbers: { last: KESTREL_NUMBERS, byJob: { v1: KESTREL_NUMBERS } },
  tacticsHidden: { tough: false, negotiate: false },
};
/** A case saved with an earlier Offer call (`GET /api/talk/last-case`). */
export const LAST_CASE: NegotiatePrep = {
  course: true,
  results: ["Cut onboarding drop-off by a third", "Led the checkout redesign for 40k merchants"],
  reason: "Market range",
  fallbacks: ["step_up", "sign_on"],
};
/** Returning, with a saved case for the Offer scenario: "Use my case from last time" is offered. */
export const TALK_WITH_LAST_CASE: TalkContext = { ...TALK_RETURNING, lastCases: { offer: LAST_CASE } };
export const TALK_HIDDEN: TalkContext = { ...TALK_RETURNING, tacticsHidden: { tough: true, negotiate: true } };
