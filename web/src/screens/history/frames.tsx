/* Scenes of the Archive list (D80; was History) for stories and the review page: the list inside the full shell, every
 * state from props. */
import { MemoryRouter } from "react-router-dom";
import { AppShellView } from "../../components/AppShell";
import { SHELL_ENGINE, SHELL_RECENT } from "../debrief/frames";
import { HISTORY_NOW, RENAMING_ID, RENAMING_VALUE, historyData, historyOverflow, LONG_TITLE, trashData } from "./fixtures";
import { HistoryView } from "./HistoryView";
import { TrashView } from "./TrashView";
import type { HistoryRowModel, HistoryUi, HistoryViewProps, TrackFilter, TrashViewProps } from "./types";

export interface HistorySceneSpec extends Partial<Omit<HistoryViewProps, "rows" | "now" | "trashCount">> {
  rows: HistoryRowModel[];
  trashCount?: number;
  track?: TrackFilter;
  ui?: HistoryUi;
  route?: string;
}

export const HISTORY_SCENES = {
  data: { rows: historyData, trashCount: 1 },
  renaming: {
    rows: historyData.map((r) => (r.id === RENAMING_ID ? { ...r, title: RENAMING_VALUE } : r)),
    trashCount: 1,
    ui: { renaming: RENAMING_ID },
  },
  overflow: { rows: historyOverflow, trashCount: 1, ui: { tooltipOpen: "o3" } },
  /** 375 only: the narrow "more" menu of one row, open. */
  menuOpen: { rows: historyData, trashCount: 1, ui: { menuOpen: "s3" } },
  filteredEmpty: { rows: historyData.filter((r) => r.track === "interview"), trashCount: 1, track: "english", route: "/archive?track=english" },
  empty: { rows: [] },
  loading: { rows: [], state: "loading" },
  error: { rows: [], state: "error" },
  /** After "Move back to Recents": the row is gone, the toast offers Undo. */
  toast: { rows: historyData.filter((r) => r.id !== "s1"), trashCount: 2, toast: { message: "Moved back to Recents.", undoLabel: "Undo" } },
  failed: { rows: historyData, trashCount: 1, notice: "Couldn't rename this session. Try again." },
} satisfies Record<string, HistorySceneSpec>;
export type HistorySceneId = keyof typeof HISTORY_SCENES;

export function HistoryScene({ id }: { id: HistorySceneId }) {
  const spec: HistorySceneSpec = HISTORY_SCENES[id];
  const { rows, trashCount = 0, route, ...rest } = spec;
  return (
    <MemoryRouter initialEntries={[route ?? "/archive"]}>
      <AppShellView current="archive" recent={SHELL_RECENT} engine={SHELL_ENGINE}>
        <HistoryView state="ready" now={HISTORY_NOW} rows={rows} trashCount={trashCount} onUnarchive={() => {}} {...rest} />
      </AppShellView>
    </MemoryRouter>
  );
}

/** Trash (US-23 AC2, Q9): the list, empty, loading, a failed load with Try again, the "Delete forever" confirm, a failed call. */
export const TRASH_SCENES = {
  /** A long title wraps inside the row. */
  data: { rows: trashData },
  empty: { rows: [] },
  loading: { rows: [], state: "loading" },
  error: { rows: [], state: "error" },
  /** "Delete forever" asks first: the dialog says it cannot be undone. */
  confirm: { rows: trashData, ui: { confirming: "t2" } },
  /** After Restore: a success line, the row has left. */
  restored: { rows: trashData.slice(1), notice: "Restored." },
  failed: { rows: trashData, error: "The app server is not answering." },
} satisfies Record<string, Partial<TrashViewProps>>;
export type TrashSceneId = keyof typeof TRASH_SCENES;

export function TrashScene({ id }: { id: TrashSceneId }) {
  const spec: Partial<TrashViewProps> = TRASH_SCENES[id];
  return (
    <MemoryRouter initialEntries={["/archive/trash"]}>
      <AppShellView current="archive" recent={SHELL_RECENT} engine={SHELL_ENGINE}>
        <TrashView state="ready" rows={[]} {...spec} />
      </AppShellView>
    </MemoryRouter>
  );
}

export { LONG_TITLE };
