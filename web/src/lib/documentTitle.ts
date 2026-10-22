/* The tab title says where you are (QA-11, WCAG 2.4.2): "Archive · Vukoli", the session name for a debrief, plain
 * "Vukoli" for Home. The session screen writes its own title ("Question 2 of 5 · Company") and restores the previous one. */
import { useEffect } from "react";
import { t } from "../i18n";

/** "<page> · Vukoli", or just "Vukoli" when there is no page part. */
export function pageTitle(page?: string | null): string {
  const app = t("app.name");
  const part = page?.trim();
  return part ? t("app.pageTitle", { page: part, app }) : app;
}

/** Sets `document.title` (`undefined` = just the app name, `null` = do nothing) for the life of the screen. `restore`: put the previous title back on leave (a popup over a
 * page, like Settings); pages do not restore, because during a route swap the old page leaves after the new one mounts. */
export function useDocumentTitle(page?: string | null, restore = false) {
  useEffect(() => {
    if (page === null) return; // `null` = leave the title alone (a popup that is closed)
    const prev = document.title;
    document.title = pageTitle(page);
    return restore ? () => { document.title = prev; } : undefined;
  }, [page, restore]);
}
