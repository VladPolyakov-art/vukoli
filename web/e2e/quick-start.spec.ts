/* D111 Quick start: a button next to the composer starts a call at once. Mike asks "interview or English?"; the answer
 * (typed here, spoken in life) picks the practice, and the session is saved and debriefed as that practice. */
import { expect, test, type Page } from "@playwright/test";
import {
  ANSWER_WITH_RESULT,
  ENGLISH_TURN,
  collectPageErrors,
  conversation,
  denyMicrophone,
  endSession,
  expectNoHorizontalScroll,
  resetApp,
  sendAnswer,
  showDebrief,
  skipSetup,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
  // Typed answers (the "text" input preference): the same call a user without a microphone gets.
  await page.addInitScript(() => window.localStorage.setItem("ic.input", "text"));
});

async function quickStart(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Quick start" }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(conversation(page)).toContainText("Do you want to practise an interview or English today?");
}

test.describe("D111 Quick start", () => {
  test("the button sits by the composer and opens a call with no plan or settings", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Quick start" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Here's the plan" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await quickStart(page);
    await expect(page.getByRole("region", { name: "Here's the plan" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("answering English: an English practice, saved and debriefed as English", async ({ page }) => {
    const errors = collectPageErrors(page);
    await quickStart(page);
    await sendAnswer(page, "English");
    const log = conversation(page);
    await expect(log).toContainText("Great, English practice. What would you like to talk about today?");
    await sendAnswer(page, ENGLISH_TURN);
    await expect(log).toContainText("Mike: That sounds interesting.");
    await (await endSession(page, "End practice")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: "English practice", level: 1 })).toBeVisible();
    await showDebrief(page);
    const corrections = page.getByRole("region", { name: "Corrections" });
    await expect(corrections).toContainText("since five years");
    expect(errors).toEqual([]);
  });

  test("answering interview: general questions, saved and debriefed as an interview", async ({ page }) => {
    const errors = collectPageErrors(page);
    await quickStart(page);
    await sendAnswer(page, "an interview, please");
    const log = conversation(page);
    await expect(log).toContainText("Great, let's do an interview.");
    await expect(log).toContainText("main questions");
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(log).toContainText("You typed: " + ANSWER_WITH_RESULT);
    await (await endSession(page, "End")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: "General questions", level: 1 })).toBeVisible();
    await showDebrief(page);
    await expect(page.getByRole("list", { name: "Session details" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("an unclear answer is asked once more, then it is an interview", async ({ page }) => {
    await quickStart(page);
    await sendAnswer(page, "hmm, not sure");
    await expect(conversation(page)).toContainText("Interview or English?");
    await sendAnswer(page, "you decide");
    await expect(conversation(page)).toContainText("Great, let's do an interview.");
  });

  test("the choice alone is not an answer: End saves nothing", async ({ page, request }) => {
    await quickStart(page);
    await sendAnswer(page, "English");
    await expect(conversation(page)).toContainText("Great, English practice.");
    await page.getByRole("button", { name: /^End/ }).click();
    await expect(page).toHaveURL(/\/session$/);       // nothing to save: it stays for the "no answers" message
    const sessions = await (await request.get("/api/sessions")).json();
    expect(sessions.sessions ?? sessions).toHaveLength(0);
  });

  test("no microphone: the call opens the way a voice start does, and typing works", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem("ic.input"));
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Quick start" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(conversation(page)).toContainText("interview or English");
    // The same help as any voice start (D66): "Mike can't hear you", with "Use text mode".
    const help = page.getByRole("dialog", { name: "Mike can't hear you" });
    await expect(help).toBeVisible();
    await help.getByRole("button", { name: "Use text mode" }).click();
    await sendAnswer(page, "English");
    await expect(conversation(page)).toContainText("Great, English practice.");
  });
});
