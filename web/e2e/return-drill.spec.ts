/* Flow C: coming back. Home knows the weak spots from earlier interviews and offers to drill them.
 * US-22 (mistake memory + "drill my weak spots"), US-20 AC1 ("what next" in the debrief), US-17 (dismissed corrections). */
import { expect, test } from "@playwright/test";
import {
  ANSWER_NO_RESULT,
  ANSWER_WITH_RESULT,
  conversation,
  openMenu,
  questionCounter,
  resetApp,
  seedReturningUser,
  sendAnswer,
  skipSetup,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

test.describe("US-22 Weak spots and drill", () => {
  test("happy path: home offers the drill, Mike names the recurring weak spots, the drill targets one", async ({
    page,
    request,
  }) => {
    await seedReturningUser(request);
    await page.goto("/");

    // AC1: a returning user sees the drill next to the other starts.
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Drill my weak spots" }).click();

    // Mike names what keeps coming back, with the number of sessions, and lets the user pick a layer (AC2).
    const chat = page.getByRole("log", { name: "Setup with Mike" });
    await expect(chat).toContainText("From your last 3 interviews");
    await expect(chat).toContainText("end with the result (3 sessions)");
    await expect(chat).toContainText("Words you marked as misheard aren't counted.");
    const replies = page.getByRole("group", { name: "Quick replies" });
    await expect(replies.getByRole("button", { name: "All 2" })).toBeVisible();
    await expect(replies.getByRole("button", { name: "Language 1" })).toBeVisible();
    await replies.getByRole("button", { name: "Content 1" }).click();

    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Content: end with the result");
    await expect(plan).toContainText("3 questions");
    await plan.getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);

    // The session is a short one aimed at the gap: an answer with no result gets a follow-up about the result.
    await expect(questionCounter(page, 1, 3)).toBeVisible();
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();

    // A number in the follow-up answer satisfies the drill and Mike moves on.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await expect(questionCounter(page, 2, 3)).toBeVisible();
  });

  test("the layer can be chosen: the Language drill is a different focus from the Content drill", async ({
    page,
    request,
  }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Language 1" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Language");
    await expect(plan).not.toContainText("end with the result");
  });

  test("home shows the finished interviews in Recents, newest first", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    const recents = page.getByRole("region", { name: "Recents" }).getByRole("listitem");
    await expect(recents).toHaveCount(3);
    await expect(recents.nth(0)).toContainText("Kestrel Pay · Product Manager");
    await expect(recents.nth(1)).toContainText("Northwind Logistics · Product Owner");
  });

  test("negative: with no history the drill is not offered (AC4)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    const suggestions = page.getByRole("group", { name: "Suggestions" });
    await expect(suggestions.getByRole("button", { name: "General questions" })).toBeVisible();
    await expect(suggestions.getByRole("button", { name: "Practise English" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drill my weak spots" })).toHaveCount(0);
    await openMenu(page);
    await expect(page.getByText("Your practice sessions will appear here.").locator("visible=true")).toBeVisible();
  });
});

test.describe("US-20 AC1 What next, in the debrief", () => {
  test("the debrief lists one weak spot per layer, each pointing at its question", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("link", { name: "Kestrel Pay · Product Manager" }).click();

    await page.getByRole("button", { name: /^Verdict/ }).click();
    const work = page.getByRole("region", { name: "What to work on" });
    await expect(work).toContainText("Finish with what happened: one result, ideally a number.");
    await expect(work.getByRole("listitem")).toHaveCount(2); // one for content, one for language
    await work.getByRole("button", { name: "Go to question 3" }).click();
    await expect(page.getByRole("article")).toContainText("Question 3");
    await expect(page.getByRole("button", { name: "Drill these weak spots" })).toBeVisible();
  });

  test("'Drill these weak spots' in the debrief starts the same drill as Home's chip", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("link", { name: "Kestrel Pay · Product Manager" }).click();
    await page.getByRole("button", { name: /^Verdict/ }).click();
    await page.getByRole("button", { name: "Drill these weak spots" }).click();

    // F-13-14: Home opens the drill plan straight away, no "What should we drill?" question, and it keeps the job.
    await expect(page).toHaveURL(/\/\?drill=1&job=/);
    const chat = page.getByRole("log", { name: "Setup with Mike" });
    await expect(chat).toContainText("Here's a drill on the weak spots we found");
    await expect(chat).not.toContainText("What should we drill?");
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Kestrel Pay · Product Manager");
    await expect(plan).toContainText("end with the result");
    await expect(plan).toContainText("3 questions");
  });
});

test.describe("US-22 AC3 Dismissed corrections are not counted", () => {
  test("negative: dismissing the language correction in an old debrief takes it out of the weak spots", async ({
    page,
    request,
  }) => {
    // The weak spots come from each session's saved debrief (memory.py); the server recomputes them on every
    // dismiss / restore / recheck (feedback.refresh_weak_spots), so Home's drill follows.
    const { sessions } = await seedReturningUser(request);
    for (const session of sessions) {
      await page.goto(`/sessions/${session.id}`);
      await page.getByRole("radio", { name: "2", exact: true }).click();
      const card = page.getByRole("region", { name: "Breakdown" }).getByRole("article");
      await expect(card).toContainText("since five years");
      await card.getByRole("button", { name: "Dismiss" }).click();
      // The correction is gone from the card (the answer itself is still there); it says why it is not counted.
      await expect(card.getByText("You typed")).toHaveCount(0);
      await expect(card).toContainText("marked misheard by you");
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    const replies = page.getByRole("group", { name: "Quick replies" });
    await expect(replies.getByRole("button", { name: "Content 1" })).toBeVisible();
    await expect(replies.getByRole("button", { name: /^Language/ })).toHaveCount(0);
  });
});
