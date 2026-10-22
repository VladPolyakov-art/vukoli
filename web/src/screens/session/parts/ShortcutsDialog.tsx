/* Keyboard shortcuts (session.md §V2.3, V2.8): the v1 help line under the dock moved here, opened from More or with "?".
 * A plain Dialog with a <dl> of Kbd → action. Esc closes it (never the session). */
import { Button, Dialog, Kbd } from "../../../ds";
import { t } from "../../../i18n";
import type { SessionInput, SessionVariant } from "../types";
import s from "./parts.module.css";

export function ShortcutsDialog({ open, onClose, input, variant, onMicHelp }: {
  open: boolean; onClose: () => void; input: SessionInput; variant: SessionVariant;
  /** D62: the help button opens this dialog; mic help is one step from it (voice only). */
  onMicHelp?: () => void;
}) {
  const voice = input === "voice";
  const rows: [string, string][] = [
    ...(voice ? ([
      [t("session.help.space"), t("session.shortcuts.space")],
      [t("session.help.enter"), t("session.shortcuts.enter")],
      ["M", t("session.shortcuts.m")],
    ] as [string, string][]) : []),
    ["R", t("session.shortcuts.r")],
    ...(voice ? ([["T", t("session.shortcuts.t")]] as [string, string][]) : []),
    ["F", t("session.shortcuts.f")],
    ...(variant === "english" ? [] : ([["N", t("session.shortcuts.n")]] as [string, string][])),
    ["Esc", t("session.shortcuts.esc")],
    ["?", t("session.shortcuts.q")],
  ];
  return (
    <Dialog
      open={open}
      title={t("session.shortcuts.title")}
      onClose={onClose}
      actions={
        <>
          {onMicHelp ? <Button variant="ghost" icon="mic" data-track="mic-help" onClick={onMicHelp}>{t("session.island.micHelp")}</Button> : null}
          <Button variant="secondary" data-track="shortcuts-close" onClick={onClose}>{t("session.shortcuts.close")}</Button>
        </>
      }
    >
      <dl className={s.keys} data-review-id="Session/Shortcuts">
        {rows.map(([key, label]) => (
          <div key={key} className={s.keyRow}>
            <dt><Kbd>{key}</Kbd></dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <p className={s.keysHint}>{t("session.shortcuts.hint")}</p>
    </Dialog>
  );
}
