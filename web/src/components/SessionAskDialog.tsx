/* "How did it go?" (US-60 AC2, AC3; pattern, components.md §2). Shown over Home right after the user presses End on the
 * 1st finished session and then on the 6th, 11th… (lib/feedback.isAskTurn), before the debrief opens (the debrief keeps
 * preparing in Recents either way). A rating of 5 steps in one click, an optional "What should we improve?", Send and
 * Not now, and "Don't ask again" (turns Settings → Privacy and data → "Ask how a session went" off). The rating alone
 * can be sent. Any other way out (Esc, Not now, Continue) carries on to the debrief. Only the rating and the note are
 * sent: nothing about the session. States: idle · sending · sent · error (the answer stays; Try again).
 * `SessionAskDialogView` is pure (stories, review); `SessionAskDialog` is the live one. */
import { useEffect, useState } from "react";
import { Button, Callout, Chip, ChipGroup, Dialog, Icon, Textarea } from "../ds";
import { t, tMaybe } from "../i18n";
import { api, ApiError } from "../lib/api";
import { drafts } from "../lib/drafts";
import { canSendRating, ratingBody } from "../lib/feedback";
import { useApp } from "../lib/store";
import type { SupportStatus } from "./SupportDialog";
import s from "./SessionAskDialog.module.css";

const STEPS = [1, 2, 3, 4, 5] as const;

export interface SessionAskDialogViewProps {
  open: boolean;
  rating: number | null;
  note: string;
  onRating: (n: number) => void;
  onNote: (text: string) => void;
  status: SupportStatus;
  errorCode?: string;
  onSend: () => void;
  /** Not now, Esc, or Continue after sending. */
  onClose: () => void;
  onDontAsk: () => void;
  inline?: boolean;
}

export function SessionAskDialogView({ open, rating, note, onRating, onNote, status, errorCode, onSend, onClose, onDontAsk, inline }: SessionAskDialogViewProps) {
  const sending = status === "sending";
  const sent = status === "sent";
  return (
    <Dialog
      inline={inline} open={open} onClose={onClose} title={t("support.ask.title")}
      actionsStart={sent ? undefined : <Button variant="link" data-track="ask-dont-ask" onClick={onDontAsk} disabled={sending}>{t("support.ask.dontAsk")}</Button>}
      actions={sent ? (
        <Button variant="primary" data-track="ask-continue" onClick={onClose}>{t("support.ask.continue")}</Button>
      ) : (
        <>
          <Button data-track="ask-not-now" onClick={onClose} disabled={sending}>{t("support.ask.notNow")}</Button>
          <Button variant="primary" loading={sending} disabled={!canSendRating(rating)} data-track="ask-send" onClick={onSend}>
            {status === "error" ? t("support.ask.tryAgain") : t("support.ask.send")}
          </Button>
        </>
      )}
    >
      {sent ? (
        <div className={s.sent} role="status">
          <span className={s.sentIcon}><Icon name="check" size="md" /></span>
          <div className={s.sentText}>
            <div className={s.sentTitle}>{t("support.ask.sentTitle")}</div>
            <div className={s.sentBody}>{t("support.ask.sentBody")}</div>
          </div>
        </div>
      ) : (
        <div className={s.form} aria-busy={sending || undefined}>
          {status === "error" ? (
            <Callout tone="error" live="alert" title={t("support.ask.errorTitle")}>
              {t("support.ask.errorBody", { reason: tMaybe(`support.errors.${errorCode ?? ""}`, t("support.errors.generic")) })}
            </Callout>
          ) : null}
          <div className={s.scale}>
            <ChipGroup label={t("support.ask.rating")} hideLabel role="radio" align="start">
              {STEPS.map((n) => (
                <Chip key={n} role="radio" selected={rating === n} disabled={sending} aria-label={t("support.ask.ratingOption", { n })}
                  data-track={`ask-rating-${n}`} onClick={() => onRating(n)}>
                  {n}
                </Chip>
              ))}
            </ChipGroup>
            <div className={s.ends} aria-hidden="true"><span>{t("support.ask.low")}</span><span>{t("support.ask.high")}</span></div>
          </div>
          <Textarea label={t("support.ask.improve")} optionalText={t("common.optional")} rows={3} maxLength={4000} value={note}
            disabled={sending} data-track="ask-note" onChange={(e) => onNote(e.target.value)} />
          <p className={s.note}>{canSendRating(rating) ? t("support.ask.note") : t("support.ask.pick")}</p>
        </div>
      )}
    </Dialog>
  );
}

const DRAFT_KEY = "session-ask";
interface AskDraft { sessionId: string; rating: number | null; note: string }

/** The live dialog: sends one "session" note, or switches the ask off. The answer so far is a draft in memory (D108: a
 * click on the dimmed area is "Not now"), kept for the same session until it is sent. */
export function SessionAskDialog({ open, sessionId, onClose }: { open: boolean; sessionId: string; onClose: () => void }) {
  const { updateSettings } = useApp();
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<SupportStatus>("idle");
  const [errorCode, setErrorCode] = useState<string>();
  useEffect(() => {
    if (!open) return;
    const saved = drafts.get<AskDraft>(DRAFT_KEY);
    const mine = saved && saved.sessionId === sessionId ? saved : null;
    setRating(mine?.rating ?? null);
    setNote(mine?.note ?? "");
    setStatus("idle");
    setErrorCode(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const keep = (next: { rating: number | null; note: string }) => drafts.set<AskDraft>(DRAFT_KEY, { sessionId, ...next });
  const send = () => {
    if (rating === null) return;
    setStatus("sending");
    api.sendFeedback(ratingBody(rating, note, sessionId)).then(
      () => { drafts.clear(DRAFT_KEY); setStatus("sent"); },
      (e: unknown) => { setErrorCode(e instanceof ApiError ? e.code : "generic"); setStatus("error"); },
    );
  };
  const dontAsk = () => {
    drafts.clear(DRAFT_KEY);
    onClose();
    void updateSettings({ feedback_ask: false }).catch(() => {});
  };
  return (
    <SessionAskDialogView
      open={open} rating={rating} note={note}
      onRating={(n) => { setRating(n); keep({ rating: n, note }); }} onNote={(v) => { setNote(v); keep({ rating, note: v }); }}
      status={status} errorCode={errorCode} onSend={send} onClose={onClose} onDontAsk={dontAsk}
    />
  );
}
