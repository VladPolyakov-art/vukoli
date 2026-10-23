/* D96: the feedback panel during the call. Feedback is made after the call (so Mike stays fast and nothing competes
 * with him for the machine): the panel never opens by itself, no dot lights up, and when the user opens it by hand it
 * says one calm thing, with no spinner and no per-answer waiting. After End the debrief carries all of it.
 * US-15 AC1 / AC2, US-24 AC3. */
import { expect, test, type Page } from "@playwright/test";
import {
  ANSWER_NO_RESULT,
  ANSWER_WITH_RESULT,
  ENGLISH_TURN,
  resetApp,
  sendAnswer,
  skipSetup,
  startTextInterview,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const WIDE = { width: 1440, height: 900 };
const MID = { width: 900, height: 900 };
const NARROW = { width: 375, height: 812 };

/** The toggle in the island: with no feedback made during the call it never says "new feedback is ready". */
const toggle = (page: Page, state: "unread" | "plain" | "open") =>
  state === "unread"
    ? page.getByRole("button", { name: /new feedback is ready/ })
    : state === "plain"
      ? page.getByRole("button", { name: "Show feedback (F)", exact: true })
      : // The panel has its own hide button with the same name: look at the island's.
        page.getByRole("group", { name: "Tools" }).getByRole("button", { name: "Hide feedback (F)", exact: true });

/** Wide: the floating panel; mid: a drawer; narrow: a sheet (both are a dialog). */
const panelOf = (page: Page) =>
  page.getByRole("complementary", { name: "Feedback" }).or(page.getByRole("dialog", { name: "Feedback" }));

/** One finished question thread: an answer with no result, Mike's follow-up, an answer with a number, Question 2. */
async function finishThreadOne(page: Page) {
  await sendAnswer(page, ANSWER_NO_RESULT);
  await expect(page.getByText("Follow-up", { exact: true })).toBeVisible();
  await sendAnswer(page, ANSWER_WITH_RESULT);
  await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
}

test.describe("US-15 D96 Feedback comes after the call", () => {
  for (const [layout, size] of [["wide", WIDE], ["mid", MID], ["narrow", NARROW]] as const) {
    test(`${layout}: nothing opens by itself and no dot lights up after a question`, async ({ page }) => {
      await page.setViewportSize(size);
      await startTextInterview(page);
      await expect(toggle(page, "plain")).toBeVisible();
      await expect(panelOf(page)).toHaveCount(0);

      await finishThreadOne(page);

      // Mike went on at once; the panel did not open and the button has no cue.
      await expect(panelOf(page)).toHaveCount(0);
      await expect(toggle(page, "unread")).toHaveCount(0);
      await expect(toggle(page, "plain")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
    });

    test(`${layout}: opened by hand, the panel says feedback comes after the call, with no spinner`, async ({ page }) => {
      await page.setViewportSize(size);
      await startTextInterview(page);
      await finishThreadOne(page);

      await toggle(page, "plain").click();
      const panel = panelOf(page);
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Feedback comes after the call");
      await expect(panel).toContainText("Mike stays fast");
      await expect(panel.getByRole("list", { name: "Summary" })).toHaveCount(0);
      await expect(panel.getByRole("status")).toHaveCount(0);
      await expect(panel.getByRole("heading", { name: /^Question 1/ })).toHaveCount(0);

      // It closes like any panel.
      await panel.getByRole("button", { name: "Hide feedback (F)" }).click();
      await expect(panelOf(page)).toHaveCount(0);
      await expect(toggle(page, "plain")).toBeVisible();
    });
  }

  test("English talk, wide: no corrections during the call, the panel waits for the debrief", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/");
    await page.getByRole("button", { name: "Practise English" }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: /^B1/ }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Talk about your work" }).click();
    await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole("log", { name: "Transcript" })).toContainText("your English practice partner");

    await sendAnswer(page, ENGLISH_TURN);
    await expect(page.getByText("Turn 2")).toBeVisible();

    await expect(panelOf(page)).toHaveCount(0);
    await toggle(page, "plain").click();
    await expect(panelOf(page)).toContainText("Feedback comes after the call");
    await expect(panelOf(page)).not.toContainText("since five years");
  });
});
