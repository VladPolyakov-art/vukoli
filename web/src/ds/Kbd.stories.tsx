import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "./Kbd";
import { Menu } from "./Menu";
import { IconButton } from "./Button";
import { t } from "../i18n";

/* Kbd marks a key. The app uses it in two places: the keyboard-shortcuts dialog (a definition list, key → action) and as
 * the `shortcut` hint at the end of a Menu row. Keys: Space, M, Enter, T, R, F, N, Esc, ?. */
const meta: Meta<typeof Kbd> = { title: "DS/Kbd", component: Kbd };
export default meta;

/** Every key the session uses. */
export const Keys: StoryObj<typeof Kbd> = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
      {[t("session.help.space"), "M", t("session.help.enter"), "T", "R", "F", "N", "Esc", "?"].map((k) => <Kbd key={k}>{k}</Kbd>)}
    </div>
  ),
};

/** The shortcuts list pattern (Session → Keyboard shortcuts): Kbd in the term, the action in the description, then the hint. */
export const ShortcutsList: StoryObj<typeof Kbd> = {
  render: () => {
    const rows: [string, string][] = [
      [t("session.help.space"), t("session.shortcuts.space")],
      [t("session.help.enter"), t("session.shortcuts.enter")],
      ["M", t("session.shortcuts.m")],
      ["R", t("session.shortcuts.r")],
      ["F", t("session.shortcuts.f")],
      ["Esc", t("session.shortcuts.esc")],
      ["?", t("session.shortcuts.q")],
    ];
    return (
      <div style={{ maxWidth: "28rem" }}>
        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "baseline", gap: "var(--space-2) var(--space-4)", margin: 0 }}>
          {rows.map(([key, label]) => (
            <div key={key} style={{ display: "contents" }}>
              <dt style={{ margin: 0 }}><Kbd>{key}</Kbd></dt>
              <dd style={{ margin: 0 }}>{label}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{t("session.shortcuts.hint")}</p>
      </div>
    );
  },
};

/** As a Menu row hint (`shortcut`): the key sits at the end of the row. Open and static. */
export const InMenuRow: StoryObj<typeof Kbd> = {
  render: () => (
    <Menu
      inline
      open
      label={t("session.island.menu")}
      placement="top-end"
      items={[
        { id: "redo", label: t("session.controls.redo"), icon: "redo", shortcut: "R" },
        { id: "shortcuts", label: t("session.island.shortcuts"), icon: "keyboard", shortcut: "?" },
      ]}
      trigger={(p) => <IconButton {...p} icon="more" label={t("session.island.more")} />}
    />
  ),
};
