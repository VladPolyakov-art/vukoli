/* Flow D2: deleting a chat. Soft delete to the trash, restore, delete forever after a confirmation.
 * US-23 AC2 (trash and restore; deleting from the trash is permanent after confirmation). */
import { expect, test } from "@playwright/test";
import { openMenu, resetApp, seedReturningUser, skipSetup } from "./helpers";

const TITLE = "Northwind Logistics · Product Owner";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
  await seedReturningUser(request);
});

/** Delete the Northwind chat from its "..." menu in Recents (with the confirmation). */
async function deleteFromRecents(page: import("@playwright/test").Page) {
  await page.goto("/");
  await openMenu(page);
  await page.getByRole("button", { name: `Actions for ${TITLE}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete this chat?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: TITLE })).toHaveCount(0);
}

test.describe("US-23 AC2 Trash", () => {
  test("happy path: delete, find it in the trash, restore it to Recents", async ({ page }) => {
    await deleteFromRecents(page);
    await page.goto("/archive/trash");
    const row = page.getByRole("listitem").filter({ hasText: "Northwind Logistics" });
    await expect(row).toContainText("Deleted");
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("heading", { name: "The trash is empty.", level: 2 })).toBeVisible();

    await page.goto("/");
    await openMenu(page);
    await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: TITLE })).toBeVisible();
  });

  test("delete forever asks first, then the chat is gone for good", async ({ page, request }) => {
    await deleteFromRecents(page);
    await page.goto("/archive/trash");
    await page.getByRole("button", { name: `Delete forever: ${TITLE}` }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this chat forever?" });
    await expect(confirm).toContainText("This can't be undone.");
    await confirm.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByRole("heading", { name: "The trash is empty.", level: 2 })).toBeVisible();

    // Not in Recents, not in the Archive, and not on disk either.
    await page.goto("/");
    await openMenu(page);
    await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: TITLE })).toHaveCount(0);
    const sessions = (await (await request.get("/api/sessions")).json()).sessions as { title: string }[];
    expect(sessions.map((s) => s.title).join("|")).not.toContain("Northwind");
  });

  test("negative: cancelling either confirmation keeps the chat", async ({ page }) => {
    // Cancel the first confirmation: the chat stays in Recents.
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: `Actions for ${TITLE}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete this chat?" }).getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: TITLE })).toBeVisible();

    // Delete it for real, then cancel "delete forever": it stays in the trash.
    await page.getByRole("button", { name: `Actions for ${TITLE}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete this chat?" }).getByRole("button", { name: "Delete" }).click();
    await page.goto("/archive/trash");
    await page.getByRole("button", { name: `Delete forever: ${TITLE}` }).click();
    await page.getByRole("dialog", { name: "Delete this chat forever?" }).getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Northwind Logistics" })).toBeVisible();
  });

  test("negative: an empty trash says so", async ({ page }) => {
    await page.goto("/archive/trash");
    await expect(page.getByRole("heading", { name: "The trash is empty.", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Archive" })).toBeVisible();
  });
});
