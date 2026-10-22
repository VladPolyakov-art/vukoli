/* Rename a saved session: PATCH /api/sessions/{id} {title} (US-23 AC2; the route exists since D80). A failed call is a
 * normal path: the caller puts the old title back. */
import { api } from "../../lib/api";

/** Titles longer than this are cut by the server and by the field (maxLength). */
export const TITLE_MAX = 80;

/** Fired on window when a chat was renamed or moved outside the sidebar: the sidebar reloads Recents. */
export const SESSIONS_CHANGED = "ic:sessions-changed";

export async function renameSession(id: string, title: string): Promise<string> {
  const saved = await api.patchSession(id, { title: title.trim().slice(0, TITLE_MAX) });
  window.dispatchEvent(new Event(SESSIONS_CHANGED));
  return saved.title;
}
