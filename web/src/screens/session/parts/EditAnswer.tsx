/* Edit what I said (US-18 AC3): the panel body is replaced by two text fields; only this answer is checked again.
 * "Save and check again" is the one primary here, so the footer's Next question drops to secondary. */
import { useState } from "react";
import { Button, Callout, Textarea } from "../../../ds";
import { t } from "../../../i18n";
import type { SessionHandlers, SessionInput } from "../types";
import s from "./parts.module.css";

export function EditAnswer({ number, input, answer, followUp, error, withChecks, handlers }: {
  number: number; input: SessionInput; answer: string; followUp?: string; error?: string; withChecks: boolean; handlers?: SessionHandlers;
}) {
  const [a, setA] = useState(answer);
  const [f, setF] = useState(followUp ?? "");
  return (
    <div className={s.edit}>
      <div className={s.editHead}>
        <h3 className={s.editTitle} tabIndex={-1}>{t(input === "voice" ? "session.edit.title" : "session.edit.titleTyped", { n: number })}</h3>
        <p className={s.editHint}>{t(input === "voice" ? "session.edit.hint" : "session.edit.hintTyped")}</p>
      </div>
      {error ? <Callout tone="error" live="alert" title={t("session.edit.failedTitle")}>{error}</Callout> : null}
      <Textarea label={t("session.edit.answer")} value={a} rows={7} onChange={(e) => setA(e.target.value)} />
      {followUp !== undefined ? <Textarea label={t("session.edit.followUp")} value={f} rows={3} onChange={(e) => setF(e.target.value)} /> : null}
      {withChecks && input === "voice" ? <p className={s.editHint}>{t("session.edit.underlined")}</p> : null}
      <div className={s.editActions}>
        <Button variant="primary" data-track="recheck" onClick={() => handlers?.onSaveEdit?.(a, f)}>{t("session.edit.save")}</Button>
        <Button variant="ghost" data-track="edit-cancel" onClick={handlers?.onCancelEdit}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
