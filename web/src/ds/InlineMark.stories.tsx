import type { Meta, StoryObj } from "@storybook/react-vite";
import { InlineMark } from "./InlineMark";

/** Inline marks (G20). `fix` = grey fill + semibold (never red / green); `heard` = what speech recognition heard,
 * grey dotted underline, no strikethrough; `unsure` = low-confidence word, dashed underline + optional hint. */
const meta: Meta<typeof InlineMark> = { title: "DS/InlineMark", component: InlineMark, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof InlineMark>;

const p = { fontSize: "var(--text-md)", lineHeight: "var(--leading-relaxed)", maxWidth: "60ch", margin: 0 } as const;

export const Fix: Story = {
  render: () => <p style={p}>“I <InlineMark kind="fix" srLabel="Say:">led</InlineMark> the redesign last spring.”</p>,
};
export const Heard: Story = {
  render: () => <p style={p}>“…and <InlineMark kind="heard" srLabel="Heard as:">I have led</InlineMark> the redesign last spring, so…”</p>,
};
export const Unsure: Story = {
  render: () => (
    <p style={p}>
      Two weeks before launch, legal <InlineMark kind="unsure" hint="(may be misheard)" srLabel="Possibly misheard:">give</InlineMark> us a new
      requirement: we needed an explicit consent step in checkout.
    </p>
  ),
};
export const FixPair: Story = {
  render: () => (
    <p style={p}>
      “I am responsible <InlineMark kind="fix">of</InlineMark>” → “I'm responsible <InlineMark kind="fix">for</InlineMark>” · B1 grammar
    </p>
  ),
};
/** Long marked fragment wraps across lines in a narrow parent. */
export const Overflow: Story = {
  render: () => (
    <p style={{ ...p, width: "15rem" }}>
      “We made it <InlineMark kind="heard">more easier for merchants because the consent is now inline</InlineMark> with the pay button.”
    </p>
  ),
};
