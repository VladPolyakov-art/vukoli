import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { Menu, type ListboxOption, type MenuEntry, type MenuTriggerProps } from "./Menu";
import { OverlayRoot } from "./OverlayRoot";
import { t } from "../i18n";

/* The menus the app really has (screens/** and components/**): the chat-row "…" menu (AppShell), the account menu
 * (AppShell), the debrief and Archive-row "…" menus, the radio menus with descriptions (mode, round, strictness), the
 * Saved jobs listbox (PlanCard) and the session More menu (Island). Copy is from i18n/en.json. D80: no theme row in the
 * account menu (the theme lives in Settings → General); D62: no "Show a sample answer" row (a bulb IconButton in the
 * island); delete is "Delete" and asks first (Dialog), it never says "Move to Trash". */
const meta: Meta = { title: "DS/Menu" };
export default meta;

const CHAT = "Kestrel Pay · Senior Product Designer";

/* AppShell ChatRow: Rename / Download as Markdown / Archive / separator / Delete. */
const chatRowItems: MenuEntry[] = [
  { id: "rename", label: t("rail.rowRename"), icon: "edit" },
  { id: "download", label: t("rail.rowDownload"), icon: "download" },
  { id: "archive", label: t("rail.rowArchive"), icon: "archive" },
  { id: "sep", separator: true },
  { id: "delete", label: t("rail.rowDelete"), icon: "trash" },
];

/* Debrief header "…" (screens/debrief/parts/Header.tsx). */
const debriefItems: MenuEntry[] = [
  { id: "export", label: t("debrief.menu.export"), icon: "folder" },
  { id: "download", label: t("debrief.menu.download"), icon: "download" },
  { id: "archive", label: t("debrief.menu.archive"), icon: "archive" },
  { id: "sep", separator: true },
  { id: "trash", label: t("debrief.menu.trash"), icon: "trash" },
];

/* Archive row "…" at narrow width (screens/history/HistoryView.tsx). */
const archiveRowItems: MenuEntry[] = [
  { id: "rename", label: t("history.row.menuRename"), icon: "edit" },
  { id: "unarchive", label: t("history.row.menuUnarchive"), icon: "archive" },
  { id: "sep", separator: true },
  { id: "trash", label: t("history.row.menuTrash"), icon: "trash" },
];

type Level = "gentle" | "standard" | "tough";
const strictness = (value: Level, set?: (v: Level) => void): MenuEntry[] =>
  (["gentle", "standard", "tough"] as const).map((v) => ({
    id: v,
    label: t(`home.strictness.${v}.label`),
    description: t(`home.strictness.${v}.desc`),
    checked: value === v,
    onSelect: () => set?.(v),
  }));

type Mode = "interview" | "english";
const modes = (value: Mode, set?: (v: Mode) => void): MenuEntry[] => [
  { id: "interview", label: t("chat.start.mode.interview"), description: t("chat.start.mode.interviewDesc"), icon: "briefcase", checked: value === "interview", onSelect: () => set?.("interview") },
  { id: "english", label: t("chat.start.mode.english"), description: t("chat.start.mode.englishDesc"), icon: "chat", checked: value === "english", onSelect: () => set?.("english") },
];

type Round = "hr" | "behavioural" | "mix";
const rounds = (value: Round, set?: (v: Round) => void): MenuEntry[] =>
  (["hr", "behavioural", "mix"] as const).map((v) => ({
    id: v,
    label: t(`home.round.${v}`),
    description: t(`home.round.${v}Hint`),
    checked: value === v,
    onSelect: () => set?.(v),
  }));

/* PlanCard "Change job": Saved jobs listbox, no search, no footer, as wide as its options. */
const jobs: ListboxOption[] = [
  { id: "kestrel", label: "Kestrel Pay", description: "Senior Product Designer", icon: "briefcase" },
  { id: "lumen", label: "Lumen Health", description: "Product Designer, Design Systems", icon: "briefcase" },
  { id: "fieldnote", label: "Fieldnote", description: "Product Designer", icon: "briefcase" },
  { id: "general", label: t("chat.plan.general"), description: t("home.vacancies.generalHint") },
];

const rowMore = (label: string) => (p: MenuTriggerProps) => (
  <IconButton {...p} icon="more" size="sm" label={label} />
);

function ActionDemo() {
  const [last, setLast] = useState<string | null>(null);
  const label = t("rail.rowActions", { title: CHAT });
  const items = chatRowItems.map((e) => ("separator" in e ? e : { ...e, onSelect: () => setLast(e.label) }));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <Menu label={label} placement="bottom-end" items={items} trigger={rowMore(label)} />
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>{last ? `Chose: ${last}` : "Arrow keys, Home / End, type to jump, Esc"}</span>
    </div>
  );
}

function RadioDemo() {
  const [value, setValue] = useState<Level>("standard");
  return (
    <Menu
      label={t("chat.plan.changeStrictness")}
      placement="bottom-end"
      items={strictness(value, setValue)}
      trigger={(p) => <Button {...p} variant="link" size="sm" aria-label={t("chat.plan.changeStrictness")}>{t("chat.plan.change")}</Button>}
    />
  );
}

function ModeDemo({ open }: { open?: boolean }) {
  const [value, setValue] = useState<Mode>("interview");
  const label = value === "english" ? t("chat.start.mode.english") : t("chat.start.mode.interview");
  return (
    <Menu
      inline={open}
      open={open ? true : undefined}
      label={t("chat.start.mode.menu")}
      items={modes(value, setValue)}
      trigger={(p) => (
        <Button {...p} variant="secondary" size="sm" icon={value === "english" ? "chat" : "briefcase"} iconRight="chevronDown" aria-label={t("chat.start.mode.aria", { mode: label })}>{label}</Button>
      )}
    />
  );
}

function PickerDemo() {
  const [value, setValue] = useState<string | null>("kestrel");
  return (
    <Menu
      kind="listbox"
      label={t("chat.plan.jobs")}
      options={jobs}
      value={value}
      onChange={setValue}
      matchWidth={false}
      placement="bottom-end"
      trigger={(p) => <Button {...p} variant="link" size="sm" aria-label={t("chat.plan.changeJob")}>{t("chat.plan.change")}</Button>}
    />
  );
}

function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ width, maxWidth: "100%", height, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>{children}</OverlayRoot>
    </div>
  );
}

/** The chat-row "…" menu in the sidebar (Rename / Download / Archive / Delete), interactive. */
export const ActionMenu: StoryObj = { render: () => <ActionDemo /> };

/** The chat-row menu, open and static, in the flow (gallery, review). Delete is neutral here: the red button is in the confirm Dialog. */
export const ActionMenuOpen: StoryObj = {
  render: () => {
    const label = t("rail.rowActions", { title: CHAT });
    return <Menu inline open label={label} placement="bottom-end" items={chatRowItems} trigger={rowMore(label)} />;
  },
};

/** The debrief header "…" menu: Export to Obsidian (when linked), Download, Archive, Delete. Open and static. */
export const DebriefMenuOpen: StoryObj = {
  render: () => (
    <Menu inline open label={t("debrief.moreActions")} placement="bottom-end" items={debriefItems} trigger={rowMore(t("debrief.moreActions"))} />
  ),
};

/** The Archive row menu at narrow width (the row's own buttons fold into it). Open and static. */
export const ArchiveRowMenuOpen: StoryObj = {
  render: () => {
    const label = t("history.row.more", { title: CHAT });
    return <Menu inline open label={label} placement="bottom-end" items={archiveRowItems} trigger={rowMore(label)} />;
  },
};

/** Radio items with descriptions (menuitemradio, the check on the right): "Change" next to Strictness in the plan, interactive. */
export const RadioItems: StoryObj = { render: () => <RadioDemo /> };

/** Strictness radio items, open and static. */
export const RadioItemsOpen: StoryObj = {
  render: () => (
    <Menu inline open label={t("chat.plan.changeStrictness")} placement="bottom-end" items={strictness("standard")}
      trigger={(p) => <Button {...p} variant="link" size="sm" aria-label={t("chat.plan.changeStrictness")}>{t("chat.plan.change")}</Button>} />
  ),
};

/** Practice type on the start screen: radio items with an icon and a description, secondary button trigger, interactive. */
export const ModeItems: StoryObj = { render: () => <ModeDemo /> };

/** Practice type menu, open and static. */
export const ModeItemsOpen: StoryObj = { render: () => <ModeDemo open /> };

/** Round type in the plan ("Change" next to Round): label + hint per round, open and static. */
export const RoundItemsOpen: StoryObj = {
  render: () => (
    <Menu inline open label={t("chat.plan.changeRound")} placement="bottom-end" items={rounds("behavioural")}
      trigger={(p) => <Button {...p} variant="link" size="sm" aria-label={t("chat.plan.changeRound")}>{t("chat.plan.change")}</Button>} />
  ),
};

/** Listbox popover: the Saved jobs picker in the plan ("Change" next to Job). No search, no footer, as wide as its options. Interactive. */
export const ListboxPicker: StoryObj = { render: () => <PickerDemo /> };

/** Listbox, open and static. */
export const ListboxOpen: StoryObj = {
  render: () => (
    <Menu inline open kind="listbox" label={t("chat.plan.jobs")} options={jobs} value="kestrel" onChange={() => {}} matchWidth={false} placement="bottom-end"
      trigger={(p) => <Button {...p} variant="link" size="sm" aria-label={t("chat.plan.changeJob")}>{t("chat.plan.change")}</Button>} />
  ),
};

/** In a 375 frame (OverlayRoot narrower than 640): the popover becomes a full-width sheet under the trigger (max 60% of the frame). */
export const NarrowSheet: StoryObj = {
  render: () => (
    <Frame width={375} height={520}>
      <div style={{ padding: "var(--space-4)" }}><ActionDemo /></div>
    </Frame>
  ),
};

/* Island "More" (screens/session/parts/Island.tsx): a header (title, round · strictness), Redo (only on a phone, where
 * the island is stacked), Keyboard shortcuts, Microphone help (voice), and a disabled "Switch to voice" with the reason
 * as its description when speech recognition is missing. Shortcut hints are Kbd at the row end. */
function MoreDemo({ open }: { open?: boolean }) {
  const items: MenuEntry[] = [
    { id: "redo", label: t("session.controls.redo"), icon: "redo", shortcut: "R", disabled: true },
    { id: "shortcuts", label: t("session.island.shortcuts"), icon: "keyboard", shortcut: "?" },
    { id: "mic-help", label: t("session.island.micHelp"), icon: "mic" },
    { id: "voice", label: t("session.island.switchToVoice"), description: t("session.island.voiceUnavailable"), icon: "mic", disabled: true },
  ];
  const header = (
    <>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" }}>{CHAT}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Behavioural · Standard</span>
    </>
  );
  return (
    <Menu inline={open} open={open ? true : undefined} label={t("session.island.menu")} header={header} items={items} placement="top-end"
      trigger={(p) => <IconButton {...p} icon="more" label={t("session.island.more")} />} />
  );
}
/** The session More menu: header, shortcut hints, a disabled row with its reason. Interactive. */
export const HeaderCheckboxShortcut: StoryObj = { render: () => <div style={{ paddingTop: "var(--space-16)" }}><MoreDemo /></div> };
/** The session More menu, open and static. (The export name predates D62, which removed the checkbox row.) */
export const HeaderCheckboxShortcutOpen: StoryObj = { render: () => <MoreDemo open /> };

function AccountDemo() {
  const [open, setOpen] = useState(true);
  const items: MenuEntry[] = [
    { id: "settings", label: t("settings.title"), icon: "settings" },
    { id: "sep", separator: true },
    { id: "privacy", label: t("settings.section.privacy"), icon: "lock" },
    { id: "help", label: t("rail.help"), icon: "info" },
  ];
  const header = (
    <>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" }}>{t("rail.you")}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{t("rail.storage")}</span>
    </>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-end", minHeight: "22rem" }}>
      <Menu label={t("rail.accountMenu")} placement="right-end" open={open} onOpenChange={setOpen} header={header} items={items}
        trigger={(p) => <Button {...p} variant="secondary" icon="user" iconRight="chevronRight">{t("rail.you")} · {t("rail.local")}</Button>} />
    </div>
  );
}

/** D79/D80: the account menu opens beside its trigger, bottom edges aligned (into the work area). A header (name, "Saved on this computer"), Settings, a separator, Privacy and data, Help. No theme row: the theme is in Settings → General. */
export const RightOfTrigger: StoryObj = { render: () => <AccountDemo /> };
