import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState, type ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { Menu, type ListboxOption, type MenuEntry } from "./Menu";
import { OverlayRoot } from "./OverlayRoot";

/* Fixture: docs/ia.md §6 (Kestrel Pay, Lumen Health, Fieldnote). */
const meta: Meta = { title: "DS/Menu" };
export default meta;

const sessionActions: MenuEntry[] = [
  { id: "export", label: "Export to Obsidian", icon: "folder" },
  { id: "download", label: "Download as Markdown", icon: "download" },
  { id: "sep", separator: true },
  { id: "trash", label: "Move to Trash", icon: "trash" },
];

const strictness = (value: string, set?: (v: string) => void): MenuEntry[] => [
  { id: "gentle", label: "Gentle", description: "Mike lets small gaps go and encourages you.", checked: value === "gentle", onSelect: () => set?.("gentle") },
  { id: "standard", label: "Standard", description: "Like a fair first-round interviewer.", checked: value === "standard", onSelect: () => set?.("standard") },
  { id: "tough", label: "Tough", description: "Follow-ups on every vague answer.", checked: value === "tough", onSelect: () => set?.("tough") },
];

const jobs: ListboxOption[] = [
  { id: "kestrel", label: "Kestrel Pay", description: "Senior Product Designer · Added Oct 18", icon: "briefcase" },
  { id: "lumen", label: "Lumen Health", description: "Product Designer, Design Systems · Added Oct 12", icon: "briefcase" },
  { id: "fieldnote", label: "Fieldnote", description: "Product Designer · Added Oct 3", icon: "briefcase" },
];

function ActionDemo() {
  const [last, setLast] = useState<string | null>(null);
  const items = sessionActions.map((e) => ("separator" in e ? e : { ...e, onSelect: () => setLast(e.label) }));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <Menu
        label="More actions for this session"
        items={items}
        trigger={(p) => <IconButton {...p} icon="more" size="sm" label="More actions for this session" />}
      />
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>{last ? `Chose: ${last}` : "Arrow keys, Home / End, type to jump, Esc"}</span>
    </div>
  );
}

function RadioDemo() {
  const [value, setValue] = useState("standard");
  return (
    <Menu
      label="Strictness"
      items={strictness(value, setValue)}
      trigger={(p) => <Button {...p} size="sm" iconRight="chevronDown">Strictness: {value[0]!.toUpperCase() + value.slice(1)}</Button>}
    />
  );
}

function PickerDemo({ search }: { search?: boolean }) {
  const [value, setValue] = useState<string | null>("kestrel");
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchor} style={{ width: 480, maxWidth: "100%", padding: "var(--space-3)", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}>
      <Menu
        kind="listbox"
        label="Saved jobs"
        anchor={anchor}
        options={jobs}
        value={value}
        onChange={setValue}
        search={search ? { label: "Search saved jobs", placeholder: "Search jobs" } : undefined}
        footer={<Button variant="ghost" size="sm" icon="plus">Add a job</Button>}
        trigger={(p) => <Button {...p} variant="ghost" size="sm" icon="briefcase">Saved jobs</Button>}
      />
    </div>
  );
}

function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ width, maxWidth: "100%", height, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>{children}</OverlayRoot>
    </div>
  );
}

/** Interactive action menu (menu button pattern). */
export const ActionMenu: StoryObj = { render: () => <ActionDemo /> };

/** Open and static, in the flow (gallery, review). */
export const ActionMenuOpen: StoryObj = {
  render: () => (
    <Menu inline open label="More actions for this session" items={sessionActions}
      trigger={(p) => <IconButton {...p} icon="more" size="sm" label="More actions for this session" />} />
  ),
};

/** Radio items (menuitemradio): the Strictness menu, interactive. */
export const RadioItems: StoryObj = { render: () => <RadioDemo /> };

/** Radio items, open and static. */
export const RadioItemsOpen: StoryObj = {
  render: () => (
    <Menu inline open label="Strictness" items={strictness("standard")}
      trigger={(p) => <Button {...p} size="sm" iconRight="chevronDown">Strictness: Standard</Button>} />
  ),
};

/** Listbox popover: the Saved jobs picker, as wide as the composer, interactive. */
export const ListboxPicker: StoryObj = { render: () => <PickerDemo /> };

/** Listbox with search (more than 5 jobs) and a footer action, interactive. */
export const ListboxWithSearch: StoryObj = { render: () => <PickerDemo search /> };

/** Listbox, open and static. */
export const ListboxOpen: StoryObj = {
  render: () => (
    <div style={{ width: 480, maxWidth: "100%" }}>
      <Menu inline open kind="listbox" label="Saved jobs" options={jobs} value="kestrel" onChange={() => {}}
        search={{ label: "Search saved jobs", placeholder: "Search jobs" }}
        footer={<Button variant="ghost" size="sm" icon="plus">Add a job</Button>}
        trigger={(p) => <Button {...p} variant="ghost" size="sm" icon="briefcase">Saved jobs</Button>} />
    </div>
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

/* v2: header slot, checkbox item (menuitemcheckbox, stays open), shortcut hints (Kbd at the end). Session More menu. */
function MoreDemo({ open }: { open?: boolean }) {
  const [sample, setSample] = useState(false);
  const items: MenuEntry[] = [
    { id: "sample", label: "Show a sample answer", description: "Practice only. Say it in your own words.", checkbox: true, checked: sample, onSelect: () => setSample((v) => !v) },
    { id: "sep", separator: true },
    { id: "keys", label: "Keyboard shortcuts", icon: "keyboard", shortcut: "?" },
    { id: "mic", label: "Microphone help", icon: "mic" },
  ];
  const header = (
    <>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" }}>Kestrel Pay · Senior Product Designer</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Behavioural · Standard</span>
    </>
  );
  return (
    <Menu inline={open} open={open ? true : undefined} label="More" header={header} items={items} placement="top-end"
      trigger={(p) => <IconButton {...p} icon="more" label="More" />} />
  );
}
/** v2 More menu: header, checkbox item and shortcut hints, interactive. */
export const HeaderCheckboxShortcut: StoryObj = { render: () => <div style={{ paddingTop: "var(--space-16)" }}><MoreDemo /></div> };
/** v2 More menu, open and static. */
export const HeaderCheckboxShortcutOpen: StoryObj = { render: () => <MoreDemo open /> };

function AccountDemo() {
  const [open, setOpen] = useState(true);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const items: MenuEntry[] = [
    { id: "settings", label: "Settings", icon: "settings" },
    {
      id: "theme", label: "Theme", hideLabel: true,
      choices: (["system", "light", "dark"] as const).map((v) => ({
        id: v, label: v[0]!.toUpperCase() + v.slice(1), icon: v === "system" ? "monitor" : v === "light" ? "sun" : "moon", checked: theme === v, onSelect: () => setTheme(v),
      })),
    },
    { id: "sep", separator: true },
    { id: "privacy", label: "Privacy and data", icon: "lock" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", minHeight: "22rem" }}>
      <Menu label="Account" placement="right-end" open={open} onOpenChange={setOpen} items={items}
        trigger={(p) => <Button {...p} variant="secondary">You · Local</Button>} />
    </div>
  );
}

/** D79: opens beside its trigger, bottom edges aligned (the account menu opens into the work area); the theme row has no label. */
export const RightOfTrigger: StoryObj = { render: () => <AccountDemo /> };
