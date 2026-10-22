/* Rail chat rows (D57, claude.ai sidebar): one quiet line per session, no dates or times. Since 13 the server names a
 * session "Company · Role", "General questions", "English practice" or "Drill · …" (QA-15) and shows older records the
 * same way; this still drops the old "Interview practice" prefix for any title that slips through. Titles the user
 * renamed are kept as they are. */
import { t } from "../i18n";
import type { SessionSummary } from "../lib/types";

export interface RailSession { id: string; title: string; track: "interview" | "english" }

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
      track: x.mode === "english" ? "english" : "interview",
    }));
}
