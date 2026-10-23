/* Flow E: the English track. Pick a level and a topic, talk in text mode, get corrections after each turn.
 * US-24 (English track), US-17 (explainable, dismissible corrections), US-21 AC4 (history under the English filter). */
import { expect, test, type Page } from "@playwright/test";
import {
  ENGLISH_TURN,
  collectPageErrors,
  conversation,
  endSession,
  goToArchive,
  openMenu,
  resetApp,
  sendAnswer,
  showFeedbackLater,
  skipSetup,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** Home -> Practise English -> level -> topic -> the plan. */
async function planEnglish(page: Page, level = /^B1/, topic = "Talk about your work") {
  await page.goto("/");
  await page.getByRole("button", { name: "Practise English" }).click();
  await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: level }).click();
  await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: topic }).click();
  await expect(page.getByRole("region", { name: "Here's the plan" })).toBeVisible();
}

async function startEnglishInText(page: Page) {
  await planEnglish(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("log", { name: "Transcript" })).toContainText("your English practice partner");
}

test.describe("US-24 English practice", () => {
  test("happy path: level, topic, a turn, corrections after the turn, end, debrief, history", async ({ page }) => {
    const errors = collectPageErrors(page);

    // AC1/AC2: English is a named track on home; the level is picked from a labelled selector, and Mike is the partner.
    await page.goto("/");
    await page.getByRole("button", { name: "Practise English" }).click();
    const levels = page.getByRole("group", { name: "Quick replies" });
    for (const level of [/^A2/, /^B1/, /^B2/, /^C1/]) await expect(levels.getByRole("button", { name: level })).toBeVisible();
    await levels.getByRole("button", { name: /^B1/ }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Talk about your work" }).click();

    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("B1: familiar topics, more corrections");
    await expect(plan).toContainText("After the call, each one with a reason. Nothing appears while you speak.");
    // AC5: no cap, paywall or upsell.
    // 13 (F-13-13): "Free forever" is said once (the footer), and the plan has a Length row.
    await expect(page.getByText("Free forever: no limits on English practice.")).toHaveCount(1);
    await expect(plan).not.toContainText("Free forever");
    await expect(plan).toContainText("As long as you like · end any time");
    await plan.getByRole("button", { name: "Type instead" }).click();

    await expect(page).toHaveURL(/\/session$/);
    const transcript = page.getByRole("log", { name: "Transcript" });
    await expect(transcript).toContainText("Hi, I'm Mike, your English practice partner. Today's topic is Talk about your work.");
    await expect(page.getByText("Turn 1")).toBeVisible();

    // The user's turn goes in; Mike answers with a question of his own.
    await sendAnswer(page, ENGLISH_TURN);
    await expect(transcript).toContainText(`You typed: ${ENGLISH_TURN}`);
    await expect(transcript).toContainText("Mike: That sounds interesting.");
    await expect(page.getByText("Turn 2")).toBeVisible();

    // AC3 / D96: corrections come after the call, not after the turn: the panel only says so.
    const panel = await showFeedbackLater(page);
    await expect(panel).toContainText("Feedback comes after the call");
    await expect(panel).not.toContainText("since five years");
    await expect(panel.getByRole("region", { name: "Content" })).toHaveCount(0);
    await expect(panel.getByRole("region", { name: "Delivery" })).toHaveCount(0);

    // End: the debrief lists the corrections in order, and the session is in the history under English.
    await (await endSession(page, "End practice")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: "English practice", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Summary" })).toContainText("2 corrections.");
    const corrections = page.getByRole("region", { name: "Corrections" });
    await expect(corrections).toContainText("since five years");
    await expect(corrections).toContainText("Agree is itself the verb");
    // The reason is there too (no interview layers).
    await expect(corrections).toContainText("Use 'for' with periods of time");

    await openMenu(page);
    await page.getByRole("button", { name: "Actions for English practice" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await goToArchive(page);
    const filter = page.getByRole("radiogroup", { name: "Show" });
    await expect(filter.getByRole("radio", { name: "English 1" })).toBeVisible();
    await filter.getByRole("radio", { name: /^English/ }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "English practice" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the level can be changed from the plan, at any time before starting (AC2)", async ({ page }) => {
    await planEnglish(page);
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await plan.getByRole("button", { name: "Change level" }).click();
    await page.getByRole("menuitemradio", { name: /^A2/ }).click();
    await expect(page.getByRole("region", { name: "Here's the plan" })).toContainText("A2: everyday topics, slow pace");
  });

  test("a correction can be dismissed in the debrief and stops counting (US-17 AC2)", async ({ page }) => {
    await startEnglishInText(page);
    await sendAnswer(page, ENGLISH_TURN);
    await expect(conversation(page)).toContainText("Mike: That sounds interesting.");

    await (await endSession(page, "End practice")).click();
    const corrections = page.getByRole("region", { name: "Corrections" });
    await expect(corrections).toContainText("since five years");
    await corrections.getByRole("button", { name: "Dismiss" }).first().click();
    await expect(corrections).not.toContainText("Use 'for' with periods of time");
    await expect(corrections).toContainText("Agree is itself the verb"); // the other correction stays
  });

  test("negative: a turn with nothing to correct says so instead of inventing a correction", async ({ page }) => {
    await startEnglishInText(page);
    await sendAnswer(page, "I run the checkout team and I like the work. We shipped on time.");
    await expect(conversation(page)).toContainText("Mike: That sounds interesting.");
    await (await endSession(page, "End practice")).click();
    await expect(page.getByRole("region", { name: "Corrections" })).toContainText("No corrections this time.");
  });

  test("negative: an English debrief with no phrases to review never says 'uses these 0 phrases'", async ({ page }) => {
    await startEnglishInText(page);
    await sendAnswer(page, "I run the checkout team and I like the work. We shipped on time.");
    await expect(conversation(page)).toContainText("Mike: That sounds interesting.");
    await (await endSession(page, "End practice")).click();
    await expect(page.getByRole("region", { name: "Corrections" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Corrections" })).toContainText("No corrections this time.");
    const actions = page.getByRole("region", { name: "What next" });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Practise again" })).toBeVisible();
    await expect(page.getByText(/uses (these )?0 phrases/)).toHaveCount(0);
    await expect(page.getByText(/0 phrases/)).toHaveCount(0);
  });

  test("boundary: an English session with no turns ends on a short screen, not an empty debrief", async ({ page }) => {
    await startEnglishInText(page);
    await page.getByRole("button", { name: "End practice", exact: true }).click();
    // Nothing was said, so there is nothing to correct: a short "ended" screen with a way home, not an empty debrief.
    await expect(page.getByRole("heading", { name: "Session ended", level: 2 })).toBeVisible();
    await expect(page.getByText("Nothing was saved")).toBeVisible();
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
  });
});
