/* Tough talk, the session and the debrief (US-69, US-70, US-71, US-73; ds/screens/tough-talk.md §4-§6): start a Negotiate
 * salary or a Tough questions session, ask for a hint (the button and the H key), answer a few turns, end, and read the
 * debrief frames. The scripted engine stands in for the model: recruiter lines carry only the amounts the server gave
 * them, and the after-call check flags nothing. Home's chips for the two modes are another change; the session is opened
 * the way Home opens it, by navigating to /session with the start configuration in the router state. */
import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, conversation, endSession, expectNoHorizontalScroll, resetApp, sendAnswer, showConversation, showDebrief, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const NEGOTIATE = {
  mode: "negotiate", input: "text", speak: false, suggest: false,
  negotiate: { role: "Designer", job_low: 80000, job_high: 100000, target: 98000, currency: "USD", style: "friendly", has_real_offer: false },
};
const TOUGH = { mode: "tough", input: "text", speak: false, suggest: false, tough: { theme: "leaving" } };

/** Open /session the way Home does (router state), without the chips that belong to another change. */
async function startTalk(page: Page, start: Record<string, unknown>, title: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.evaluate(({ start, title }) => {
    window.history.pushState({ usr: { config: { start: { type: "start", ...start }, browserStt: false, pauseSec: 5 }, title }, key: "talk", idx: 1 }, "", "/session");
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, { start, title });
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
}

const hintButton = (page: Page) => page.getByRole("button", { name: /(Show a hint|Hide the hint) \(H\)/ });

/** Focus is outside the answer box, the way a shortcut is pressed. For two seconds after Send a letter counts as typing
 * (SENT_GUARD_MS in SessionView), so the key waits that out. */
async function pressH(page: Page) {
  await page.waitForTimeout(2100);
  await page.mouse.click(5, 5);
  await page.keyboard.press("h");
}

test.describe("US-70 Negotiate salary: the session", () => {
  test("hint by the button and by H, then a deal with a step-up in the debrief", async ({ page }) => {
    const errors = collectPageErrors(page);
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    const log = conversation(page);
    await expect(log).toContainText("what are you expecting for the salary?");   // Mike asks first; the offer follows your number

    // The Hint button sits in the island, in the place of the suggester, and the shortcuts list names H.
    await expect(hintButton(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: /suggest/i })).toHaveCount(0);

    await sendAnswer(page, "I was hoping for around 98k");
    await expect(log).toContainText("91,000 USD");

    // Button: the card opens (Try saying + an example), the button is pressed; the second press hides it.
    await hintButton(page).click();
    const card = page.getByText("Try saying").first();
    await expect(card).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide the hint (H)" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Hide the hint (H)" }).click();
    await expect(card).toHaveCount(0);

    // H does the same from the keyboard; typing a word with an h in the answer box is left alone.
    await pressH(page);
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await pressH(page);
    await expect(page.getByText("Try saying")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Your answer" }).fill("h");
    await expect(page.getByText("Try saying")).toHaveCount(0);

    await sendAnswer(page, "Could we do 91k now and 98k after the 3 month probation, in writing?");
    await expect(log).toContainText("offer letter");
    await sendAnswer(page, "Great, I accept the offer");
    // Mike closes the round: "See your debrief" in the closing card ends the session.
    await expect(page.getByText("That's the end of the round")).toBeVisible();
    await page.getByRole("button", { name: "See your debrief" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Open debrief" }).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: "Negotiation · Designer · Friendly", level: 1 })).toBeVisible();
    await showDebrief(page);

    // The three frames carry titles (D109); the deal line says what was agreed and that it is in the offer letter.
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expect(page.getByTestId("deal-line")).toContainText(/Now 91,000 → 98,000 after 3 months/);
    await expect(page.getByTestId("deal-line")).toContainText("In the offer letter");
    await expect(page.getByRole("heading", { name: "What moved the offer", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Say it better", level: 2 })).toBeVisible();
    await expect(page.getByText(/Hints you used:/)).toBeVisible();

    // The conversation view carries the whole talk.
    await showConversation(page);
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("I was hoping for around 98k");
    expect(errors).toEqual([]);
  });

  test("a very short session: ended before any answer saves nothing", async ({ page }) => {
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    await page.getByRole("button", { name: "End practice", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Session ended", level: 2 })).toBeVisible();
    await expect(page.getByText("Nothing was saved: you didn't answer any questions.")).toBeVisible();
  });

  test("a short talk with no offer from Mike: No offer yet, tactic tiles, no deal line, no moves frame", async ({ page }) => {
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    await sendAnswer(page, "Great, I accept the offer");
    await (await endSession(page, "End practice")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expect(page.getByText("No offer yet", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Say it better", level: 2 })).toBeVisible();
    await expect(page.getByText("Ask for their range", { exact: true })).toBeVisible();
    await expect(page.getByTestId("deal-line")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "What moved the offer", level: 2 })).toHaveCount(0);
  });

  test("on a phone the hint card and the debrief do not scroll sideways", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    await sendAnswer(page, "I was hoping for around 98k");
    await hintButton(page).click();
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await sendAnswer(page, "Could we do 91k now and 98k after the 3 month probation, in writing?");
    await (await endSession(page, "End practice")).click();
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("US-69 Tough questions: the session", () => {
  test("hint shows the answer shape, then Summary and Questions in the debrief", async ({ page }) => {
    const errors = collectPageErrors(page);
    await startTalk(page, TOUGH, "Tough questions · Why you left");
    const log = conversation(page);
    await expect(log).toContainText("Mike");

    await hintButton(page).click();
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await page.getByRole("button", { name: "Hide the hint (H)" }).click();
    await pressH(page);
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await pressH(page);

    for (const text of ["The role changed and I wanted more product ownership.", "I wanted to grow into product work, and I learned a lot there.", "I enjoyed the team and I am ready for a new challenge."]) {
      await sendAnswer(page, text);
      await expect(log).toContainText(text);
    }
    await (await endSession(page, "End")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);

    await expect(page.getByRole("heading", { name: "Summary", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions", level: 2 })).toBeVisible();
    await expect(page.getByText(/Handled calmly: \d of \d|You answered \d questions?\./)).toBeVisible();
    await showConversation(page);
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("The role changed and I wanted more product ownership.");
    expect(errors).toEqual([]);
  });

  test("a very short session: one answer shows no counts", async ({ page }) => {
    await startTalk(page, TOUGH, "Tough questions · Why you left");
    await sendAnswer(page, "The role changed and I wanted more product ownership.");
    await expect(conversation(page)).toContainText("product ownership");
    await (await endSession(page, "End")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Summary", level: 2 })).toBeVisible();
    await expect(page.getByText(/Handled calmly/)).toHaveCount(0);
    await expect(page.getByText("You answered 1 question.")).toBeVisible();
  });
});
