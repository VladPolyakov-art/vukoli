import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";
import { NavRow } from "./NavRow";

/* In the app NavRow is two things in the sidebar: the chat rows under Recents and the "AI engine" warning row.
 * New practice, Archive and the collapsed icon rail are the shell's own links (AppShell.module.css `.newRow`), and
 * the Settings sections are their own links too — none of them is a NavRow. */
const meta: Meta = { title: "DS/NavRow" };
export default meta;

const rail = { width: 208, display: "flex", flexDirection: "column", gap: "var(--space-0)", padding: "var(--space-4)", background: "var(--color-sidebar)", borderRadius: "var(--radius-lg)" } as const;

/** Recents: one line per chat, no icon. Current = grey fill + weight 500 + aria-current; hover; a quiet "EN" in `end`
 * marks English practice. 44px on touch. */
export const Default: StoryObj = {
  render: () => (
    <nav aria-label="Recents" style={rail}>
      <NavRow href="#s3" label="Kestrel Pay · Senior Product Designer" current />
      <NavRow href="#s2" label="English · Talk about your work" end={<span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" }}>EN</span>} />
      <NavRow href="#s1" label="Lumen Health · Product Designer, Design Systems" />
    </nav>
  ),
};

/** A chat still being saved after End: the title shimmers (the text treatment of "preparing" lines), progress such as
 * "2 of 5" sits quietly in `end`. Still a link; plain secondary text under reduced motion. */
export const Loading: StoryObj = {
  render: () => (
    <nav aria-label="Recents" style={rail}>
      <NavRow href="#s4" label="Kestrel Pay · Senior Product Designer" loading end={<span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" }}>2 of 5</span>} />
      <NavRow href="#s3" label="English practice" loading end={<span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" }}>EN</span>} />
      <NavRow href="#s1" label="Lumen Health · Product Designer, Design Systems" />
    </nav>
  ),
};

/** The engine warning at the bottom of the rail (only while the AI engine is not ready): icon + label, the Badge in `end`. */
export const EngineWarning: StoryObj = {
  render: () => (
    <nav aria-label="AI engine" style={rail}>
      <NavRow href="#engine" label="AI engine" icon="cpu" end={<Badge tone="warning" icon="alert">Not ready</Badge>} />
    </nav>
  ),
};
