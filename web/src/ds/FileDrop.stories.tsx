import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { FileDrop, FileRow } from "./FileDrop";

/** File drop zone (G9): dashed zone + "browse" link, reading / chosen / error states. */
const meta: Meta<typeof FileDrop> = {
  title: "DS/FileDrop",
  component: FileDrop,
  tags: ["autodocs"],
  args: {
    label: "Job description file",
    privacy: "The file stays on this computer.",
    prompt: "Drop a file here or",
    browseLabel: "browse",
    hint: "PDF, DOCX, TXT, MD or HTML · up to 5 MB",
    accept: ".pdf,.docx,.txt,.md,.html",
  },
};
export default meta;
type Story = StoryObj<typeof FileDrop>;

export const Empty: Story = { args: { state: "empty" } };
export const Reading: Story = { args: { state: "reading", file: { name: "kestrel-pay-senior-product-designer.pdf", size: "184 KB" }, readingLabel: "Reading the file…" } };
export const Chosen: Story = {
  args: { state: "chosen", file: { name: "kestrel-pay-senior-product-designer.pdf", size: "184 KB" }, removeLabel: "Remove file", onRemove: () => {} },
};
export const Error: Story = {
  args: {
    state: "error",
    error: {
      title: "Couldn't read this file",
      body: "It may be a scanned PDF. Paste the job text instead.",
      action: <Button variant="secondary" size="sm">Choose another file</Button>,
    },
  },
};
export const Disabled: Story = { args: { state: "empty", disabled: true } };
/** Long file name in a narrow parent (343px): the name truncates, the size stays visible. */
export const Overflow: Story = {
  args: {
    state: "chosen",
    file: { name: "Kestrel-Pay_Senior-Product-Designer_Checkout-and-Merchant-Onboarding_2026-10-18_final_v3.pdf", size: "1.2 MB" },
    removeLabel: "Remove file",
    onRemove: () => {},
  },
  render: (args) => <div style={{ width: "21.4375rem" }}><FileDrop {...args} /></div>,
};
/** Several files (D79, Settings → General): a row per file with Replace and Remove, the zone below takes more.
 * D80: once a file is in, the zone is `compact`: one line instead of a tall box with a centred icon. */
export const Multiple: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "32rem" }}>
      <FileRow name="alex-morgan-cv.pdf" meta="Added Oct 14" accept={args.accept} replaceLabel="Replace" replaceName="Replace alex-morgan-cv.pdf"
        onReplace={() => {}} removeLabel="Remove alex-morgan-cv.pdf" onRemove={() => {}} />
      <FileRow name="portfolio-notes.md" meta="Added Oct 15" accept={args.accept} replaceLabel="Replace" replaceName="Replace portfolio-notes.md"
        onReplace={() => {}} removeLabel="Remove portfolio-notes.md" onRemove={() => {}} />
      <FileRow name="case-study-billing.docx" reading readingLabel="Reading the file…" />
      <FileDrop {...args} compact multiple onFiles={() => {}} label="CV and other files" prompt="Drop more files here, or" browseLabel="choose files"
        hint="PDF, DOCX, TXT or MD · up to 10 files" accept=".pdf,.docx,.txt,.md" privacy={undefined} />
    </div>
  ),
};
