/* Variant `english` (debrief.md §3.6, US-24 AC4): Summary → Corrections (language tint, in the order they happened) →
 * Phrases to review. No verdict and no content / delivery layers (US-24 AC3). */
import { useState } from "react";
import { Badge, Button } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { EnglishModel } from "../types";
import { CorrectionRow } from "./Correction";
import { RemovedLines, type RowContext } from "./Layers";
import { Frame } from "./Frame";
import s from "./english.module.css";

export function EnglishBody({ english, ctx, ids }: { english: EnglishModel; ctx: RowContext; ids: { summary: string; corrections: string; phrases: string } }) {
  const [all, setAll] = useState(false);
  const total = english.corrections.length;
  const shown = all ? english.corrections : english.corrections.slice(0, english.visible);
  const hidden = total - english.visible;
  // QA-14: the "Heard as" explanation only when some row says "Heard as" (a typed talk says "You typed").
  const heardAs = english.corrections.some((c) => !c.typed);
  const phrases = english.phrases.length > 0;
  return (
    <div className={s.grid}>
      <Frame id={ids.summary} title={t("debrief.english.summary")} data-review-id="Debrief/EnglishSummary" data-review-section="Debrief · Summary" data-comment-target="">
        <p className={s.summary}>
          {tp("debrief.english.count", total)}
          {english.repeated ? <> {tp("debrief.english.repeated", english.repeated)}</> : null}
        </p>
        {/* F-13-7: nothing to list, so no Corrections frame: one plain line in the summary. */}
        {total === 0 ? <p className={s.empty}>{t("debrief.english.noCorrections")}</p> : null}
      </Frame>

      <div className={`${s.cols} ${phrases && total > 0 ? s.two : ""}`}>
        {total === 0 ? null : (
          <Frame id={ids.corrections} title={t("debrief.english.corrections")} hint={t(heardAs ? "debrief.english.correctionsSubHeard" : "debrief.english.correctionsSub")} data-review-id="Debrief/EnglishCorrections" data-review-section="Debrief · Corrections" data-comment-target="">
            <div className={s.block}>
              {shown.map((c, i) => (
                <div key={c.id} className={i >= english.visible ? "motion-rise-base" : undefined}>
                  <CorrectionRow
                    c={c}
                    dismissed={ctx.isDismissed(c.id, c.dismissed)}
                    leaving={ctx.isLeaving(c.id)}
                    editing={ctx.editing === c.id}
                    focusEditor={ctx.focusEditor}
                    onEdit={ctx.onEdit ? () => ctx.onEdit?.(c.id) : undefined}
                    onDismiss={ctx.onDismiss ? () => ctx.onDismiss?.(c.id) : undefined}
                    onRestore={ctx.onRestore ? () => ctx.onRestore?.(c.id) : undefined}
                    onSave={(text) => ctx.onSave?.(c.id, text)}
                    onCancel={ctx.onCancel}
                  />
                </div>
              ))}
              {hidden > 0 ? (
                <div>
                  <Button variant="link" size="sm" data-track="debrief-corrections-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                    {all ? t("debrief.english.showFewer") : t("debrief.english.showMore", { n: hidden })}
                  </Button>
                </div>
              ) : null}
              <RemovedLines lines={english.removed} />
            </div>
          </Frame>
        )}

        {phrases ? (
          <Frame id={ids.phrases} title={t("debrief.english.phrases")} data-review-id="Debrief/EnglishPhrases" data-review-section="Debrief · Phrases to review" data-comment-target="">
            <ul className={s.phrases}>
              {english.phrases.map((p) => (
                <li key={p.from} className={s.phrase}>
                  <span className={s.pair}>
                    <span>{p.from}</span>
                    <span aria-hidden="true" className={s.arrow}>→</span>
                    <span className="visually-hidden">{t("debrief.english.becomes")}</span>
                    <strong>{p.to}</strong>
                  </span>
                  <Badge>{t("debrief.english.times", { n: p.times })}</Badge>
                </li>
              ))}
            </ul>
          </Frame>
        ) : null}
      </div>
    </div>
  );
}
