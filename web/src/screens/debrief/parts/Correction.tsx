/* One correction row (debrief.md §3.5): Heard as / Say / Why on the raised surface, with "Not what you said?" and
 * Dismiss. DS candidate: this and the Feedback item are the same row in two contexts. The fixed fragment is marked
 * inside the user's own sentence (InlineMark); never red / green / struck through (P8). */
import { useState } from "react";
import { Button, Textarea } from "../../../ds";
import { t } from "../../../i18n";
import type { Correction } from "../types";
import { Marked, plain } from "./Marked";
import s from "./layers.module.css";

export interface CorrectionRowProps {
  c: Correction;
  /** Dismissed ("Not counted"): the row is replaced by one line with Undo. */
  dismissed?: boolean;
  /** Row-out motion before the row is replaced. */
  leaving?: boolean;
  /** The inline editor replaces the row. */
  editing?: boolean;
  /** Reopen the editor with this text (after a failed check) instead of what was heard. */
  draft?: string;
  onEdit?: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
  onSave?: (text: string) => void;
  onCancel?: () => void;
  /** Focus the editor when it opens (false for a state that starts open: review, stories). */
  focusEditor?: boolean;
}

export function CorrectionRow({ c, dismissed, leaving, editing, draft, onEdit, onDismiss, onRestore, onSave, onCancel, focusEditor = true }: CorrectionRowProps) {
  if (dismissed) {
    return (
      <p className={`${s.removed} motion-fade`} data-review-id="Debrief/CorrectionRow/dismissed">
        <span>{t("debrief.lang.dismissed")}</span>
        {onRestore ? <Button variant="link" size="sm" data-track="correction-undo" onClick={onRestore}>{t("common.undo")}</Button> : null}
      </p>
    );
  }
  if (editing) return <Editor start={draft ?? plain(c.heard)} label={t("debrief.lang.editorLabel")} focus={focusEditor} onSave={onSave} onCancel={onCancel} />;
  return (
    <div className={`${s.row} ${leaving ? "motion-row-out" : ""}`} data-review-id="Debrief/CorrectionRow">
      {c.turn ? <p className={s.turn}>{c.turn.at ? t("debrief.english.turnAt", { n: c.turn.n, time: c.turn.at }) : t("debrief.english.turn", { n: c.turn.n })}</p> : null}
      <dl className={s.dl}>
        <dt>{c.typed ? t("feedback.language.youTyped") : t("feedback.language.heardAs")}</dt>
        <dd><Marked parts={c.heard} quoted /></dd>
        <dt>{t("feedback.language.say")}</dt>
        <dd><Marked parts={c.say} quoted /></dd>
        <dt>{t("feedback.language.why")}</dt>
        <dd>{c.why}</dd>
      </dl>
      {onEdit || onDismiss ? (
        <div className={s.rowActions}>
          {onEdit ? <Button variant="ghost" size="sm" data-track="not-what-i-said" onClick={onEdit}>{t("debrief.lang.notWhatISaid")}</Button> : null}
          {onDismiss ? <Button variant="ghost" size="sm" icon="x" data-track="correction-dismiss" onClick={onDismiss}>{t("debrief.lang.dismiss")}</Button> : null}
        </div>
      ) : null}
    </div>
  );
}

/** "Not what you said?" / "Edit what I said": a textarea in place, saved with "Save and check again". */
export function Editor({ start, label, focus = true, onSave, onCancel }: { start: string; label: string; focus?: boolean; onSave?: (text: string) => void; onCancel?: () => void }) {
  const [text, setText] = useState(start);
  return (
    <div className={`${s.editor} motion-rise-base`} data-review-id="Debrief/Editor">
      <Textarea
        label={label}
        hint={t("debrief.lang.editorHint")}
        value={text}
        rows={3}
        autoFocus={focus}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={s.rowActions}>
        <Button variant="secondary" size="sm" data-track="recheck" disabled={!text.trim()} onClick={() => onSave?.(text.trim())}>{t("debrief.lang.saveCheck")}</Button>
        <Button variant="ghost" size="sm" data-track="correction-cancel" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
