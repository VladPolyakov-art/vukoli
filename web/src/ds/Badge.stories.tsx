import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Badge, Chip, ChipGroup } from "./Badge";

const meta: Meta = { title: "DS/Badge", tags: ["autodocs"] };
export default meta;

const row = { display: "flex", gap: "var(--space-2)", flexWrap: "wrap" } as const;

export const Tones: StoryObj = {
  render: () => (
    <div style={row}>
      <Badge>Free</Badge>
      <Badge tone="live" dot>Mike is speaking</Badge>
      <Badge tone="success" icon="check">Ready</Badge>
      <Badge tone="warning" icon="alert">Not running</Badge>
      <Badge tone="error" icon="x">Not found</Badge>
      <Badge tone="outline" icon="lock">Local</Badge>
      <Badge tone="content" icon="content">Content</Badge>
      <Badge tone="language" icon="language">Language</Badge>
      <Badge tone="delivery" icon="delivery">Delivery</Badge>
    </div>
  ),
};
/** Debrief only: soft layer tints (Session layers are monochrome, see Tones). */
export const DebriefTints: StoryObj = {
  render: () => (
    <div style={row}>
      <Badge tone="content" icon="content" tinted>No result · “we” → “I” ×2</Badge>
      <Badge tone="language" icon="language" tinted>2 phrasings</Badge>
      <Badge tone="delivery" icon="delivery" tinted>11 fillers</Badge>
    </div>
  ),
};
/** Toggle chips (`aria-pressed`): independent on / off. */
export const Chips: StoryObj = {
  render: () => (
    <div style={row}>
      <Chip selected>LM Studio</Chip>
      <Chip>Jan</Chip>
      <Chip>OpenRouter</Chip>
      <Chip icon="plus">Add</Chip>
      <Chip disabled>Ollama (not installed)</Chip>
    </div>
  ),
};

function Rounds({ center = false }) {
  const [v, setV] = useState("Behavioural");
  return (
    <ChipGroup label="Round type" hideLabel role="radio" align={center ? "center" : "start"}>
      {["HR screen", "Behavioural", "Technical", "Unseen mix"].map((r) => (
        <Chip key={r} role="radio" selected={v === r} onClick={() => setV(r)}>{r}</Chip>
      ))}
    </ChipGroup>
  );
}
/** Single choice (G8, `role: radio`): one Tab stop, arrows move and select. */
export const RadioChips: StoryObj = { render: () => <Rounds /> };
export const RadioChipsCentred: StoryObj = { render: () => <Rounds center /> };
/** Narrow parent (343px): the row wraps. */
export const RadioChipsNarrow: StoryObj = { render: () => <div style={{ width: "21.4375rem" }}><Rounds center /></div> };

function Focus() {
  const [v, setV] = useState("All");
  const items: [string, number][] = [["All", 4], ["Content", 2], ["Language", 1], ["Delivery", 1]];
  return (
    <ChipGroup label="Focus" role="radio">
      {items.map(([name, n]) => (
        <Chip key={name} role="radio" count={n} selected={v === name} onClick={() => setV(name)}>{name}</Chip>
      ))}
    </ChipGroup>
  );
}
/** Chips with counts (Home "Focus", US-22 AC2): the count is part of the accessible name. */
export const WithCounts: StoryObj = { render: () => <Focus /> };
