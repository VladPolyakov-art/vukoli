/* History fixtures: docs/ia.md §6 (Alex Morgan, Product Designer; sessions S1–S3). All fictional. The overflow set is
 * separate from the S1–S3 mock so `data` keeps invariant 1 (ds/screens/_index.md §2). "Today" is fixed. */
import type { HistoryRowModel, TrashRowModel } from "./types";

const LONG_TITLE_TRASH = "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools";

/** Tue Oct 20, 2026: S2 (Oct 19) is "This week", S1 and S3 are "Last week". */
export const HISTORY_NOW = new Date(2026, 9, 20, 12, 0);

export const S2: HistoryRowModel = {
  id: "s2", title: "Kestrel Pay · Senior Product Designer", track: "interview", round: "Behavioural · Standard",
  startedAt: "2026-10-19T20:40:00", durationS: 24 * 60, result: "Getting there",
  question: "Tell me about a design decision you changed after seeing the data.",
};
export const S3: HistoryRowModel = {
  id: "s3", title: "English · Talk about your work", track: "english", round: "B2",
  startedAt: "2026-10-18T21:05:00", durationS: 11 * 60, result: "5 corrections",
};
/** 🟡 The S1 verdict is not in the mock; "Not ready yet" is a placeholder. */
export const S1: HistoryRowModel = {
  id: "s1", title: "Lumen Health · Product Designer, Design Systems", track: "interview", round: "HR screen · Gentle",
  startedAt: "2026-10-17T19:10:00", durationS: 14 * 60, result: "Not ready yet",
  question: "Why do you want to move from agency work to a product team?",
};

/** Trash: two deleted chats, one with a long title. Fictional (Alex Morgan, Kestrel Pay). */
export const trashData: TrashRowModel[] = [
  { id: "t2", title: "Kestrel Pay · Senior Product Designer", startedAt: "2026-10-16T18:30:00", deletedAt: "2026-10-19T09:12:00" },
  { id: "t1", title: LONG_TITLE_TRASH, startedAt: "2026-10-12T20:00:00", deletedAt: "2026-10-18T22:40:00" },
];

export const historyData: HistoryRowModel[] = [S2, S3, S1];

/** `renaming` state: the Lumen row is being renamed. */
export const RENAMING_ID = S1.id;
export const RENAMING_VALUE = "Lumen Health · HR screen, first try";

export const LONG_TITLE = "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools";

/** Seven rows, +30% text (stress). */
export const historyOverflow: HistoryRowModel[] = [
  {
    id: "o1", title: "Kestrel Pay · Senior Product Designer", track: "interview", round: "Behavioural · Standard",
    startedAt: "2026-10-20T08:15:00", durationS: 6 * 60, result: "No verdict — 2 of 5 answered",
    question: "Walk me through your career so far.", short: true,
  },
  S2,
  S3,
  {
    id: "o2", title: "Lumen HR screen — calmer second try", track: "interview", round: "HR screen · Gentle",
    startedAt: "2026-10-16T18:30:00", durationS: 13 * 60, result: "Getting there",
  },
  {
    id: "o3", title: LONG_TITLE, track: "interview", round: "Behavioural · Tough",
    startedAt: "2026-10-09T10:20:00", durationS: 27 * 60, result: "Not ready yet",
  },
  {
    id: "o4", title: "English · Explaining a delayed release to a client without sounding defensive", track: "english", round: "C1",
    startedAt: "2026-10-11T17:45:00", durationS: 18 * 60, result: "8 corrections",
  },
  S1,
];
