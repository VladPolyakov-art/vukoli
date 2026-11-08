import { describe, expect, it } from "vitest";
import {
  CTX_ENGLISH, CTX_ENGLISH_FIRST, CTX_FIRST, CTX_NEGOTIATE, CTX_NEGOTIATE_AGAIN, CTX_NEGOTIATE_LAST, CTX_NO_CV, CTX_RETURNING, CTX_TOUGH, CV_FILE, JOB_FILE,
  KESTREL_PASTED, PASTED_TEXT,
} from "./fixtures";
import { EMPTY_NUMBERS } from "./numbers";
import { weakFromSession } from "./sessionFocus";
import {
  attach, begin, change, pick, planFor, resolveCv, resolveJob, resolveRange, say, setTacticsHidden, setupModel, skip, submitNumbers,
  suggestionsFor, splitResults, tacticOrder, type SetupState,
} from "./script";

const last = <T,>(xs: T[]) => xs[xs.length - 1]!;

describe("home setup script", () => {
  it("suggests Again / Drill / English to a returning user, General / Example / English on a first visit", () => {
    expect(suggestionsFor(CTX_RETURNING).map((s) => s.label)).toEqual(["Kestrel Pay again", "Drill my weak spots", "Practise English", "Tough questions", "Negotiate salary"]);
    expect(suggestionsFor(CTX_FIRST).map((s) => s.label)).toEqual(["General questions", "Show me an example", "Practise English", "Tough questions", "Negotiate salary"]);
    expect(suggestionsFor(CTX_ENGLISH).map((s) => s.label)).toEqual(["Talk about your work", "Small talk", "Practise my 2 phrases"]);
  });

  it("asks T1 → T2 → T3 and then shows the plan", () => {
    let s = begin(CTX_RETURNING, { kind: "text", text: "I want to practise" });
    expect(s.stage).toBe("job");
    expect(setupModel(CTX_RETURNING, s).step).toEqual({ n: 1, of: 3 });
    const t1 = last(s.turns);
    expect(t1.replies?.map((r) => r.label)).toEqual(["Kestrel Pay", "Lumen Health", "Fieldnote", "General questions"]);
    s = pick(CTX_RETURNING, s, t1.id, "job:v2");
    expect(s.stage).toBe("round");
    expect(last(s.turns).text).toBe("What kind of round is it? Last time it was Behavioural.");
    expect(setupModel(CTX_RETURNING, s).step).toEqual({ n: 2, of: 3 });
    s = pick(CTX_RETURNING, s, last(s.turns).id, "round:hr");
    expect(s.stage).toBe("anything");
    s = pick(CTX_RETURNING, s, last(s.turns).id, "anything:none");
    expect(s.stage).toBe("plan");
    const m = setupModel(CTX_RETURNING, s);
    expect(m.step).toBeUndefined();
    expect(m.canSkip).toBe(false);
    expect(m.plan).toMatchObject({ kind: "interview", job: { company: "Lumen Health" }, round: "hr", strictness: 2, questions: 5, minutes: 20, basis: "cv+job" });
    expect(m.plan?.watch).toBe("No result in 4 answers. End each story with what changed.");
  });

  it("answered quick replies are marked and can't be picked twice", () => {
    let s = begin(CTX_RETURNING, { kind: "suggestion", id: "general" });
    const t2 = last(s.turns);
    s = pick(CTX_RETURNING, s, t2.id, "round:technical");
    expect(s.turns.find((x) => x.id === t2.id)?.answered).toBe(true);
    const again = pick(CTX_RETURNING, s, t2.id, "round:hr");
    expect(again).toBe(s);
  });

  it("matches keywords in the first message (HR screen with Lumen → straight to T3, step 1 of 1)", () => {
    const s = begin(CTX_RETURNING, { kind: "text", text: "I have an HR screen with Lumen tomorrow" });
    expect(s.turns[1]?.text).toBe("HR screen for Lumen Health, got it.");
    expect(s.stage).toBe("anything");
    expect(setupModel(CTX_RETURNING, s).step).toEqual({ n: 1, of: 1 });
  });

  it("re-asks the round when nothing matches", () => {
    let s = begin(CTX_RETURNING, { kind: "suggestion", id: "general" });
    s = say(CTX_RETURNING, s, "not sure honestly");
    expect(last(s.turns).text).toBe("I didn't catch the round. Pick one:");
    expect(last(s.turns).replies).toHaveLength(4);
  });

  it("a pasted job is pending until the server answers, then Mike names it", () => {
    let s = begin(CTX_RETURNING, { kind: "text", text: PASTED_TEXT });
    expect(s.pending?.kind).toBe("job");
    expect(last(s.turns)).toMatchObject({ state: "pending", pendingLabel: "Reading the job…" });
    expect(s.turns[0]?.attachment?.meta).toMatch(/^Job description · [\d,]+ characters$/);
    s = resolveJob(CTX_RETURNING, s, { ok: true, job: KESTREL_PASTED });
    expect(s.pending).toBeUndefined();
    expect(s.turns.some((x) => x.text?.startsWith("Got it: **Kestrel Pay**, Senior Product Designer."))).toBe(true);
    expect(s.stage).toBe("round");
    s = skip(CTX_RETURNING, s);
    expect(planFor(CTX_RETURNING, s).jobStatus).toBe("preparing");
  });

  it("a link that needs a login becomes an error with Use general questions", () => {
    let s = begin(CTX_RETURNING, { kind: "text", text: "https://jobs.example/lumen" });
    expect(last(s.turns).pendingLabel).toBe("Opening the page…");
    s = resolveJob(CTX_RETURNING, s, { ok: false });
    expect(last(s.turns)).toMatchObject({ state: "error", action: { id: "use-general" } });
  });

  it("free text in T3 becomes the plan's note; no CV prefixes T3", () => {
    let s = begin(CTX_NO_CV, { kind: "suggestion", id: "general" });
    s = pick(CTX_NO_CV, s, last(s.turns).id, "round:behavioural");
    expect(last(s.turns).text?.startsWith("I don't have your CV yet")).toBe(true);
    s = say(CTX_NO_CV, s, "Please ask about the Lumen redesign story");
    expect(planFor(CTX_NO_CV, s).note).toBe("Please ask about the Lumen redesign story");
  });

  it("Again goes straight to the plan with last time's choices", () => {
    const s = begin(CTX_RETURNING, { kind: "suggestion", id: "again" });
    expect(s.stage).toBe("plan");
    expect(s.turns[1]?.text).toBe("Same as Oct 19: Kestrel Pay, Behavioural, Standard. Change anything below, or start.");
    expect(setupModel(CTX_RETURNING, s).canSkip).toBe(false);
    const changed = change(CTX_RETURNING, s, "strictness", "3");
    expect(planFor(CTX_RETURNING, changed).strictness).toBe(3);
  });

  it("Drill asks for a focus and plans 3 questions", () => {
    let s = begin(CTX_RETURNING, { kind: "suggestion", id: "drill" });
    const ask = last(s.turns);
    expect(ask.text).toBe("From your last 2 interviews: no result in 4 answers and “we” instead of “I” in 3. Two smaller ones too. What should we drill?");
    expect(ask.replies?.map((r) => r.label)).toEqual(["All 4", "Content 2", "Language 1", "Delivery 1"]);
    s = pick(CTX_RETURNING, s, ask.id, "focus:content");
    const plan = planFor(CTX_RETURNING, s);
    expect(plan).toMatchObject({ kind: "drill", questions: 3, minutes: 12 });
    expect(plan.focus?.label).toBe("Content: no result, “we” instead of “I”");
  });

  it("13 (F-13-8, F-13-14): a drill from a debrief goes straight to the plan, keeps the job and asks nothing", () => {
    const s = begin(CTX_RETURNING, { kind: "drill", jobId: "v2" });
    expect(s.stage).toBe("plan");
    expect(s.turns.some((x) => x.replies?.length)).toBe(false);
    expect(s.turns.some((x) => x.text?.includes("What should we drill?"))).toBe(false);
    const plan = planFor(CTX_RETURNING, s);
    expect(plan).toMatchObject({ kind: "drill", questions: 3, job: { id: "v2", company: "Lumen Health" } });
    expect(plan.focus?.spots).toBe("no result, “we” instead of “I”, “I have led”, fillers");
  });

  it("C1: a drill from a debrief works on that debrief's weak spots, not on the shared memory", () => {
    const own = weakFromSession({ debrief: { verdict: "", strength: "", next_step: "", source: "model", weak_spots: [{ layer: "content", tag: "we_not_i", text: "" }] } });
    expect(own.map((w) => w.short)).toEqual(["say \"I\", not \"we\""]);
    const s = begin(CTX_RETURNING, { kind: "drill", jobId: "v2", weak: own });
    const plan = planFor(CTX_RETURNING, s);
    expect(plan.focus?.spots).toBe("say \"I\", not \"we\"");
    expect(plan.focus?.tags).toEqual([{ layer: "content", tag: "we_not_i" }]);
    expect(plan.focus?.label).toBe("All 1: say \"I\", not \"we\"");
    expect(plan.focus?.spots).not.toContain("fillers");
    // The focus can still be changed, but only among the layers of this debrief.
    expect(plan.focusOptions?.map((o) => o.id)).toEqual(["all", "content"]);
    const delivery = planFor(CTX_RETURNING, change(CTX_RETURNING, s, "focus", "delivery"));
    expect(delivery.focus?.spots).toBe("");
    expect(delivery.focus?.tags).toEqual([]);
    // The context itself (the shared memory, Home's chip) is not touched.
    expect(CTX_RETURNING.weak.length).toBeGreaterThan(1);
  });

  it("C1b: the drill plan carries the tags of the chosen focus, so the start message can name them", () => {
    const s = begin(CTX_RETURNING, { kind: "drill" });
    expect(planFor(CTX_RETURNING, s).focus?.tags).toEqual([
      { layer: "content", tag: "no_result" }, { layer: "content", tag: "we_not_i" },
      { layer: "language", tag: "tense" }, { layer: "delivery", tag: "filler_high" },
    ]);
    expect(planFor(CTX_RETURNING, change(CTX_RETURNING, s, "focus", "content")).focus?.tags).toEqual([
      { layer: "content", tag: "no_result" }, { layer: "content", tag: "we_not_i" },
    ]);
    expect(planFor(CTX_RETURNING, change(CTX_RETURNING, s, "focus", "delivery")).focus?.tags).toEqual([{ layer: "delivery", tag: "filler_high" }]);
  });

  it("C1: a drill from a debrief of a session without a job is General questions, not the remembered job", () => {
    expect(CTX_RETURNING.last?.jobId).toBeTruthy();
    const s = begin(CTX_RETURNING, { kind: "drill", jobId: null });
    expect(planFor(CTX_RETURNING, s).job).toBeNull();
    // Home's own drill (no job named at all) keeps the remembered job.
    expect(planFor(CTX_RETURNING, begin(CTX_RETURNING, { kind: "drill" })).job).not.toBeNull();
  });

  it("C1: a debrief with no weak spots of its own falls back to the shared memory", () => {
    const s = begin(CTX_RETURNING, { kind: "drill", jobId: "v2", weak: weakFromSession(null) });
    expect(planFor(CTX_RETURNING, s).focus?.spots).toBe("no result, “we” instead of “I”, “I have led”, fillers");
  });

  it("13 (QA-04): a job with no role is named without a dangling comma", () => {
    let s = begin(CTX_RETURNING, { kind: "text", text: PASTED_TEXT });
    s = resolveJob(CTX_RETURNING, s, { ok: true, job: { ...KESTREL_PASTED, role: "" } });
    const got = s.turns.find((x) => x.text?.startsWith("Got it:"))?.text ?? "";
    expect(got).toMatch(/^Got it: \*\*Kestrel Pay\*\*\. I saved it/);
  });

  it("English: a returning user confirms the level, picks a topic, answers the phrases question", () => {
    let s = begin(CTX_ENGLISH, { kind: "suggestion", id: "en-work" });
    expect(last(s.turns).text).toBe("Same level as last time, B2?");
    expect(setupModel(CTX_ENGLISH, s).step).toEqual({ n: 1, of: 2 });
    s = pick(CTX_ENGLISH, s, last(s.turns).id, "level:B2");
    expect(last(s.turns).text).toBe("Two phrases came back twice: “discuss about the plan” and “since three years”. Shall I steer the talk so you can use them?");
    s = pick(CTX_ENGLISH, s, last(s.turns).id, "phrases:yes");
    expect(planFor(CTX_ENGLISH, s)).toMatchObject({ kind: "english", level: "B2", topic: "Talk about your work", phrases: ["discuss the plan", "for three years"] });
  });

  it("English first visit asks the level with the B1 hint", () => {
    const s = begin(CTX_ENGLISH_FIRST, { kind: "suggestion", id: "en-free" });
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["A2 · everyday topics", "B1 · familiar topics", "B2 · work topics", "C1 · complex topics"]);
  });

  it("the example path switches to English from its quick reply and keeps the chat", () => {
    let s = begin(CTX_FIRST, { kind: "suggestion", id: "example" });
    expect(s.turns.some((x) => x.example)).toBe(true);
    const before = s.turns.length;
    s = pick(CTX_FIRST, s, last(s.turns).id, "example:english");
    expect(s.track).toBe("english");
    expect(s.turns.length).toBeGreaterThan(before);
  });

  it("D89: a file sent at T3 is the CV: Mike reads it, confirms and asks T3 again with its replies", () => {
    let s = begin(CTX_NO_CV, { kind: "text", text: "I want to practise for an interview" });
    s = pick(CTX_NO_CV, s, last(s.turns).id, "job:v2");
    s = pick(CTX_NO_CV, s, last(s.turns).id, "round:behavioural");
    expect(s.stage).toBe("anything");
    s = attach(CTX_NO_CV, s, CV_FILE);
    expect(s.pending?.kind).toBe("cv");
    expect(s.turns.at(-2)?.attachment).toEqual({ kind: "file", label: CV_FILE.name, meta: CV_FILE.size });
    expect(last(s.turns)).toMatchObject({ state: "pending", pendingLabel: "Reading your CV…" });
    expect(attach(CTX_NO_CV, s, CV_FILE)).toBe(s);                         // one read at a time
    s = resolveCv(CTX_NO_CV, s, "ok");
    expect(s.pending).toBeUndefined();
    expect(s.stage).toBe("anything");
    expect(last(s.turns).text).toMatch(/^Thanks, I added your CV.*Anything else I should know\?/);
    expect(last(s.turns).replies?.map((r) => r.id)).toEqual(["anything:none", "anything:gentle", "anything:tough"]);
    s = pick(CTX_RETURNING, s, last(s.turns).id, "anything:none");
    expect(s.stage).toBe("plan");
  });

  it("D89: a CV that can't be read, or a full profile, says so and keeps the question open", () => {
    let s = begin(CTX_NO_CV, { kind: "suggestion", id: "general" });
    expect(s.stage).toBe("round");
    s = resolveCv(CTX_NO_CV, attach(CTX_NO_CV, s, CV_FILE), "unreadable");
    expect(last(s.turns)).toMatchObject({ state: "error" });
    expect(last(s.turns).text).toMatch(/couldn't read this CV/);
    expect(last(s.turns).replies).toHaveLength(4);
    s = resolveCv(CTX_NO_CV, attach(CTX_NO_CV, s, CV_FILE), "full");
    expect(last(s.turns).text).toMatch(/already has 10 files/);
  });

  it("D89: a file sent at T1 is the job", () => {
    let s = begin(CTX_RETURNING, { kind: "text", text: "I want to practise for an interview" });
    s = attach(CTX_RETURNING, s, JOB_FILE);
    expect(s.pending).toMatchObject({ kind: "file", file: JOB_FILE.name });
    expect(s.turns.find((x) => x.replies?.length)?.answered).toBe(true);
  });
});

/** What the user types into the card on a first try: the target (the rest comes from the post). */
const filled = (s: SetupState) => ({ ...last(s.turns).numbers!.values, target: last(s.turns).numbers!.values.target || "96,000" });
const withRange = { ok: true, low: 85000, high: 98000, currency: "EUR" } as const;

/** The negotiate chat up to the numbers card with Kestrel Pay (range read from the post). */
function toNumbers(ctx = CTX_NEGOTIATE): SetupState {
  let s = begin(ctx, { kind: "suggestion", id: "negotiate", scenario: "offer" });
  s = pick(ctx, s, last(s.turns).id, "job:v1");
  expect(s.pending?.kind).toBe("range");
  return resolveRange(ctx, s, withRange);
}

describe("tough talk: chips", () => {
  it("puts the practice modes in their own row, always the same three in the same order", () => {
    for (const ctx of [CTX_RETURNING, CTX_FIRST]) {
      const row = suggestionsFor(ctx).filter((x) => x.group === "practice");
      expect(row.map((x) => [x.id, x.icon])).toEqual([["english", "chat"], ["tough", "hand"], ["negotiate", "target"]]);
      expect(suggestionsFor(ctx).filter((x) => x.group !== "practice")).toHaveLength(2);
    }
  });
  it("leaves the English track alone and offers no chips inside a tough-talk chat", () => {
    expect(suggestionsFor(CTX_ENGLISH).some((x) => x.id === "tough" || x.id === "negotiate")).toBe(false);
    expect(suggestionsFor(CTX_TOUGH)).toEqual([]);
    expect(suggestionsFor(CTX_NEGOTIATE)).toEqual([]);
  });
});

describe("tough talk: negotiate script", () => {
  it("asks for the role with the three newest jobs and a way to type it", () => {
    const s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    expect(s.track).toBe("negotiate");
    expect(s.turns[0]).toMatchObject({ speaker: "user", text: "Negotiate salary" });
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["Kestrel Pay", "Lumen Health", "Fieldnote", "No job, I'll type it"]);
    expect(setupModel(CTX_NEGOTIATE, s)).toMatchObject({ stage: "reply", step: { n: 1, of: 4 }, canSkip: true });
  });

  it("reads the post for the range after a job is picked, then shows the numbers card prefilled", () => {
    let s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "job:v1");
    expect(s.stage).toBe("pending");
    expect(setupModel(CTX_NEGOTIATE, s).step).toEqual({ n: 1, of: 4 });
    s = resolveRange(CTX_NEGOTIATE, s, withRange);
    expect(s.turns.some((x) => x.text === "Kestrel Pay, Senior Product Designer. The post says 85,000–98,000 EUR.")).toBe(true);
    const card = last(s.turns).numbers!;
    expect(card).toMatchObject({ fromPost: true, roleField: false });
    expect(card.values).toMatchObject({ low: "85,000", high: "98,000", currency: "EUR", role: "Senior Product Designer" });
    expect(s.stage).toBe("numbers");
    expect(setupModel(CTX_NEGOTIATE, s).step).toEqual({ n: 2, of: 4 });
  });

  it("says so when the post lists no range, and asks for the numbers without a prefill", () => {
    let s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "job:v2");
    s = resolveRange(CTX_NEGOTIATE, s, { ok: true, low: null, high: null, currency: null });
    expect(s.turns.some((x) => x.text === "Lumen Health, Product Designer, Design Systems. The post doesn't list a range, so add your numbers.")).toBe(true);
    expect(last(s.turns).numbers).toMatchObject({ fromPost: false });
    expect(last(s.turns).numbers?.values).toMatchObject({ low: "", high: "" });
    // a failed read is the same as no range
    let f = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    f = resolveRange(CTX_NEGOTIATE, pick(CTX_NEGOTIATE, f, last(f.turns).id, "job:v2"), { ok: false });
    expect(last(f.turns).numbers).toBeDefined();
  });

  it("takes a typed role (at most 80 characters) and shows the Role field in the numbers card", () => {
    let s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "role:type");
    expect(last(s.turns).text).toBe("Type the role, e.g. Product Designer");
    expect(setupModel(CTX_NEGOTIATE, s).placeholder).toBe("Type the role, e.g. Product Designer");
    s = say(CTX_NEGOTIATE, s, "x".repeat(120));
    expect(s.draft.role).toHaveLength(80);
    // N-1 gave the role, so the card does not ask for it again
    expect(last(s.turns).numbers).toMatchObject({ roleField: false, fromPost: false });
    expect(last(s.turns).numbers?.values.role).toHaveLength(80);
  });

  it("collapses the sent card into a bubble and asks the style (first try: Friendly is the suggestion)", () => {
    let s = toNumbers();
    const turn = last(s.turns);
    s = submitNumbers(CTX_NEGOTIATE, s, turn.id, { ...turn.numbers!.values, target: "96,000" });
    expect(s.turns.find((x) => x.id === turn.id)?.numbers).toBeUndefined();
    expect(s.turns.some((x) => x.speaker === "user" && x.text === "85,000–98,000 EUR · target 96,000 · no competing offer")).toBe(true);
    expect(last(s.turns).text).toBe("How tough should I be? For a first try, Friendly is a good start.");
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["Friendly · easy", "Firm · medium", "Tight budget · hard", "Surprise me"]);
    expect(setupModel(CTX_NEGOTIATE, s).step).toEqual({ n: 3, of: 4 });
  });

  it("does not send an invalid card", () => {
    const s = toNumbers();
    const turn = last(s.turns);
    expect(submitNumbers(CTX_NEGOTIATE, s, turn.id, { ...turn.numbers!.values, target: "" })).toBe(s);
    expect(submitNumbers(CTX_NEGOTIATE, s, turn.id, { ...turn.numbers!.values, target: "80000" })).toBe(s);
  });

  it("remembers: a returning user is asked 'Same as last time, Firm?' with easier / harder / surprise", () => {
    let s = toNumbers(CTX_NEGOTIATE_AGAIN);
    // this job's numbers come back prefilled
    expect(last(s.turns).numbers?.values).toMatchObject({ target: "96,000", currency: "EUR" });
    s = submitNumbers(CTX_NEGOTIATE_AGAIN, s, last(s.turns).id, filled(s));
    expect(last(s.turns).text).toBe("Same as last time, Firm?");
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["Yes, Firm", "Easier: Friendly", "Harder: Tight budget", "Surprise me"]);
  });

  it("matches style words typed in the chat, and asks again when none fits", () => {
    let s = toNumbers();
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, filled(s));
    const bad = say(CTX_NEGOTIATE, { ...s }, "no idea");
    expect(last(bad.turns).text).toBe("I didn't catch the style. Pick one:");
    s = say(CTX_NEGOTIATE, s, "go firm please");
    expect(s.stage).toBe("prep");
    expect(planFor(CTX_NEGOTIATE, s).negotiate?.style).toBe("firm");
  });

  it("builds the plan: start block, Length, tactics in the order of the call", () => {
    let s = toNumbers();
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, filled(s));
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "style:tight");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "prep:no");
    const plan = planFor(CTX_NEGOTIATE, s);
    expect(plan.kind).toBe("negotiate");
    expect(plan.negotiate).toEqual({ scenario: "offer", role: "Senior Product Designer", job_low: 85000, job_high: 98000, target: 96000, currency: "EUR", style: "tight", has_real_offer: false, company: "Kestrel Pay" });
    expect(plan.minutes).toBe(10);
    expect(plan.tactics?.map((c) => c.id)).toEqual(["N2", "N1", "N3", "N4", "N5", "N6", "N9", "N10", "N8"]);
    expect(setupModel(CTX_NEGOTIATE, s).stage).toBe("plan");
  });

  it("adds N7 only when the competing-offer box is on, and Change toggles it", () => {
    let s = toNumbers();
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, filled(s));
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "style:firm");
    s = change(CTX_NEGOTIATE, s, "offer", "on");
    expect(planFor(CTX_NEGOTIATE, s).negotiate?.has_real_offer).toBe(true);
    expect(planFor(CTX_NEGOTIATE, s).tactics?.map((c) => c.id)).toContain("N7");
    expect(tacticOrder("negotiate", { hasOffer: false })).not.toContain("N7");
  });

  it("changes the style and the numbers from the plan card", () => {
    let s = toNumbers();
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, filled(s));
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "style:firm");
    s = change(CTX_NEGOTIATE, s, "style", "friendly");
    s = submitNumbers(CTX_NEGOTIATE, s, null, { ...planValues(s), target: "97k" });
    const plan = planFor(CTX_NEGOTIATE, s);
    expect(plan.negotiate).toMatchObject({ style: "friendly", target: 97000 });
  });

  it("sends text typed beside the form, and at the plan, to the note", () => {
    let s = toNumbers();
    s = say(CTX_NEGOTIATE, s, "I freeze when they ask about salary.");
    expect(last(s.turns).text).toBe("Noted. Fill in the numbers above when you're ready.");
    expect(s.stage).toBe("numbers");
    expect(s.draft.note).toBe("I freeze when they ask about salary.");
  });

  it("skip: remembered numbers and style fill the plan; without them the numbers card is asked", () => {
    let s = begin(CTX_NEGOTIATE_AGAIN, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    s = pick(CTX_NEGOTIATE_AGAIN, s, last(s.turns).id, "job:v1");
    s = resolveRange(CTX_NEGOTIATE_AGAIN, s, withRange);
    s = skip(CTX_NEGOTIATE_AGAIN, s);
    expect(s.stage).toBe("plan");
    expect(planFor(CTX_NEGOTIATE_AGAIN, s).negotiate).toMatchObject({ style: "firm", target: 96000 });

    let f = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "offer" });
    f = skip(CTX_NEGOTIATE, f);
    expect(f.stage).toBe("numbers");
    expect(last(f.turns).numbers?.roleField).toBe(true);
    expect(setupModel(CTX_NEGOTIATE, f).canSkip).toBe(true);
    expect(skip(CTX_NEGOTIATE, f)).toBe(f);
  });

  it("hides and shows the tactics for this chat, starting from the stored preference", () => {
    let s = toNumbers();
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, filled(s));
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "style:firm");
    expect(planFor(CTX_NEGOTIATE, s).tacticsHidden).toBe(false);
    s = setTacticsHidden(s, true);
    expect(planFor(CTX_NEGOTIATE, s).tacticsHidden).toBe(true);
    const stored = { ...CTX_NEGOTIATE, talk: { ...CTX_NEGOTIATE.talk!, tacticsHidden: { tough: false, negotiate: true } } };
    expect(planFor(stored, s.draft.tacticsHidden === undefined ? s : { ...s, draft: { ...s.draft, tacticsHidden: undefined } }).tacticsHidden).toBe(true);
  });
});

function planValues(s: SetupState) {
  const p = planFor(CTX_NEGOTIATE, s).negotiate!;
  return { ...EMPTY_NUMBERS, role: p.role, low: "85,000", high: "98,000", target: "96,000", currency: p.currency };
}

describe("tough talk: tough questions script", () => {
  it("asks the theme with seven replies (Personal is its own theme) and shows the plan", () => {
    let s = begin(CTX_TOUGH, { kind: "suggestion", id: "tough" });
    expect(s.track).toBe("tough");
    expect(last(s.turns).text).toBe("Which questions should I ask? Pick a theme, or Mix for one from each.");
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["Money", "Leaving and gaps", "Weak spots", "Fit", "English at work", "Personal questions", "Mix"]);
    expect(setupModel(CTX_TOUGH, s).step).toEqual({ n: 1, of: 1 });
    s = pick(CTX_TOUGH, s, last(s.turns).id, "theme:money");
    const m = setupModel(CTX_TOUGH, s);
    expect(m.stage).toBe("plan");
    expect(m.plan).toMatchObject({ kind: "tough", questions: 5, minutes: 15, tough: { theme: "money", themeName: "Money" } });
    expect(m.plan?.tactics?.map((c) => c.id)).toEqual(["N3", "T1", "T2"]);
  });

  it("puts N3 first for Money and Mix, last otherwise", () => {
    expect(tacticOrder("tough", { theme: "mix" })).toEqual(["N3", "T1", "T2"]);
    expect(tacticOrder("tough", { theme: "fit" })).toEqual(["T1", "T2", "N3"]);
  });

  it("explains the Personal theme and keeps it out of Mix", () => {
    let s = begin(CTX_TOUGH, { kind: "suggestion", id: "tough" });
    s = pick(CTX_TOUGH, s, last(s.turns).id, "theme:personal");
    expect(s.turns.some((x) => x.text?.startsWith("In many places an interviewer may not be allowed to ask these."))).toBe(true);
    expect(planFor(CTX_TOUGH, s).tough?.theme).toBe("personal");
    expect(planFor(CTX_TOUGH, s).questions).toBe(4);
    expect(planFor(CTX_TOUGH, change(CTX_TOUGH, s, "theme", "mix")).tough?.theme).toBe("mix");
  });

  it("matches theme words, asks again when none fits, and skip chooses Mix", () => {
    let s = begin(CTX_TOUGH, { kind: "suggestion", id: "tough" });
    const bad = say(CTX_TOUGH, s, "hmm");
    expect(last(bad.turns).text).toBe("I didn't catch the theme. Pick one:");
    expect(last(bad.turns).replies).toHaveLength(7);
    const kept = skip(CTX_TOUGH, s);
    expect(planFor(CTX_TOUGH, kept).tough?.theme).toBe("mix");
    s = say(CTX_TOUGH, s, "ask me about leaving my last job");
    expect(planFor(CTX_TOUGH, s).tough?.theme).toBe("leaving");
  });

  it("sends text at the plan to the note", () => {
    let s = begin(CTX_TOUGH, { kind: "suggestion", id: "tough" });
    s = pick(CTX_TOUGH, s, last(s.turns).id, "theme:fit");
    s = say(CTX_TOUGH, s, "keep it short");
    expect(planFor(CTX_TOUGH, s).note).toBe("keep it short");
  });

  it("works without the server content: the chat runs, the plan has no strip", () => {
    const ctx = { ...CTX_TOUGH, talk: undefined };
    let s = begin(ctx, { kind: "suggestion", id: "tough" });
    s = pick(ctx, s, last(s.turns).id, "theme:money");
    expect(planFor(ctx, s)).toMatchObject({ questions: 5, tactics: [] });
  });
});

describe("negotiation v2: scenario step", () => {
  it("asks which kind of call first, with five scenarios", () => {
    const s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate" });
    expect(s.stage).toBe("scenario");
    expect(last(s.turns).replies?.map((r) => r.id)).toEqual(["scenario:screening", "scenario:offer", "scenario:internship", "scenario:counteroffer", "scenario:raise"]);
    expect(setupModel(CTX_NEGOTIATE, s).step).toEqual({ n: 1, of: 5 });
  });

  it("a scenario in the link skips the question (v1 links mean offer)", () => {
    const s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "raise" });
    expect(s.stage).not.toBe("scenario");
    expect(s.draft.scenario).toBe("raise");
  });

  it("raise: no range read, the card has current pay and ask, the plan carries the raise start", () => {
    let s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "raise" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "role:type");
    s = say(CTX_NEGOTIATE, s, "Product Designer");
    const card = last(s.turns).numbers!;
    expect(card.scenario).toBe("raise");
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, { ...card.values, currentPay: "60,000", ask: "72,000", currency: "EUR" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "style:firm");
    const plan = planFor(CTX_NEGOTIATE, s);
    expect(plan.negotiate).toMatchObject({ scenario: "raise", role: "Product Designer", current_pay: 60000, ask: 72000, style: "firm" });
    expect(plan.tactics?.[0]?.id).toBe("R1");
  });

  it("does not send a raise whose ask is below the current pay", () => {
    let s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "raise" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "role:type");
    s = say(CTX_NEGOTIATE, s, "Product Designer");
    const id = last(s.turns).id;
    const sent = submitNumbers(CTX_NEGOTIATE, s, id, { ...last(s.turns).numbers!.values, currentPay: "72,000", ask: "60,000" });
    expect(sent.stage).toBe("numbers");
  });

  it("the interview plan offers a salary talk, off until numbers are given", () => {
    const s = begin(CTX_RETURNING, { kind: "text", text: "I want to practise" });
    let p = pick(CTX_RETURNING, s, last(s.turns).id, "job:v2");
    p = pick(CTX_RETURNING, p, last(p.turns).id, "round:behavioural");
    p = pick(CTX_RETURNING, p, last(p.turns).id, "anything:none");
    const plan = planFor(CTX_RETURNING, p);
    expect(plan.money?.on).toBe(false);
    expect(planFor({ ...CTX_RETURNING, moneyTalk: false }, p).money).toBeUndefined();
  });
});

/* ---------- Negotiation v3 (D118): prepare first ---------- */

function toPrep(ctx = CTX_NEGOTIATE): SetupState {
  let s = toNumbers(ctx);
  s = submitNumbers(ctx, s, last(s.turns).id, filled(s));
  return pick(ctx, s, last(s.turns).id, "style:firm");
}

describe("negotiation v3: prepare first", () => {
  it("asks after the style: Yes · No, and 'Use my case' only when a last case exists", () => {
    const s = toPrep();
    expect(s.stage).toBe("prep");
    expect(last(s.turns).text).toBe("Want to prepare first? About 3 minutes: how bargaining works, then your case.");
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["Yes, let's prepare", "No, start now"]);
    const withLast = toPrep(CTX_NEGOTIATE_LAST);
    expect(last(withLast.turns).replies?.map((r) => r.label)).toEqual(["Yes, let's prepare", "No, start now", "Use my case from last time"]);
    expect(setupModel(CTX_NEGOTIATE, s).step).toEqual({ n: 4, of: 4 });
  });

  it("No: straight to the plan, no case, no prep in the start message", () => {
    let s = toPrep();
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "prep:no");
    const plan = planFor(CTX_NEGOTIATE, s);
    expect(s.stage).toBe("plan");
    expect(plan.case).toBeUndefined();
    expect(plan.negotiate?.prep).toBeUndefined();
  });

  it("Yes: five course messages one at a time, then the three case questions, the Your case card and the plan", () => {
    let s = toPrep();
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "prep:yes");
    expect(setupModel(CTX_NEGOTIATE, s).step).toEqual({ n: 5, of: 8 });
    for (let i = 1; i <= 5; i += 1) {
      expect(s.stage).toBe("course");
      expect(last(s.turns).text).toMatch(new RegExp(`^\\*\\*${i}\\. `));
      expect(last(s.turns).list?.[0]?.text).toMatch(/^“.+”$/);
      expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["Next", "Skip to my case"]);
      s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "course:next");
    }
    expect(s.stage).toBe("case1");
    s = say(CTX_NEGOTIATE, s, "Cut onboarding drop-off by a third.\nLed the checkout redesign.\nGrew trial-to-paid by 12%.\nA fourth one.");
    expect(s.draft.case?.results).toHaveLength(3);
    expect(s.stage).toBe("case2");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case2:market");
    expect(s.stage).toBe("case3");
    const q3 = last(s.turns);
    expect(q3.replies?.map((r) => r.label)).toEqual(["Step-up after probation", "Sign-on bonus", "Earlier review", "Remote days", "Title", "Done", "Skip"]);
    s = pick(CTX_NEGOTIATE, s, q3.id, "case3:step_up");
    s = pick(CTX_NEGOTIATE, s, q3.id, "case3:sign_on");
    expect(s.turns.find((x) => x.id === q3.id)?.answered).toBeFalsy();
    expect(s.turns.find((x) => x.id === q3.id)?.replies?.filter((r) => r.selected).map((r) => r.id)).toEqual(["case3:step_up", "case3:sign_on"]);
    s = pick(CTX_NEGOTIATE, s, q3.id, "case3:done");
    expect(s.stage).toBe("plan");
    expect(s.turns.find((x) => x.caseCard)?.caseCard).toMatchObject({ reason: "Market range", fallbacks: ["Step-up after probation", "Sign-on bonus"] });
    const plan = planFor(CTX_NEGOTIATE, s);
    expect(plan.case).toMatchObject({ reason: "Market range", fallbacks: ["Step-up after probation", "Sign-on bonus"] });
    expect(plan.negotiate?.prep).toEqual({
      course: true, results: ["Cut onboarding drop-off by a third.", "Led the checkout redesign.", "Grew trial-to-paid by 12%."], reason: "Market range", fallbacks: ["step_up", "sign_on"],
    });
  });

  it("Skip to my case leaves the course out of nothing: the strip still follows (course shown), every question can be skipped", () => {
    let s = toPrep();
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "prep:yes");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "course:skip");
    expect(s.stage).toBe("case1");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case1:skip");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case2:skip");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case3:skip");
    expect(s.stage).toBe("plan");
    expect(planFor(CTX_NEGOTIATE, s).case).toBeUndefined();
    expect(planFor(CTX_NEGOTIATE, s).negotiate?.prep).toEqual({ course: true, results: [], reason: "", fallbacks: [] });
  });

  it("without course content the course is skipped and the case is asked; the call has no strip", () => {
    const bare = { ...CTX_NEGOTIATE, talk: { ...CTX_NEGOTIATE.talk!, content: { ...CTX_NEGOTIATE.talk!.content!, course: undefined } } };
    let s = toPrep(bare);
    s = pick(bare, s, last(s.turns).id, "prep:yes");
    expect(s.stage).toBe("case1");
    s = say(bare, s, "Shipped checkout in 3 months");
    s = say(bare, s, "Because of my scope");
    s = say(bare, s, "sign-on bonus and remote days");
    expect(planFor(bare, s).negotiate?.prep).toMatchObject({ course: false, reason: "Because of my scope", fallbacks: ["sign_on", "remote"] });
  });

  it("Use my case from last time: case from the API, course follows the saved case", () => {
    let s = toPrep(CTX_NEGOTIATE_LAST);
    s = pick(CTX_NEGOTIATE_LAST, s, last(s.turns).id, "prep:last");
    expect(s.stage).toBe("plan");
    expect(planFor(CTX_NEGOTIATE_LAST, s).negotiate?.prep).toEqual({
      course: true, results: ["Cut onboarding drop-off by a third", "Led the checkout redesign for 40k merchants"], reason: "Market range", fallbacks: ["step_up", "sign_on"],
    });
    const noCourse = { ...CTX_NEGOTIATE_LAST, talk: { ...CTX_NEGOTIATE_LAST.talk!, lastCases: { offer: { ...CTX_NEGOTIATE_LAST.talk!.lastCases!.offer!, course: false } } } };
    let t2 = toPrep(noCourse);
    t2 = pick(noCourse, t2, last(t2.turns).id, "prep:last");
    expect(planFor(noCourse, t2).negotiate?.prep?.course).toBe(false);
  });

  it("raise uses the raise wording, levers and course", () => {
    let s = begin(CTX_NEGOTIATE, { kind: "suggestion", id: "negotiate", scenario: "raise" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "role:type");
    s = say(CTX_NEGOTIATE, s, "Product Designer");
    s = submitNumbers(CTX_NEGOTIATE, s, last(s.turns).id, { ...last(s.turns).numbers!.values, currentPay: "60,000", ask: "72,000", currency: "EUR" });
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "style:firm");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "prep:yes");
    expect(last(s.turns).text).toContain("Collect results since your last raise");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "course:skip");
    expect(last(s.turns).text).toContain("since your last raise");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case1:skip");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case2:skip");
    expect(last(s.turns).replies?.map((r) => r.label)).toEqual(["A part now", "Dated raise", "Title", "Done", "Skip"]);
  });

  it("Change on the plan's Your case row asks the three questions again and keeps one plan card", () => {
    let s = toPrep();
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "prep:yes");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "course:skip");
    s = say(CTX_NEGOTIATE, s, "Cut churn by 20%");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case2:scope");
    s = pick(CTX_NEGOTIATE, s, last(s.turns).id, "case3:done");
    s = change(CTX_NEGOTIATE, s, "case", "");
    expect(s.stage).toBe("case1");
    expect(s.turns.filter((x) => x.plan)).toHaveLength(0);
    s = skip(CTX_NEGOTIATE, s);
    expect(s.stage).toBe("plan");
    expect(s.turns.filter((x) => x.plan)).toHaveLength(1);
  });

  it("Skip questions skips the rest of the prep", () => {
    let s = toPrep();
    s = skip(CTX_NEGOTIATE, s);
    expect(s.stage).toBe("plan");
    expect(planFor(CTX_NEGOTIATE, s).negotiate?.prep).toBeUndefined();
  });

  it("splits results by line, else by sentence; at most 3, 200 characters each", () => {
    expect(splitResults("One.\nTwo.\n- Three.\nFour.")).toEqual(["One.", "Two.", "Three."]);
    expect(splitResults("Cut churn by 20%. Grew revenue by 5%! Shipped v2?")).toHaveLength(3);
    expect(splitResults("x".repeat(300))[0]).toHaveLength(200);
    expect(splitResults("  ")).toEqual([]);
  });

  it("the tactics strip never lists the in-call objection cards X1 to X6", () => {
    for (const sc of ["screening", "offer", "internship", "counteroffer", "raise"] as const) {
      expect(tacticOrder("negotiate", { scenario: sc, hasOffer: true }).some((id) => /^X\d/.test(id))).toBe(false);
    }
  });
});
