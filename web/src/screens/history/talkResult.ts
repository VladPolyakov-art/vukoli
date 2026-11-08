/* History result line of the tough-talk modes (tough-talk.md §7), from the server's structured `talk_result`.
 * null = nothing to show in numbers (caller falls back to the verdict text or the answer count). */
import { t } from "../../i18n";
import type { TalkResult } from "../../lib/types";

const fmt = (n: number) => n.toLocaleString("en-US");

export function talkResult(r: TalkResult | null | undefined): string | null {
  if (!r) return null;
  if (r.kind === "tough") {
    return r.calm == null || r.total == null ? null : t("history.result.calm", { n: r.calm, total: r.total });
  }
  const sc = r.scenario ?? "offer";
  if (sc === "screening") {
    if (r.first_number == null || !r.currency) return t("history.result.noNumber");
    const band = r.vs_band ? t(`history.result.band.${r.vs_band}`) : null;
    return band
      ? t("history.result.firstNumber", { amount: fmt(r.first_number), currency: r.currency, band })
      : `${fmt(r.first_number)} ${r.currency}`;
  }
  if (sc !== "offer" && (r.no_offer || r.final_offer == null)) return t("history.result.noChange");
  if (r.no_offer || r.final_offer == null) return t("history.result.noOffer");
  if (r.step_up) {
    return t("history.result.stepUp", { now: fmt(r.final_offer), later: fmt(r.step_up.later), months: r.step_up.after_months });
  }
  if (r.gain_now == null || r.currency == null || r.captured_now_pct == null) return null;
  return t("history.result.moved", { amount: fmt(r.gain_now), currency: r.currency, pct: Math.round(r.captured_now_pct) });
}
