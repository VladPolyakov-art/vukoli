import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScaledStage } from "../debrief/frames";
import { HistoryScene, TrashScene, type HistorySceneId, type TrashSceneId } from "./frames";

/* Fixture: docs/ia.md §6 (Alex Morgan; sessions S1–S3). Spec: ds/screens/debrief.md §4. Each story is a frame of a real
 * width, scaled to fit, with its own OverlayRoot. Light; dark with the toolbar. */
const meta: Meta = { title: "Screens/History", parameters: { layout: "padded" } };
export default meta;

const desktop = (id: HistorySceneId): StoryObj => ({
  render: () => <ScaledStage width={1440} height={900}><HistoryScene id={id} /></ScaledStage>,
});
const mobile = (id: HistorySceneId): StoryObj => ({
  render: () => <ScaledStage width={375} height={812}><HistoryScene id={id} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/** Three sessions in two week groups (invariant 1). */
export const Data = desktop("data");
export const DataMobile = mobile("data");
/** The Lumen row is being renamed in place. */
export const Renaming = desktop("renaming");
/** Narrow: one "more" button opens the row menu (Rename, Move to Trash). */
export const RowMenuMobile = mobile("menuOpen");
/** Seven rows, +30% text, one truncated title with its tooltip. */
export const Overflow = desktop("overflow");
export const OverflowMobile = mobile("overflow");
/** `?track=english` with no English sessions. */
export const FilteredEmpty = desktop("filteredEmpty");
export const Empty = desktop("empty");
export const EmptyMobile = mobile("empty");
export const Loading = desktop("loading");
export const LoadingMobile = mobile("loading");
export const Error = desktop("error");
/** After Move to Trash: the row has gone, the toast offers Undo (never a green callout). */
export const Toast = desktop("toast");
/** A rename or trash call failed: an error callout above the list, the old title is back. */
export const ActionFailed = desktop("failed");

const trash = (id: TrashSceneId): StoryObj => ({
  render: () => <ScaledStage width={1440} height={900}><TrashScene id={id} /></ScaledStage>,
});
const trashMobile = (id: TrashSceneId): StoryObj => ({
  render: () => <ScaledStage width={375} height={812}><TrashScene id={id} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/** Trash (US-23 AC2): two deleted chats, one with a long title; Restore and Delete forever on each row. */
export const TrashData = trash("data");
export const TrashDataMobile = trashMobile("data");
export const TrashEmpty = trash("empty");
export const TrashLoading = trash("loading");
/** The trash could not be read: an error callout with Try again and a link to storage settings. */
export const TrashLoadError = trash("error");
export const TrashLoadErrorMobile = trashMobile("error");
/** Delete forever asks first; the dialog says it cannot be undone (the confirm button is red). */
export const TrashDeleteForeverConfirm = trash("confirm");
export const TrashDeleteForeverConfirmMobile = trashMobile("confirm");
/** After Restore: a success line, the row has gone. */
export const TrashRestored = trash("restored");
/** A Restore or Delete forever call failed: an error callout above the list, the row stays. */
export const TrashActionFailed = trash("failed");
