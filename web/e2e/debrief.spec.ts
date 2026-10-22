/* The debrief of a saved session: "Edit what I said" checks one answer again (US-18 AC3), and dismissing a correction
 * after the fact changes what counts as a weak spot (US-17 AC2, US-22 AC3). */
import { expect, test, type Page } from "@playwright/test";
import { blockStorage, resetApp, seedReturningUser, skipSetup, startTextInterview } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** The seeded newest session, on its second question: an answer with the slip "since five years". */
async function openSlipCard(page: Page, id: string) {
  await page.goto(`/sessions/${id}`);
  await page.getByRole("radio", { name: "2", exact: true }).click();
  return page.getByRole("region", { name: "Breakdown" }).getByRole("article");
}

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
    await expect(card.getByRole("region", { name: "Language" }).or(card.getByText("Nothing to fix in this answer.").last())).toBeVisible();
    await expect(card.getByText("You typed")).toHaveCount(0);

    // The change is saved on this computer, not only on screen.
    await page.reload();
    await page.getByRole("radio", { name: "2", exact: true }).click();
    await expect(page.getByRole("region", { name: "Breakdown" }).getByRole("article")).toContainText("I have worked on this team for five years");
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
    await page.goto(`/sessions/${id}`);
    const bar = page.getByRole("button", { name: /^Verdict/ });
    // Premise: the verdict names the Language weak spot ("preposition") that the edit below removes.
    await expect(bar).toContainText("preposition");

    await page.getByRole("radio", { name: "2", exact: true }).click();
    const card = page.getByRole("region", { name: "Breakdown" }).getByRole("article");
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

    // "What to work on" lost the Language item, and the verdict says the same thing.
    await bar.click();
    await expect(page.getByRole("region", { name: "What to work on" })).not.toContainText("Language");
    await expect(bar).not.toContainText("preposition");
    // Saved on this computer, not only on screen.
    await page.reload();
    await expect(page.getByRole("button", { name: /^Verdict/ })).not.toContainText("preposition");
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
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await page.getByRole("button", { name: /^Verdict/ }).click();
    const work = page.getByRole("region", { name: "What to work on" });
    await expect(work.getByRole("listitem")).toHaveCount(2);

    const card = await openSlipCard(page, sessions[0]!.id);
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card.getByText("You typed")).toHaveCount(0);

    await page.reload();
    await page.getByRole("button", { name: /^Verdict/ }).click();
    await expect(page.getByRole("region", { name: "What to work on" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "What to work on" })).not.toContainText("Language");
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
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible();
    await expect(page.getByText("We couldn't save this debrief to your computer")).toHaveCount(0);
  });
});
