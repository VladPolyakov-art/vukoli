/* The debrief of a saved session: "Edit what I said" checks one answer again (US-18 AC3), and dismissing a correction
 * after the fact changes what counts as a weak spot (US-17 AC2, US-22 AC3). */
import { expect, test, type Page } from "@playwright/test";
import {
  ANSWER_WITH_RESULT, blockStorage, debriefCard, endSession, openSkills, questionTab, resetApp, seedReturningUser, sendAnswer, showDebrief, skipSetup,
  startTextInterview, viewer,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** The seeded newest session, in the Debrief view (`?view=debrief`), on its second question: an answer with the slip "since five years". */
async function openSlipCard(page: Page, id: string) {
  await page.goto(`/sessions/${id}?view=debrief`);
  await questionTab(page, 2).click();
  return viewer(page).getByRole("article");
}

/** The plan block (layout D): up to three steps, or, for an older debrief with no plan, the weak spots under "What to work on". */
const plan = (page: Page) => page.locator("[data-review-id='Debrief/Plan']");

test.describe("US-18 AC3 Edit what I said, in the debrief", () => {
  test("happy path: the corrected answer is checked again and kept", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    const card = await openSlipCard(page, sessions[0]!.id);
    await expect(card).toContainText("since five years");

    await card.getByRole("button", { name: "Edit what I said" }).click();
    const said = card.getByRole("textbox", { name: "What you actually said" });
    await said.fill(
      "When two engineers disagreed about the release plan I set up a short call, I wrote down both options and I asked the team lead to decide by Friday. I have worked on this team for five years and I like it.",
    );
    await card.getByRole("button", { name: "Save and check again" }).click();

    // Only this answer is made again: it carries the "Edited by you" badge and the slip is gone.
    await expect(card.getByText("Edited by you")).toBeVisible();
    await expect(card).toContainText("I have worked on this team for five years");
    await expect(card.getByText("You typed")).toHaveCount(0);

    // The change is saved on this computer, not only on screen.
    await page.reload();
    await questionTab(page, 2).click();
    await expect(viewer(page).getByRole("article")).toContainText("I have worked on this team for five years");
  });

  test("negative: the check fails, the answer is not changed and the editor reopens with the typed text", async ({
    page,
    request,
  }) => {
    const { sessions } = await seedReturningUser(request);
    const card = await openSlipCard(page, sessions[0]!.id);
    // The engine is out of reach for this one call (a network-level stand-in: the server refuses with a 502).
    await page.route("**/api/sessions/*/recheck", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "engine_error", message: "The AI engine did not answer." } }),
      }),
    );
    await card.getByRole("button", { name: "Edit what I said" }).click();
    await card.getByRole("textbox", { name: "What you actually said" }).fill("Something I typed that must not get lost.");
    await card.getByRole("button", { name: "Save and check again" }).click();

    await expect(page.getByText("Couldn't check that answer again. It was not changed.")).toBeVisible();
    await expect(card.getByRole("textbox", { name: "What you actually said" })).toHaveValue("Something I typed that must not get lost.");

    // Cancel leaves the old answer and its correction in place.
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card).toContainText("since five years");
    await expect(card.getByText("Edited by you")).toHaveCount(0);
  });

  test("negative: Cancel keeps the answer as it was", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    const card = await openSlipCard(page, sessions[0]!.id);
    await card.getByRole("button", { name: "Edit what I said" }).click();
    await card.getByRole("textbox", { name: "What you actually said" }).fill("Nothing to see here.");
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card).toContainText("since five years");
    await expect(card.getByRole("button", { name: "Edit what I said" })).toBeVisible();
  });
});

test.describe("US-20 QA-07 The verdict follows the weak spots after a recheck", () => {
  test("the verdict no longer names a weak spot that the edit removed, and the editor does not promise otherwise", async ({
    page,
    request,
  }) => {
    const { sessions } = await seedReturningUser(request);
    const id = sessions[0]!.id;
    await page.goto(`/sessions/${id}?view=debrief`);
    // D99: the headline is the step's name; the model's sentence is under it.
    const verdict = page.getByRole("region", { name: "Verdict", exact: true });
    // Premise: the verdict names the Language weak spot ("preposition") that the edit below removes.
    await expect(verdict).toContainText("preposition");

    await questionTab(page, 2).click();
    const card = viewer(page).getByRole("article");
    await card.getByRole("button", { name: "Edit what I said" }).click();
    // The old copy said "The rest of the debrief stays as it is." while the verdict changed with the edit.
    await expect(card).not.toContainText("The rest of the debrief stays as it is");
    await card
      .getByRole("textbox", { name: "What you actually said" })
      .fill(
        "When two engineers disagreed about the release plan I set up a short call, I wrote down both options and I asked the team lead to decide by Friday. I have worked on this team for five years and I like it.",
      );
    await card.getByRole("button", { name: "Save and check again" }).click();
    await expect(card.getByText("Edited by you")).toBeVisible();

    // The plan lost the Language step, and the verdict says the same thing.
    await expect(plan(page)).not.toContainText("Language");
    await expect(verdict).not.toContainText("preposition");
    // Saved on this computer, not only on screen.
    await page.reload();
    await expect(page.getByRole("region", { name: "Verdict", exact: true })).not.toContainText("preposition");
  });
});

/* D99 (rubric 9.4): the step of the verdict scale is computed in code from the scorecard, at read time. The scripted
 * engine finds an action only in "I ..." sentences and a result only in a number, and adds the language slip "since five years". */
const GOOD =
  "Two weeks before launch legal asked for a consent step in checkout. I led the redesign: I put the consent inline next to the pay button and I tested it with five merchants in three days. Activation went up by twelve percent and support tickets fell by a third, so we shipped on time.";
const GOOD_WITH_SLIP = `I am working on this team since five years. ${GOOD}`;
/** The step the level block stands on, as the block says it to a screen reader ("Your level: Ready, step 3 of 3 …"). */
const level = (page: Page) => page.locator("[data-review-id='Debrief/Level']");
const stepIs = (page: Page, name: string) => expect(level(page)).toHaveAttribute("aria-label", new RegExp(`^Your level: ${name}, step \\d of 3`));

/** Run a text interview with these answers and open the Debrief view of its saved session. */
async function debriefAfter(page: Page, answers: string[]) {
  await startTextInterview(page);
  for (const [i, answer] of answers.entries()) {
    await sendAnswer(page, answer);
    if (i < answers.length - 1) await expect(page.getByRole("heading", { name: `Question ${i + 2}`, level: 2 })).toBeVisible();
  }
  await (await endSession(page)).click();
  await expect(page).toHaveURL(/\/sessions\/s-/);
  await showDebrief(page);
  return page.getByRole("region", { name: "Verdict", exact: true });
}

test.describe("US-20 D99 The verdict step follows the scorecard", () => {
  test("Not ready yet: a content row at 1-2; the line names it and the score to reach", async ({ page }) => {
    // No first-person action in these answers: Structure (STAR) scores 1.
    const verdict = await debriefAfter(page, [ANSWER_WITH_RESULT, ANSWER_WITH_RESULT, ANSWER_WITH_RESULT]);
    await expect(verdict).toContainText("Not ready yet");
    await stepIs(page, "Not ready yet");
    await expect(verdict.getByText("To reach “Getting there”: get Structure (STAR) to 3 of 5 or more.", { exact: true })).toBeVisible();
    await expect(verdict).toContainText("The main thing to fix");                    // the model's sentence is still there, under the name
    const skills = await openSkills(page);
    await expect(skills.getByRole("listitem").filter({ hasText: "Structure (STAR)" })).toContainText("1 out of 5");
  });

  test("Ready: every shown row at 4 or more; no rule line", async ({ page }) => {
    const verdict = await debriefAfter(page, [GOOD, GOOD, GOOD]);
    await expect(verdict).toContainText("Ready");
    await stepIs(page, "Ready");
    await expect(verdict).not.toContainText("To reach");
  });

  test("a dismissed correction that lifts a row moves the step: Getting there becomes Ready", async ({ page }) => {
    const verdict = await debriefAfter(page, [GOOD_WITH_SLIP, GOOD_WITH_SLIP, GOOD_WITH_SLIP]);
    // English scores 3 (a slip in each answer), so only English stands between the user and "Ready"; content is fine.
    await stepIs(page, "Getting there");
    await expect(verdict.getByText("To reach “Ready”: get English to 4 of 5 or more.", { exact: true })).toBeVisible();
    for (const n of [1, 2, 3]) {
      const card = await debriefCard(page, n);
      await card.getByRole("button", { name: "Dismiss" }).click();
      await expect(card.getByText("You typed")).toHaveCount(0);
    }
    await stepIs(page, "Ready");
    await expect(verdict).not.toContainText("To reach");
    // The step is read-time: it holds after a reload, from the saved corrections.
    await page.reload();
    await stepIs(page, "Ready");
  });

  test("an older saved session gets the step too (derived from its scorecard), and the level block is one", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}?view=debrief`);
    await expect(page.getByRole("region", { name: "Verdict", exact: true })).toContainText(/Not ready yet|Getting there|Ready/);
    await expect(level(page)).toHaveCount(1);
    await expect(level(page)).toHaveAttribute("aria-label", /^Your level: (Not ready yet|Getting there|Ready), step [123] of 3/);
  });
});

test.describe("US-22 AC3 Dismissing a correction in a saved debrief", () => {
  test("the dismissed correction no longer counts as a weak spot", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    // Before: Home offers a Language weak spot from the seeded history.
    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    await expect(page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: /^Language/ })).toBeVisible();

    for (const session of sessions) {
      const card = await openSlipCard(page, session.id);
      if (await card.getByRole("button", { name: "Dismiss" }).count()) {
        await card.getByRole("button", { name: "Dismiss" }).click();
        await expect(card.getByText("You typed")).toHaveCount(0);
        await expect(card).toContainText("marked misheard by you");
      }
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    const replies = page.getByRole("group", { name: "Quick replies" });
    await expect(replies.getByRole("button", { name: /^Content/ })).toBeVisible();
    await expect(replies.getByRole("button", { name: /^Language/ })).toHaveCount(0);
  });

  test("the debrief's own weak-spot list drops the dismissed language item", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}?view=debrief`);
    const work = plan(page);
    await expect(work.getByRole("listitem")).toHaveCount(2);

    const card = await openSlipCard(page, sessions[0]!.id);
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card.getByText("You typed")).toHaveCount(0);

    await page.reload();
    await expect(plan(page).getByRole("listitem")).toHaveCount(1);
    await expect(plan(page)).not.toContainText("Language");
  });
});

test.describe("US-23 AC4 The data folder is not writable", () => {
  test("negative: the debrief says it could not be saved and offers the download", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await blockStorage(request);
    await page.goto(`/sessions/${sessions[0]!.id}`);
    const banner = page.getByRole("alert").filter({ hasText: "We couldn't save this debrief to your computer" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("this session will be lost when you close the app");
    await expect(banner.getByRole("link", { name: "Fix in Settings" })).toBeVisible();

    // The way out is a file the user keeps.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      banner.getByRole("button", { name: "Download debrief (.md)" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("negative: a live session warns before the first answer that nothing will be saved", async ({ page, request }) => {
    await blockStorage(request);
    await startTextInterview(page);
    await expect(page.getByText("We can't save to this computer")).toBeVisible();
    await expect(page.getByText("Your debrief will be offered as a download at the end.")).toBeVisible();
  });

  test("the warning is gone once the folder is writable again", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}?view=debrief`);
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible();
    await expect(page.getByText("We couldn't save this debrief to your computer")).toHaveCount(0);
  });
});
