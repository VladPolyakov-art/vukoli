/* D94 / US-13 AC5: the reducer's interrupted state (an engine that stopped, a socket that dropped) and the way back. */
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../lib/types";
import { initialState, sessionReducer, type SessionAction, type SessionState } from "./reducer";

const run = (actions: SessionAction[], start: SessionState = initialState("text")) => actions.reduce(sessionReducer, start);

const started: ServerMessage = {
  type: "session_started", session_id: "s-1", mode: "interview", engine: "ollama", model: "qwen3:8b", speaks: false,
  questions: [{ id: "A1", competency: "A", text: "Why Kestrel Pay?" }],
  audio: { sample_rate_out: 24000, sample_rate_in: 16000 }, stt: { available: true, backend: "mlx" },
  suggester_available: false, suggest: false, warnings: [],
};
const answered: SessionAction[] = [started, { type: "ready" }, { type: "turn_complete", speaker: "user", full_text: "I like payments.", turn_id: 1 }];
const engineDown: SessionAction = { type: "error", code: "not_running", message: "Ollama is not running." };

describe("interrupted session", () => {
  it("an engine error after an answer pauses the session instead of failing it", () => {
    const s = run([...answered, engineDown]);
    expect(s.phase).toBe("live");
    expect(s.fatal).toBeNull();
    expect(s.interrupted).toMatchObject({ kind: "engine", code: "not_running", ended: false });
  });

  it("an engine error before any answer is still a plain failure", () => {
    const s = run([started, { type: "ready" }, engineDown]);
    expect(s.phase).toBe("failed");
    expect(s.interrupted).toBeNull();
  });

  it("a dropped socket with an answer on record is an interruption of the voice kind", () => {
    const s = run([...answered, { type: "local/socket_closed" }]);
    expect(s.phase).toBe("live");
    expect(s.interrupted).toMatchObject({ kind: "voice", code: "connection_lost", ended: true });
  });

  it("resuming with the socket still open clears the interruption in place", () => {
    const s = run([...answered, engineDown, { type: "local/resumed_in_place" }]);
    expect(s.interrupted).toBeNull();
    expect(s.transcript.filter((x) => x.speaker === "user")).toHaveLength(1);
  });

  it("a new socket keeps the transcript; session_started clears the interruption", () => {
    const s = run([...answered, { type: "local/socket_closed" }, { type: "local/resume_requested", input: "text" }]);
    expect(s.phase).toBe("connecting");
    expect(s.interrupted?.resuming).toBe(true);
    const back = sessionReducer(s, started);
    expect(back.phase).toBe("live");
    expect(back.interrupted).toBeNull();
    expect(back.transcript.filter((x) => x.speaker === "user")).toHaveLength(1);
  });

  it("a failed try to continue goes back to the card with the server's reason", () => {
    const s = run([...answered, { type: "local/socket_closed" }, { type: "local/resume_requested", input: "voice" },
      { type: "error", code: "resume_unavailable", message: "This engine cannot continue a session." }]);
    expect(s.phase).toBe("live");
    expect(s.interrupted).toMatchObject({ resuming: false, ended: true, failed: "This engine cannot continue a session." });
  });

  it("a socket that closes while resuming is a plain failed try", () => {
    const s = run([...answered, { type: "local/socket_closed" }, { type: "local/resume_requested", input: "voice" }, { type: "local/socket_closed" }]);
    expect(s.interrupted).toMatchObject({ resuming: false, failed: "" });
  });

  it("ending from the card leaves the interruption and moves to ending", () => {
    const s = run([...answered, engineDown, { type: "local/end_requested" }]);
    expect(s.interrupted).toBeNull();
    expect(s.phase).toBe("ending");
  });

  it("a save error settles on done so the screen can offer the transcript", () => {
    const s = run([...answered, { type: "local/end_requested" }, { type: "save_error", code: "save_failed", message: "Read-only folder." }]);
    expect(s.phase).toBe("done");
    expect(s.saveError).toBe("Read-only folder.");
  });
});
