/* Flow D: one history. Recents in the sidebar, the Archive page with its track filter, open a session, rename it.
 * US-21 (one history), US-23 AC2 (trash and restore are in trash.spec.ts). */
import { expect, test, type Page } from "@playwright/test";
import { goToArchive, openMenu, resetApp, seedReturningUser, showDebrief, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** Move a chat out of Recents with its "..." menu. */
async function archiveChat(page: Page, title: string) {
  await openMenu(page);
  await page.getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByText("Moved to Archive.")).toBeVisible();
}

test.describe("US-21 One history", () => {
  test("happy path: archive a chat, find it in the Archive by track, open its debrief", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    const recents = page.getByRole("region", { name: "Recents" });
    await expect(recents.getByRole("link")).toHaveCount(3);

    await archiveChat(page, "Northwind Logistics · Product Owner");
    await expect(recents.getByRole("link", { name: "Northwind Logistics · Product Owner" })).toHaveCount(0);

    // AC1: the Archive lists it with its title (company and role), date and a track filter.
    await goToArchive(page);
    const filter = page.getByRole("radiogroup", { name: "Show" });
    await expect(filter.getByRole("radio", { name: "All 1" })).toBeChecked();
    await expect(filter.getByRole("radio", { name: "Interview 1" })).toBeVisible();
    await expect(filter.getByRole("radio", { name: "English 0" })).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "Northwind Logistics" });
    await expect(row).toContainText("Interview");
    // The seed puts this interview 8 days back from today.
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    await expect(row).toContainText(eightDaysAgo);

    // AC3: opening a session shows its debrief.
    await row.getByRole("link", { name: /Northwind Logistics · Product Owner/ }).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(
      page.getByRole("heading", { name: "Northwind Logistics · Product Owner", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible(); // D101: it opens on the debrief
    await expect(page.getByRole("log", { name: "Conversation with Mike" })).toHaveCount(0);
    await showDebrief(page);
  });

  test("the track filter narrows the list; the English filter has nothing to show for interviews", async ({
    page,
    request,
  }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await archiveChat(page, "Northwind Logistics · Product Owner");
    await goToArchive(page);

    const filter = page.getByRole("radiogroup", { name: "Show" });
    await filter.getByRole("radio", { name: /^English/ }).click();
    await expect(filter.getByRole("radio", { name: /^English/ })).toBeChecked();
    await expect(page.getByRole("listitem").filter({ hasText: "Northwind Logistics" })).toHaveCount(0);
    await filter.getByRole("radio", { name: /^Interview/ }).click();
    await expect(filter.getByRole("radio", { name: /^Interview/ })).toBeChecked();
    await expect(page.getByRole("listitem").filter({ hasText: "Northwind Logistics" })).toHaveCount(1);
  });

  test("rename: the new title is saved and shows everywhere (AC2)", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await page.getByRole("button", { name: "Rename session" }).click();
    const title = page.getByRole("textbox", { name: "Session title" });
    await title.fill("Kestrel Pay: round one");
    await page.getByRole("button", { name: "Save title" }).click();
    await expect(page.getByRole("heading", { name: "Kestrel Pay: round one", level: 1 })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Kestrel Pay: round one", level: 1 })).toBeVisible();
    await openMenu(page);
    await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: "Kestrel Pay: round one" })).toBeVisible();
  });

  test("rename: Cancel keeps the old title", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await page.getByRole("button", { name: "Rename session" }).click();
    await page.getByRole("textbox", { name: "Session title" }).fill("Something else");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Kestrel Pay · Product Manager", level: 1 }),
    ).toBeVisible();
  });

  test("an archived chat can be brought back to Recents", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await archiveChat(page, "Northwind Logistics · Product Owner");
    await goToArchive(page);
    // A desktop row has the button inline; a phone row keeps it in the "..." menu.
    const title = "Northwind Logistics · Product Owner";
    const inline = page.getByRole("button", { name: `Move ${title} back to Recents` });
    if (await inline.isVisible()) {
      await inline.click();
    } else {
      await page.getByRole("button", { name: `More actions for ${title}` }).click();
      await page.getByRole("menuitem", { name: "Move back to Recents" }).click();
    }
    await expect(page.getByRole("heading", { name: "No archived chats", level: 2 })).toBeVisible();
    await openMenu(page);
    await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: /Northwind Logistics/ })).toBeVisible();
  });

  test("negative: with no sessions the Archive explains itself and offers to start one (AC4)", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await expect(page.getByText("Your practice sessions will appear here.").locator("visible=true")).toBeVisible();
    await goToArchive(page);
    await expect(page.getByRole("heading", { name: "No archived chats", level: 2 })).toBeVisible();
    await expect(page.getByText("Archive a chat from its … menu in the sidebar. It leaves Recents; nothing is deleted.")).toBeVisible();
    await page.getByRole("button", { name: "Start a practice" }).click();
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
  });

  test("negative: a session that does not exist says so instead of showing an empty page", async ({ page }) => {
    await page.goto("/sessions/s-19990101-000000-000000");
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toBeVisible();
    await expect(page.getByRole("region", { name: /^Verdict/ })).toHaveCount(0);
    await expect(page.getByText(/couldn't find|not found|doesn't exist|no longer/i).first()).toBeVisible();
  });
});
