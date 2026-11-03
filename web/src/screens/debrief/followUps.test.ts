/* A session with follow-ups (c1-r2 findings R2-1, R2-2, R2-3, c1-r1 C3): the real test-engine session "General questions",
 * 5 questions and 7 scored answers (Q4 has two follow-ups), with the debrief as the server sends it (testdata/session-followups.json,
 * made by enrich_debrief on tests/data/session_followups.json of the server). Numbers on the page are question numbers. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionRecord } from "../../lib/types";
import { mapRecord } from "./mapRecord";
import { rowsLostIn } from "./parts/debriefShared";
import { Plan } from "./parts/Plan";
import { QuestionView, type QuestionViewProps } from "./parts/QuestionView";
import data from "./testdata/session-followups.json";

const record = data as unknown as SessionRecord;
const opts = { obsidian: false, stronger: {}, waiting: false };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const noop = () => {};

const model = mapRecord(record, opts);
const question = (n: number) => model.questions.find((q) => q.n === n)!;

describe("question numbers (R2-1)", () => {
  it("the session has five tabs, one per question; follow-ups are not tabs", () => {
    expect(model.questions.map((q) => q.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it("every number the debrief shows is the number of a tab", () => {
    const tabs = new Set(model.questions.map((q) => q.n));
    const numbers = [
      ...model.weakSpots.flatMap((w) => [...(w.evidence?.ids ?? []), ...(w.also?.ids ?? [])]),
      ...(model.plan ?? []).flatMap((p) => p.evidence?.ids ?? []),
      ...(model.scorecard ?? []).flatMap((r) => r.lost),
    ];
    expect(numbers.length).toBeGreaterThan(8);
    expect(numbers.filter((n) => !tabs.has(n))).toEqual([]);
  });

  it("the weak spots name the questions where they showed, once each", () => {
    expect(model.weakSpots.find((w) => w.id === "content-no_result")?.evidence?.ids).toEqual([4, 5]);   // was 5, 6, 7
    expect(model.weakSpots.find((w) => w.id === "delivery-too_short")?.evidence?.ids).toEqual([1, 2, 4, 5]);
  });

  it("an old server (no `questions` on the spot) still reads the evidence ids it sends", () => {
    const old = structuredClone(record);
    for (const w of old.debrief!.weak_spots) delete w.questions;
    expect(mapRecord(old, opts).weakSpots.find((w) => w.id === "content-no_result")?.evidence?.ids).toEqual([5, 6, 7]);
  });
});

describe("lost points per question (R2-3)", () => {
  it("Q5 lost points, and says on what; Q4 and Q5 are not mixed up with Q7", () => {
    expect(rowsLostIn(model.scorecard, 5)).toEqual(["structure", "result", "reflection", "delivery"]);
    expect(rowsLostIn(model.scorecard, 4)).toEqual(["structure", "own_part", "result", "delivery"]);
    expect(rowsLostIn(model.scorecard, 3)).toEqual(["own_part"]);
    expect(rowsLostIn(model.scorecard, 7)).toEqual([]);
  });

  const view = (n: number): QuestionViewProps => ({
    q: question(n), index: n - 1, total: 5, seq: ["content", "language", "delivery"], spots: model.weakSpots,
    scorecard: model.scorecard, headingId: "h", uid: "u", answerEditing: false, rechecking: false, focusEditor: false,
    strongerOpen: false, onStrongerOpenChange: noop,
    rows: { isDismissed: () => false, isLeaving: () => false, editing: null, focusEditor: false },
  });
  const html = (n: number) => text(renderToStaticMarkup(createElement(QuestionView, view(n))));

  it("Q5 says 'Lost points on', with its own notes, and no quote from Q4", () => {
    const h = html(5);
    expect(h).toContain("Lost points on: Structure (STAR), Result, Lessons learned, Delivery");
    expect(h).not.toContain("No points lost");
    expect(h).not.toContain("I called the team together");
    expect(h).toContain("Our launch slipped by a month");
  });

  it("Q4 carries the 'what you said' of the weak spot that starts on it, from its own follow-up", () => {
    const h = html(4);
    expect(h).toContain("I called the team together and we re-ranked");
  });
});

describe("one question with two follow-ups (R2-2)", () => {
  const q4 = question(4);

  it("keeps every follow-up with its own question and its own answer, in order", () => {
    expect(q4.followUps).toBe(2);
    expect(q4.followUpTurns).toEqual([
      { question: "What was the first thing you did when you heard?", answer: "I called the team together and we re-ranked the backlog in an hour." },
      { question: "What would you ask earlier next time to avoid the surprise?", answer: "Next time I would ask stakeholders about open assumptions during kickoff." },
    ]);
    expect(question(1).followUpTurns).toBeUndefined();
  });

  it("the page reads: main answer, then follow-up 1 and its answer, then follow-up 2 and its answer", () => {
    const h = text(renderToStaticMarkup(createElement(QuestionView, {
      q: q4, index: 3, total: 5, seq: ["content", "language", "delivery"], spots: [], scorecard: model.scorecard, headingId: "h", uid: "u",
      answerEditing: false, rechecking: false, focusEditor: false, strongerOpen: false, onStrongerOpenChange: noop,
      rows: { isDismissed: () => false, isLeaving: () => false, editing: null, focusEditor: false },
    })));
    const at = (s: string) => h.indexOf(s);
    const order = [
      "Your answer", "We changed the plan and it was fine.",
      "Follow-up 1:", "What was the first thing you did when you heard?", "I called the team together",
      "Follow-up 2:", "What would you ask earlier next time", "Next time I would ask stakeholders",
    ].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(h.match(/Your follow-up answer/g)).toHaveLength(2);
  });

  it("one follow-up reads 'Follow-up:' without a number, after the main answer", () => {
    const h = text(renderToStaticMarkup(createElement(QuestionView, {
      q: { ...q4, followUps: 1, followUpTurns: [{ question: "What was the result?", answer: "Up ten percent." }] }, index: 3, total: 5,
      seq: ["content"], spots: [], headingId: "h", uid: "u", answerEditing: false, rechecking: false, focusEditor: false,
      strongerOpen: false, onStrongerOpenChange: noop, rows: { isDismissed: () => false, isLeaving: () => false, editing: null, focusEditor: false },
    })));
    expect(h.indexOf("We changed the plan")).toBeLessThan(h.indexOf("Follow-up: What was the result?"));
    expect(h).not.toContain("Follow-up 1");
  });
});

describe("the plan (C3)", () => {
  const steps = model.plan ?? [];

  it("each step has the title and the questions of its own weak spot", () => {
    expect(steps.map((s) => s.title)).toHaveLength(3);
    expect(new Set(steps.map((s) => s.title)).size).toBe(3);
    expect(steps[0]!.title).toBe("End with the result");
    expect(steps[1]!.title).toBe("Say what you did");
    expect(steps[1]!.title).not.toBe(steps[0]!.title);
    expect(steps[1]!.evidence?.ids).toEqual([2, 4]);
    expect(steps[0]!.evidence?.ids).toEqual([4, 5]);
  });

  it("the page does not put the title of the first spot of a layer on the other step of that layer", () => {
    const h = text(renderToStaticMarkup(createElement(Plan, {
      steps, spots: model.weakSpots, id: "p", showDrill: true, drill: model.drill, onJump: noop,
    })));
    expect(h).toContain('Say what you did. Retell one story using only sentences that start with "I".');
    expect(h.match(/End with the result\./g)).toHaveLength(1);
  });
});
