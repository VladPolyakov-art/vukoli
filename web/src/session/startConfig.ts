/* Builds the `start` message (PROTOCOL.md) from the Home choices and per-browser preferences. */
import { browserSttSupported } from "../audio/browserStt";
import { prefs } from "../lib/prefs";
import type { Level, Settings, StartMessage, SttInfo } from "../lib/types";
import type { SessionConfig } from "./useSession";

export interface StartChoices {
  mode: "interview" | "english";
  answer: "voice" | "text";
  roundType?: "hr" | "behavioural" | "mix";
  strictness?: number;
  questions?: number;
  level?: Level;
  vacancyId?: string;
  topic?: string;
  drill?: boolean;
}

export function buildSessionConfig(choices: StartChoices, settings: Settings | null, stt: SttInfo | null): SessionConfig {
  let input: StartMessage["input"] = "text";
  let browserStt = false;
  if (choices.answer === "voice") {
    const wantBrowser = prefs.stt() === "browser";
    const serverOk = stt?.available !== false;
    if ((wantBrowser || !serverOk) && browserSttSupported()) {
      input = "browser_stt";
      browserStt = true;
    } else if (serverOk) {
      input = "voice";
    }
  }
  const start: StartMessage = {
    type: "start",
    mode: choices.mode,
    input,
    speak: input === "text" ? false : prefs.speak(),
    suggest: false,
  };
  if (choices.mode === "interview") {
    start.round_type = choices.roundType ?? "mix";
    start.strictness = choices.strictness ?? settings?.strictness ?? 2;
    start.questions = choices.questions ?? settings?.questions_per_session ?? 5;
    if (choices.vacancyId) start.vacancy_id = choices.vacancyId;
    if (choices.drill) start.drill = true;
  } else {
    start.level = choices.level ?? settings?.level ?? "B1";
    if (choices.topic) start.topic = choices.topic;
  }
  if (settings?.voice) start.voice = settings.voice;
  return { start, browserStt, pauseSec: prefs.pause() };
}
