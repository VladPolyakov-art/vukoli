/* D104: what the window the user installed from does once the browser accepted the install. Chrome opens the installed
 * app in a NEW window; this window waits for that window to say hello (lib/windowLink.ts) and closes itself, with no
 * screen in between. It resolves when this window is STILL here, which means one of three things: the new window never
 * said hello within HELLO_WAIT_MS, the browser refused `window.close()`, or the new window did not close it in time.
 * The caller then simply continues setup here. */
import { waitForOtherWindow, type WindowLink } from "../../lib/windowLink";

/** How long the new window gets to say hello before this one carries on by itself. */
export const HELLO_WAIT_MS = 4000;
/** How long `window.close()` gets before it counts as refused. */
export const CLOSE_GRACE_MS = 500;

export interface HandOffOptions {
  link: WindowLink;
  /** When Install was pressed: only a window that loaded after this counts. */
  since: number;
  closeWindow?: () => void;
  helloWaitMs?: number;
  closeGraceMs?: number;
}

export async function handOffToInstalledApp({
  link, since, closeWindow = () => window.close(), helloWaitMs = HELLO_WAIT_MS, closeGraceMs = CLOSE_GRACE_MS,
}: HandOffOptions): Promise<void> {
  const seen = await waitForOtherWindow(link, { since, waitMs: helloWaitMs });
  if (!seen) return;
  try { closeWindow(); } catch { return; }
  // A closed window never gets past this line; one that is refused does.
  await new Promise<void>((resolve) => setTimeout(resolve, closeGraceMs));
}
