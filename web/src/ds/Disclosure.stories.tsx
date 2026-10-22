import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";
import { Disclosure } from "./Disclosure";
import { Icon } from "./icons";

/** Disclosure (G19): a header button (aria-expanded / aria-controls) that opens a region with a short rise and closes
 * with a soft fade. `card` = Debrief question cards; `plain` = a text toggle inside other content. */
const meta: Meta<typeof Disclosure> = { title: "DS/Disclosure", component: Disclosure, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Disclosure>;

const Q2 = "Tell me about a time you had to change a design late in a project.";

const num = (n: number) => (
  <span
    style={{
      display: "inline-grid", placeItems: "center", width: "var(--control-h-sm)", height: "var(--control-h-sm)", flex: "none",
      borderRadius: "var(--radius-pill)", background: "var(--color-subtle)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)",
    }}
  >
    {n}
  </span>
);
const meta2 = (
  <>
    <Badge tone="content" icon="content" tinted>No result · “we” → “I” ×2</Badge>
    <Badge tone="language" icon="language" tinted>2 phrasings</Badge>
    <Badge tone="delivery" icon="delivery" tinted>11 fillers</Badge>
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>
      <Icon name="clock" size="sm" /> 2:20 · at 03:35 · 1 follow-up
    </span>
  </>
);
const body = (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-md)", lineHeight: "var(--leading-relaxed)" }}>
    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Follow-up: What was the result for the merchants?</p>
    <p style={{ margin: 0 }}>
      Two weeks before launch, legal gave us a new requirement: we needed an explicit consent step in checkout. We tested it with five merchants and
      we shipped on time.
    </p>
  </div>
);

export const CardClosed: Story = {
  args: { leading: num(2), title: "Tell me about a time you had to change a design late in a project.", meta: meta2, headingLevel: 3, children: body },
};
export const CardOpen: Story = { args: { ...CardClosed.args, defaultOpen: true } };
export const Plain: Story = { args: { surface: "plain", title: "Show full answer", children: body } };
export const PlainOpen: Story = { args: { surface: "plain", title: "Show full answer", defaultOpen: true, children: body } };
export const NoChevron: Story = { args: { ...CardClosed.args, chevron: "none" } };
export const Disabled: Story = { args: { leading: num(5), title: "Why do you want to join Kestrel Pay?", meta: "Not answered", disabled: true, children: body } };
/** Overflow: a long question wraps; the chevron keeps its place. Narrow parent 343px. */
export const Overflow: Story = {
  args: {
    ...CardClosed.args,
    title: "Describe a disagreement with a product manager about scope late in a release, how you resolved it, and what you would do differently next time.",
  },
  render: (args) => <div style={{ width: "21.4375rem" }}><Disclosure {...args} /></div>,
};
export const List: Story = {
  render: () => (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Disclosure as="li" leading={num(1)} title="Tell me about yourself and your current role." meta="1:50 · 1 follow-up" headingLevel={3}>{body}</Disclosure>
      <Disclosure as="li" leading={num(2)} title={Q2} meta={meta2} headingLevel={3} defaultOpen>{body}</Disclosure>
      <Disclosure as="li" leading={num(3)} title="How do you work with engineers during handoff?" meta="1:35 · no follow-up" headingLevel={3}>{body}</Disclosure>
    </ol>
  ),
};
