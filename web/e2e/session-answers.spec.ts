/* Bug C2 (P1, synthetic explorer c1-r1, F1): "Redo answer" and several answers in quick succession in a live text session
 * must keep every answer under the question it was given to. Two cases:
 *  (a) redo puts the counter, the thread and the closing flag back and replaces only the last answer;
 *  (b) nothing the user does while Mike is still answering, or while the keys land outside the answer box, can send,
 *      shift or undo an answer by accident. */
import { expect, test, type Page } from "@playwright/test";
import {
  ANSWER_NO_RESULT,
  ANSWER_WITH_RESULT,
  ANSWER_WITH_SLIP,
  conversation,
  debriefCard,
  endSession,
  questionCounter,
  questionTab,
  resetApp,
  sendAnswer,
  skipSetup,
  startTextInterview,
  steerEngine,
  viewer,
} from "./helpers";

const FOLLOW_UP_ANSWER = "Activation rose by twelve percent in one quarter after the rebuild.";
const REDO = (page: Page) => page.getByRole("button", { name: "Redo answer (R)" });

/** The Redo control: the island's button, or on a phone the item of the "More" menu (the island stacks, V2.2). */
async function redoControl(page: Page) {
  if (await REDO(page).isVisible()) return REDO(page);
  await page.getByRole("button", { name: "More", exact: true }).click();
  return page.getByRole("menuitem", { name: /^Redo answer/ });
}
async function redoAnswer(page: Page) {
  await (await redoControl(page)).click();
}
/** The user's answers in the running conversation (one bubble each). */
const typedLines = (page: Page) => conversation(page).locator('[data-review-id="Session/Transcript/user"]');

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

test.describe("C2 (a) Redo answer", () => {
  test("puts the counter and the question back, and the debrief keeps only the new answer under question 1", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await expect(questionCounter(page, 2, 5)).toBeVisible();

    await redoAnswer(page);
    // Mike takes the question back: question 1 is the open one, question 2 and the answer are gone.
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    await expect(conversation(page)).toContainText("Sure, go ahead.");
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toHaveCount(0);
    await expect(conversation(page)).not.toContainText(ANSWER_WITH_RESULT);
    await expect(typedLines(page)).toHaveCount(0);

    // The new answer is the answer to question 1; Mike moves on again, and the counter follows.
    await sendAnswer(page, ANSWER_WITH_SLIP);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 3, 5)).toBeVisible();

    await (await endSession(page)).click();
    await expect(viewer(page).getByRole("tablist", { name: "Questions from this interview" }).getByRole("tab")).toHaveCount(2);
    const first = await debriefCard(page, 1);
    await expect(first).toContainText(ANSWER_WITH_SLIP);
    await expect(first).not.toContainText(ANSWER_WITH_RESULT);
    await expect(questionTab(page, 2)).toBeVisible();
    await questionTab(page, 2).click();
    await expect(viewer(page).getByRole("article")).toContainText(ANSWER_WITH_RESULT);
    await expect(viewer(page).getByRole("article")).not.toContainText(ANSWER_WITH_SLIP);
  });

  test("redoing the answer to a follow-up keeps the question, its follow-up and the first answer", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 2, 5)).toBeVisible();

    await redoAnswer(page);
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toHaveCount(0);
    await expect(conversation(page)).toContainText(ANSWER_NO_RESULT);       // the first answer stays
    await expect(conversation(page)).not.toContainText(ANSWER_WITH_RESULT); // the redone one goes
    await expect(typedLines(page)).toHaveCount(1);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toHaveCount(1);

    await sendAnswer(page, FOLLOW_UP_ANSWER);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 3, 5)).toBeVisible();

    await (await endSession(page)).click();
    const card = await debriefCard(page, 1);
    await expect(card).toContainText(ANSWER_NO_RESULT);
    await expect(card).toContainText(FOLLOW_UP_ANSWER);
    await expect(card).not.toContainText(ANSWER_WITH_RESULT);
  });

  test("a double click on Redo takes back one answer, not two", async ({ page, isMobile }) => {
    test.skip(isMobile, "Redo is a menu item on a phone: one click opens it, there is no double click");
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await REDO(page).dblclick();
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    await expect(conversation(page)).toContainText(ANSWER_NO_RESULT);
    await expect(typedLines(page)).toHaveCount(1);
    await expect(conversation(page).getByText("Sure, go ahead.")).toHaveCount(1);
  });

  test("redo twice in a row (one answer, then none) changes nothing more", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await redoAnswer(page);
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    await expect(await redoControl(page)).toBeDisabled(); // nothing left to redo
    await expect(conversation(page).getByText("Sure, go ahead.")).toHaveCount(1);
  });

  test("C2b: three Redo in a row leave one \"Sure, go ahead.\" in the live conversation", async ({ page }) => {
    await startTextInterview(page);
    for (let i = 0; i < 3; i += 1) {
      await sendAnswer(page, ANSWER_WITH_RESULT);
      await expect(questionCounter(page, 2, 5)).toBeVisible();
      await redoAnswer(page);
      await expect(questionCounter(page, 1, 5)).toBeVisible();
      await expect(typedLines(page)).toHaveCount(0);
    }
    await expect(conversation(page).getByText("Sure, go ahead.")).toHaveCount(1);
  });

  test("C2b: after Redo the focus is in the empty answer box, so the next answer is typed without a click", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await redoAnswer(page);
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    const box = page.getByRole("textbox", { name: "Your answer" });
    await expect(box).toBeFocused();
    await page.waitForTimeout(2300);
    await page.keyboard.type("really, the number went up");
    await expect(box).toHaveValue("really, the number went up");
    await expect(typedLines(page)).toHaveCount(0);
  });
});

test.describe("C2 (b) Answers sent quickly, keys outside the answer box", () => {
  test("while Mike is still answering nothing is sent: the draft waits, then goes to the question Mike asked", async ({ page, request }) => {
    await startTextInterview(page);
    await steerEngine(request, { delay_ms: 1500 }); // Mike takes a moment to reply
    const box = page.getByRole("textbox", { name: "Your answer" });
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(page.getByRole("button", { name: "Sent" })).toBeVisible(); // Mike is answering

    // Typing and Enter in that moment: not sent, not lost.
    await box.fill(FOLLOW_UP_ANSWER);
    await box.press("Enter");
    await box.press("Enter");
    await expect(typedLines(page)).toHaveCount(1);
    await expect(box).toHaveValue(FOLLOW_UP_ANSWER);

    // Mike has asked his follow-up: the same Enter now sends it, as the answer to that follow-up.
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    await box.press("Enter");
    await expect(typedLines(page)).toHaveCount(2);
    await expect(box).toHaveValue("");
    await expect(questionCounter(page, 2, 5)).toBeVisible();

    await steerEngine(request, { delay_ms: 0 });
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 3, 5)).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 4, 5)).toBeVisible();
    await (await endSession(page)).click();
    const card = await debriefCard(page, 1);
    await expect(card).toContainText(ANSWER_NO_RESULT);
    await expect(card).toContainText(FOLLOW_UP_ANSWER);
  });

  test("an answer typed with the focus outside the box (after Send with the mouse) lands in the box, it never fires Redo", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT); // Send with the mouse: the focus leaves the box
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await page.mouse.click(5, 5); // anywhere outside the box

    const second = "Conversion went from 41 to 58 percent in two months, nothing to redo here.";
    await page.keyboard.type(second);
    await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue(second);
    await expect(page.getByRole("complementary", { name: "Feedback" })).toHaveCount(0); // "f" opens nothing (D107: no panel)
    await expect(conversation(page)).toContainText(ANSWER_WITH_RESULT);                  // "r" did not redo the answer
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(questionCounter(page, 3, 5)).toBeVisible();
  });

  test("R pressed once outside the box still redoes; holding it redoes one answer, not all", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await page.mouse.click(5, 5);
    await page.waitForTimeout(2300); // past the 2 s after Send in which a letter is never a shortcut

    await page.keyboard.down("r");
    for (let i = 0; i < 4; i += 1) await page.keyboard.down("r"); // auto-repeat: the same key held down
    await page.keyboard.up("r");
    await expect(questionCounter(page, 1, 5)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toHaveCount(0);
    await expect(conversation(page)).toContainText(ANSWER_NO_RESULT); // only the follow-up's answer was redone
    await expect(typedLines(page)).toHaveCount(1);
  });

  test("C2b: Send with the mouse, a pause, then \"really…\": the text lands in the box, the sent answer is not taken back", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT); // Send with the mouse
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    const box = page.getByRole("textbox", { name: "Your answer" });
    await expect(box).toBeFocused(); // the focus is back in the box (the Send button is disabled by now)
    await page.waitForTimeout(2300);
    const second = "really, it was the onboarding rebuild that moved the number";
    await page.keyboard.type(second);
    await expect(box).toHaveValue(second);
    await expect(conversation(page)).toContainText(ANSWER_WITH_RESULT);
    await expect(typedLines(page)).toHaveCount(1);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Feedback" })).toHaveCount(0);
  });

  test("C2b: even with the focus taken off the box, a letter right after Send is typing, not Redo", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await page.mouse.click(5, 5); // the focus leaves the box at once
    await page.keyboard.type("really");
    const box = page.getByRole("textbox", { name: "Your answer" });
    await expect(box).toHaveValue("really");
    await expect(conversation(page)).toContainText(ANSWER_WITH_RESULT);
    await expect(typedLines(page)).toHaveCount(1);
    await expect(questionCounter(page, 2, 5)).toBeVisible();
  });
});
