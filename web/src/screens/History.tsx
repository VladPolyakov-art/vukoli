/* Archive (D80; was History): archived chats, the live container of `history/HistoryView`, and the trash (soft
 * delete with restore, Delete forever after a confirm: US-23 AC2; the view is `history/TrashView`). Recents in the sidebar hold every other chat. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { durationMs, useFreshOnce, useToast } from "../ds";
import { t, tp } from "../i18n";
import { api } from "../lib/api";
import { useLoad } from "../lib/hooks";
import { errorMessage } from "../lib/store";
import type { SessionSummary } from "../lib/types";
import { renameSession, SESSIONS_CHANGED } from "./debrief/rename";
import { HistoryView } from "./history/HistoryView";
import { TrashView } from "./history/TrashView";
import type { HistoryRowModel, TrackFilter, TrashRowModel } from "./history/types";

/* ---------- row motion (docs/motion.md 3.4: rows enter staggered once, a removed row slides out) ---------- */

/** Rows stagger in on the first load only (40ms apart, capped so a long list is not slow); later rows just appear. */
const STAGGER_CAP = 8;
function useFirstLoadStagger(ready: boolean) {
  const played = useRef(false);
  const stagger = !played.current;
  useEffect(() => {
    if (ready) played.current = true;
  }, [ready]);
  return (i: number) => (stagger ? { className: "motion-row", style: { "--row-i": Math.min(i, STAGGER_CAP) } as CSSProperties } : {});
}

/** Before a row leaves, focus moves to the next row's control, else the previous one, else the page title (rule 5). */
function focusAfter(li: HTMLElement | null) {
  let next = li?.nextElementSibling as HTMLElement | null;
  while (next?.dataset.leaving) next = next.nextElementSibling as HTMLElement | null;
  let prev = li?.previousElementSibling as HTMLElement | null;
  while (prev?.dataset.leaving) prev = prev.previousElementSibling as HTMLElement | null;
  const target = (next ?? prev)?.querySelector<HTMLElement>("a, button")
    ?? li?.closest("main")?.querySelector<HTMLElement>("h1") ?? null;
  if (!target) return;
  if (target.tagName === "H1") target.tabIndex = -1;
  target.focus();
}

/** A removed row plays row-out, then leaves the list; focus has already moved on, so nothing waits on the animation. */
function useRowExit(remove: (id: string) => void) {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  const exit = (id: string, li: HTMLElement | null) => {
    focusAfter(li);
    setLeaving((prev) => new Set(prev).add(id));
    timers.current.push(window.setTimeout(() => {
      remove(id);
      setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, durationMs("--duration-exit")));
  };
  const rowProps = (id: string) => (leaving.has(id) ? { "data-leaving": "true", inert: true, className: "motion-row-out" } : {});
  return { exit, rowProps };
}

/** The saved summary carries a verdict sentence, an answer count and the first question; the row shows what it has.
 * D69: a session with fewer than 3 answers is "short": no verdict sentence, "2 of 5 answered", folded in its week. */
export function rowFromSummary(x: SessionSummary): HistoryRowModel {
  const english = x.mode === "english";
  const short = !english && (Boolean(x.too_short) || (x.answers < 3 && !x.verdict));
  const result = short
    ? x.planned ? t("history.result.partial", { answered: x.answers, total: x.planned }) : tp("history.result.answered", x.answers)
    : x.verdict || (x.answers > 0 ? tp("history.result.answered", x.answers) : t("history.result.noDebrief"));
  return {
    id: x.id,
    title: x.title || t("debrief.title"),
    track: english ? "english" : "interview",
    startedAt: x.started_at,
    durationS: x.duration_s ?? undefined,
    result,
    question: x.first_question || undefined,
    short,
  };
}

const parseTrack = (v: string | null): TrackFilter => (v === "interview" || v === "english" ? v : "all");
/** Rows stagger in once per visit (motion.md N10), not on every return to the list. */
const seen = new Set<string>();

export function ArchiveScreen() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [notice, setNotice] = useState("");
  const list = useLoad(() => api.sessions());
  const trashed = useLoad(() => api.trash());
  const fresh = useFreshOnce(seen, "history");
  const now = useMemo(() => new Date(), []);
  const rows = useMemo(() => (list.data?.sessions ?? []).filter((x) => x.archived).map(rowFromSummary), [list.data]);
  const drop = (id: string) => list.setData((d) => (d ? { ...d, sessions: d.sessions.filter((x) => x.id !== id) } : d));
  const changed = () => window.dispatchEvent(new Event(SESSIONS_CHANGED));

  const undo = (trashId: string) => {
    api.restoreSession(trashId)
      .then(() => { list.reload(); trashed.reload(); changed(); })
      .catch((e: unknown) => setNotice(errorMessage(e)));
  };
  const showTrashed = (trashId: string) => {
    toast.show({ message: t("history.toast.trashed"), action: trashId ? { label: t("common.undo"), onClick: () => undo(trashId) } : undefined });
  };

  const onTrash = async (id: string) => {
    setNotice("");
    try {
      const { trash_id } = await api.deleteSession(id);
      drop(id);
      trashed.reload();
      showTrashed(trash_id);
      return true;
    } catch (e) {
      setNotice(`${rows.find((r) => r.id === id)?.title ?? ""}: ${errorMessage(e)}`.replace(/^: /, ""));
      return false;
    }
  };
  const onUnarchive = async (id: string) => {
    setNotice("");
    try {
      await api.patchSession(id, { archived: false });
      drop(id);
      changed();
      toast.show({ message: t("history.toast.unarchived"), action: { label: t("common.undo"), onClick: () => { api.patchSession(id, { archived: true }).then(() => { list.reload(); changed(); }, (e: unknown) => setNotice(errorMessage(e))); } } });
      return true;
    } catch (e) {
      setNotice(errorMessage(e));
      return false;
    }
  };
  const onRename = async (id: string, title: string) => {
    setNotice("");
    try {
      const saved = await renameSession(id, title);
      list.setData((d) => (d ? { ...d, sessions: d.sessions.map((x) => (x.id === id ? { ...x, title: saved } : x)) } : d));
      return true;
    } catch {
      setNotice(t("history.toast.renameFailed"));
      return false;
    }
  };

  return (
    <HistoryView
      state={list.error ? "error" : list.loading && !list.data ? "loading" : "ready"}
      rows={rows}
      now={now}
      track={parseTrack(params.get("track"))}
      onTrackChange={(next) => setParams(next === "all" ? {} : { track: next }, { replace: true })}
      trashCount={trashed.data?.items.length ?? 0}
      enterStagger={fresh}
      notice={notice || undefined}
      onTrash={onTrash}
      onUnarchive={onUnarchive}
      onRename={onRename}
      onRetry={list.reload}
    />
  );
}

export function TrashScreen() {
  const list = useLoad(() => api.trash());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const enter = useFirstLoadStagger(Boolean(list.data));
  const exits = useRowExit((id) => list.setData((d) => (d ? { ...d, items: d.items.filter((x) => x.trash_id !== id) } : d)));
  const rows = useMemo<TrashRowModel[]>(
    () => (list.data?.items ?? []).map((x) => ({ id: x.trash_id, title: x.title || t("debrief.title"), startedAt: x.started_at, deletedAt: x.deleted_at })),
    [list.data],
  );

  /** Restore and Delete forever: the row leaves on success, an error shows above the list otherwise. */
  const act = (call: (id: string) => Promise<unknown>, done: string) => async (trashId: string, li: HTMLElement | null) => {
    setError("");
    setNotice("");
    try {
      await call(trashId);
      setNotice(done);
      exits.exit(trashId, li);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <TrashView
      state={list.error && !list.data ? "error" : list.loading && !list.data ? "loading" : "ready"}
      rows={rows}
      notice={notice}
      error={error}
      rowMotion={(id, i) => ({ ...enter(i), ...exits.rowProps(id) })}
      onRestore={act((id) => api.restoreSession(id).then(() => window.dispatchEvent(new Event(SESSIONS_CHANGED))), t("history.restored"))}
      onPurge={act((id) => api.purgeSession(id), t("history.purged"))}
      onRetry={list.reload}
    />
  );
}
