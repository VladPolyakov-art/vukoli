/* Flow B: a text interview. A question, follow-ups, one feedback panel per question thread, End, the debrief.
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
  showFeedback,
  skipSetup,
  startTextInterview,
  steerEngine,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

test.describe("US-14 / US-15 / US-20 A text interview", () => {
  test("happy path: answer, follow-up, per-thread feedback, end, debrief", async ({ page }) => {
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

    // US-15 AC1: one panel for the whole thread (main answer + its follow-up), three layers, one fix at most each.
    const panel = await showFeedback(page);
    await expect(panel.getByRole("heading", { name: /^Question 1 · Your answer \+ 1 follow-up$/ })).toBeVisible();
    const summary = panel.getByRole("list", { name: "Summary" });
    await expect(summary).toContainText("Content");
    await expect(summary).toContainText("Language");
    await expect(summary).toContainText("Delivery");
    await expect(panel.getByRole("region", { name: "Content" })).toContainText("Finish with what happened");
    // AC3: a layer with nothing to fix says so in one line instead of inventing a fix.
    await expect(panel.getByRole("region", { name: "Language" })).toContainText("Nothing to fix in this answer.");
    // US-19: delivery in text mode shows the length and says what is not available.
    await expect(panel.getByRole("region", { name: "Delivery" })).toContainText("Pace and fillers aren't available in text mode.");

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
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible(); // AC1: the verdict is on top
    await expect(page.getByRole("list", { name: "Session details" })).toContainText("1 follow-up");
    await expect(page.getByRole("link", { name: "Saved on this computer" })).toBeVisible(); // AC5
    // AC3: a question card shows the question, the user's answer and the layer results.
    const breakdown = page.getByRole("region", { name: "Breakdown" });
    await expect(breakdown.getByRole("radiogroup", { name: "Question" }).getByRole("radio")).toHaveCount(3); // answered
    await expect(breakdown.getByRole("article")).toContainText(ANSWER_NO_RESULT);
    await expect(breakdown.getByRole("heading", { name: "Content", level: 4 })).toBeVisible();
    expect(errors).toEqual([]);
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
    await expect(page.getByRole("region", { name: "Breakdown" }).getByRole("article")).toBeVisible();
    await expect(page.getByRole("region", { name: "What to work on" })).toHaveCount(0);
  });

  test("negative: the model fails on the content and language layers, the session goes on and the answer is saved (US-15 AC5)", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { fail: ["p2a", "p2b"] }); // the content and language layers fail on purpose
    await startTextInterview(page);

    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    const panel = await showFeedback(page);
    // The panel is still there and the layer that could not be made is marked, not given a made-up fix.
    await expect(panel.getByRole("list", { name: "Summary" })).toContainText("Content · n/a");
    await expect(panel.getByRole("region", { name: "Delivery" })).toContainText("words");

    // The session is not stuck: the next answer is accepted, and the first answer is still in the conversation.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_RESULT}`);
    await (await endSession(page)).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("region", { name: "Breakdown" }).getByRole("article")).toContainText(ANSWER_WITH_RESULT);
  });

  test("negative: when a layer cannot be made the live panel says so instead of 'Nothing to fix' or 'Good' (US-15 AC5)", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { fail: ["p2a", "p2b"] });
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    const panel = await showFeedback(page);
    for (const layer of ["Content", "Language"]) {
      const block = panel.getByRole("region", { name: layer });
      await expect(block).toContainText("Not available for this answer.");
      await expect(block).not.toContainText("Nothing to fix");
    }
    // The summary chips say n/a, never Good; delivery (computed locally) still reports.
    const summary = panel.getByRole("list", { name: "Summary" });
    await expect(summary).toContainText("Content · n/a");
    await expect(summary).toContainText("Language · n/a");
    await expect(summary).not.toContainText("Good");
    // Mike moves on and the session is not stuck.
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
  });

  test("a language slip is a weak spot in the debrief, with a reason (US-17 AC1, US-20 AC1)", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    const language = (await showFeedback(page)).getByRole("region", { name: "Language" });
    await expect(language).toContainText("since five years");
    await expect(language).toContainText("for five years");
    await expect(language).toContainText("Use 'for' with periods of time"); // the reason is explained (US-17 AC1)

    await sendAnswer(page, ANSWER_WITH_RESULT);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await (await endSession(page)).click();
    await page.getByRole("button", { name: /^Verdict/ }).click();
    await expect(page.getByRole("region", { name: "What to work on" })).toContainText("Language");
  });

  test("negative: a correction the user dismisses is not counted in the debrief (US-17 AC2, US-22 AC3)", async ({
    page,
  }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    const language = (await showFeedback(page)).getByRole("region", { name: "Language" });
    await expect(language).toContainText("since five years");
    await language.getByRole("button", { name: "I wrote it right" }).click();
    await expect(language).not.toContainText("since five years");

    await sendAnswer(page, ANSWER_WITH_RESULT);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await (await endSession(page)).click();
    await page.getByRole("button", { name: /^Verdict/ }).click();
    await expect(page.getByRole("region", { name: "What to work on" })).not.toContainText("Language");
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

test.describe("US-15 The first-time hint names where feedback appears", () => {
  const WORDING = {
    wide: "Feedback appears on the right after each question.",
    mid: "a dot shows on the feedback button. Press it and the feedback slides in from the right.",
    narrow: "a dot shows on the feedback button. Press it and the feedback slides up from the bottom.",
  } as const;
  for (const [layout, width] of [["narrow", 375], ["mid", 900], ["wide", 1440]] as const) {
    test(`${layout} layout (${width} px): the hint matches where the panel opens`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await startTextInterview(page);
      // The session reports the layout it measured; the hint must follow it, not the viewport.
      const measured = await page.locator("[data-layout]").first().getAttribute("data-layout");
      expect(measured).toBe(layout);
      const tips = page.getByText("First time here").locator("xpath=ancestor::div[1]");
      await expect(tips).toContainText(WORDING[layout]);
      for (const other of Object.values(WORDING).filter((w) => w !== WORDING[layout])) {
        await expect(tips).not.toContainText(other);
      }
    });
  }
});

test.describe("US-18 AC3 Edit my answer", () => {
  test("happy path: correct the typed answer, only that answer is checked again", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    const panel = await showFeedback(page);
    await expect(panel.getByRole("region", { name: "Language" })).toContainText("since five years");

    await panel.getByRole("button", { name: "Edit my answer" }).click();
    await expect(panel.getByText("Only this answer is checked again.")).toBeVisible();
    const fixed = "I have worked on this team for five years and activation went up by twelve percent in one quarter.";
    await panel.getByRole("textbox", { name: "Your answer" }).fill(fixed);
    await panel.getByRole("button", { name: "Save and check again" }).click();

    // The new text replaces the old one in the transcript and the language layer is made again.
    await expect(conversation(page)).toContainText(`You typed: ${fixed}`);
    await expect(conversation(page)).not.toContainText("I am working on this team since five years");
    await expect(panel.getByRole("region", { name: "Language" })).toContainText("Nothing to fix in this answer.");
    await expect(panel.getByRole("region", { name: "Language" })).not.toContainText("since five years");
    // The session carries on: the next question is still waiting for an answer.
    await expect(questionCounter(page, 2, 5)).toBeVisible();
  });

  test("negative: Cancel keeps the answer and its corrections as they were", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    const panel = await showFeedback(page);
    await panel.getByRole("button", { name: "Edit my answer" }).click();
    await panel.getByRole("textbox", { name: "Your answer" }).fill("Something else entirely.");
    await panel.getByRole("button", { name: "Cancel" }).click();
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_SLIP}`);
    await expect(panel.getByRole("region", { name: "Language" })).toContainText("since five years");
  });

  test("negative: the engine fails while checking again, the answer is not changed", async ({ page, request }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    const panel = await showFeedback(page);
    await panel.getByRole("button", { name: "Edit my answer" }).click();
    await steerEngine(request, { fail: ["p2a", "p2b"] });
    await panel.getByRole("textbox", { name: "Your answer" }).fill("Activation went up by twelve percent.");
    await panel.getByRole("button", { name: "Save and check again" }).click();
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_SLIP}`);
  });
});
