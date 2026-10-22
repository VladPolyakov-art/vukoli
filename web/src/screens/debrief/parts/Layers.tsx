/* Layer blocks inside an expanded question card (debrief.md §3.5): Content, Language, Delivery, each on its tint
 * (--color-layer-*-tint, only here and on the weak-spot cards). The layer is named in text + icon, never colour only.
 * DS candidate: the Feedback pattern in "debrief mode" (tinted block, rows on --color-raised, Dismiss, turn prefix). */
import type { ReactNode } from "react";
import { Icon } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { ContentBlock, DeliveryBlock, LanguageBlock, Layer, RemovedLine } from "../types";
import { CorrectionRow } from "./Correction";
import s from "./layers.module.css";

export function LayerBlock({ layer, children }: { layer: Layer; children: ReactNode }) {
  return (
    <section className={s.block} data-review-id={`Debrief/Layer/${layer}`}>
      <h4 className={s.blockTitle}>
        <Icon name={layer} size="sm" />
        {t(`feedback.layer.${layer}`)}
      </h4>
      {children}
    </section>
  );
}

export function ContentLayer({ block }: { block: ContentBlock }) {
  return (
    <LayerBlock layer="content">
      {block.items.length ? (
        <ul className={s.items}>
          {block.items.map((it, i) => (
            <li key={i}>{it.lead ? <><strong className={s.lead}>{it.lead}</strong> </> : null}{it.text}</li>
          ))}
        </ul>
      ) : (
        <p className={s.ok}>{t("feedback.content.nothing")}</p>
      )}
    </LayerBlock>
  );
}

function removedText(r: RemovedLine): string {
  if (r.kind === "misheard") return t("debrief.lang.removedMisheard", { text: r.text });
  if (r.kind === "name") return t("debrief.lang.removedName", { text: r.text });
  return tp("debrief.lang.removedUnsure", r.n);
}

export function RemovedLines({ lines }: { lines: RemovedLine[] }) {
  return (
    <>
      {lines.map((r, i) => (
        <p key={i} className={s.removed}>
          <Icon name="info" size="sm" />
          <span>{removedText(r)}</span>
        </p>
      ))}
    </>
  );
}

/** What a correction row needs from the card: its local state and handlers (all optional: a static state passes none). */
export interface RowContext {
  isDismissed: (id: string, base?: boolean) => boolean;
  isLeaving: (id: string) => boolean;
  editing: string | null;
  /** The text to reopen the editor with after a failed check. */
  draft?: string;
  focusEditor: boolean;
  onEdit?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onRestore?: (id: string) => void;
  onSave?: (id: string, text: string) => void;
  onCancel?: () => void;
}

export function LanguageLayer({ block, ctx }: { block: LanguageBlock; ctx: RowContext }) {
  const empty = !block.corrections.length && !block.removed.length;
  return (
    <LayerBlock layer="language">
      {block.note && block.corrections.length ? (
        <p className={s.note}><Icon name="info" size="sm" /><span>{t("debrief.lang.note")}</span></p>
      ) : null}
      {block.corrections.map((c) => (
        <CorrectionRow
          key={c.id}
          c={c}
          dismissed={ctx.isDismissed(c.id, c.dismissed)}
          leaving={ctx.isLeaving(c.id)}
          editing={ctx.editing === c.id}
          draft={ctx.editing === c.id ? ctx.draft : undefined}
          focusEditor={ctx.focusEditor}
          onEdit={ctx.onEdit ? () => ctx.onEdit?.(c.id) : undefined}
          onDismiss={ctx.onDismiss ? () => ctx.onDismiss?.(c.id) : undefined}
          onRestore={ctx.onRestore ? () => ctx.onRestore?.(c.id) : undefined}
          onSave={(text) => ctx.onSave?.(c.id, text)}
          onCancel={ctx.onCancel}
        />
      ))}
      <RemovedLines lines={block.removed} />
      {empty ? <p className={s.ok}>{t("debrief.lang.nothing")}</p> : null}
    </LayerBlock>
  );
}

export function DeliveryLayer({ block }: { block: DeliveryBlock }) {
  const verdict = block.pace ? t(`feedback.delivery.${block.pace.verdict}`) : "";
  const words = block.words !== undefined ? tp("common.words", block.words) : "";
  return (
    <LayerBlock layer="delivery">
      <dl className={s.metrics}>
        {block.fillers !== undefined ? <div><dt>{t("debrief.delivery.fillers")}</dt><dd>{block.fillers}</dd></div> : null}
        {block.length ? <div><dt>{t("debrief.delivery.length")}</dt><dd>{t("debrief.delivery.lengthValue", { time: block.length, words })}</dd></div> : null}
        {block.textMode && words ? <div><dt>{t("debrief.delivery.length")}</dt><dd>{words}</dd></div> : null}
        {block.pace ? <div><dt>{t("debrief.delivery.pace")}</dt><dd>{t("debrief.delivery.paceValue", { wpm: block.pace.wpm, verdict })}</dd></div> : null}
      </dl>
      {block.textMode ? <p className={s.note}><Icon name="info" size="sm" /><span>{t("feedback.delivery.textMode")}</span></p> : null}
      {block.mostFillers ? <p className={s.tip}>{t("debrief.delivery.tip", { list: block.mostFillers })}</p> : null}
      {block.engineNote ? <p className={s.note}><Icon name="info" size="sm" /><span>{t("debrief.delivery.engineNote")}</span></p> : null}
    </LayerBlock>
  );
}
