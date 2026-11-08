/* Tough talk hint (ds/screens/tough-talk.md §4.1): when the Hint button works, and the reason when it does not.
 * Disabled, not hidden (session.md §V2.1): the reason is the tooltip. The H key follows the same gate. */
import { t } from "../../i18n";
import type { SessionData, SessionPhase } from "./types";

export interface HintGate { enabled: boolean; reason?: string }

export function hintGate(p: { phase: SessionPhase; interrupted: boolean; data: Pick<SessionData, "hint" | "closing"> }): HintGate {
  const { phase, interrupted, data } = p;
  if (!data.hint) return { enabled: false };
  if (data.closing) return { enabled: false, reason: t("session.hint.off.closing") };
  if (interrupted || phase === "saving") return { enabled: false, reason: t("session.hint.off.closing") };
  if (phase === "connecting" || !data.hint.available) return { enabled: false, reason: t("session.hint.off.connecting") };
  if (phase === "listening") return { enabled: false, reason: t("session.hint.off.listening") };
  if (phase === "thinking") return { enabled: false, reason: t("session.hint.off.thinking") };
  return { enabled: true };
}
