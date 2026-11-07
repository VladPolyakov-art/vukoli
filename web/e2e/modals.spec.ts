/* D108: every modal closes on a click on the dimmed area outside it, as it does on Esc. A click on the backdrop is the
 * dialog's own Cancel / Close / "Not now": for a confirmation it is Cancel (nothing destructive happens). It counts only
 * when the press started on the backdrop too (a text selection dragged out of a dialog does not close it). Text typed in
 * a dialog is kept as a draft in memory, so a stray click does not lose it.
 * Each test opens one modal reachable in the UI and presses at the top-left corner of the viewport (always dimmed). */
import { expect, test, type Page } from "@playwright/test";
import {
  ENGLISH_TURN,
  JOB_TEXT,
  collectPageErrors,
  conversation,
  denyMicrophone,
  openMenu,
  resetApp,
  seedReturningUser,
  sendAnswer,
  sentFeedback,
  skipSetup,
  startTextInterview,
  steerFeedback,
} from "./helpers";

const TITLE = "Northwind Logistics · Product Owner";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** A click (a tap on a phone) at a point of the page that no dialog covers. */
async function pressAt(page: Page, x: number, y: number) {
  if (test.info().project.name === "mobile") await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
const clickBackdrop = (page: Page) => pressAt(page, 4, 4);

/** The dimmed area is not part of the page the user was on: nothing under it may have been pressed. */
async function expectNoModal(page: Page) {
  await expect(page.locator("dialog:modal")).toHaveCount(0);
}

test.describe("D108 Search", () => {
  test("a click on the dimmed area closes it, the page stays where it was", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/archive");
    await expect(page.getByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await openMenu(page);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await clickBackdrop(page);
    await expect(dialog).toBeHidden();
    await expectNoModal(page);
    await expect(page).toHaveURL(/\/archive$/);
  });
});

test.describe("D108 Settings", () => {
  test("a click on the dimmed area closes it (a phone shows it full screen: no dimmed area there)", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Settings fills the screen on a phone");
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await clickBackdrop(page);
    await expect(dialog).toBeHidden();
  });
});

test.describe("D108 Send feedback", () => {
  async function openSupport(page: Page) {
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("menuitem", { name: "Send feedback" }).click();
    const dialog = page.getByRole("dialog", { name: "Send feedback" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: /Attach app version/ })).toBeEnabled();
    return dialog;
  }

  test("closing by the backdrop keeps what was typed; nothing is sent; Send clears the draft", async ({ page, request }) => {
    const errors = collectPageErrors(page);
    let dialog = await openSupport(page);
    await dialog.getByRole("radio", { name: "Problem" }).click();
    await dialog.getByRole("textbox", { name: "Message" }).fill("The mic icon stays red.");
    await dialog.getByRole("textbox", { name: /^Email/ }).fill("alex@example.com");

    await clickBackdrop(page);
    await expect(dialog).toBeHidden();
    expect(await sentFeedback(request)).toEqual([]);

    // Open again: the draft is there (same app session).
    await openMenu(page);
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("menuitem", { name: "Send feedback" }).click();
    dialog = page.getByRole("dialog", { name: "Send feedback" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue("The mic icon stays red.");
    await expect(dialog.getByRole("textbox", { name: /^Email/ })).toHaveValue("alex@example.com");
    await expect(dialog.getByRole("radio", { name: "Problem" })).toBeChecked();

    // Send: the draft is spent. The next time the form is empty.
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(dialog.getByText("Thanks — sent")).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await openMenu(page);
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("menuitem", { name: "Send feedback" }).click();
    dialog = page.getByRole("dialog", { name: "Send feedback" });
    await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue("");
    expect(errors).toEqual([]);
  });

  test("Esc closes it too", async ({ page }) => {
    const dialog = await openSupport(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("a click inside the dialog, on its title or its empty space, does not close it", async ({ page }) => {
    const dialog = await openSupport(page);
    await dialog.getByRole("heading", { name: "Send feedback" }).click();
    await dialog.click({ position: { x: 4, y: 4 } });     // its own padding
    await expect(dialog).toBeVisible();
  });

  test("a press that starts inside the dialog and is released on the backdrop (a selection drag) does not close it", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "needs a mouse drag");
    const dialog = await openSupport(page);
    const message = dialog.getByRole("textbox", { name: "Message" });
    await message.fill("Some text to select");
    const box = (await message.boundingBox())!;
    await page.mouse.move(box.x + box.width - 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(4, 4, { steps: 8 });
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    await expect(message).toHaveValue("Some text to select");
  });
});

/** One quick English session in text mode, ended with End practice (the session goes Home at once). */
async function finishEnglishSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Practise English" }).click();
  await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: /^(Yes, )?B1/ }).click();
  await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Talk about your work" }).click();
  await expect(page.getByRole("region", { name: "Here's the plan" })).toBeVisible();
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(page).toHaveURL(/\/session$/);
  await sendAnswer(page, ENGLISH_TURN);
  await expect(conversation(page)).toContainText("Mike: That sounds interesting.");
  await page.getByRole("button", { name: "End practice", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("D108 How did it go?", () => {
  test("a click on the dimmed area is Not now: nothing is sent, the debrief carries on", async ({ page, request }) => {
    await steerFeedback(request, { ask: true });
    await finishEnglishSession(page);
    const ask = page.getByRole("dialog", { name: "How did it go?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("radio", { name: "4 of 5" }).click();
    await ask.getByRole("textbox", { name: /What should we improve/ }).fill("Fewer corrections, please.");
    await clickBackdrop(page);
    await expect(ask).toBeHidden();
    expect(await sentFeedback(request)).toEqual([]);
    await expect(page.getByRole("button", { name: "Open debrief" })).toBeVisible();
  });
});

test.describe("D108 Confirmations", () => {
  test("Delete this chat? (sidebar): the backdrop is Cancel, the chat stays", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: `Actions for ${TITLE}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this chat?" });
    await expect(confirm).toBeVisible();
    await clickBackdrop(page);
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("region", { name: "Recents" }).getByRole("link", { name: TITLE })).toHaveCount(1);
  });

  test("Delete this chat? (Archive list): the backdrop is Cancel, the chat stays", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: `Actions for ${TITLE}` }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(page.getByText("Moved to Archive.")).toBeVisible();
    await page.goto("/archive");
    const row = page.getByRole("listitem").filter({ hasText: "Northwind Logistics" });
    await expect(row).toBeVisible();
    const trash = row.getByRole("button", { name: `Delete ${TITLE}` });
    if (await trash.isVisible()) await trash.click();
    else {
      await row.getByRole("button", { name: `More actions for ${TITLE}` }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
    }
    const confirm = page.getByRole("dialog", { name: "Delete this chat?" });
    await expect(confirm).toBeVisible();
    await clickBackdrop(page);
    await expect(confirm).toBeHidden();
    await expect(row).toBeVisible();
    await expect(page.getByText("Moved to trash.")).toHaveCount(0);
  });

  test("Delete this chat? (debrief menu): the backdrop is Cancel, the debrief stays", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[1]!.id}`);
    await page.getByRole("button", { name: "More actions for this session" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this chat?" });
    await expect(confirm).toBeVisible();
    await clickBackdrop(page);
    await expect(confirm).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessions[1]!.id}`));
    await expect(page.getByText("Moved to trash.")).toHaveCount(0);
  });

  test("Delete this chat forever? (Trash): the backdrop is Cancel, the chat stays in the trash", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: `Actions for ${TITLE}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete this chat?" }).getByRole("button", { name: "Delete" }).click();
    await page.goto("/archive/trash");
    await page.getByRole("button", { name: `Delete forever: ${TITLE}` }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this chat forever?" });
    await expect(confirm).toBeVisible();
    await clickBackdrop(page);
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("listitem").filter({ hasText: "Northwind Logistics" })).toBeVisible();
  });
});

test.describe("D108 Add a job", () => {
  test("a click on the dimmed area is Cancel; the pasted text is still there when it is opened again", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem("ic.setupDone"));     // this one starts in the wizard
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("radio", { name: /^Ollama/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "I'll type instead" }).first().click();
    await expect(page.getByRole("heading", { name: "About you", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Add a job" }).click();
    let job = page.getByRole("dialog", { name: "Add a job" });
    await job.getByRole("textbox", { name: "Job description" }).fill(JOB_TEXT);
    await expect(job.getByRole("textbox", { name: "Company" })).toHaveValue("Kestrel Pay");

    await clickBackdrop(page);
    await expect(job).toBeHidden();
    await expect(page.getByText("Kestrel Pay · Product Manager")).toHaveCount(0);   // nothing was saved

    await page.getByRole("button", { name: "Add a job" }).click();
    job = page.getByRole("dialog", { name: "Add a job" });
    await expect(job.getByRole("textbox", { name: "Job description" })).toHaveValue(JOB_TEXT);
    await expect(job.getByRole("textbox", { name: "Company" })).toHaveValue("Kestrel Pay");

    // Saved: the draft is spent.
    await job.getByRole("button", { name: "Save job" }).click();
    await expect(page.getByText("Kestrel Pay · Product Manager")).toBeVisible();
  });
});

test.describe("D108 Session dialogs", () => {
  test("Mike can't hear you (microphone help): the backdrop closes it like ×", async ({ page }) => {
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Start interview" }).click();
    const help = page.getByRole("dialog", { name: "Mike can't hear you" });
    await expect(help).toBeVisible();
    await clickBackdrop(page);
    await expect(help).toBeHidden();
    await expectNoModal(page);
  });

  test("Keyboard shortcuts: the backdrop closes it", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "the shortcuts help is for a keyboard: it is not offered on a phone");
    await startTextInterview(page);
    await page.getByRole("button", { name: /^Shortcuts and microphone help/ }).click();
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await clickBackdrop(page);
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/session$/);
  });
});

test.describe("D108 Menu drawer", () => {
  test("on a phone the sidebar drawer closes on a click on the scrim, on its right", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "the sidebar is a drawer below 1024 px only");
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open menu" });
    await menu.waitFor({ state: "visible" });
    await menu.click();
    const drawer = page.locator('[role="dialog"][data-side="left"]');
    await expect(drawer).toBeVisible();
    const { width, height } = page.viewportSize()!;
    await pressAt(page, width - 6, height - 6);             // the rail is narrower than the screen: this point is the scrim
    await expect(drawer).toBeHidden();
  });

  test("a press that starts in the drawer and ends on the scrim does not close it", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "the sidebar is a drawer below 1024 px only");
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Open menu" });
    await menu.waitFor({ state: "visible" });
    await menu.click();
    const drawer = page.locator('[role="dialog"][data-side="left"]');
    await expect(drawer).toBeVisible();
    const box = (await drawer.boundingBox())!;
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(box.x + 20, box.y + box.height - 20);
    await page.mouse.down();
    await page.mouse.move(width - 6, height - 6, { steps: 6 });
    await page.mouse.up();
    await expect(drawer).toBeVisible();
  });
});
