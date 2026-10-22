/* Setup (D81): three steps — AI engine → Check → About you. */
export const SETUP_STEPS = ["engine", "check", "about"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export type CheckErrorCode = "mic_denied" | "mic_missing" | "no_stt" | "not_heard" | "engine" | "failed";

/** The voice check, one phrase: idle → listening → thinking (recognising, then Mike answering) → done | error. */
export type CheckState =
  | { phase: "idle" }
  | { phase: "listening" }
  | { phase: "thinking"; heard?: string }
  | { phase: "done"; heard: string; reply: string; audio: string | null }
  | { phase: "error"; code: CheckErrorCode; message?: string; heard?: string };
