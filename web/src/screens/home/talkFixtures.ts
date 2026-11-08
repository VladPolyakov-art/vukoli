/* Fixture for the tough-talk setup: what `GET /api/tough-talk/content` returns (card texts copied from
 * app/server/content/tough_talk.json, theme counts from the question bank), plus remembered values. Stories, review
 * states and tests only. */
import type { ToughTalkContent } from "../../lib/types";
import type { NumbersMemory, TalkContext } from "./types";

export const TALK_CONTENT: ToughTalkContent = {
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
    }
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
export const TALK_HIDDEN: TalkContext = { ...TALK_RETURNING, tacticsHidden: { tough: true, negotiate: true } };
