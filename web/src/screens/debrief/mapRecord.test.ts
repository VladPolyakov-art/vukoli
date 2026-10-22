import { describe, expect, it } from "vitest";
import type { FeedbackRecord, LanguageItem, SessionRecord } from "../../lib/types";
import { answerSegments, feedbackOfFlag, mapRecord, rewriteSegments, threadsFromRecord, usageText } from "./mapRecord";

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
