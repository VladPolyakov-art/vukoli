/* Where the setup wizard is, kept in localStorage (prefs.setupStep) so any window opened later resumes there: the app
 * installed from the wizard opens in a NEW window, a reload or a closed-and-reopened window must not send the user back
 * to the start. It holds the current step and the answers that otherwise live only in React state (the engine picked,
 * the name typed, the job's title, voice or keyboard). Cleared when setup completes (prefs.setSetupDone(true)) and when
 * Settings → About runs the setup again. "install" is never stored: a reload there re-asks the browser. */
import { prefs } from "../../lib/prefs";
import type { EngineId } from "../../lib/types";
import type { SetupStep } from "./types";

export interface SetupProgress {
  step: Exclude<SetupStep, "install">;
  /** The run started with the Install step (the stepper keeps showing four steps, Install done). */
  withInstall: boolean;
  pick?: EngineId;
  name?: string;
  job?: string;
  answer?: "voice" | "text";
}

const STEPS: readonly string[] = ["engine", "check", "about"];
const ANSWERS: readonly string[] = ["voice", "text"];

/** Parses what is stored; anything unexpected is treated as "no progress" (never throws). */
export function parseProgress(raw: string | null): SetupProgress | null {
  if (!raw) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  if (typeof d.step !== "string" || !STEPS.includes(d.step)) return null;
  const out: SetupProgress = { step: d.step as SetupProgress["step"], withInstall: d.withInstall === true };
  if (typeof d.pick === "string") out.pick = d.pick as EngineId;
  if (typeof d.name === "string") out.name = d.name;
  if (typeof d.job === "string") out.job = d.job;
  if (typeof d.answer === "string" && ANSWERS.includes(d.answer)) out.answer = d.answer as "voice" | "text";
  return out;
}

export function readProgress(): SetupProgress | null {
  return parseProgress(prefs.setupStep());
}

/** The wizard entered a step: keep the answers already stored, change the step. */
export function saveStep(step: SetupProgress["step"], withInstall: boolean) {
  prefs.setSetupStep(JSON.stringify({ ...readProgress(), step, withInstall }));
}

/** An answer changed. A no-op when the wizard has not stored a step (stories, review frames: nothing leaks into them). */
export function saveAnswer(patch: Partial<Omit<SetupProgress, "step" | "withInstall">>) {
  const current = readProgress();
  if (!current) return;
  prefs.setSetupStep(JSON.stringify({ ...current, ...patch }));
}

export function clearProgress() {
  prefs.setSetupStep(null);
}
