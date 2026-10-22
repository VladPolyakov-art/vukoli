import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavRow } from "./NavRow";

const meta: Meta = { title: "DS/NavRow" };
export default meta;

/** The rail nav: current row (grey fill + weight 500 + aria-current), hover, focus ring offset 2px. 44px on touch. */
export const Default: StoryObj = {
  render: () => (
    <nav aria-label="Main" style={{ width: 208, display: "flex", flexDirection: "column", gap: "var(--space-1)", padding: "var(--space-4)", background: "var(--color-sidebar)", borderRadius: "var(--radius-lg)" }}>
      <NavRow href="#practice" label="Home" icon="practice" current />
      <NavRow href="#history" label="Archive" icon="history" />
      <NavRow href="#settings" label="Settings" icon="settings" />
    </nav>
  ),
};

/** Settings section nav: text rows, a trailing note. */
export const SectionNav: StoryObj = {
  render: () => (
    <nav aria-label="Settings sections" style={{ width: 208, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <NavRow href="#engine" label="AI engine" icon="cpu" current />
      <NavRow href="#voice" label="Voice" icon="mic" />
      <NavRow href="#storage" label="Storage" icon="folder" end="Local" />
      <NavRow href="#about" label="About" icon="info" />
    </nav>
  ),
};
