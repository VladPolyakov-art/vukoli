import { describe, expect, it } from "vitest";
import type { FeedbackRecord, LanguageItem, SessionRecord } from "../../lib/types";
import { answerSegments, feedbackOfFlag, mapRecord, questionRefs, rewriteSegments, threadsFromRecord, usageText } from "./mapRecord";

const item = (over: Partial<LanguageItem> = {}): LanguageItem => ({
  id: "f1", tag: "tense", original: "I have led the redesign last spring", better: ["I led the redesign last spring"],
  reason: "A finished time takes the past simple.", severity: 2, status: "active", ...over,
});

const fb = (id: string, qid: string, over: Partial<FeedbackRecord> = {}): FeedbackRecord => ({
  id, turn_id: 1, question: "Q", question_id: qid, competency: "x", answer_kind: "main", answer: "I have led the redesign last spring",
  source: "voice", complete: true,
  layers: {
    content: { status: "fix", fix: "End with a result.", layer: "content" },
    language: { status: "fix", items: [item({ id: `${id}-1` })] },
    delivery: { status: "ok", metrics: { words: 120, fillers: 8, seconds: 110, wpm: 118, mode: "voice" } },
  },
  ...over,
});

const rec = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: "s1", mode: "interview", engine: "ollama", started_at: "2026-10-19T20:40:00", title: "Kestrel Pay",
  questions: [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, competency: "x", text: `Question ${n}` })),
  transcript: [{ role: "model", text: "What was the result?", question_id: "q1", kind: "follow_up" }],
  feedback: [fb("a", "q1"), fb("b", "q2"), fb("c", "q3")],
  debrief: { verdict: "Clear stories.", weak_spots: [
    { layer: "language", tag: "tense", text: "Tense", evidence: ["q1", "q2"] },
    { layer: "content", tag: "no_result", text: "No result", evidence: ["q1"] },
    { layer: "content", tag: "we_vs_i", text: "We instead of I", evidence: ["q2"] },
  ], strength: "", next_step: "", source: "model" },
  ...over,
});

const opts = { obsidian: false, stronger: {}, waiting: false };

describe("mapRecord", () => {
  it("groups feedback per question and numbers it by the question list", () => {
    const m = mapRecord(rec(), opts);
    expect(m.questions.map((q) => q.n)).toEqual([1, 2, 3]);
    expect(m.questions[0]!.followUp).toBe("What was the result?");
    expect(m.questions[0]!.layers.language?.corrections).toHaveLength(1);
  });

  it("`empty`: a debrief view exists whenever there is something to show besides the chat", () => {
    expect(mapRecord(rec(), opts).empty).toBe(false);
    // Too short, no feedback at all: only the conversation, no switch.
    const noFeedback = rec({ feedback: [], debrief: { verdict: "Too short.", weak_spots: [], strength: "", next_step: "", source: "template", too_short: true } });
    expect(mapRecord(noFeedback, opts).empty).toBe(true);
    // Too short, but two answers were checked: their cards are the debrief view.
    const twoCards = rec({ feedback: [fb("a", "q1"), fb("b", "q2")], debrief: { verdict: "Too short.", weak_spots: [], strength: "", next_step: "", source: "template", too_short: true } });
    expect(mapRecord(twoCards, opts).empty).toBe(false);
    // While the debrief is being written the pending state belongs to the debrief view.
    expect(mapRecord(rec({ debrief: undefined }), { ...opts, waiting: true }).empty).toBe(false);
    // English: even a one-turn talk with nothing to correct has its summary and "No corrections this time."
    const english = rec({ mode: "english", questions: [], feedback: [], debrief: { verdict: "", weak_spots: [], strength: "", next_step: "", source: "template", too_short: true } });
    expect(mapRecord(english, opts).empty).toBe(false);
    expect(mapRecord({ ...english, debrief: null }, opts).empty).toBe(false);
  });

  it("keeps the whole talk as chat lines, each tied to its question (D71)", () => {
    const m = mapRecord(rec({
      transcript: [
        { role: "model", text: "Tell me about a redesign.", question_id: "q2", kind: "question" },
        { role: "user", text: "I led it.", question_id: "q2", kind: "main" },
        { role: "model", text: "  ", kind: "ack" },
        { role: "model", text: "What was the result?", question_id: "q2", kind: "follow_up" },
        { role: "model", text: "Thanks, that's all.", kind: "closing" },
      ],
    }), opts);
    expect(m.conversation?.map((c) => [c.speaker, c.q, c.opens ?? false, c.followUp ?? false])).toEqual([
      ["mike", 2, true, false], ["user", 2, false, false], ["mike", 2, false, true], ["mike", undefined, false, false],
    ]);
  });

  it("keeps one weak spot per layer and folds the second content spot into `also`", () => {
    const m = mapRecord(rec(), opts);
    expect(m.weakSpots.map((w) => w.layer).sort()).toEqual(["content", "language"]);
    const content = m.weakSpots.find((w) => w.layer === "content")!;
    expect(content.also?.ids).toEqual([2]);
    expect(content.evidence).toEqual({ kind: "questions", ids: [1] });
  });

  it("gives a partial state under three answers, with no verdict or weak spots", () => {
    const m = mapRecord(rec({ feedback: [fb("a", "q1"), fb("b", "q2")], debrief: { verdict: "", weak_spots: [], strength: "", next_step: "", source: "template", too_short: true } }), opts);
    expect(m.partial).toEqual({ answered: 2, total: 5 });
    expect(m.verdict).toBeUndefined();
    expect(m.weakSpots).toEqual([]);
    expect(m.skipped).toEqual({ from: 3, to: 5 });
  });

  describe("answered counts questions, not replies", () => {
    const tooShort = { verdict: "", weak_spots: [], strength: "", next_step: "", source: "template" as const, too_short: true };
    const partialOf = (feedback: FeedbackRecord[], over: Partial<SessionRecord> = {}) =>
      mapRecord(rec({ feedback, debrief: tooShort, ...over }), opts).partial;
    it("many voice fragments of one question are one answered question, whatever stats.answers says", () => {
      const fragments = Array.from({ length: 11 }, (_, i) => fb(`f${i}`, "q1"));
      expect(partialOf(fragments, { stats: { answers: 11, turns: 16 } })).toEqual({ answered: 1, total: 5 });
    });
    it("two questions answered read 2", () => {
      expect(partialOf([fb("a", "q1"), fb("b", "q1"), fb("c", "q2")], { stats: { answers: 9, turns: 12 } })).toEqual({ answered: 2, total: 5 });
    });
    it("follow-ups do not count", () => {
      const m = partialOf([fb("a", "q1"), fb("b", "q2", { answer_kind: "follow_up" }), fb("c", "q3", { answer_kind: "follow_up" })]);
      expect(m).toEqual({ answered: 1, total: 5 });
    });
    it("a question without an id is told apart by its text; the count never exceeds the total", () => {
      const noId = (id: string, question: string) => fb(id, "", { question });
      expect(partialOf([noId("a", "Tell me about X"), noId("b", "Tell me about X")])?.answered).toBe(1);
      const many = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"].map((q) => fb(q, q));
      expect(partialOf(many, { questions: [{ id: "q1", competency: "x", text: "Question 1" }], feedback: many.slice(0, 3) })?.answered).toBeLessThanOrEqual(3);
    });
  });

  it("says why the verdict is missing", () => {
    expect(mapRecord(rec({ debrief: null }), { ...opts, waiting: true }).verdictNotice).toBe("pending");
    expect(mapRecord(rec({ debrief: null }), opts).verdictNotice).toBe("missing");
    const tpl = mapRecord(rec({ debrief: { verdict: "V", weak_spots: [], strength: "", next_step: "", source: "template" } }), opts);
    expect(tpl.verdictNotice).toBe("template");
    expect(tpl.verdict?.headline).toBe("V");
  });

  it("marks a dismissed flag as dismissed and counts it as misheard", () => {
    const f = fb("a", "q1", { layers: { language: { status: "fix", items: [item({ id: "x", status: "dismissed" })] } } });
    const m = mapRecord(rec({ feedback: [f, fb("b", "q2"), fb("c", "q3")] }), opts);
    expect(m.questions[0]!.layers.language?.corrections[0]!.dismissed).toBe(true);
    expect(m.questions[0]!.misheard).toBe(1);
  });

  it("marks an unconfirmed flag's heard words as unsure", () => {
    const f = fb("a", "q1", { layers: { language: { status: "fix", items: [item({ id: "x", status: "unconfirmed", original: "give us", better: ["gave us"] })] } } });
    const c = mapRecord(rec({ feedback: [f, fb("b", "q2"), fb("c", "q3")] }), opts).questions[0]!.layers.language!.corrections[0]!;
    expect(c.heard.some((p) => typeof p !== "string" && p.kind === "unsure")).toBe(true);
  });

  it("maps an English session to corrections per turn", () => {
    const m = mapRecord(rec({ mode: "english", questions: [], feedback: [fb("a", "", { answer_kind: "turn" }), fb("b", "", { answer_kind: "turn", id: "b" })] }), opts);
    expect(m.english?.corrections.map((c) => c.turn?.n)).toEqual([1, 2]);
    expect(m.english?.phrases).toHaveLength(1);
    expect(m.questions).toEqual([]);
  });

  it("finds the record a flag belongs to", () => {
    const r = rec();
    expect(feedbackOfFlag(r, "b-1")?.id).toBe("b");
    expect(threadsFromRecord(r)).toHaveLength(3);
  });
});

describe("segments", () => {
  it("marks low-confidence words in the answer", () => {
    const parts = answerSegments("legal give us a requirement", [{ w: "give" }]);
    expect(parts).toEqual(["legal ", { kind: "unsure", text: "give" }, " us a requirement"]);
  });
  it("marks [placeholders] in a stronger answer as fixes", () => {
    const { parts, placeholders } = rewriteSegments("It went from [your number] to [your number].");
    expect(placeholders).toBe(true);
    expect(parts).toEqual(["It went from ", { kind: "fix", text: "[your number]" }, " to ", { kind: "fix", text: "[your number]" }, "."]);
  });
});

describe("usageText (D88)", () => {
  it("counts the session's requests and, where the plan reports it, the share it used", () => {
    expect(usageText(rec())).toBe("");
    expect(usageText(rec({ usage: { engine: "antigravity_cli", requests: 14 } }))).toBe("14 requests to the AI");
    expect(usageText(rec({ usage: { engine: "codex_cli", requests: 10, windows: [{ id: "month", before: 2, after: 2 }] } })))
      .toBe("10 requests to the AI · under 1% of the monthly limit");
    expect(usageText(rec({ usage: { engine: "claude_cli", requests: 9, windows: [
      { id: "five_hour", before: 10, after: 13 }, { id: "seven_day", before: 4, after: 4.5 }] } })))
      .toBe("9 requests to the AI · 3% of the 5-hour limit");
  });

  it("is in the debrief's meta line", () => {
    const model = mapRecord(rec({ usage: { engine: "ollama", requests: 1 } }), opts);
    expect(model.meta.map((m) => m.text)).toContain("1 request to the AI");
  });
});

describe("D98: scorecard, how it lands, plan", () => {
  const d98 = (over: Partial<NonNullable<SessionRecord["debrief"]>> = {}): SessionRecord["debrief"] => ({
    verdict: "Clear stories.",
    weak_spots: [
      { layer: "content", tag: "no_result", text: "End every story with a number.", evidence: ["q1", "q2"], said: "I rebuilt the onboarding.", said_kind: "quote", lands_as: "The story ends without a point." },
      { layer: "delivery", tag: "filler_high", text: "Pause silently.", evidence: ["q2"], said: "12 fillers in 3:40", said_kind: "metric", lands_as: "Many ums read as unsure." },
    ],
    scorecard: { rows: [
      { key: "delivery", score: 3, answers: 3, lost: ["q2"] },
      { key: "structure", score: 2, answers: 3, lost: ["q1", "q2", "bad"] },
      { key: "reflection", score: null, answers: 0, lost: [] },
      { key: "nonsense" as never, score: 4, answers: 1, lost: [] },
    ] },
    plan: [
      { layer: "content", tag: "no_result", text: "Write one number for each story.", drill: true },
      { layer: "delivery", tag: "filler_high", text: "Record one answer.", drill: true },
    ],
    strength: "", next_step: "", source: "model", ...over,
  });

  it("reads question ids the same way for weak spots and for the scorecard", () => {
    expect(questionRefs(["q1", "Q12", "x", "q"])).toEqual([1, 12]);
    expect(questionRefs(undefined)).toEqual([]);
    expect(questionRefs(["q1", "q1", "q2", "q1", "q2", "q3"])).toEqual([1, 2, 3]);
  });

  it("keeps the scorecard rows in the fixed order, drops unknown keys and bad question ids", () => {
    const m = mapRecord(rec({ debrief: d98() }), opts);
    expect(m.scorecard?.map((r) => r.key)).toEqual(["structure", "reflection", "delivery"]);
    expect(m.scorecard?.[0]).toEqual({ key: "structure", score: 2, answers: 3, lost: [1, 2] });
    expect(m.scorecard?.[1]).toEqual({ key: "reflection", score: null, answers: 0, lost: [] });
  });

  it("treats a score outside 1–5 as not asked, and lists no lost points for it", () => {
    const m = mapRecord(rec({ debrief: d98({ scorecard: { rows: [{ key: "result", score: 9, answers: 2, lost: ["q1"] }, { key: "own_part", score: 0, answers: 2, lost: ["q1"] }] } }) }), opts);
    expect(m.scorecard?.map((r) => [r.key, r.score, r.lost])).toEqual([["own_part", null, []], ["result", null, []]]);
  });

  it("maps 'What you said' and 'How it lands' and moves the server text to 'How to fix'", () => {
    const m = mapRecord(rec({ debrief: d98() }), opts);
    const content = m.weakSpots.find((w) => w.layer === "content")!;
    expect(content.said).toEqual({ text: "I rebuilt the onboarding.", kind: "quote" });
    expect(content.lands).toBe("The story ends without a point.");
    expect(content.fix).toBe("End every story with a number.");
    expect(content.title).toBe("End with the result");
    expect(m.weakSpots.find((w) => w.layer === "delivery")!.said).toEqual({ text: "12 fillers in 3:40", kind: "metric" });
  });

  it("a delivery fragment without a kind is a metric, a content one is a quote", () => {
    const m = mapRecord(rec({ debrief: d98({ weak_spots: [
      { layer: "delivery", tag: "pace_fast", text: "Slow down.", said: "182 words per minute", lands_as: "x" },
      { layer: "content", tag: "no_result", text: "Add a result.", said: "It went well" },
    ] }) }), opts);
    expect(m.weakSpots.map((w) => w.said?.kind)).toEqual(["metric", "quote"]);
  });

  it("leaves out a line that has no data: no empty 'What you said'", () => {
    const m = mapRecord(rec({ debrief: d98({ weak_spots: [{ layer: "content", tag: "no_result", text: "Add a result.", said: "  ", lands_as: "" }, { layer: "language", tag: "tense", text: "Use the past simple.", lands_as: "Tense slips…" }] }) }), opts);
    expect(m.weakSpots[0]!.said).toBeUndefined();
    expect(m.weakSpots[0]!.lands).toBeUndefined();
    expect(m.weakSpots[1]!.said).toBeUndefined();
    expect(m.weakSpots[1]!.lands).toBe("Tense slips…");
  });

  it("an older debrief keeps its sentence as the heading and gets no new parts", () => {
    const m = mapRecord(rec(), opts);
    expect(m.weakSpots.find((w) => w.layer === "language")!.title).toBe("Tense");
    expect(m.weakSpots.every((w) => !w.said && !w.lands && !w.fix)).toBe(true);
    expect(m.scorecard).toBeUndefined();
    expect(m.plan).toBeUndefined();
  });

  it("the plan has up to three steps and only the first carries the drill", () => {
    const four = d98({ plan: [1, 2, 3, 4].map((n) => ({ layer: "content" as const, tag: "no_result", text: `Step ${n}`, drill: true })) });
    const m = mapRecord(rec({ debrief: four }), opts);
    expect(m.plan?.map((p) => [p.text, p.drill])).toEqual([["Step 1", true], ["Step 2", false], ["Step 3", false]]);
  });

  it("an empty plan is no plan", () => {
    expect(mapRecord(rec({ debrief: d98({ plan: [] }) }), opts).plan).toBeUndefined();
    expect(mapRecord(rec({ debrief: d98({ plan: [{ layer: "content", tag: "x", text: " ", drill: true }] }) }), opts).plan).toBeUndefined();
  });

  it("a short session (no verdict) and an English session get neither the scorecard nor the plan", () => {
    const short = mapRecord(rec({ feedback: [fb("a", "q1"), fb("b", "q2")], debrief: d98({ too_short: true, verdict: "" }) }), opts);
    expect(short.scorecard).toBeUndefined();
    expect(short.plan).toBeUndefined();
    const noVerdict = mapRecord(rec({ debrief: d98({ verdict: "" }) }), opts);
    expect(noVerdict.scorecard).toBeUndefined();
    const english = mapRecord(rec({ mode: "english", questions: [], feedback: [fb("a", "", { answer_kind: "turn" })], debrief: d98() }), opts);
    expect(english.scorecard).toBeUndefined();
    expect(english.plan).toBeUndefined();
  });
});

describe("D99: the verdict step comes from the server", () => {
  const withStep = (step: unknown, over: Partial<NonNullable<SessionRecord["debrief"]>> = {}) =>
    mapRecord(rec({ debrief: { verdict: "Clear stories.", weak_spots: [], strength: " Clear results. ", next_step: "", source: "model", step, ...over } as SessionRecord["debrief"] }), opts);

  it("with a step the headline is the step's name and the model's sentence is the line under it", () => {
    const v = withStep({ value: 1, gap: ["reflection", "structure"], target: 4 }).verdict!;
    expect(v).toMatchObject({ step: 1, headline: "Getting there", line: "Clear stories.", gap: ["reflection", "structure"], target: 4, strength: "Clear results." });
    expect(withStep({ value: 0, gap: ["result"], target: 3 }).verdict).toMatchObject({ step: 0, headline: "Not ready yet", target: 3 });
    expect(withStep({ value: 2, gap: [], target: null }).verdict).toMatchObject({ step: 2, headline: "Ready", gap: [], target: undefined });
  });
  it("without a step (too short, no scored row, older server) the sentence stays the headline, no scale", () => {
    const v = withStep(undefined).verdict!;
    expect(v).toEqual({ headline: "Clear stories.", strength: "Clear results." });
    expect(v.step).toBeUndefined();
  });
  it("ignores a step value outside 0–2, unknown gap keys and a repeated key", () => {
    expect(withStep({ value: 3, gap: [], target: 4 }).verdict?.step).toBeUndefined();
    expect(withStep({ value: 1, gap: ["result", "nonsense", "result"], target: 4 }).verdict?.gap).toEqual(["result"]);
    expect(withStep({ value: 1, gap: ["result"], target: 7 }).verdict?.target).toBeUndefined();
  });
  it("a template verdict also gets the step; its sentence goes under the name", () => {
    const m = withStep({ value: 1, gap: ["delivery"], target: 4 }, { source: "template", verdict: "You finished the practice round." });
    expect(m.verdictNotice).toBe("template");
    expect(m.verdict).toMatchObject({ headline: "Getting there", line: "You finished the practice round." });
  });
});

