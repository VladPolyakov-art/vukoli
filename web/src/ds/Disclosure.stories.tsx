import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Disclosure } from "./Disclosure";
import { Icon } from "./icons";

/** Disclosure (G19): a header button (aria-expanded / aria-controls) that opens a region with a short rise and closes
 * with a soft fade. The app uses two shapes (code is the source, 2026-10-25): `plain`, a text toggle inside other
 * content (Earlier questions, "Show a stronger answer" with a leading icon, the engine / CV / terminal toggles), and
 * the `card` verdict bar of the debrief (title only, controlled `open`, `headingLevel` 2). The numbered question card
 * (leading number, meta line, list, no chevron, disabled) is gone: the debrief question card is always open and fixed
 * (D71), so the `leading` / `meta` / `chevron="none"` slots have no card story any more. */
const meta: Meta<typeof Disclosure> = { title: "DS/Disclosure", component: Disclosure, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Disclosure>;

const STRONGER =
  "Kestrel is moving into small-business payments, where checkout is the whole experience. I led the design system rollout last year, and I'd like to apply that here, starting with consent and error states.";

const earlier = (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-md)", lineHeight: "var(--leading-relaxed)" }}>
    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Follow-up: What was the result for the merchants?</p>
    <p style={{ margin: 0 }}>
      Two weeks before launch, legal gave us a new requirement: we needed an explicit consent step in checkout. We tested it with five merchants and
      we shipped on time.
    </p>
  </div>
);

/** Plain toggle in the Session feedback panel: "Earlier questions (2)". */
export const Plain: Story = { args: { surface: "plain", title: "Earlier questions (2)", children: earlier } };
export const PlainOpen: Story = { args: { surface: "plain", title: "Earlier questions (2)", defaultOpen: true, children: earlier } };

/** Plain with a leading icon (debrief question card): the title flips with the state. */
function Stronger({ initial = false }: { initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <Disclosure
      surface="plain"
      open={open}
      onOpenChange={setOpen}
      leading={<Icon name="sparkle" size="sm" />}
      title={open ? "Hide the stronger answer" : "Show a stronger answer"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-md)", lineHeight: "var(--leading-relaxed)" }}>
        <p style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>A stronger answer</p>
        <p style={{ margin: 0 }}>{STRONGER}</p>
      </div>
    </Disclosure>
  );
}
export const PlainLeadingIcon: Story = { render: () => <Stronger /> };
export const PlainLeadingIconOpen: Story = { render: () => <Stronger initial /> };

/** The verdict bar of the debrief (D98): a `card` surface whose header is the whole verdict line — label, headline, a
 * 3-step mini scale — inside an h2. Title only; the open state is controlled by the screen. */
function VerdictBar({ headline = "Clear stories, but 3 of 5 answers end before the result.", initial = false, narrow }: { headline?: string; initial?: boolean; narrow?: boolean }) {
  const [open, setOpen] = useState(initial);
  const step = 1;
  return (
    <div style={{ width: narrow ? "21.4375rem" : undefined, maxWidth: "100%" }}>
      <Disclosure
        id="verdict"
        headingLevel={2}
        open={open}
        onOpenChange={setOpen}
        title={(
          <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-1) var(--space-3)", minWidth: 0 }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" }}>Verdict</span>
            <span style={{ color: "var(--color-text-primary)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
              {headline}<span className="visually-hidden">, step {step + 1} of 3</span>
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", gap: "var(--space-1)" }}>
              {[0, 1, 2].map((n) => (
                <span key={n} style={{ inlineSize: "var(--space-5)", blockSize: "var(--space-1)", borderRadius: "var(--radius-pill)", background: n <= step ? "var(--color-text-primary)" : "var(--color-border-subtle)" }} />
              ))}
            </span>
          </span>
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-md)", lineHeight: "var(--leading-relaxed)" }}>
          <p style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>Getting there</p>
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>To reach “Ready”: get Structure and Result to 4 of 5 or more.</p>
        </div>
      </Disclosure>
    </div>
  );
}
export const VerdictBarClosed: Story = { render: () => <VerdictBar /> };
export const VerdictBarOpen: Story = { render: () => <VerdictBar initial /> };
/** Overflow: a long headline wraps in a narrow parent (343px); the chevron keeps its place. */
export const Overflow: Story = {
  render: () => <VerdictBar narrow headline="Clear stories, but 3 of 5 answers end before the result and the numbers behind them are missing." />,
};
