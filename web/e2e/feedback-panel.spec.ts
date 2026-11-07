/* D107 (2026-11-07): there is no feedback panel in the call. Feedback comes only after the session, in the debrief
 * (D96 made none during the call; D107 removed the button, the F key and the panel). On every layout the session has no
 * "Show feedback" button, no panel, drawer or sheet, F opens nothing, and the shortcuts list no longer mentions it. */
import { expect, test } from "@playwright/test";
import {
  ANSWER_NO_RESULT,
  ANSWER_WITH_RESULT,
  ENGLISH_TURN,
  expectNoFeedbackPanel,
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

test.describe("D107 No feedback panel in the call", () => {
  for (const [layout, size] of [["wide", WIDE], ["mid", MID], ["narrow", NARROW]] as const) {
    test(`${layout}: no Show feedback button, no panel, F opens nothing, before and after an answer`, async ({ page }) => {
      await page.setViewportSize(size);
      await startTextInterview(page);
      await expectNoFeedbackPanel(page);

      await sendAnswer(page, ANSWER_NO_RESULT);
      await expect(page.getByText("Follow-up", { exact: true })).toBeVisible();
      await sendAnswer(page, ANSWER_WITH_RESULT);
      await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();

      // Mike went on at once; nothing about feedback appeared on the stage.
      await expectNoFeedbackPanel(page);
      await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
    });
  }

  test("the keyboard shortcuts list has no F row", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await startTextInterview(page);
    await page.getByRole("button", { name: "Shortcuts and microphone help (?)" }).click();
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText("feedback");
  });

  test("English talk, wide: no corrections and no panel during the call", async ({ page }) => {
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

    await expectNoFeedbackPanel(page);
  });
});
