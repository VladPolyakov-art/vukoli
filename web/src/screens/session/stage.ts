/* Session stage state (session.md O5 + V2.1, D49): one state text (StatusPill) and Mike's Presence, from the phase.
 * Pure, so the mapping is unit-tested (stage.test.ts).
 * Presence (D49): a glow only while someone talks or Mike thinks. Mike speaking → speaking; the user's answer being
 * recorded → listening; Mike preparing a reply → thinking; your turn before the first word → waiting, a faint inviting
 * glow (D50). Everything else is idle (no glow): muted, paused, connecting, between questions. */
import type { PresenceState, StatusPillState } from "../../ds";
import { t } from "../../i18n";
import type { SessionViewProps } from "./types";

export interface Stage {
  presence: PresenceState; pill: StatusPillState; label: string; sub?: string; live: boolean;
  /** D91: the sub is a hint ("Take your time…"), folded away once read; a state's sub (muted, paused) stays. */
  hint?: boolean;
}

/** How long a hint stays under the state text (D91). */
export const HINT_MS = 6000;

/** One state text (O5) and Mike's presence, from the phase. */
export function stageFor(p: SessionViewProps): Stage {
  const { phase, input, muted, variant, data } = p;
  const voice = input === "voice";
  // English has no "Next question": after the feedback the conversation goes on, so it is the user's turn again.
  const effective = variant === "english" && (phase === "feedback" || phase === "between" || phase === "preparing") ? "your-turn" : phase;
  const sec = data.pauseSec;
  switch (effective) {
    case "connecting":
      return { presence: "idle", pill: "connecting", label: t("session.status.connecting"), sub: t("session.sub.connecting"), live: false };
    case "mike-speaking":
      return { presence: "speaking", pill: "speaking", label: t("session.status.speaking"), sub: voice ? t("session.sub.speaking") : undefined, live: false, hint: true };
    case "thinking":
      return { presence: "thinking", pill: "thinking", label: t("session.status.thinking"), live: false };
    case "listening":
      return muted
        ? { presence: "idle", pill: "muted", label: t("session.status.muted"), sub: t("session.sub.muted"), live: false }
        : { presence: "listening", pill: "listening", label: t("session.status.listening"), sub: sec > 0 ? t("session.sub.listening", { sec }) : t("session.sub.listeningManual"), live: true, hint: sec > 0 };
    case "your-turn":
      if (!voice) return { presence: "waiting", pill: "your-turn", label: t("session.status.yourTurn"), sub: t("session.sub.yourTurnText"), live: false };
      return muted
        ? { presence: "idle", pill: "muted", label: t("session.status.muted"), sub: t("session.sub.muted"), live: false }
        : { presence: "waiting", pill: "your-turn", label: t("session.status.yourTurn"), sub: t("session.sub.yourTurn"), live: true, hint: true };
    case "preparing":
    case "rechecking":
      return { presence: "idle", pill: "between", label: t("session.status.preparingFeedback"), live: false };
    case "unavailable":
      return { presence: "idle", pill: "between", label: t("session.status.saved"), sub: betweenLine(p), live: false };
    case "interrupted":
      return { presence: "idle", pill: "paused", label: t("session.status.paused"), sub: t("session.sub.paused"), live: false };
    case "saving":
      return { presence: "idle", pill: "between", label: t("session.saving"), live: false };
    default: // between · feedback · editing
      return { presence: "idle", pill: "between", label: t("session.status.between"), sub: betweenLine(p), live: false };
  }
}

function betweenLine(p: SessionViewProps): string | undefined {
  if (p.variant === "english") return undefined;
  return p.data.nextNumber ? t("session.sub.between", { n: p.data.nextNumber }) : t("session.sub.betweenLast");
}
