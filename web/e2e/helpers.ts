/* Shared steps for the specs. The server runs in test mode (IC_E2E=1, see playwright.config.ts): a scripted AI engine
 * stands in for Ollama and `/api/_e2e/*` resets and steers it. Test data is fictional (Alex Morgan, Kestrel Pay). */
import { expect, type APIRequestContext, type Page, type WebSocketRoute } from "@playwright/test";

export const NAME = "Alex";
export const CV_TEXT = "Alex Morgan, product manager at Kestrel Pay. I lead the checkout team of six people.";
export const JOB_TEXT =
  "Product Manager at Kestrel Pay\nYou will own the checkout experience, work with engineering and design, and use data to decide what to build next.";
/** No digit and no number word, so the scripted interviewer finds no result and asks a follow-up. */
export const ANSWER_NO_RESULT =
  "I lead the checkout team and I own the roadmap for payments. Last year I rebuilt the onboarding flow with a designer and I wrote the brief and decided what to cut when we were late.";
/** Has a number: the scripted interviewer moves on to the next question. */
export const ANSWER_WITH_RESULT = "Activation went up by twelve percent in one quarter and support tickets fell by a third.";
/** A number (no follow-up) and one language slip the scripted language layer knows: "since five years". */
export const ANSWER_WITH_SLIP =
  "I am working on this team since five years and activation went up by twelve percent in one quarter.";
/** Two language slips the scripted language layer knows: "since five years" and "I am agree". */
export const ENGLISH_TURN = "I am working on this team since five years and I am agree with the plan.";

export type EngineStatus = "ready" | "not_running" | "no_model" | "not_installed";

/** Wipe the test server's data folder and reset the scripted engine. Every test starts with this. */
export async function resetApp(request: APIRequestContext) {
  const res = await request.post("/api/_e2e/reset");
  expect(res.ok()).toBeTruthy();
}

/** A returning user: a CV, two jobs and three finished interviews (1, 8 and 15 days ago). */
export async function seedReturningUser(request: APIRequestContext) {
  const res = await request.post("/api/_e2e/seed", { data: { fixture: "returning" } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { sessions: { id: string; title: string }[] };
}

/** Take the scripted engine down, make some call kinds fail, or slow it down. */
export async function steerEngine(
  request: APIRequestContext,
  body: { status?: EngineStatus; fail?: string[]; delay_ms?: number },
) {
  const res = await request.post("/api/_e2e/engine", { data: body });
  expect(res.ok()).toBeTruthy();
}

/** US-23 AC4: GET /api/health reports the data folder as not writable until the next reset. */
export async function blockStorage(request: APIRequestContext) {
  const res = await request.post("/api/_e2e/storage", { data: { writable: false } });
  expect(res.ok()).toBeTruthy();
}

/** The wizard has been completed in this browser: `/` opens home instead of redirecting to /setup. */
export async function skipSetup(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("ic.setupDone", "1");
    } catch {
      /* storage blocked: the app falls back to its defaults */
    }
  });
}

/** The microphone is blocked: getUserMedia rejects the way a denied permission prompt does. */
export async function denyMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")) },
    });
  });
}

/** On a phone the sidebar is behind a menu button; on a desktop it is always there. */
export async function openMenu(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  // On a phone the button appears a moment after the page loads: wait for it, or the sidebar is never opened (two
  // different mobile tests timed out on this in full runs, 13).
  if ((page.viewportSize()?.width ?? 1440) < 768) await menu.waitFor({ state: "visible" });
  // Already open (aria-expanded) on a phone: leave it, the button is under the drawer.
  if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
}

export async function goToArchive(page: Page) {
  await openMenu(page);
  await page.getByRole("link", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
}

export async function openSettings(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: /^You/ }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
}

/** From home, with no job saved yet: paste a job, pick the round, and start the interview in text mode. */
export async function startTextInterview(page: Page, round = "Behavioural") {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: round, exact: true }).click();
  await page.getByRole("button", { name: "Nothing else" }).click();
  await expect(page.getByRole("region", { name: "Here's the plan" })).toBeVisible();
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
}

/** "Question 2 of 5" on a desktop, "Q2 of 5" on a phone. */
export function questionCounter(page: Page, n: number, total: number) {
  return page.getByText(new RegExp(`^Q(uestion)? ?${n} of ${total}$`));
}

export async function sendAnswer(page: Page, text: string) {
  // On a phone the feedback panel is a sheet over the session; close it before typing.
  const feedbackDialog = page.getByRole("dialog", { name: "Feedback" });
  if (await feedbackDialog.isVisible()) await feedbackDialog.getByRole("button", { name: "Hide feedback (F)" }).click();
  await page.getByRole("textbox", { name: "Your answer" }).fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

/** The conversation as the user reads it (interview: "Conversation", English: "Transcript"). */
export function conversation(page: Page) {
  return page.getByRole("log", { name: /^(Conversation|Transcript)$/ });
}

/** Open the live feedback panel if it is closed (F). */
export async function showFeedback(page: Page) {
  const show = page.getByRole("button", { name: "Show feedback (F)" });
  if (await show.isVisible()) await show.click();
  // Desktop: a side panel (complementary). Phone: the same panel as a dialog over the session.
  const panel = page.getByRole("complementary", { name: "Feedback" }).or(page.getByRole("dialog", { name: "Feedback" }));
  await expect(panel).toBeVisible();
  return panel;
}

/** End the session and wait for the "saved" toast; returns its "Open debrief" button. */
export async function endSession(page: Page, label: "End" | "End practice" = "End") {
  // On a phone the feedback panel is a dialog over the session; close it before reaching the End button.
  const feedbackDialog = page.getByRole("dialog", { name: "Feedback" });
  if (await feedbackDialog.isVisible()) await feedbackDialog.getByRole("button", { name: "Hide feedback (F)" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  const open = page.getByRole("button", { name: "Open debrief" });
  await expect(open).toBeVisible();
  return open;
}

/** The page must never scroll sideways (G4, 375 px). */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

/** Script errors thrown in the page while the test runs; assert `toEqual([])` at the end. */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** A message the page sends to the session socket (the `start` message is the one the resume tests read). */
export type SocketMessage = { type: string; [key: string]: unknown };

/** The session WebSocket, seen from the browser: everything passes through to the real server, and the test can cut the
 * connection, push a server error into the page, or make the next resume attempt fail. Call before the page opens
 * `/session`. */
export async function watchSessionSocket(page: Page) {
  const pairs: { page: WebSocketRoute; server: WebSocketRoute }[] = [];
  const sent: SocketMessage[] = [];
  let failResume: string | null = null;
  await page.routeWebSocket(/\/ws\/session$/, (route) => {
    if (failResume && pairs.length > 0) {
      // A resume attempt the server refuses: answer in its words and close, without reaching the real server.
      const code = failResume;
      route.onMessage((m) => {
        if (typeof m === "string") sent.push(JSON.parse(m) as SocketMessage);
        route.send(JSON.stringify({ type: "error", code, message: "This session cannot be continued.", retryable: true }));
        void route.close();
      });
      pairs.push({ page: route, server: route });
      return;
    }
    const server = route.connectToServer();
    route.onMessage((m) => {
      if (typeof m === "string") sent.push(JSON.parse(m) as SocketMessage);
      server.send(m);
    });
    server.onMessage((m) => route.send(m));
    pairs.push({ page: route, server });
  });
  return {
    /** What the page has sent, in order. */
    sent,
    starts: () => sent.filter((m) => m.type === "start"),
    /** The voice connection drops: both ends close, so the server saves the session as it would for a closed tab. */
    async drop() {
      const last = pairs.at(-1)!;
      await last.server.close();
      await last.page.close();
    },
    /** The server tells the page the engine failed (the card for an engine that stopped). */
    injectError(code: string, message: string) {
      pairs.at(-1)!.page.send(JSON.stringify({ type: "error", code, message, retryable: true }));
    },
    /** The next socket the page opens is refused with this error code (e.g. resume_unavailable); null lets it through. */
    failNextResume(code: string | null) {
      failResume = code;
    },
  };
}

/** The id of the session the server holds for this test (there is only one), once it has been saved. */
export async function savedSessionId(request: APIRequestContext) {
  let id = "";
  await expect
    .poll(async () => {
      const list = (await (await request.get("/api/sessions")).json()) as { sessions: { id: string }[] };
      id = list.sessions[0]?.id ?? "";
      return id;
    })
    .not.toBe("");
  return id;
}
