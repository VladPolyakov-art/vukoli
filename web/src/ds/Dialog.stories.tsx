import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Input, Textarea } from "./Field";
import { Kbd } from "./Kbd";
import { OverlayRoot } from "./OverlayRoot";
import { Select } from "./Select";
import { SettingGroup, SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";
import { t } from "../i18n";

/* The dialogs the app really has (screens/** and components/**): the delete confirmations (chat, job, Trash purge),
 * the vacancy editor (edit mode has `actionsStart`), Settings (`size="lg"`), mic help and keyboard shortcuts (help
 * dialogs with a × and no decision). D73: no "End this round?" confirmation, End goes straight Home. Copy is from
 * i18n/en.json. */
const meta: Meta = { title: "DS/Dialog" };
export default meta;

const CHAT = "Kestrel Pay · Senior Product Designer";

/* AppShell ChatRow, Debrief header and Archive: Cancel + a red Delete (D80). */
const deleteChatActions = (close: () => void) => (
  <>
    <Button onClick={close}>{t("common.cancel")}</Button>
    <Button variant="danger" onClick={close}>{t("rail.deleteConfirm")}</Button>
  </>
);
const deleteChatBody = <p>{t("rail.deleteBody", { title: CHAT })}</p>;

function Demo() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("rail.rowDelete")}…</Button>
      <Dialog open={open} onClose={close} title={t("rail.deleteTitle")} actions={deleteChatActions(close)}>
        {deleteChatBody}
      </Dialog>
    </>
  );
}

/** A box the size of a phone frame with its own OverlayRoot: the dialog stays inside it (review page behaviour). */
function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ width, maxWidth: "100%", height, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>{children}</OverlayRoot>
    </div>
  );
}

const deleteJobActions = (
  <>
    <Button variant="ghost">{t("common.cancel")}</Button>
    <Button variant="danger">{t("vacancy.delete")}</Button>
  </>
);

function Contained() {
  const [open, setOpen] = useState(true);
  return (
    <Frame width={375} height={520}>
      <div style={{ padding: "var(--space-4)" }}>
        <Button onClick={() => setOpen(true)}>{t("vacancy.delete")}…</Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("vacancy.deleteTitle", { name: "Kestrel Pay" })}
        actions={<><Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => setOpen(false)}>{t("vacancy.delete")}</Button></>}
      >
        <p>{t("vacancy.deleteBody")}</p>
      </Dialog>
    </Frame>
  );
}

/** Interactive: native showModal() (the app). The delete-chat confirmation. */
export const Default: StoryObj = { render: () => <Demo /> };

/** Open and static, in the flow (gallery, review): the delete-chat confirmation, from the sidebar "…" menu, the debrief menu and the Archive. The confirm button is red (D80); the menu item that opens it stays neutral. */
export const InlineOpen: StoryObj = {
  render: () => (
    <Dialog inline open onClose={() => {}} title={t("rail.deleteTitle")} actions={deleteChatActions(() => {})}>
      {deleteChatBody}
    </Dialog>
  ),
};

/** Confirming a job delete (the vacancy editor's "Delete job"): the sessions stay in Recents and Archive. */
export const DeleteConfirm: StoryObj = {
  render: () => (
    <Dialog inline open onClose={() => {}} title={t("vacancy.deleteTitle", { name: "Kestrel Pay" })} actions={deleteJobActions}>
      <p>{t("vacancy.deleteBody")}</p>
    </Dialog>
  ),
};

/** Deleting for good from Trash (Settings → Privacy and data, Trash page): the confirm button says "Delete forever". */
export const PurgeConfirm: StoryObj = {
  render: () => (
    <Dialog
      inline
      open
      onClose={() => {}}
      title={t("history.purgeTitle")}
      actions={<><Button>{t("common.cancel")}</Button><Button variant="danger">{t("history.purge")}</Button></>}
    >
      <p>{t("history.purgeBody", { title: CHAT })}</p>
    </Dialog>
  ),
};

/** A secondary action on the left (actionsStart): "Delete job" in the vacancy editor, edit mode. */
export const WithStartAction: StoryObj = {
  render: () => (
    <Dialog
      inline
      open
      onClose={() => {}}
      title={t("vacancy.editTitle")}
      actionsStart={<Button variant="ghost" icon="trash">{t("vacancy.delete")}</Button>}
      actions={<><Button variant="ghost">{t("common.cancel")}</Button><Button variant="primary">{t("vacancy.save")}</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Textarea label={t("vacancy.text")} placeholder={t("vacancy.textPlaceholder")} rows={4} readOnly defaultValue="Senior Product Designer. You will own checkout and merchant onboarding for Kestrel Pay." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <Input label={t("vacancy.company")} readOnly defaultValue="Kestrel Pay" />
          <Input label={t("vacancy.role")} readOnly defaultValue="Senior Product Designer" />
        </div>
      </div>
    </Dialog>
  ),
};

function SettingsBody() {
  const [speak, setSpeak] = useState(true);
  const [voice, setVoice] = useState("af_heart");
  return (
    <SettingGroup title={t("settings.voice.title")}>
      <SettingRow label={t("settings.voice.voice")}>
        <Select
          label={t("settings.voice.voice")}
          hideLabel
          width="content"
          value={voice}
          onChange={setVoice}
          options={[{ value: "af_heart", label: "Heart · en-US" }, { value: "bf_emma", label: "Emma · en-GB" }]}
        />
      </SettingRow>
      <SettingRow label={t("settings.voice.speak")} description={t("settings.voice.speakHint")}>
        <Toggle label={t("settings.voice.speak")} hideLabel checked={speak} onChange={setSpeak} />
      </SettingRow>
    </SettingGroup>
  );
}

/** Settings (D76): `size="lg"` is a tall panel with its own layout in the body, a × (`closeLabel`) and no actions; a press on the backdrop closes it (`closeOnBackdrop`). Full screen on a phone. */
export const SettingsLarge: StoryObj = {
  render: () => (
    <Dialog inline open size="lg" onClose={() => {}} title={t("settings.title")} closeLabel={t("common.close")} closeOnBackdrop>
      <SettingsBody />
    </Dialog>
  ),
};

/** Mic help (US-06): a help dialog, not a decision, so it has a × (`closeLabel`); a ghost "Use text mode" and the primary "Try again". */
export const MicHelp: StoryObj = {
  render: () => (
    <Dialog
      inline
      open
      onClose={() => {}}
      title={t("session.micHelp.title")}
      closeLabel={t("common.close")}
      actions={(
        <>
          <Button variant="ghost" icon="keyboard">{t("session.micHelp.useText")}</Button>
          <Button variant="primary" icon="refresh">{t("session.micHelp.tryAgain")}</Button>
        </>
      )}
    >
      <p>{t("session.micHelp.blocked")}</p>
      <ol style={{ margin: "var(--space-3) 0", paddingInlineStart: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <li>{t("session.micHelp.step1")}</li>
        <li>{t("session.micHelp.step2")}</li>
        <li>{t("session.micHelp.step3")}</li>
      </ol>
      <p>{t("session.micHelp.mac")}</p>
    </Dialog>
  ),
};

/** Keyboard shortcuts (V2.3), opened from More or with "?": a definition list of Kbd → action, a hint, and "Microphone help" beside Close. Esc closes the list, never the session. */
export const Shortcuts: StoryObj = {
  render: () => {
    const rows: [string, string][] = [
      [t("session.help.space"), t("session.shortcuts.space")],
      [t("session.help.enter"), t("session.shortcuts.enter")],
      ["M", t("session.shortcuts.m")],
      ["R", t("session.shortcuts.r")],
      ["T", t("session.shortcuts.t")],
      ["F", t("session.shortcuts.f")],
      ["N", t("session.shortcuts.n")],
      ["Esc", t("session.shortcuts.esc")],
      ["?", t("session.shortcuts.q")],
    ];
    return (
      <Dialog
        inline
        open
        onClose={() => {}}
        title={t("session.shortcuts.title")}
        actions={(
          <>
            <Button variant="ghost" icon="mic">{t("session.island.micHelp")}</Button>
            <Button variant="secondary">{t("session.shortcuts.close")}</Button>
          </>
        )}
      >
        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "baseline", gap: "var(--space-2) var(--space-4)", margin: 0 }}>
          {rows.map(([key, label]) => (
            <div key={key} style={{ display: "contents" }}>
              <dt style={{ margin: 0 }}><Kbd>{key}</Kbd></dt>
              <dd style={{ margin: 0 }}>{label}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{t("session.shortcuts.hint")}</p>
      </Dialog>
    );
  },
};

/** Under 480px of dialog width the actions stack, primary on top. */
export const Narrow: StoryObj = {
  render: () => (
    <div style={{ width: 343, maxWidth: "100%" }}>
      <Dialog inline open onClose={() => {}} title={t("rail.deleteTitle")} actions={deleteChatActions(() => {})}>
        {deleteChatBody}
      </Dialog>
    </div>
  ),
};

/** Inside an OverlayRoot (review frame): scrim element instead of the top layer, focus trapped in the frame. */
export const InFrame: StoryObj = { render: () => <Contained /> };
