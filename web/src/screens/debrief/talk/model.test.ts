import { describe, expect, it } from "vitest";
import type { NegotiateDebrief, ToughDebrief } from "../../../lib/types";
import {
  negotiateStrong, negotiateNotInWriting, negotiateAcceptedFirst, negotiateNoOffer, toughNormal, toughModelFailed, toughTwo, toughOne,
} from "./fixtures";
import {
  causeText, conversationTurns, hintsLine, hurtItems, movesEmpty, negotiateEdge, negotiateMoves, negotiateResult, signalText, toughSummary,
} from "./model";

const neg = (r: { debrief: unknown }) => r.debrief as NegotiateDebrief;
const tough = (r: { debrief: unknown }) => r.debrief as ToughDebrief;

describe("negotiate result", () => {
  it("strong deal with a step-up in writing: deal line, two figures, year one", () => {
    const r = negotiateResult(neg(negotiateStrong));
    expect(r.edge).toBe("none");
    expect(r.headline).toBe("You moved the offer from 88,000 to 91,000 EUR.");
    expect(r.dealLine).toBe("Now 91,000 → 98,000 after 6 months");
    expect(r.inWriting).toBe(true);
    expect(r.now).toBe("25%");
    expect(r.later).toEqual({ value: "83%", months: 6 });
    expect(r.yearOne).toBe("Year one: 94,500 EUR");
    expect(r.levers).toEqual(["Signing bonus: 3,000 EUR"]);
  });

  it("a step-up not in the offer letter is marked as such", () => {
    expect(negotiateResult(neg(negotiateNotInWriting)).inWriting).toBe(false);
  });

  it("accepting the first offer has no deal line and its own headline", () => {
    const r = negotiateResult(neg(negotiateAcceptedFirst));
    expect(r.edge).toBe("acceptedFirst");
    expect(r.headline).toBe("You accepted Mike's first offer: 88,000 EUR.");
    expect(r.dealLine).toBeUndefined();
    expect(r.later).toBeUndefined();
  });

  it("no offer yet: a dash for the figure, an explanation, no rows of numbers it does not have", () => {
    const r = negotiateResult(neg(negotiateNoOffer));
    expect(r.edge).toBe("noOffer");
    expect(r.headline).toBe("No offer yet");
    expect(r.now).toBe("—");
    expect(r.note).toBeUndefined();   // the Say it better frame explains
    expect(r.rows.find((x) => x.id === "first")).toBeUndefined();
  });

  it("no room on base: a null share with an offer", () => {
    const d = { ...neg(negotiateStrong), deal: null, summary: { ...neg(negotiateStrong).summary, captured_now_pct: null } };
    expect(negotiateEdge(d)).toBe("noRoom");
    expect(negotiateResult(d).note).toBe("Mike had no room to move on base this time.");
  });

  it("a range built from the target is named so", () => {
    const d = neg(negotiateStrong);
    const built = negotiateResult({ ...d, summary: { ...d.summary, range_source: "your_target" } });
    expect(built.rows.find((x) => x.id === "range")?.label).toBe("Mike's range was built from your target");
    expect(negotiateResult(d).rows.find((x) => x.id === "range")?.value).toBe("85,000–100,000 EUR");
  });

  it("declined and time outcomes", () => {
    const d = neg(negotiateStrong);
    expect(negotiateResult({ ...d, outcome: "declined", deal: null }).headline).toBe("No deal: you declined.");
    expect(negotiateResult({ ...d, outcome: "time", outcome_label: "You asked for time (2 days)" }).rows.find((x) => x.id === "outcome")?.value).toBe("You asked for time (2 days)");
  });
});

describe("negotiate moves", () => {
  it("the step-up row carries the deal line and the goals / writing sub-line", () => {
    const m = negotiateMoves(neg(negotiateStrong));
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0]).toMatchObject({ amounts: "88,000 → 91,000", cause: "Counter with a reason" });
    expect(m.rows[1]).toMatchObject({ amounts: "Now 91,000 → 98,000 after 6 months", cause: "Step-up agreed", sub: "Goals named: yes · In writing: yes" });
    expect(m.pressure).toHaveLength(1);
    expect(m.unasked).toEqual(["Extra days of leave"]);
  });

  it("verbal step-up: goals no, writing no", () => {
    expect(negotiateMoves(neg(negotiateNotInWriting)).rows[0]?.sub).toBe("Goals named: no · In writing: no");
  });

  it("empty when nothing moved", () => {
    expect(movesEmpty(negotiateMoves(neg(negotiateAcceptedFirst)))).toBe(true);
    expect(movesEmpty(negotiateMoves(neg(negotiateStrong)))).toBe(false);
  });

  it("cause labels: ours for known ids, the server's for the rest", () => {
    expect(causeText("lever:bonus", "x")).toBe("Lever ask");
    expect(causeText("competing_offer", "x")).toBe("Competing offer");
    expect(causeText("opening", "Opening offer")).toBe("Opening offer");
  });

  it("hints used line", () => {
    expect(hintsLine([])).toBeNull();
    expect(hintsLine(neg(negotiateStrong).hints_used)).toBe("Hints you used: Ask for their range first (turn 1).");
  });
});

describe("negotiate moves: held and named below", () => {
  it("held rows join the shifts in turn order; the named-below line carries both numbers", () => {
    const d = { ...neg(negotiateStrong), held: [{ turn: 1, offer: 88000, asked: 98000, why: "no_reason", quote: "I want 98,000." }], named_below_opening: { turn: 1, your_number: 70000, opening: 88000, quote: "70k" } };
    const m = negotiateMoves(d);
    expect(m.rows.map((r) => r.turn)).toEqual([1, 1, 2]);
    expect(m.rows.find((r) => r.id === "h0")).toMatchObject({ cause: "Offer unchanged · Same number without a new reason", amounts: "88,000 → 88,000" });
    expect(m.below).toBe("You said 70,000 EUR before Mike made an offer. He was ready to open at 88,000 EUR.");
  });
});

describe("tough summary", () => {
  it("5 answers: calm count and the answer that hurt most", () => {
    const s = toughSummary(tough(toughNormal));
    expect(s.headline).toBe("Handled calmly: 3 of 5");
    expect(s.hurt).toMatchObject({ n: 2, label: "Blames others", quote: "my manager never listened" });
    expect(s.none).toBeNull();
  });

  it("1-2 answers: no counts", () => {
    expect(toughSummary(tough(toughTwo)).headline).toBe("You answered 2 questions.");
    expect(toughSummary(tough(toughOne)).headline).toBe("You answered 1 question.");
    expect(toughSummary(tough(toughTwo)).none).toContain("Nothing hurt");
  });

  it("the model failed: code signals only, no quote for them", () => {
    const d = tough(toughModelFailed);
    const items = hurtItems(d.questions[0]!);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: "Rambling: 9 words", quote: null, mayBeWrong: false });
    expect(d.questions.every((q) => !q.model_checked)).toBe(true);
  });

  it("a model signal is marked as possibly wrong, with its quote", () => {
    const items = hurtItems(tough(toughNormal).questions[1]!);
    expect(items[0]).toMatchObject({ label: "Blames others", quote: "my manager never listened", mayBeWrong: true });
  });

  it("signal labels: ours where the map names the signal, the server's otherwise", () => {
    expect(signalText("shares_personal_info", "x")).toBe("Shares personal info");
    expect(signalText("something_new", "Server label")).toBe("Server label");
  });
});

describe("conversation turns", () => {
  it("numbers the questions of a tough talk by their ids", () => {
    const turns = conversationTurns(toughNormal, tough(toughNormal));
    expect(turns.filter((x) => x.opens).map((x) => x.q)).toEqual([1, 2, 3, 4, 5]);
    expect(turns.find((x) => x.speaker === "user")?.q).toBe(1);
  });

  it("a negotiation is one question long", () => {
    const turns = conversationTurns(negotiateStrong);
    expect(turns[0]).toMatchObject({ speaker: "mike", opens: true, q: 1 });
    expect(new Set(turns.map((x) => x.q))).toEqual(new Set([1]));
  });
});
