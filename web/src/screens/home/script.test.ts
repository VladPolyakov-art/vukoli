import { describe, expect, it } from "vitest";
import { CTX_ENGLISH, CTX_ENGLISH_FIRST, CTX_FIRST, CTX_NO_CV, CTX_RETURNING, CV_FILE, JOB_FILE, KESTREL_PASTED, PASTED_TEXT } from "./fixtures";
import { attach, begin, change, pick, planFor, resolveCv, resolveJob, say, setupModel, skip, suggestionsFor } from "./script";

const last = <T,>(xs: T[]) => xs[xs.length - 1]!;

describe("home setup script", () => {
  it("suggests Again / Drill / English to a returning user, General / Example / English on a first visit", () => {
    expect(suggestionsFor(CTX_RETURNING).map((s) => s.label)).toEqual(["Kestrel Pay again", "Drill my weak spots", "Practise English"]);
    expect(suggestionsFor(CTX_FIRST).map((s) => s.label)).toEqual(["General questions", "Show me an example", "Practise English"]);
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
