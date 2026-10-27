import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextShimmer } from "./TextShimmer";

/** Shimmering text for short waits (G13): "Preparing questions…". Under reduced motion it is plain secondary text. */
const meta: Meta<typeof TextShimmer> = { title: "DS/TextShimmer", component: TextShimmer, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof TextShimmer>;

export const Active: Story = { args: { children: "Preparing questions…", status: true } };
/** `size="md"` on its own line: the debrief while it is written. */
export const Medium: Story = { args: { children: "Preparing feedback · 2 of 5 answers", size: "md", as: "p", status: true } };
export const Overflow: Story = {
  args: { children: "Reading the Kestrel Pay job description and matching it with your CV and the question bank…", as: "p" },
  render: (args) => <div style={{ width: "17.5rem" }}><TextShimmer {...args} /></div>,
};
