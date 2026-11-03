/* US-60 (F66, D102): in-app feedback. The support form (account menu, Settings → About) and "How did it go?" after End
 * on the 1st session and then the 6th, 11th… The server is in test mode: a stand-in for the form service remembers what
 * it was sent (GET /api/_e2e/feedback), so each test checks the payload as the server built it, not the screen. */
import { expect, test, type Page } from "@playwright/test";
import {
  ENGLISH_TURN,
  collectPageErrors,
  conversation,
  openMenu,
  resetApp,
  sendAnswer,
  sentFeedback,
  skipSetup,
  steerFeedback,
} from "./helpers";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const supportDialog = (page: Page) => page.getByRole("dialog", { name: "Send feedback" });
const askDialog = (page: Page) => page.getByRole("dialog", { name: "How did it go?" });

/** Account menu -> Send feedback (on a phone the sidebar is behind the menu button). */
async function openSupport(page: Page) {
  await page.goto("/");
  await openMenu(page);
  await page.getByRole("button", { name: /^You/ }).click();
  await page.getByRole("menuitem", { name: "Send feedback" }).click();
  const dialog = supportDialog(page);
  await expect(dialog).toBeVisible();
  // The preview line needs the config; wait for the "Attach" box to be usable.
  await expect(dialog.getByRole("checkbox", { name: /Attach app version/ })).toBeEnabled();
  return dialog;
}

/** One quick English session in text mode, ended with End practice (D73: the session goes Home at once). */
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

test.describe("US-60 Send feedback", () => {
  test("happy path: menu, form, Send; the service got exactly what the form shows (AC1, AC4)", async ({ page, request }) => {
    const errors = collectPageErrors(page);
    const dialog = await openSupport(page);

    // Send is off until there is a message (the message is required).
    await expect(dialog.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await dialog.getByRole("radio", { name: "Problem" }).click();
    await dialog.getByRole("textbox", { name: "Message" }).fill("The mic icon stays red after I stop talking.");
    await dialog.getByRole("textbox", { name: /^Email/ }).fill("alex@example.com");

    // The line the server adds is shown under the box; the same text reaches the service.
    const attach = dialog.getByRole("checkbox", { name: /Attach app version/ });
    await expect(attach).toBeChecked();
    const preview = (await dialog.getByText(/^Vukoli \S+ · /).textContent())?.trim() ?? "";
    expect(preview).toMatch(/^Vukoli \S+ · .+ · .+$/);

    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(dialog.getByText("Thanks — sent")).toBeVisible();
    expect(await sentFeedback(request)).toEqual([
      { kind: "problem", message: "The mic icon stays red after I stop talking.", email: "alex@example.com", app: preview },
    ]);

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("no metadata when the box is unticked; no email key when the field is empty (AC4)", async ({ page, request }) => {
    const dialog = await openSupport(page);
    await dialog.getByRole("textbox", { name: "Message" }).fill("Would love a dark-only theme option.");
    await dialog.getByText("Attach app version, system and AI engine").click();
    await expect(dialog.getByRole("checkbox", { name: /Attach app version/ })).not.toBeChecked();
    await expect(dialog.getByText("Not attached.")).toBeVisible();
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(dialog.getByText("Thanks — sent")).toBeVisible();
    expect(await sentFeedback(request)).toEqual([{ kind: "idea", message: "Would love a dark-only theme option." }]);
  });

  test("negative: the service fails, the text stays, Try again sends it (AC5)", async ({ page, request }) => {
    await steerFeedback(request, { fail: "service_error" });
    const dialog = await openSupport(page);
    await dialog.getByRole("textbox", { name: "Message" }).fill("Second question repeated the first.");
    await dialog.getByRole("button", { name: "Send", exact: true }).click();

    await expect(dialog.getByRole("alert")).toContainText("Not sent");
    await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue("Second question repeated the first.");
    expect(await sentFeedback(request)).toEqual([]);

    // The copy button puts the same text (and the line, when ticked) on the clipboard.
    await dialog.getByRole("button", { name: "Copy text" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Second question repeated the first.");

    await steerFeedback(request, { clear_fail: true });
    await dialog.getByRole("button", { name: "Try again" }).click();
    await expect(dialog.getByText("Thanks — sent")).toBeVisible();
    expect(await sentFeedback(request)).toHaveLength(1);
  });

  test("negative: no connection says so and keeps the text (AC5)", async ({ page, request }) => {
    await steerFeedback(request, { fail: "network" });
    const dialog = await openSupport(page);
    await dialog.getByRole("textbox", { name: "Message" }).fill("Offline test.");
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Check your connection");
    await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue("Offline test.");
  });

  test("not set up: Copy text and a link to GitHub issues instead of Send (AC6)", async ({ page, request }) => {
    await steerFeedback(request, { configured: false });
    // The link opens GitHub in a new tab: record the call, do not leave the test machine.
    await page.addInitScript(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = (url) => { (window as unknown as { __opened: string[] }).__opened.push(String(url)); return null; };
    });
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("menuitem", { name: "Send feedback" }).click();
    const dialog = supportDialog(page);
    await expect(dialog.getByText("This copy can't send feedback")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);

    await dialog.getByRole("textbox", { name: "Message" }).fill("Posting this on GitHub.");
    await dialog.getByRole("button", { name: "Copy text" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Posting this on GitHub.");

    await dialog.getByRole("button", { name: "Open GitHub issues" }).click();
    expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(["https://github.com/VladPolyakov-art/vukoli/issues/new"]);
    expect(await sentFeedback(request)).toEqual([]);
  });

  test("the same form opens from Settings → About (AC1)", async ({ page }) => {
    await page.goto("/settings/about");
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await settings.getByRole("button", { name: "Send feedback" }).click();
    await expect(supportDialog(page)).toBeVisible();
    await supportDialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(supportDialog(page)).toBeHidden();
    await expect(settings).toBeVisible();
  });
});

test.describe("US-60 How did it go?", () => {
  test.beforeEach(async ({ request }) => {
    await steerFeedback(request, { ask: true });
  });

  test("the 1st session asks after End; Not now carries on to the debrief (AC2, AC3)", async ({ page, request }) => {
    const errors = collectPageErrors(page);
    await finishEnglishSession(page);

    const ask = askDialog(page);
    await expect(ask).toBeVisible();
    await expect(ask.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await ask.getByRole("button", { name: "Not now" }).click();
    await expect(ask).toBeHidden();
    expect(await sentFeedback(request)).toEqual([]);

    // The debrief is still on its way: the toast that was waiting behind the dialog appears and opens it.
    await page.getByRole("button", { name: "Open debrief" }).click();
    await expect(page).toHaveURL(/\/sessions\/.+/);
    expect(errors).toEqual([]);
  });

  test("one click on a step and Send: the rating and the note reach the service, nothing else (AC2, AC3)", async ({ page, request }) => {
    await finishEnglishSession(page);
    const ask = askDialog(page);
    await expect(ask).toBeVisible();
    await ask.getByRole("radio", { name: "4 of 5" }).click();
    await ask.getByRole("textbox", { name: /What should we improve/ }).fill("The corrections were too many.");
    await ask.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ask.getByText("Thanks")).toBeVisible();
    await ask.getByRole("button", { name: "Continue" }).click();
    await expect(ask).toBeHidden();

    const sent = await sentFeedback(request);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ kind: "session", message: "The corrections were too many.", rating: 4 });
    await page.getByRole("button", { name: "Open debrief" }).click();
    await expect(page).toHaveURL(/\/sessions\/.+/);
  });

  test("a rating alone is enough to send (AC2)", async ({ page, request }) => {
    await finishEnglishSession(page);
    const ask = askDialog(page);
    await ask.getByRole("radio", { name: "5 of 5" }).click();
    await ask.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ask.getByText("Thanks")).toBeVisible();
    expect(await sentFeedback(request)).toEqual([{ kind: "session", message: "", rating: 5 }]);
  });

  test("negative: sessions 2 to 5 do not ask, the 6th does (AC2)", async ({ page, request }) => {
    // One session done already: the next one is the 2nd.
    await steerFeedback(request, { sessions_finished: 1 });
    await finishEnglishSession(page);
    await expect(page.getByRole("button", { name: "Open debrief" })).toBeVisible();
    await expect(askDialog(page)).toHaveCount(0);

    // Four done: the next is the 5th (no ask), then the 6th (ask).
    await steerFeedback(request, { sessions_finished: 4 });
    await finishEnglishSession(page);
    await expect(page.getByRole("button", { name: "Open debrief" })).toBeVisible();
    await expect(askDialog(page)).toHaveCount(0);

    await finishEnglishSession(page);
    await expect(askDialog(page)).toBeVisible();
  });

  test("Don't ask again stops the asks and turns the Settings switch off (AC3)", async ({ page, request }) => {
    await finishEnglishSession(page);
    await askDialog(page).getByRole("button", { name: "Don't ask again" }).click();
    await expect(askDialog(page)).toBeHidden();
    await page.getByRole("button", { name: "Open debrief" }).click();
    await expect(page).toHaveURL(/\/sessions\/.+/);

    // Settings → Privacy and data: the switch is off.
    await page.goto("/settings/privacy");
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings.getByRole("switch", { name: "Ask how a session went" })).not.toBeChecked();

    // It would have been the 6th session: no ask.
    await steerFeedback(request, { sessions_finished: 5 });
    await finishEnglishSession(page);
    await expect(page.getByRole("button", { name: "Open debrief" })).toBeVisible();
    await expect(askDialog(page)).toHaveCount(0);

    // Turned on again in Settings, the next turn asks (the 11th).
    await page.goto("/settings/privacy");
    const askSwitch = settings.getByRole("switch", { name: "Ask how a session went" });
    await expect(askSwitch).not.toBeChecked(); // the saved value, once the settings are loaded
    await askSwitch.click();
    await expect(askSwitch).toBeChecked();
    await steerFeedback(request, { sessions_finished: 10 });
    await page.goto("/");
    await finishEnglishSession(page);
    await expect(askDialog(page)).toBeVisible();
  });

  /* Regression (live check): the debrief can be ready before the server has answered whether to ask. The toast must not
   * be shown behind the dialog and lost: it waits, and after every way of closing the dialog it is there and opens the
   * debrief. The answer is held back for 3 s so the order is the bad one. */
  for (const way of ["Not now", "Escape", "Send, then Continue", "Don't ask again"] as const) {
    test(`after "${way}" the Open debrief toast shows and leads to the debrief, even when the debrief was ready first`, async ({ page }) => {
      await page.route("**/api/feedback/session-finished", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.continue();
      });
      await finishEnglishSession(page);
      const ask = askDialog(page);
      await expect(ask).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(6000); // longer than a toast lives: one shown behind the dialog would be gone by now
      if (way === "Not now") await ask.getByRole("button", { name: "Not now" }).click();
      else if (way === "Escape") await page.keyboard.press("Escape");
      else if (way === "Don't ask again") await ask.getByRole("button", { name: "Don't ask again" }).click();
      else {
        await ask.getByRole("radio", { name: "3 of 5" }).click();
        await ask.getByRole("button", { name: "Send", exact: true }).click();
        await expect(ask.getByText("Thanks")).toBeVisible();
        await ask.getByRole("button", { name: "Continue" }).click();
      }
      await expect(ask).toBeHidden();
      await page.getByRole("button", { name: "Open debrief" }).click();
      await expect(page).toHaveURL(/\/sessions\/.+/);
    });
  }

  test("no ask due: the Open debrief toast shows as before (the toast was never held back for good)", async ({ page, request }) => {
    await steerFeedback(request, { sessions_finished: 1 });
    await finishEnglishSession(page);
    await expect(page.getByRole("button", { name: "Open debrief" })).toBeVisible();
  });

  test("not set up: no question that could not be sent (AC6)", async ({ page, request }) => {
    await steerFeedback(request, { configured: false });
    await finishEnglishSession(page);
    await expect(page.getByRole("button", { name: "Open debrief" })).toBeVisible();
    await expect(askDialog(page)).toHaveCount(0);
  });
});
