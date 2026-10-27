import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Badge, Chip, ChipGroup } from "./Badge";

const meta: Meta = { title: "DS/Badge", tags: ["autodocs"] };
export default meta;

const row = { display: "flex", gap: "var(--space-2)", flexWrap: "wrap" } as const;

/** Every tone the app uses. Neutral: a quiet note ("Recommended", "Edited by you"); success / warning: the AI engine
 * status; live: the current step of the verdict scale; outline: a mode or level; layer tones (Session: monochrome). */
export const Tones: StoryObj = {
  render: () => (
    <div style={row}>
      <Badge>Recommended</Badge>
      <Badge icon="edit">Edited by you</Badge>
      <Badge icon="sparkle">Answered with a suggestion</Badge>
      <Badge tone="success" icon="check">Ready</Badge>
      <Badge tone="warning" icon="alert">Not ready</Badge>
      <Badge tone="live" icon="check">Getting there</Badge>
      <Badge tone="outline">Interview</Badge>
      <Badge tone="outline" icon="language">B2</Badge>
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
/** The AI engine status (rail, Settings → AI engine): green / amber only for a system state; the quiet ones have no icon. */
export const EngineStatus: StoryObj = {
  render: () => (
    <div style={row}>
      <Badge tone="success" icon="check">Ready</Badge>
      <Badge tone="warning" icon="alert">Not running</Badge>
      <Badge tone="warning" icon="alert">No model</Badge>
      <Badge tone="warning" icon="alert">Key rejected</Badge>
      <Badge tone="warning" icon="alert">Not signed in</Badge>
      <Badge>Checking…</Badge>
      <Badge>Not connected</Badge>
      <Badge>Needs setup</Badge>
    </div>
  ),
};
/** The Debrief verdict scale: the current step is `live` with a check, the other two are outlined. */
export const VerdictScale: StoryObj = {
  render: () => (
    <div style={row}>
      <Badge tone="outline">Not ready yet</Badge>
      <Badge tone="live" icon="check">Getting there</Badge>
      <Badge tone="outline">Ready</Badge>
    </div>
  ),
};

/** Toggle chips (`aria-pressed`): independent on / off. The real use: the OpenAI-compatible engine presets. */
function Presets() {
  const [v, setV] = useState("OpenAI");
  return (
    <div role="group" aria-label="Presets" style={row}>
      {["LM Studio", "Jan", "OpenRouter", "OpenAI"].map((p) => (
        <Chip key={p} selected={v === p} onClick={() => setV(p)}>{p}</Chip>
      ))}
    </div>
  );
}
export const Chips: StoryObj = { render: () => <Presets /> };

/** Action chips (no `selected`): a quick reply under Mike's question in the setup chat. A saved job carries the
 * `briefcase` icon, the rest are plain text. */
function Replies({ replies }: { replies: [string, "briefcase" | undefined][] }) {
  return (
    <ChipGroup label="Quick replies" hideLabel>
      {replies.map(([label, icon]) => <Chip key={label} icon={icon}>{label}</Chip>)}
    </ChipGroup>
  );
}
export const ActionChips: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <Replies replies={[["Kestrel Pay", "briefcase"], ["Lumen Health", "briefcase"], ["General questions", undefined]]} />
      <Replies replies={[["HR screen", undefined], ["Behavioural", undefined], ["Technical", undefined], ["Unseen mix", undefined]]} />
    </div>
  ),
};

function Suggestions() {
  return (
    <ChipGroup label="Suggestions" hideLabel align="center">
      <Chip icon="briefcase">Kestrel Pay again</Chip>
      <Chip icon="content">Drill my weak spots</Chip>
      <Chip icon="chat">Practise English</Chip>
    </ChipGroup>
  );
}
/** Home suggestions under the start composer: icon + text, centred (`align="center"`). */
export const ActionChipsCentred: StoryObj = { render: () => <Suggestions /> };
/** Narrow parent (343px): the centred row wraps. */
export const ActionChipsNarrow: StoryObj = { render: () => <div style={{ width: "21.4375rem" }}><Suggestions /></div> };

function ArchiveFilter({ loading = false }) {
  const [v, setV] = useState("All");
  const items: [string, number][] = [["All", 3], ["Interview", 2], ["English", 1]];
  return (
    <ChipGroup label="Show" role="radio">
      {items.map(([name, n]) => (
        <Chip key={name} role="radio" count={loading ? undefined : n} selected={v === name} disabled={loading} onClick={() => setV(name)}>{name}</Chip>
      ))}
    </ChipGroup>
  );
}
/** Single choice (G8, `role: radio`): the Archive filter. One Tab stop, arrows move and select; the count is part of the accessible name. */
export const RadioChips: StoryObj = { render: () => <ArchiveFilter /> };
/** While the Archive loads: no counts, chips disabled. */
export const RadioChipsLoading: StoryObj = { render: () => <ArchiveFilter loading /> };
