/* Rail chat rows (D57, claude.ai sidebar): one quiet line per session, no dates or times. Since 13 the server names a
 * session "Company · Role", "General questions", "English practice" or "Drill · …" (QA-15) and shows older records the
 * same way; this still drops the old "Interview practice" prefix for any title that slips through. Titles the user
 * renamed are kept as they are. */
import { t } from "../i18n";
import type { PendingSave, SaveProgress } from "../lib/pendingSave";
import type { PracticeMode, SessionSummary } from "../lib/types";

/** The practice a saved session belongs to; an unknown or missing mode reads as an interview. */
export function trackOf(mode: SessionSummary["mode"] | undefined): PracticeMode {
  return mode === "english" || mode === "tough" || mode === "negotiate" ? mode : "interview";
}

/** The small text at the end of a Recents row: EN · TQ · PAY (none for interviews) with the full word as its title. */
export function railBadge(track: PracticeMode): { text: string; title: string } | null {
  if (track === "english") return { text: t("rail.badge.english"), title: t("rail.english") };
  if (track === "tough") return { text: t("rail.badge.tough"), title: t("rail.tough") };
  if (track === "negotiate") return { text: t("rail.badge.negotiate"), title: t("rail.negotiate") };
  return null;
}

export interface RailSession {
  id: string;
  title: string;
  track: PracticeMode;
  /** After End the session is still being saved and its debrief written: the row loads (shimmer) until it is ready. */
  pending?: boolean;
  /** How far the server's work is (answers done of the total; the debrief last), when it has said. */
  progress?: SaveProgress;
}

const GENERIC_PREFIX = "Interview practice · ";

export function railTitle(title: string, untitled: string): string {
  const raw = title.trim();
  if (!raw) return untitled;
  if (raw === GENERIC_PREFIX.slice(0, -3)) return t("session.titleGeneral");
  return raw.startsWith(GENERIC_PREFIX) && raw.length > GENERIC_PREFIX.length ? raw.slice(GENERIC_PREFIX.length) : raw;
}

/** Every session, newest first (D52: the rail list is the history; no cap). D80: there is no History page any more, so
 * short sessions show here too; archived ones are only in the Archive. */
export function railSessions(sessions: SessionSummary[], untitled: string): RailSession[] {
  return [...sessions]
    .filter((x) => !x.archived)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .map((x) => ({
      id: x.id,
      title: railTitle(x.title, untitled),
      track: trackOf(x.mode),
    }));
}

/** Recents while sessions are still being saved after End: each one is a row at the top at once (before the server lists
 * it), with its loading state; one the server already lists keeps its own title and place and is only marked. Newest
 * first. A new practice never inherits the numbers of an older one: progress is looked up by id. */
export function withPending(
  rows: RailSession[], pending: readonly PendingSave[], progress: Readonly<Record<string, SaveProgress>>, untitled: string,
): RailSession[] {
  if (!pending.length) return rows;
  const marks = new Map(pending.map((p) => [p.id, p]));
  const marked = rows.map((row) => (marks.has(row.id) ? { ...row, pending: true, progress: progress[row.id] } : row));
  const listed = new Set(rows.map((row) => row.id));
  const added = [...pending]
    .filter((p) => !listed.has(p.id))
    .sort((a, b) => b.at - a.at)
    .map((p): RailSession => ({ id: p.id, title: railTitle(p.title ?? "", untitled), track: p.track ?? "interview", pending: true, progress: progress[p.id] }));
  return [...added, ...marked];
}

/** What the row's loading state says for a screen reader (sighted users see the shimmer and "2 of 5"). */
export function pendingLabel(progress?: SaveProgress): string {
  if (!progress) return t("session.saving");
  return progress.stage === "debrief" ? t("session.debriefPending") : t("rail.pendingPreparing");
}
