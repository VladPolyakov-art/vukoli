import { describe, expect, it } from "vitest";
import type { FeedbackRecord, ServerMessage } from "../lib/types";
import { initialState, languageCounts, selectOrb, selectThreads, sessionReducer, type SessionAction, type SessionState } from "./reducer";

const run = (actions: SessionAction[], start: SessionState = initialState("text")) => actions.reduce(sessionReducer, start);

const started: ServerMessage = {
  type: "session_started", session_id: "s-1", mode: "interview", engine: "ollama", model: "qwen3:8b", speaks: false,
  questions: [
    { id: "A1", competency: "A", text: "Why are you interested in this role?" },
    { id: "B1", competency: "B", text: "Tell me about a project you owned." },
  ],
  audio: { sample_rate_out: 24000, sample_rate_in: 16000 }, stt: { available: true, backend: "mlx" },
  suggester_available: false, suggest: false, warnings: [],
};

function record(id: string, questionId: string, extra: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id, turn_id: 1, question: "", question_id: questionId, competency: "A", answer_kind: "main", answer: "answer text",
    source: "text", complete: true, layers: {}, ...extra,
  };
}

const askQ = (id: string, text = "Okay. Next question?"): SessionAction[] => [
  { type: "turn_start", speaker: "model" },
  { type: "transcript_delta", speaker: "model", delta: text, full_text: text },
  { type: "turn_complete", speaker: "model", full_text: text, kind: "question", question_id: id, thread_id: id },
  { type: "response_complete" },
];

describe("sessionReducer", () => {
  it("goes live on session_started and tracks Mike's streaming line", () => {
    const s = run([started, { type: "ready" }, { type: "turn_start", speaker: "model" },
      { type: "transcript_delta", speaker: "model", delta: "Hi.", full_text: "Hi." }]);
    expect(s.phase).toBe("live");
    expect(s.mikeTurnOpen).toBe(true);
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({ speaker: "model", text: "Hi.", live: true });
  });

  it("uses the bank text for a question and counts threads for progress", () => {
    const s = run([started, ...askQ("A1", "Thanks for coming. Why are you interested in this role?"), ...askQ("B1")]);
    expect(s.threadOrder).toEqual(["A1", "B1"]);
    expect(s.currentQuestionText).toBe("Tell me about a project you owned.");
    expect(s.mikeTurnOpen).toBe(false);
  });

  it("keeps follow-ups under the current question and resets them on a new thread", () => {
    let s = run([started, ...askQ("A1"),
      { type: "turn_complete", speaker: "model", full_text: "What was the result?", kind: "follow_up", question_id: "A1", thread_id: "A1" }]);
    expect(s.followUps).toEqual(["What was the result?"]);
    s = run(askQ("B1"), s);
    expect(s.followUps).toEqual([]);
  });

  it("dedupes a typed answer echoed back by turn_complete", () => {
    const s = run([started, ...askQ("A1"), { type: "local/user_turn", turnId: 1, text: "I like payments." },
      { type: "turn_complete", speaker: "user", full_text: "I like payments.", turn_id: 1 }]);
    expect(s.transcript.filter((t) => t.speaker === "user")).toHaveLength(1);
    expect(s.awaitingReply).toBe(true);
  });

  it("replaces a feedback record by id as layers fill in, and groups records by thread", () => {
    // D96: nothing arrives during the call, so an answer has no thread of feedback yet.
    let s = run([started, ...askQ("A1"), { type: "local/user_turn", turnId: 1, text: "one two three four five" }]);
    expect(selectThreads(s)).toEqual([]);
    s = run([{ type: "feedback", feedback: record("fb-1", "A1", { complete: false, layers: { delivery: { status: "ok" } } }) }], s);
    expect(selectThreads(s)[0]).toMatchObject({ key: "A1", number: 1, pendingIds: ["fb-1"] });
    s = run([{ type: "feedback", feedback: record("fb-1", "A1", { layers: { delivery: { status: "ok" }, content: { status: "fix", fix: "Add a result." } } }) }], s);
    const threads = selectThreads(s);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.pendingIds).toEqual([]);
    expect(threads[0]!.records[0]!.layers.content?.fix).toBe("Add a result.");
    // A follow-up answer joins the same thread; the next question opens a new one.
    s = run([{ type: "feedback", feedback: record("fb-2", "A1", { answer_kind: "follow_up" }) }, ...askQ("B1"),
      { type: "feedback", feedback: record("fb-3", "B1") }], s);
    expect(selectThreads(s).map((t) => [t.key, t.records.length])).toEqual([["A1", 2], ["B1", 1]]);
  });

  it("tracks the work after the call: answers done of the total (D96)", () => {
    let s = run([started]);
    expect(s.feedbackProgress).toBeNull();
    s = run([{ type: "saving" }, { type: "session_saved", session_id: "s-1" },
      { type: "feedback_progress", done: 0, total: 5 }], s);
    expect(s.feedbackProgress).toEqual({ done: 0, total: 5 });
    expect(s.phase).toBe("saving");                    // the screen keeps saying it is preparing
    s = run([{ type: "feedback_progress", done: 2, total: 5 }], s);
    expect(s.feedbackProgress).toEqual({ done: 2, total: 5 });
    s = run([{ type: "debrief_pending", session_id: "s-1" }], s);
    expect(s.phase).toBe("debrief_pending");
  });

  it("a feedback record that is not complete counts as still being made, under its own question", () => {
    const s = run([started, ...askQ("A1"), ...askQ("B1"),
      { type: "feedback", feedback: record("fb-9", "A1", { complete: false }) }]);
    expect(selectThreads(s)[0]).toMatchObject({ key: "A1", pendingIds: ["fb-9"] });
  });

  it("counts confirmed and active language items but never unconfirmed ones", () => {
    const r = record("fb-1", "A1", {
      layers: {
        language: {
          status: "fix",
          items: [
            { id: "a", tag: "tense", original: "x", better: ["y"], reason: "", severity: 2, status: "active" },
            { id: "b", tag: "tense", original: "x", better: ["y"], reason: "", severity: 2, status: "unconfirmed" },
            { id: "c", tag: "tense", original: "x", better: ["y"], reason: "", severity: 2, status: "dismissed" },
          ],
        },
      },
    });
    expect(languageCounts([r])).toEqual({ counted: 1, toCheck: 1 });
    const s = run([started, { type: "feedback", feedback: r },
      { type: "flag_updated", feedback_id: "fb-1", flag: { id: "b", tag: "tense", original: "x", better: ["y"], reason: "", severity: 2, status: "confirmed" }, language: r.layers.language! }]);
    expect(languageCounts([s.feedback["fb-1"]!])).toEqual({ counted: 2, toCheck: 0 });
  });

  it("drops the last answer and its feedback on answer_reset", () => {
    const s = run([started, ...askQ("A1"), { type: "local/user_turn", turnId: 1, text: "first answer here ok" },
      { type: "feedback", feedback: record("fb-1", "A1") },
      { type: "answer_reset", question: "Why?", removed_feedback_ids: ["fb-1"] }]);
    expect(s.feedback["fb-1"]).toBeUndefined();
    expect(s.feedbackOrder).toEqual([]);
    expect(s.transcript.some((t) => t.speaker === "user")).toBe(false);
  });

  it("treats engine errors at start as fatal and turn errors as non-fatal", () => {
    const fatal = run([{ type: "error", code: "not_running", message: "Ollama is installed but not running." }]);
    expect(fatal.phase).toBe("failed");
    const soft = run([started, { type: "error", code: "engine_timeout", message: "Slow." }]);
    expect(soft.phase).toBe("live");
    expect(soft.error?.code).toBe("engine_timeout");
  });

  it("walks the end-of-session sequence", () => {
    const s = run([started, ...askQ("A1"),
      { type: "turn_complete", speaker: "model", full_text: "Thanks, that's all.", kind: "closing" },
      { type: "local/end_requested" }, { type: "saving" }, { type: "session_saved", session_id: "s-1" },
      { type: "debrief_pending", session_id: "s-1" },
      { type: "debrief", session_id: "s-1", debrief: { verdict: "Good.", weak_spots: [], strength: "", next_step: "", source: "template" } }]);
    expect(s.closing).toBe(true);
    expect(s.phase).toBe("done");
    expect(s.savedSessionId).toBe("s-1");
  });

  it("marks an unexpected close as failed unless the session was saved", () => {
    expect(run([started, { type: "local/socket_closed" }]).phase).toBe("failed");
    expect(run([started, { type: "saving" }, { type: "session_saved", session_id: "s-1" }, { type: "local/socket_closed" }]).phase).toBe("done");
  });

  it("derives the orb state; nothing but 'listening' while the user records", () => {
    let s = run([started, { type: "ready" }]);
    expect(selectOrb(s, { playing: false, muted: false })).toBe("your_turn");
    s = run([{ type: "local/voice_turn_started", turnId: 1 }], s);
    expect(selectOrb(s, { playing: true, muted: false })).toBe("listening");
    s = run([{ type: "local/voice_turn_sent" }], s);
    expect(selectOrb(s, { playing: false, muted: false })).toBe("thinking");
  });

  it("uses one thread per answer in English mode", () => {
    const s = run([{ ...started, mode: "english" } as ServerMessage,
      { type: "feedback", feedback: record("fb-1", "", { answer_kind: "turn" }) },
      { type: "feedback", feedback: record("fb-2", "", { answer_kind: "turn" }) }], initialState("text", "english"));
    expect(selectThreads(s).map((t) => t.number)).toEqual([1, 2]);
  });
  it("checks an answer again: the old feedback stays until the new one is there, then the words and the stronger answer follow", () => {
    let s = run([started, ...askQ("B1"), { type: "local/user_turn", turnId: 1, text: "Last year we has redesigned it." },
      { type: "feedback", feedback: record("fb-1", "B1", { answer: "Last year we has redesigned it." }) },
      { type: "stronger_version", feedback_id: "fb-1", rewrite: "old", placeholders: [] }]);
    s = run([{ type: "local/recheck_requested", feedbackIds: ["fb-1"] }], s);
    expect(s.rechecking).toEqual({ "fb-1": true });
    expect(s.feedback["fb-1"]!.answer).toBe("Last year we has redesigned it.");
    s = run([{ type: "feedback", feedback: record("fb-1", "B1", { answer: "Last year we redesigned it.", edited: true }) },
      { type: "answer_edited", feedback_id: "fb-1", turn_id: 1, text: "Last year we redesigned it." }], s);
    expect(s.rechecking).toEqual({});
    expect(s.feedback["fb-1"]).toMatchObject({ answer: "Last year we redesigned it.", edited: true });
    expect(s.transcript.find((t) => t.speaker === "user")!.text).toBe("Last year we redesigned it.");
    expect(s.stronger["fb-1"]).toBeUndefined();
  });

  it("keeps the old answer when the check fails and remembers the error until it is dismissed", () => {
    let s = run([started, ...askQ("B1"), { type: "feedback", feedback: record("fb-1", "B1") },
      { type: "local/recheck_requested", feedbackIds: ["fb-1"] },
      { type: "recheck_failed", feedback_id: "fb-1", code: "timeout", message: "The engine did not answer." }]);
    expect(s.rechecking).toEqual({});
    expect(s.recheckError).toEqual({ feedbackId: "fb-1", code: "timeout", message: "The engine did not answer." });
    expect(s.feedback["fb-1"]!.answer).toBe("answer text");
    s = run([{ type: "local/dismiss_recheck_error" }], s);
    expect(s.recheckError).toBeNull();
    // A new request clears an old error too.
    s = run([{ type: "recheck_failed", feedback_id: "fb-1", code: "busy", message: "x" }, { type: "local/recheck_requested", feedbackIds: ["fb-1"] }], s);
    expect(s.recheckError).toBeNull();
  });
});

describe("a voice turn that was no speech", () => {
  it("puts the screen back to what it was: Mike is still about to reply", () => {
    // The user's answer is in, Mike is thinking, a noise opens a voice turn and the server drops it.
    const thinking = run([started, { type: "local/user_turn", turnId: 1, text: "I worked on payments for two years." }]);
    expect(thinking.awaitingReply).toBe(true);
    const s = run([{ type: "local/voice_turn_started", turnId: 2 }, { type: "local/voice_turn_sent" },
      { type: "voice_turn_dropped", turn_id: 2 }], thinking);
    expect(s.recording).toBe(false);
    expect(s.awaitingReply).toBe(true);
    expect(s.transcript.filter((t) => t.speaker === "user")).toHaveLength(1);
  });

  it("does not leave the orb waiting for a reply Mike is not about to give", () => {
    const idle = run([started, ...askQ("A1")]);
    const s = run([{ type: "local/voice_turn_started", turnId: 1 }, { type: "local/voice_turn_sent" },
      { type: "voice_turn_dropped", turn_id: 1 }], idle);
    expect(s.awaitingReply).toBe(false);
  });

  it("gives each overlapping turn one verdict; the screen is restored only when none is open", () => {
    const idle = run([started, ...askQ("A1")]);
    let s = run([{ type: "local/voice_turn_started", turnId: 1 }, { type: "local/voice_turn_sent" },
      { type: "local/voice_turn_started", turnId: 2 }, { type: "local/voice_turn_sent" }], idle);
    expect(s.openVoiceTurns).toEqual([1, 2]);
    s = run([{ type: "voice_turn_dropped", turn_id: 1 }], s);
    expect(s.openVoiceTurns).toEqual([2]);
    expect(s.awaitingReply).toBe(true);                     // B is still being recognised
    s = run([{ type: "voice_turn_dropped", turn_id: 1 }], s);       // a second verdict for A: nothing
    expect(s.openVoiceTurns).toEqual([2]);
    expect(s.awaitingReply).toBe(true);
    s = run([{ type: "voice_turn_dropped", turn_id: 2 }], s);
    expect(s.openVoiceTurns).toEqual([]);
    expect(s.awaitingReply).toBe(false);                    // idle before the first clip, idle again
  });

  it("a stale verdict does not touch a turn that is being recorded", () => {
    const idle = run([started, ...askQ("A1")]);
    const s = run([{ type: "local/voice_turn_started", turnId: 1 }, { type: "local/voice_turn_sent" },
      { type: "local/voice_turn_started", turnId: 2 }, { type: "voice_turn_dropped", turn_id: 1 }], idle);
    expect(s.recording).toBe(true);
    expect(s.recordingTurnId).toBe(2);
    expect(s.openVoiceTurns).toEqual([2]);
  });

  it("speech settles its own turn only; interrupted without an id settles all; a reconnect forgets them", () => {
    let s = run([started, { type: "local/voice_turn_started", turnId: 1 }, { type: "local/voice_turn_started", turnId: 2 },
      { type: "interrupted", turn_id: 1 }]);
    expect(s.openVoiceTurns).toEqual([2]);
    s = run([{ type: "interrupted" }], s);
    expect(s.openVoiceTurns).toEqual([]);
    s = run([{ type: "local/voice_turn_started", turnId: 3 }, { type: "local/socket_closed" }], s);
    expect(s.openVoiceTurns).toEqual([]);
  });

  it("an empty browser recognition keeps the id until the server's verdict; redo voids all", () => {
    let s = run([started, { type: "local/voice_turn_started", turnId: 1 }, { type: "local/voice_turn_dropped", turnId: 1 }]);
    expect(s.recording).toBe(false);
    expect(s.openVoiceTurns).toEqual([1]);
    s = run([{ type: "voice_turn_dropped", turn_id: 1 }], s);
    expect(s.openVoiceTurns).toEqual([]);
    s = run([{ type: "local/voice_turn_started", turnId: 2 }, { type: "local/voice_turn_dropped" }], s);
    expect(s.openVoiceTurns).toEqual([]);
  });
});
