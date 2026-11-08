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
  if (r.no_offer || r.final_offer == null) return t("history.result.noOffer");
  if (r.step_up) {
    return t("history.result.stepUp", { now: fmt(r.final_offer), later: fmt(r.step_up.later), months: r.step_up.after_months });
  }
  if (r.gain_now == null || r.currency == null || r.captured_now_pct == null) return null;
  return t("history.result.moved", { amount: fmt(r.gain_now), currency: r.currency, pct: Math.round(r.captured_now_pct) });
}
