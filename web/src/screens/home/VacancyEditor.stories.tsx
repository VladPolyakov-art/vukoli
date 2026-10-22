import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DeleteJobDialog } from "../../components/VacancyEditor";
import { EditorHarness, ScaledStage } from "./frames";
import { EDITOR_SEEDS, type EditorSeedId } from "./editorSeeds";

/* The Add / Edit job dialog in every state of home.md §3.5. Each story is the open dialog in the flow (inline) on a
 * canvas background; the real dialog is a modal. */
const meta: Meta = { title: "Screens/VacancyEditor", parameters: { layout: "padded" } };
export default meta;

function Stage({ id, width = 720 }: { id: EditorSeedId; width?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <ScaledStage width={width} height={width < 500 ? 812 : 760}>
      <div style={{ padding: "var(--space-6)", background: "var(--color-canvas)", height: "100%" }}>
        <EditorHarness seed={EDITOR_SEEDS[id]} open={open} inline onClose={() => setOpen((v) => !v)} />
      </div>
    </ScaledStage>
  );
}
const story = (id: EditorSeedId): StoryObj => ({ render: () => <Stage id={id} /> });

export const PasteEmpty = story("PasteEmpty");
export const PasteFilled = story("PasteFilled");
export const TooShort = story("TooShort");
export const FileEmpty = story("FileEmpty");
export const FileChosen = story("FileChosen");
export const FileReading = story("FileReading");
export const FileError = story("FileError");
export const LinkEmpty = story("LinkEmpty");
export const LinkFetching = story("LinkFetching");
export const LinkFetched = story("LinkFetched");
export const LinkError = story("LinkError");
export const Saving = story("Saving");
export const Edit = story("Edit");
export const PasteFilledMobile: StoryObj = { render: () => <Stage id="PasteFilled" width={375} /> };

export const DeleteConfirm: StoryObj = {
  render: () => (
    <ScaledStage width={720} height={360}>
      <div style={{ padding: "var(--space-6)", background: "var(--color-canvas)", height: "100%" }}>
        <DeleteJobDialog open inline name="Kestrel Pay" onCancel={() => {}} onConfirm={() => {}} />
      </div>
    </ScaledStage>
  ),
};
