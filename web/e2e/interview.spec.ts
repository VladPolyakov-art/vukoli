/* Flow B: a text interview. A question, follow-ups, no feedback during the call (D96), End, the debrief with all of it.
 * US-10 (tailored questions), US-13 (session), US-14 (follow-ups), US-15 (feedback panel), US-20 (debrief). */
import { expect, test } from "@playwright/test";
import {
  ANSWER_NO_RESULT,
  ANSWER_WITH_RESULT,
  ANSWER_WITH_SLIP,
  collectPageErrors,
  conversation,
  endSession,
  questionCounter,
  resetApp,
  sendAnswer,
  debriefCard,
  showDebrief,
  viewer,
  showFeedbackLater,
  skipSetup,
  startTextInterview,
  openMenu,
  steerEngine,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

test.describe("US-14 / US-15 / US-20 A text interview", () => {
  test("happy path: answer, follow-up, no feedback during the call, end, debrief with the feedback", async ({ page }) => {
    const errors = collectPageErrors(page);
    await startTextInterview(page);

    // US-10: the first question is put by Mike, from a bank or from the job.
    await expect(page.getByRole("heading", { name: "Question 1", level: 2 })).toBeVisible();
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible(); // 09-D4: the timer is always visible

    // US-14 AC1: an answer with no result gets a follow-up that targets the gap.
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_NO_RESULT}`);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();
    await expect(questionCounter(page, 1, 5)).toBeVisible(); // still the same question thread

    // The follow-up is answered with a number, and Mike moves on (AC3: a complete answer gets no forced follow-up).
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await expect(questionCounter(page, 2, 5)).toBeVisible();

    // D96: Mike goes on at once and makes no feedback during the call; the panel says it comes after.
    const panel = await showFeedbackLater(page);
    await expect(panel).toContainText("Feedback comes after the call");
    await expect(panel.getByRole("list", { name: "Summary" })).toHaveCount(0);

    // Two more questions answered with a result, then the session ends.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 4", level: 2 })).toBeVisible();

    // US-20: End saves the session; the debrief opens from the toast, with a verdict and the questions.
    const openDebrief = await endSession(page);
    await expect(page.getByText("Your session is saved")).toBeVisible();
    await openDebrief.click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: /^Kestrel Pay · Product Manager$/, level: 1 })).toBeVisible();
    await showDebrief(page); // the page opens on the debrief (D101); the call only makes sure
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible(); // AC1: the verdict is on top of the debrief
    await expect(page.getByRole("list", { name: "Session details" })).toContainText("1 follow-up");
    await expect(page.getByRole("link", { name: "Saved on this computer" })).toBeVisible(); // AC5
    // AC3: a question card shows the question, the user's answer and the layer results.
    await expect(viewer(page).getByRole("tablist", { name: "Questions from this interview" }).getByRole("tab")).toHaveCount(3); // answered
    await expect(viewer(page).getByRole("article")).toContainText(ANSWER_NO_RESULT);
    await expect(viewer(page).getByRole("article").getByText("Content", { exact: true }).first()).toBeVisible();
    // US-15 AC1 (D96: made after the call): one card for the whole thread, three layers, one fix at most each.
    const card = await debriefCard(page, 1);
    await expect(card).toContainText("Finish with what happened");
    // AC3 (layout D): a layer with nothing to fix is left out of the list instead of getting an invented fix; the line
    // "Nothing to fix in this answer." stands only when no layer has a note at all.
    await expect(card.getByText("Language", { exact: true })).toHaveCount(0);
    await expect(card).not.toContainText("Nothing to fix");
    // US-19: delivery in text mode says what is not available.
    await expect(card).toContainText("Pace and fillers aren't available in text mode.");
    expect(errors).toEqual([]);
  });

  test("D73: End goes Home at once, the session loads in Recents (no 'Saving' toast), then a toast opens the debrief view", async ({
    page,
    request,
  }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await steerEngine(request, { delay_ms: 1500 }); // the feedback after the call takes a few seconds

    await page.getByRole("button", { name: "End", exact: true }).click();
    // Home right away: no full-screen "Saving your session…", no toast about saving.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/Saving your session|Writing your debrief/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open debrief" })).toHaveCount(0);

    // The session is the top row of Recents at once and shimmers while the server works; the row is a link.
    await openMenu(page);
    const row = page.getByRole("link", { name: /Kestrel Pay/ }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('[aria-busy="true"]')).toHaveCount(1);
    if (await page.getByRole("button", { name: "Open menu" }).isVisible()) await page.keyboard.press("Escape");

    // Ready: one toast with the way in; the row stops loading; Open lands on the debrief view of the session page.
    const open = page.getByRole("button", { name: "Open debrief" });
    await expect(open).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Your session is saved")).toBeVisible();
    await open.click();
    await expect(page).toHaveURL(/\/sessions\/s-[^?]+\?view=debrief$/);
    await expect(viewer(page).getByRole("article")).toContainText(ANSWER_WITH_RESULT);
    await openMenu(page);
    await expect(page.getByRole("link", { name: /Kestrel Pay/ }).first().locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("D73: a new practice started while another is still saving inherits nothing of it, the old one keeps loading in Recents", async ({
    page,
    request,
  }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await steerEngine(request, { delay_ms: 5000 });
    await page.getByRole("button", { name: "End", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    await startTextInterview(page);
    await expect(page.getByRole("heading", { name: "Question 1", level: 2 })).toBeVisible();
    // Nothing of the older session on screen: no toast, no saving line, no full-screen state.
    await expect(page.getByRole("button", { name: "Open debrief" })).toHaveCount(0);
    await expect(page.getByText(/Saving your session|Writing your debrief/)).toHaveCount(0);
    // The session screen has no sidebar: back Home, the older session is still the loading row (a reload keeps watching it).
    await page.goto("/");
    await openMenu(page);
    await expect(page.getByRole("link", { name: /Kestrel Pay/ }).first().locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Open debrief" })).toHaveCount(0);
  });

  test("the session is in the history after it ends (US-21 AC1)", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await endSession(page);
    // Recents lists it by company and role; on a phone the list is behind the menu button.
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    await expect(page.getByRole("link", { name: /Kestrel Pay/ })).toBeVisible();
  });

  test("negative: a session with fewer than 3 answers gets no verdict, only the question cards (US-20 AC4)", async ({
    page,
  }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();

    await (await endSession(page)).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("status").filter({ hasText: "Not enough answers for a verdict" })).toContainText(
      "You answered 2 of 5 questions. Answer at least 3",
    );
    await expect(viewer(page).getByRole("article")).toBeVisible();
    await expect(page.locator("[data-review-id='Debrief/Plan']")).toHaveCount(0);
    await expect(page.locator("[data-review-id='Debrief/Level']")).toHaveCount(0);
  });

  test("negative: the model fails on the content and language layers after the call, the answer is still saved (US-15 AC5)", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { fail: ["p2a", "p2b"] }); // the content and language layers fail on purpose
    await startTextInterview(page);

    // D96: nothing is made during the call, so the failure cannot reach the session: Mike moves on at once.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await expect(await showFeedbackLater(page)).toContainText("Feedback comes after the call");

    // The session is not stuck: the next answer is accepted, and the first answer is still in the conversation.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_RESULT}`);
    await (await endSession(page)).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(viewer(page).getByRole("article")).toContainText(ANSWER_WITH_RESULT);
  });

  test("negative: when a layer cannot be made the debrief says so instead of 'Nothing to fix' or 'Good' (US-15 AC5)", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { fail: ["p2a", "p2b"] });
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible(); // Mike moves on
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await (await endSession(page)).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    const card = await debriefCard(page, 1);
    // The debrief shows no made-up fix for the layers that failed: they are left out, and delivery (computed locally) reports.
    await expect(card.getByText("Content", { exact: true })).toHaveCount(0);
    await expect(card.getByText("Language", { exact: true })).toHaveCount(0);
    await expect(card).not.toContainText("Nothing to fix");
    await expect(card.getByText("Delivery", { exact: true }).first()).toBeVisible();
    await expect(card).not.toContainText("Good");
  });

  test("a language slip is a weak spot in the debrief, with a reason (US-17 AC1, US-20 AC1)", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await (await endSession(page)).click();

    const card = await debriefCard(page, 1);
    await expect(card).toContainText("since five years");
    await expect(card).toContainText("for five years");
    await expect(card).toContainText("Use 'for' with periods of time"); // the reason is explained (US-17 AC1)
    await expect(page.locator("[data-review-id='Debrief/Plan']")).toContainText("Prepositions"); // the Language step, named by its weak spot
  });

  test("negative: a correction the user dismisses is not counted in the debrief (US-17 AC2, US-22 AC3)", async ({
    page,
  }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await (await endSession(page)).click();

    const card = await debriefCard(page, 1);
    await expect(card).toContainText("since five years");
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card.getByText("You typed")).toHaveCount(0);
    await expect(page.locator("[data-review-id='Debrief/Plan']")).not.toContainText("Prepositions");
  });

  test("boundary: an empty answer cannot be sent", async ({ page }) => {
    await startTextInterview(page);
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeDisabled();
    await page.getByRole("textbox", { name: "Your answer" }).fill("   ");
    await expect(send).toBeDisabled();
    await page.getByRole("textbox", { name: "Your answer" }).fill("Some words.");
    await expect(send).toBeEnabled();
  });
});

test.describe("US-15 D96 The first-time hint says feedback comes after the call", () => {
  const WORDING = "Feedback comes after the call, so Mike stays fast.";
  for (const [layout, width] of [["narrow", 375], ["mid", 900], ["wide", 1440]] as const) {
    test(`${layout} layout (${width} px): one line, the same everywhere`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await startTextInterview(page);
      const measured = await page.locator("[data-layout]").first().getAttribute("data-layout");
      expect(measured).toBe(layout);
      const tips = page.getByText("First time here").locator("xpath=ancestor::div[1]");
      await expect(tips).toContainText(WORDING);
      await expect(tips).not.toContainText("dot shows");
      await expect(tips).not.toContainText("slides");
    });
  }
});

test.describe("US-18 AC3 Edit my answer", () => {
  test("happy path: correct the typed answer in the debrief, only that answer is checked again", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await (await endSession(page)).click();
    const card = await debriefCard(page, 1);
    await expect(card).toContainText("since five years");

    // D96: there is nothing to edit during the call (no feedback yet); the editor lives in the debrief.
    await card.getByRole("button", { name: "Edit what I said" }).click();
    const fixed = "I have worked on this team for five years and activation went up by twelve percent in one quarter.";
    await card.getByRole("textbox").fill(fixed);
    await card.getByRole("button", { name: "Save and check again" }).click();

    await expect(card).toContainText(fixed);
    await expect(card).not.toContainText("since five years");
    await expect(card.getByText("Edited by you")).toBeVisible();
  });
});
