/* Builds the `start` message (PROTOCOL.md) from the Home choices and per-browser preferences. */
import { browserSttSupported } from "../audio/browserStt";
import { prefs } from "../lib/prefs";
import type { FocusSpot, Level, MoneyTalkStart, NegotiateStart, Settings, StartMessage, SttInfo, ToughTheme } from "../lib/types";
import type { SessionConfig } from "./useSession";

export interface StartChoices {
  /** `quick` (D111): the call opens with Mike's "interview or English?"; the plan and the job are the server's. */
  mode: "interview" | "english" | "quick" | "tough" | "negotiate";
  answer: "voice" | "text";
  roundType?: "hr" | "behavioural" | "mix";
  strictness?: number;
  questions?: number;
  level?: Level;
  vacancyId?: string;
  topic?: string;
  drill?: boolean;
  /** The weak spots a drill works on (the plan's focus, after Change focus). */
  focus?: FocusSpot[];
  /** `negotiate`: the numbers card (the server checks `role`, `target`, the range and the currency). */
  negotiate?: NegotiateStart;
  /** `interview`: end with a salary talk (protocol.md §7.5). The style follows the strictness. */
  moneyTalk?: MoneyTalkStart;
  /** `tough`: the theme (default `mix`). `strictness` as in an interview (3 adds "That sounds rehearsed"). */
  toughTheme?: ToughTheme;
}

/** The server reads at most this many focus spots. */
const MAX_FOCUS = 6;

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
  if (choices.mode === "interview" || choices.mode === "quick") {
    start.round_type = choices.roundType ?? "mix";
    start.strictness = choices.strictness ?? settings?.strictness ?? 2;
    start.questions = choices.questions ?? settings?.questions_per_session ?? 5;
    if (choices.vacancyId) start.vacancy_id = choices.vacancyId;
    if (choices.moneyTalk && choices.mode === "interview" && !choices.drill) {
      start.money_talk = true;
      start.negotiate = choices.moneyTalk;
    }
    if (choices.drill) {
      start.drill = true;
      if (choices.focus?.length) start.focus = choices.focus.slice(0, MAX_FOCUS);
    }
  } else if (choices.mode === "negotiate") {
    // Tough talk (protocol.md §1): no round, questions, level or topic; the numbers travel in `negotiate`.
    if (choices.negotiate) start.negotiate = choices.negotiate;
    if (choices.vacancyId) start.vacancy_id = choices.vacancyId;
  } else if (choices.mode === "tough") {
    start.tough = { theme: choices.toughTheme ?? "mix" };
    start.strictness = choices.strictness ?? settings?.strictness ?? 2;
  } else {
    start.level = choices.level ?? settings?.level ?? "B1";
    if (choices.topic) start.topic = choices.topic;
  }
  if (settings?.voice) start.voice = settings.voice;
  return { start, browserStt, pauseSec: prefs.pause() };
}
