/* MicHelpDialog (US-06 AC2): why Mike can't hear you, and the two ways forward. */
import { Button, Dialog } from "../../../ds";
import { t } from "../../../i18n";
import type { SessionHandlers } from "../types";
import s from "./parts.module.css";

export function MicHelpDialog({ open, reason = "blocked", handlers }: { open: boolean; reason?: "blocked" | "none"; handlers?: SessionHandlers }) {
  return (
    <Dialog
      open={open}
      title={t("session.micHelp.title")}
      onClose={() => handlers?.onCloseMicHelp?.()}
      closeLabel={t("common.close")}
      actions={
        <>
          <Button variant="ghost" icon="keyboard" data-track="mic-help-use-text" onClick={handlers?.onUseText}>{t("session.micHelp.useText")}</Button>
          <Button variant="primary" icon="refresh" data-track="mic-help-try-again" onClick={handlers?.onTryAgain}>{t("session.micHelp.tryAgain")}</Button>
        </>
      }
    >
      {reason === "blocked" ? (
        <>
          <p>{t("session.micHelp.blocked")}</p>
          <ol className={s.steps}>
            <li>{t("session.micHelp.step1")}</li>
            <li>{t("session.micHelp.step2")}</li>
            <li>{t("session.micHelp.step3")}</li>
          </ol>
          <p>{t("session.micHelp.mac")}</p>
        </>
      ) : (
        <p>{t("session.micHelp.none")}</p>
      )}
    </Dialog>
  );
}
