/* Setup (D81): three steps — AI engine → Check → About you. D104: a first step "Install" in front of them when the
 * browser can install Vukoli as an app. `setupSteps()` is the list a run shows (4 or 3 steps). */
export const SETUP_STEPS = ["install", "engine", "check", "about"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** The steps one run of the wizard shows: "install" only when the browser offered the install at the start. */
export function setupSteps(withInstall: boolean): readonly SetupStep[] {
  return withInstall ? SETUP_STEPS : SETUP_STEPS.filter((x) => x !== "install");
}

export type CheckErrorCode = "mic_denied" | "mic_missing" | "no_stt" | "not_heard" | "engine" | "failed";

/** The voice check, one phrase: idle → listening → thinking (recognising, then Mike answering) → done | error. */
export type CheckState =
  | { phase: "idle" }
  | { phase: "listening" }
  | { phase: "thinking"; heard?: string }
  | { phase: "done"; heard: string; reply: string; audio: string | null }
  | { phase: "error"; code: CheckErrorCode; message?: string; heard?: string };
