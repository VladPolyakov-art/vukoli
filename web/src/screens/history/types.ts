/* View model of the History list (ds/screens/debrief.md §4). Pure data: the live container maps `SessionSummary` into
 * it, stories and the review page use the fixtures. */
import type { HTMLAttributes } from "react";
export type Track = "interview" | "english";
export type TrackFilter = "all" | Track;
export type HistoryState = "ready" | "loading" | "error";

export interface HistoryRowModel {
  id: string;
  title: string;
  track: Track;
  /** "Behavioural · Standard" or "B2"; absent for live data (the saved summary does not carry it). */
  round?: string;
  /** Local ISO time ("2026-10-19T20:40:00"): the row shows it and the list is grouped by it. */
  startedAt: string;
  durationS?: number;
  /** Verdict word, "5 corrections", "No verdict — 2 of 5 answered". Plain text, never coloured. */
  result: string;
  /** D69: the first question asked, one line under the title (same-titled sessions read apart). */
  question?: string;
  /** D69: fewer than 3 answers — folded into "N short sessions" at the end of its week. */
  short?: boolean;
}

export interface HistoryToast { message: string; undoLabel?: string; onUndo?: () => void }

/** Local UI a static state can start in. */
export interface HistoryUi {
  /** The row that starts in InlineRename. */
  renaming?: string;
  /** The row whose narrow "more" menu starts open. */
  menuOpen?: string;
  /** The row whose title tooltip starts open (truncated titles). */
  tooltipOpen?: string;
  /** Week groups whose short sessions start unfolded. */
  shortOpen?: string[];
}

export interface HistoryViewProps {
  state: HistoryState;
  rows: HistoryRowModel[];
  /** "Today" for the week groups; stories pass a fixed date so the groups do not drift. */
  now: Date;
  track?: TrackFilter;
  /** Controlled filter (the live container keeps it in `?track=`). Without it the view keeps it itself. */
  onTrackChange?: (track: TrackFilter) => void;
  trashCount: number;
  ui?: HistoryUi;
  /** Rows enter staggered on the first load only. */
  enterStagger?: boolean;
  /** Static states: a toast shown in the flow. The live container uses `useToast` instead. */
  toast?: HistoryToast;
  /** An action failed (rename, trash): an error callout above the list. */
  notice?: string;
  /** Resolve `false` when saving failed: the title goes back. */
  onRename?: (id: string, title: string) => void | Promise<boolean | void>;
  /** Resolve `false` when the trash call failed: the row comes back. */
  onTrash?: (id: string) => void | Promise<boolean | void>;
  /** D80: "Move back to Recents"; resolve `false` when it failed (the row comes back). */
  onUnarchive?: (id: string) => void | Promise<boolean | void>;
  onRetry?: () => void;
  className?: string;
}

/* Trash (US-23 AC2): a deleted chat that can be restored or deleted for good. */
export interface TrashRowModel {
  /** The trash id (not the session id): what Restore and Delete forever address. */
  id: string;
  title: string;
  /** Local ISO time the chat started, and the time it was deleted. */
  startedAt: string;
  deletedAt: string;
}

export interface TrashViewProps {
  state: HistoryState;
  rows: TrashRowModel[];
  /** A success line above the list ("Restored.", "Deleted for good."). */
  notice?: string;
  /** An action failed: error callout above the list. */
  error?: string;
  /** Local UI a static state can start in: the row whose "Delete forever" confirm is open. */
  ui?: { confirming?: string };
  /** Per-row attributes: first-load stagger and the slide-out of a leaving row (the caller owns the motion). */
  rowMotion?: (id: string, index: number) => HTMLAttributes<HTMLLIElement>;
  /** `li` is the row element, so the caller can move focus before the row leaves. */
  onRestore?: (id: string, li: HTMLElement | null) => void;
  onPurge?: (id: string, li: HTMLElement | null) => void;
  onRetry?: () => void;
}
