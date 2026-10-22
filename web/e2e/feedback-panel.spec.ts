/* QA-01 / F-13-1: the feedback panel. The first-time hint and the spec promise that feedback shows up by itself after
 * each question; these tests assert exactly that and never open the panel by clicking the toggle (the `showFeedback()`
 * helper does, which is why the first e2e round missed the bug).
 * Wide (>= 1024): the panel opens by itself. Mid and narrow: a dot on the "Show feedback" button says it is ready.
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

/** The toggle in the island: its name says "new feedback is ready" while there is feedback the user has not seen. */
const toggle = (page: Page, state: "unread" | "plain" | "open") =>
  state === "unread"
    ? page.getByRole("button", { name: /^Show feedback \(F\), new feedback is ready$/ })
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

test.describe("US-15 QA-01 Feedback shows up by itself after a question", () => {
  test("wide: the panel opens when the thread's feedback is ready, with no click", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await startTextInterview(page);
    await expect(panelOf(page)).toHaveCount(0); // nothing before there is feedback

    await finishThreadOne(page);

    // No click on the toggle: the hint says "Feedback appears on the right after each question".
    const panel = page.getByRole("complementary", { name: "Feedback" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: /^Question 1 · Your answer \+ 1 follow-up$/ })).toBeVisible();
    await expect(toggle(page, "open")).toBeVisible();
    await expect(toggle(page, "unread")).toHaveCount(0);
  });

  test("wide: the user's own close wins, new feedback then only lights the dot", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await startTextInterview(page);
    await finishThreadOne(page);
    const panel = page.getByRole("complementary", { name: "Feedback" });
    await expect(panel).toBeVisible();

    // The user closes the panel. The next thread's feedback must not fight that.
    await panel.getByRole("button", { name: "Hide feedback (F)" }).click();
    await expect(panel).toHaveCount(0);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
    await expect(toggle(page, "unread")).toBeVisible();
    await expect(panel).toHaveCount(0);

    // Opening it clears the dot and shows the newest feedback; from then on it follows again.
    await toggle(page, "unread").click();
    await expect(panel.getByRole("heading", { name: /^Question 2/ })).toBeVisible();
    await expect(toggle(page, "unread")).toHaveCount(0);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 4", level: 2 })).toBeVisible();
    await expect(panel.getByRole("heading", { name: /^Question 3/ })).toBeVisible();
  });

  for (const [layout, size] of [["mid", MID], ["narrow", NARROW]] as const) {
    test(`${layout}: the stage is not covered; a dot on the feedback button says it is ready`, async ({ page }) => {
      await page.setViewportSize(size);
      await startTextInterview(page);
      await expect(toggle(page, "plain")).toBeVisible();

      await finishThreadOne(page);

      // The sheet does not cover the stage on its own, the button tells.
      await expect(toggle(page, "unread")).toBeVisible();
      await expect(panelOf(page)).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();

      // Opening it shows the feedback and clears the cue.
      await toggle(page, "unread").click();
      const panel = page.getByRole("dialog", { name: "Feedback" });
      await expect(panel.getByRole("heading", { name: /^Question 1 · Your answer \+ 1 follow-up$/ })).toBeVisible();
      await panel.getByRole("button", { name: "Hide feedback (F)" }).click();
      await expect(panelOf(page)).toHaveCount(0);
      await expect(toggle(page, "plain")).toBeVisible();
    });
  }

  test("English talk, wide: the corrections open by themselves after the turn", async ({ page }) => {
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

    const panel = page.getByRole("complementary", { name: "Feedback" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Turn 1", level: 3 })).toBeVisible();
    await expect(panel.getByRole("region", { name: "Language" })).toContainText("since five years");
  });
});
