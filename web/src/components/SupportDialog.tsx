/* Send feedback (US-60, D102; pattern, components.md §2). Opens from the account menu and from Settings → About.
 * A type (Idea / Problem / Something else), a message (required), an email (optional) and the box "Attach app version,
 * system and AI engine" (on) whose description is the exact line that will be added. Nothing leaves the computer until
 * Send. States: idle · sending · sent ("Thanks — sent") · error (the text stays; Try again + Copy text) · off (this copy
 * has no form address: Copy text and the GitHub issues link instead of Send).
 * `SupportDialogView` is pure (stories, review); `SupportDialog` is the live one (fetches the config, sends). */
import { useEffect, useRef, useState, type Ref } from "react";
import { Button, Callout, Checkbox, Chip, ChipGroup, Dialog, Icon, Input, Textarea } from "../ds";
import { t, tMaybe } from "../i18n";
import { api, ApiError } from "../lib/api";
import { attachPreview, canSendSupport, copyText, supportBody, type SupportDraft } from "../lib/feedback";
import type { FeedbackConfig } from "../lib/types";
import s from "./SupportDialog.module.css";

export type SupportStatus = "idle" | "sending" | "sent" | "error";
/** `loading`: the config is being read · `ready`: Send works · `off`: no form address in this copy. */
export type SupportService = "loading" | "ready" | "off";

const KINDS = ["idea", "problem", "other"] as const;
export const EMPTY_DRAFT: SupportDraft = { kind: "idea", message: "", email: "", attach: true };
export const FALLBACK_ISSUES_URL = "https://github.com/VladPolyakov-art/vukoli/issues/new";

export interface SupportDialogViewProps {
  open: boolean;
  service: SupportService;
  /** The exact line the "attach" box adds. */
  appLine: string;
  issuesUrl: string;
  draft: SupportDraft;
  onDraft: (patch: Partial<SupportDraft>) => void;
  status: SupportStatus;
  /** The server's error code behind `status: "error"`. */
  errorCode?: string;
  copied?: boolean;
  onSend: () => void;
  onCopy: () => void;
  onClose: () => void;
  messageRef?: Ref<HTMLTextAreaElement>;
  inline?: boolean;
}

export function SupportDialogView({
  open, service, appLine, issuesUrl, draft, onDraft, status, errorCode, copied, onSend, onCopy, onClose, messageRef, inline,
}: SupportDialogViewProps) {
  const sending = status === "sending";
  const off = service === "off";
  const copyButton = (variant: "secondary" | "ghost") => (
    <Button variant={variant} icon={copied ? "check" : "copy"} data-track="support-copy" onClick={onCopy} disabled={!canSendSupport(draft)}>
      {copied ? t("support.copied") : t("support.copy")}
    </Button>
  );

  const sent = status === "sent";
  const actions = sent ? (
    <Button variant="primary" data-track="support-done" onClick={onClose}>{t("support.close")}</Button>
  ) : off ? (
    <>
      {copyButton("secondary")}
      <Button variant="primary" iconRight="external" data-track="support-github"
        onClick={() => window.open(issuesUrl, "_blank", "noopener")}>{t("support.github")}</Button>
    </>
  ) : (
    <>
      <Button data-track="support-cancel" onClick={onClose}>{t("support.cancel")}</Button>
      <Button variant="primary" loading={sending} disabled={!canSendSupport(draft) || service === "loading"}
        data-track="support-send" onClick={onSend}>
        {status === "error" ? t("support.tryAgain") : t("support.send")}
      </Button>
    </>
  );

  return (
    <Dialog inline={inline} open={open} onClose={onClose} title={t("support.title")} actions={actions}
      closeLabel={off && !sent ? t("support.close") : undefined}
      actionsStart={!off && !sent && status === "error" ? copyButton("ghost") : undefined}>
      {sent ? (
        <div className={s.sent} role="status">
          <span className={s.sentIcon}><Icon name="check" size="md" /></span>
          <div className={s.sentText}>
            <div className={s.sentTitle}>{t("support.sentTitle")}</div>
            <div className={s.sentBody}>{t("support.sentBody")}</div>
          </div>
        </div>
      ) : (
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); if (!sending && canSendSupport(draft)) onSend(); }} aria-busy={sending || undefined}>
          {off ? (
            <Callout tone="info" title={t("support.offTitle")}>{t("support.offBody")}</Callout>
          ) : status === "error" ? (
            <Callout tone="error" live="alert" title={t("support.errorTitle")}>
              {t("support.errorBody", { reason: tMaybe(`support.errors.${errorCode ?? ""}`, t("support.errors.generic")) })}
            </Callout>
          ) : (
            <p className={s.intro}>{t("support.intro")}</p>
          )}
          <ChipGroup label={t("support.kind")} role="radio">
            {KINDS.map((kind) => (
              <Chip key={kind} role="radio" selected={draft.kind === kind} disabled={sending} data-track={`support-kind-${kind}`}
                onClick={() => onDraft({ kind })}>
                {t(`support.kinds.${kind}`)}
              </Chip>
            ))}
          </ChipGroup>
          <Textarea ref={messageRef} label={t("support.message")} hint={t("support.messageHint")} placeholder={t("support.messagePlaceholder")}
            rows={5} maxLength={4000} value={draft.message} disabled={sending} data-track="support-message"
            onChange={(e) => onDraft({ message: e.target.value })} />
          {off ? null : (
            <Input type="email" label={t("support.email")} optionalText={t("common.optional")} hint={t("support.emailHint")}
              value={draft.email} disabled={sending} autoComplete="email" spellCheck={false} data-track="support-email"
              error={status === "error" && errorCode === "bad_email" ? t("support.errors.bad_email") : undefined}
              onChange={(e) => onDraft({ email: e.target.value })} />
          )}
          <Checkbox label={t("support.attach")} description={attachPreview(draft.attach, appLine) ?? t("support.attachOff")}
            checked={draft.attach} disabled={sending || service === "loading"} data-track="support-attach"
            onChange={(e) => onDraft({ attach: e.target.checked })} />
        </form>
      )}
    </Dialog>
  );
}

/** The live dialog. State is cleared each time it opens; the text survives a failed send (AC5). */
export function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<SupportDraft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<SupportStatus>("idle");
  const [errorCode, setErrorCode] = useState<string>();
  const [service, setService] = useState<SupportService>("loading");
  const [config, setConfig] = useState<Pick<FeedbackConfig, "app_line" | "issues_url">>({ app_line: "", issues_url: FALLBACK_ISSUES_URL });
  const [copied, setCopied] = useState(false);
  const message = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setDraft(EMPTY_DRAFT);
    setStatus("idle");
    setErrorCode(undefined);
    setCopied(false);
    setService("loading");
    api.feedbackConfig().then(
      (c) => { if (alive) { setConfig({ app_line: c.app_line, issues_url: c.issues_url }); setService(c.configured ? "ready" : "off"); } },
      () => { if (alive) setService("off"); },
    );
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const send = () => {
    setStatus("sending");
    api.sendFeedback(supportBody(draft)).then(
      () => setStatus("sent"),
      (e: unknown) => {
        const code = e instanceof ApiError ? e.code : "generic";
        if (code === "not_configured") { setService("off"); setStatus("idle"); return; }
        setErrorCode(code);
        setStatus("error");
      },
    );
  };
  const copy = () => {
    navigator.clipboard.writeText(copyText(draft, config.app_line)).then(
      () => setCopied(true),
      () => { message.current?.focus(); message.current?.select(); },     // no clipboard access: select the text to copy by hand
    );
  };

  return (
    <SupportDialogView
      open={open} service={service} appLine={config.app_line} issuesUrl={config.issues_url}
      draft={draft} onDraft={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      status={status} errorCode={errorCode} copied={copied}
      onSend={send} onCopy={copy} onClose={onClose} messageRef={message}
    />
  );
}
