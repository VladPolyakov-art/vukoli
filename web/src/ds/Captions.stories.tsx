import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Captions, type CaptionTurn } from "./Captions";

/** Captions (G15), Otter live-transcript structure: speaker + time header, then the words. Mike's streamed chunks
 * fade in (opacity only, no blur); the user's interim words are secondary until final. `subtitles` = last turn,
 * 3 lines; `transcript` = scrollable history. Nothing loops while the user speaks. */
const meta: Meta<typeof Captions> = { title: "DS/Captions", component: Captions, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Captions>;

const Q2 = "Tell me about a time you had to change a design late in a project.";
const MIKE: CaptionTurn = { id: "m2", speaker: "mike", name: "Mike", time: "03:35", text: Q2 };
const USER_FINAL =
  "Two weeks before launch, legal gave us a new requirement: we needed an explicit consent step in checkout. I led the redesign, so I knew the flow really well.";

export const SubtitlesMike: Story = { args: { mode: "subtitles", label: "Subtitles", turns: [MIKE] } };
/** Listening: final words + interim words (secondary). */
export const SubtitlesListening: Story = {
  args: {
    mode: "subtitles",
    label: "Subtitles",
    turns: [MIKE, { id: "u2", speaker: "user", name: "You", time: "03:41", text: "Two weeks before launch, legal gave us", interim: "a new requirement" }],
    footer: "What we heard. A wrong word? Fix it after you answer.",
  },
};
/** Overflow: a long answer keeps the last 3 lines in subtitles. */
export const SubtitlesOverflow: Story = {
  args: { mode: "subtitles", label: "Subtitles", turns: [MIKE, { id: "u2", speaker: "user", name: "You", time: "03:41", text: `${USER_FINAL} ${USER_FINAL}` }] },
  render: (args) => <div style={{ width: "21.4375rem" }}><Captions {...args} /></div>,
};
export const Pending: Story = { args: { mode: "subtitles", label: "Subtitles", turns: [], pending: { name: "Mike", label: "Mike is preparing an answer" } } };
export const Empty: Story = { args: { mode: "transcript", label: "Transcript", turns: [], empty: "The conversation will appear here." } };

const CHUNKS = ["What was the result", " for the merchants?", " A number or a decision is enough."];
function Streamed() {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n >= CHUNKS.length) return;
    const t = window.setTimeout(() => setN(n + 1), 900);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Captions mode="subtitles" label="Subtitles" turns={[{ id: "m3", speaker: "mike", name: "Mike", time: "05:02", text: CHUNKS.slice(0, n) }]} />
      <button type="button" onClick={() => setN(1)} style={{ alignSelf: "flex-start" }}>Replay</button>
    </div>
  );
}
/** Mike's words stream in chunks: each new chunk fades in, earlier words stay still. */
export const StreamedMike: Story = { render: () => <Streamed /> };

const HISTORY: CaptionTurn[] = [
  { id: "m1", speaker: "mike", name: "Mike", time: "00:12", text: "Tell me about yourself and your current role." },
  { id: "u1", speaker: "user", name: "You", time: "00:18", text: "I'm a product designer at Kestrel Pay. I work on checkout for small merchants on web and mobile." },
  MIKE,
  { id: "u2", speaker: "user", name: "You", time: "03:41", text: USER_FINAL },
  { id: "m3", speaker: "mike", name: "Mike", time: "05:02", text: "What was the result for the merchants?" },
  { id: "u3", speaker: "user", name: "You typed", time: "05:10", text: "We shipped on time and support tickets about checkout didn't go up." },
];
export const Transcript: Story = {
  args: { mode: "transcript", label: "Transcript", turns: HISTORY },
  render: (args) => <div style={{ height: "20rem", display: "flex" }}><Captions {...args} /></div>,
};
/** Narrow parent: text steps down one size. */
export const TranscriptNarrow: Story = {
  args: { mode: "transcript", label: "Transcript", turns: HISTORY },
  render: (args) => <div style={{ width: "21.4375rem", height: "20rem", display: "flex" }}><Captions {...args} /></div>,
};
