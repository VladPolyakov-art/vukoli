import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon, iconNames } from "./icons";
import { Kbd } from "./Kbd";

const meta: Meta = { title: "DS/Icons" };
export default meta;
export const All: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))", gap: "var(--space-4)" }}>
      {iconNames.map((n) => (
        <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
          <Icon name={n} size="lg" />
          {n}
        </div>
      ))}
    </div>
  ),
};
export const Keys: StoryObj = { render: () => <p>Press <Kbd>Space</Kbd> to talk, <Kbd>M</Kbd> to mute, <Kbd>Enter</Kbd> to send.</p> };
