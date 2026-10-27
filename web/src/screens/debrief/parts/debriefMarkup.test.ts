/* Markup tests of the interview Debrief view, layout D (2026-10-27): the one score and its skills, the level, the summary
 * with and without a step, the plan with the one drill button, one question's feedback list, and the small shared bits. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { englishS3, exampleSam, interviewS2 } from "../fixtures";
import type { PlanStepModel, ScoreRowModel, VerdictModel, WeakSpotModel } from "../types";
import { averageScore, orderedPlan, weakestFirst } from "./debriefShared";
import { LevelProgress, levelProgress } from "./LevelProgress";
import { Plan } from "./Plan";
import { QuestionView, type QuestionViewProps } from "./QuestionView";
import { Actions, PractiseAgain } from "./Sections";
import { SkillsList } from "./SkillsHoverCard";
import { Summary } from "./Summary";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const noop = () => {};

const rows: ScoreRowModel[] = [
  { key: "structure", score: 3, answers: 5, lost: [1, 2, 4] },
  { key: "own_part", score: 5, answers: 5, lost: [] },
  { key: "result", score: 2, answers: 5, lost: [2] },
  { key: "reflection", score: null, answers: 0, lost: [] },
];

describe("the one score (layout D)", () => {
  it("is the mean of the scored rows with one decimal; 'Not asked' is left out", () => {
    expect(averageScore(rows)).toEqual({ value: "3.3", n: 3 });
    expect(averageScore([{ key: "result", score: 4, answers: 1, lost: [] }, { key: "delivery", score: 3, answers: 1, lost: [] }])).toEqual({ value: "3.5", n: 2 });
  });
  it("is hidden when no row has a score", () => {
    expect(averageScore([{ key: "reflection", score: null, answers: 0, lost: [] }])).toBeNull();
    expect(averageScore([])).toBeNull();
    expect(averageScore(undefined)).toBeNull();
  });
});

describe("the skills list (D98, US-20 AC6)", () => {
  const html = (r = rows) => renderToStaticMarkup(createElement(SkillsList, { rows: r, onJump: noop }));

  it("lists the scored rows weakest first, with the score as '3/5' and no meter", () => {
    const h = html();
    expect((h.match(/data-score-key=/g) ?? []).length).toBe(3);
    const order = [...h.matchAll(/data-score-key="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["result", "structure", "own_part"]);
    expect(text(h)).toContain("Result 2/5");
    expect(h).not.toContain("seg");
  });
  it("a score is read as 'n out of 5' for screen readers", () => {
    expect(html()).toContain('<span class="visually-hidden">3 out of 5</span>');
  });
  it("lost points link to the questions; a row that lost nothing says so", () => {
    const h = html();
    for (const n of [1, 2, 4]) expect(h).toContain(`aria-label="Go to question ${n}"`);
    const own = h.split("<li ").find((li) => li.includes('data-score-key="own_part"'))!;
    expect(own).not.toContain("aria-label=\"Go to question");
  });
  it("a row with nothing to judge is one line at the end, not a row", () => {
    const h = html();
    expect(h).not.toContain('data-score-key="reflection"');
    expect(text(h)).toContain("Not asked this time: Lessons learned");
  });
  it("says that possibly misheard words are not counted (GR9)", () => {
    expect(text(html())).toContain("Words the app may have misheard are not counted.");
  });
  it("weakestFirst keeps the scorecard order among equal scores", () => {
    const tie: ScoreRowModel[] = [
      { key: "result", score: 3, answers: 1, lost: [] },
      { key: "structure", score: 3, answers: 1, lost: [] },
      { key: "delivery", score: 1, answers: 1, lost: [] },
    ];
    expect(weakestFirst(tie).map((r) => r.key)).toEqual(["delivery", "result", "structure"]);
  });
});

describe("level progress (layout D, look 'blocks')", () => {
  it("Not ready yet counts the answer rows at 3 or more", () => {
    expect(levelProgress(0, rows)).toEqual({ step: 0, done: 2, total: 3 });
  });
  it("Getting there counts every shown row at 4 or more", () => {
    expect(levelProgress(1, rows)).toEqual({ step: 1, done: 1, total: 3 });
  });
  it("Ready fills every cell", () => {
    expect(levelProgress(2, rows)).toEqual({ step: 2, done: 3, total: 3 });
  });
  it("no scored row: nothing to show", () => {
    expect(levelProgress(1, [{ key: "reflection", score: null }])).toBeNull();
    expect(levelProgress(1, undefined)).toBeNull();
  });
  it("one image for screen readers; the cells and the steps are decoration", () => {
    const data = levelProgress(0, rows)!;
    const h = renderToStaticMarkup(createElement(LevelProgress, { data }));
    expect(h).toContain('role="img"');
    expect(h).toContain('aria-label="Your level: Not ready yet, step 1 of 3 (');
    expect((h.match(/<span class="[^"]*cell[^"]*"/g) ?? []).length).toBe(3);
    expect(h).toContain('data-review-id="Debrief/Level"');
  });
});

describe("the summary", () => {
  const withStep: VerdictModel = { step: 0, gap: ["result"], target: 3, headline: "Not ready yet", line: "Answers need a result." };
  const render = (verdict: VerdictModel, r: ScoreRowModel[] | null = rows) => renderToStaticMarkup(createElement(Summary, { verdict, rows: r ?? undefined, id: "v", uid: "u", onJump: noop }));

  it("is a region named Verdict (the heading is visually hidden) with the headline, the sentence and the rule's line", () => {
    const h = render(withStep);
    expect(h).toContain('aria-labelledby="v"');
    expect(h).toContain('<h2 id="v" class="visually-hidden">Verdict</h2>');
    expect(text(h)).toContain("Not ready yet");
    expect(text(h)).toContain("Answers need a result.");
    expect(text(h)).toContain("To reach “Getting there”: get Result to 3 of 5 or more.");
  });
  it("shows the level and the score '3.3/5 · Average of 3 skills'", () => {
    const h = render(withStep);
    expect(h).toContain('data-review-id="Debrief/Level"');
    expect(text(h)).toContain("3.3");
    expect(text(h)).toMatch(/Average of 3 skills/);
  });
  it("a verdict with no step gets its step from the rows (the headline stays the model's sentence)", () => {
    const h = render({ headline: "A solid but uneven session." });
    expect(h).toContain('aria-label="Your level: Not ready yet, step 1 of 3 (');
    expect(text(h)).toContain("A solid but uneven session.");
  });
  it("no scored row: no level and no score", () => {
    const h = render({ headline: "Too little to judge." }, [{ key: "reflection", score: null, answers: 0, lost: [] }]);
    expect(h).not.toContain("Debrief/Level");
    expect(text(h)).not.toContain("Average of");
    expect(text(h)).toContain("Too little to judge.");
  });
  it("no scorecard at all (an older debrief): the sentence alone", () => {
    const h = render({ headline: "Clear answers." }, null);
    expect(h).not.toContain("Debrief/Level");
    expect(text(h)).toContain("Clear answers.");
  });
});

describe("plan markup (D98, US-20 AC8; layout D)", () => {
  const steps: PlanStepModel[] = [
    { id: "p1", layer: "content", text: "Write one number for each story.", drill: true },
    { id: "p2", layer: "language", text: "Drill the phrases out loud.", drill: false },
  ];
  const spots: WeakSpotModel[] = [
    { id: "w1", layer: "content", title: "Stories have no numbers", evidence: { kind: "questions", ids: [1, 3] }, fix: "Add one number." },
    { id: "w2", layer: "language", title: "Tenses slip", evidence: { kind: "questions", ids: [2] }, fix: "Keep one tense." },
  ];
  const plan = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(Plan, { steps, spots, id: "pl", showDrill: true, onDrill: noop, onJump: noop, ...extra }));

  it("is a numbered list of up to three steps under 'Your plan for the next session'", () => {
    const h = plan();
    expect(h).toContain("<ol ");
    expect((h.match(/<li /g) ?? []).length).toBe(2);
    expect(text(h)).toContain("Your plan for the next session");
    expect(text(h)).toContain("Write one number for each story.");
  });
  it("each step names the weak spot it comes from and links to its questions", () => {
    const h = plan();
    expect(text(h)).toContain("Stories have no numbers");
    for (const n of [1, 3]) expect(h).toContain(`aria-label="Go to question ${n}"`);
  });
  it("has one drill button, the page's only primary, with the drill track and the hint", () => {
    const h = plan({ drill: { questions: 3, points: 2, minutes: 8 } });
    expect((h.match(/Drill these weak spots/g) ?? []).length).toBe(1);
    expect(h).toContain('data-track="drill-start"');
    expect(text(h)).toContain("3 questions on these 2 points · about 8 min");
  });
  it("no drill (a too-short session): no button", () => {
    expect(text(plan({ showDrill: false }))).not.toContain("Drill these weak spots");
  });
  it("storage not writable: the drill is secondary", () => {
    expect(plan({ storageError: true })).not.toMatch(/<button[^>]*primary[^>]*>[^<]*<[^>]*>[^<]*Drill/);
  });
  it("in the example the drill is off and says it is for the user's own debrief", () => {
    const h = plan({ example: true });
    expect(h).toMatch(/<button[^>]*disabled[^>]*>/);
    expect(text(h)).toContain("In your own debrief, you can drill these weak spots in a short session.");
  });
  it("an older debrief with no plan lists its weak spots under 'What to work on'", () => {
    const h = plan({ steps: [] });
    expect(text(h)).toContain("What to work on");
    expect(text(h)).toContain("Stories have no numbers");
    expect(text(h)).toContain("Add one number.");
  });
  it("nothing to list and no drill: nothing", () => {
    expect(plan({ steps: [], spots: [], showDrill: false })).toBe("");
  });
  it("steps follow the configured layer order", () => {
    expect(orderedPlan(steps, ["language", "content", "delivery"]).map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});

describe("one question's feedback list (layout D)", () => {
  const q = exampleSam.questions.find((x) => x.layers.language?.corrections.length) ?? exampleSam.questions[0]!;
  const rowCtx: QuestionViewProps["rows"] = {
    isDismissed: (_id, base) => Boolean(base),
    isLeaving: () => false,
    editing: null,
    focusEditor: false,
    onEdit: noop,
    onDismiss: noop,
    onRestore: noop,
    onSave: noop,
    onCancel: noop,
  };
  const base = (over: Partial<QuestionViewProps> = {}): QuestionViewProps => ({
    q,
    index: 0,
    total: exampleSam.questions.length,
    seq: ["content", "language", "delivery"],
    spots: exampleSam.weakSpots,
    scorecard: exampleSam.scorecard,
    headingId: "h1",
    uid: "u",
    rows: rowCtx,
    rechecking: false,
    answerEditing: false,
    focusEditor: false,
    strongerOpen: false,
    onStrongerOpenChange: noop,
    ...over,
  });
  const render = (over: Partial<QuestionViewProps> = {}) => renderToStaticMarkup(createElement(QuestionView, base(over)));

  it("has the question as a focusable heading and the 'n of total' fact", () => {
    const h = render();
    expect(h).toContain('id="h1"');
    expect(h).toContain('tabindex="-1"');
    expect(text(h)).toContain(`Question 1 of ${exampleSam.questions.length}`);
  });
  it("shows 'Lost points on' from the scorecard, or nothing without one", () => {
    expect(text(render())).toMatch(/Lost points on|No points lost/);
    expect(text(render({ scorecard: undefined }))).not.toMatch(/Lost points on|No points lost/);
  });
  it("two columns: your answer and one 'Feedback' list", () => {
    const h = render();
    expect(text(h)).toContain("Your answer");
    expect(text(h)).toContain("Feedback");
    expect((h.match(/>Feedback</g) ?? []).length).toBe(1);
  });
  it("language corrections read 'heard → say' with 'Not what you said?' and Dismiss when the handlers exist", () => {
    const h = render();
    expect(h).toContain('data-track="not-what-i-said"');
    expect(h).toContain('data-track="correction-dismiss"');
    const bare = render({ rows: { ...rowCtx, onEdit: undefined, onDismiss: undefined } });
    expect(bare).not.toContain('data-track="not-what-i-said"');
    expect(bare).not.toContain('data-track="correction-dismiss"');
  });
  it("a dismissed correction is one line with Undo", () => {
    const h = render({ rows: { ...rowCtx, isDismissed: () => true } });
    expect(h).toContain("Debrief/CorrectionRow/dismissed");
    expect(h).toContain('data-track="correction-undo"');
  });
  it("the weak-spot block (said / lands / fix) sits on the spot's first evidence question only", () => {
    const spot: WeakSpotModel = { id: "w", layer: "content", title: "No numbers", evidence: { kind: "questions", ids: [q.n, q.n + 1] }, said: { kind: "quote", text: "we did a lot" }, lands: "Sounds vague.", fix: "Add a number." };
    const here = render({ spots: [spot] });
    expect(text(here)).toMatch(/What you said .*we did a lot .*How it lands Sounds vague\. How to fix Add a number\./);
    expect(here).toMatch(/<q class="[^"]*quote/);
    const other = renderToStaticMarkup(createElement(QuestionView, base({ q: { ...q, n: q.n + 1 }, spots: [spot] })));
    expect(text(other)).not.toContain("Sounds vague.");
  });
  it("a delivery number is labelled Measured, as plain text", () => {
    const spot: WeakSpotModel = { id: "w", layer: "delivery", title: "Fillers", evidence: { kind: "questions", ids: [q.n] }, said: { kind: "metric", text: "12 fillers in 3:40" }, fix: "Pause." };
    const h = render({ spots: [spot] });
    expect(text(h)).toMatch(/Measured 12 fillers in 3:40/);
    expect(h).not.toContain("“12 fillers");
  });
  it("a language spot does not repeat 'What you said' (its correction shows the same words)", () => {
    const spot: WeakSpotModel = { id: "w", layer: "language", title: "Tenses", evidence: { kind: "questions", ids: [q.n] }, said: { kind: "quote", text: "I go yesterday" }, fix: "Use the past." };
    expect(text(render({ spots: [spot] }))).not.toContain("What you said");
  });
  it("while the answer is checked again, a skeleton stands in for the feedback", () => {
    const h = render({ rechecking: true });
    expect(h).toContain("Debrief/Rechecking");
    expect(h).not.toContain('data-track="not-what-i-said"');
  });
  it("feedback that never arrived: an info line instead of the notes", () => {
    const h = render({ q: { ...q, unavailable: true } });
    expect(text(h)).toContain("Feedback wasn't available for this answer.");
  });
});

describe("one Practise again on the page, near the top", () => {
  const button = (props: Parameters<typeof PractiseAgain>[0]) => renderToStaticMarkup(createElement(PractiseAgain, props));
  it("an interview: a button with the tracking label; the hint is its description (and tooltip), not a line of text", () => {
    const h = button({ variant: "interview", onPractise: noop });
    expect(text(h)).toContain("Practise again");
    expect(h).toContain('data-track="practise-again"');
    expect(h).toContain('aria-description="Same job and round, new questions"');
    expect(text(h)).not.toContain("Same job and round");
  });
  it("English with phrases to review: the label says so; without them it is a plain Practise again", () => {
    const withPhrases = button({ variant: "english", english: englishS3.english, onPractise: noop });
    expect(text(withPhrases)).toContain("Practise these phrases");
    const plain = button({ variant: "english", english: { ...englishS3.english!, phrases: [] }, onPractise: noop });
    expect(text(plain)).toContain("Practise again");
    expect(plain).not.toContain("aria-description");
  });
  it("the example has none", () => {
    expect(button({ variant: "example" })).toBe("");
  });
});

describe("the actions block (layout D: the drill lives in the plan)", () => {
  const actions = (drillInPlan: boolean) => renderToStaticMarkup(createElement(Actions, { variant: "interview", model: interviewS2, drillInPlan, id: "a", onDrill: noop }));
  it("drops its drill when the plan has it, and keeps it for a debrief with no plan", () => {
    expect(actions(true)).toBe("");
    expect(text(actions(false))).toContain("Drill these weak spots");
  });
  it("Practise again is not in the Actions block: it is one button near the top of the page", () => {
    expect(text(actions(false))).not.toContain("Practise again");
  });
  it("the example has no second \"Start your first interview\" (the banner button is its way in); the hint moves to the plan with the button", () => {
    const ex = (drillInPlan: boolean) => text(renderToStaticMarkup(createElement(Actions, { variant: "example", model: exampleSam, drillInPlan, id: "a" })));
    expect(ex(true)).not.toContain("In your own debrief");
    expect(ex(true)).toBe("");
    expect(ex(false)).not.toContain("Start your first interview");
    expect(ex(false)).toContain("In your own debrief");
  });
});
