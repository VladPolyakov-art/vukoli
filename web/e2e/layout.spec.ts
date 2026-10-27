/* G4: at 375 px no page scrolls sideways. The viewport is set here, so the check is the same in both projects. */
import { expect, test } from "@playwright/test";
import {
  ENGLISH_TURN,
  ANSWER_NO_RESULT,
  expectNoHorizontalScroll,
  resetApp,
  seedReturningUser,
  sendAnswer,
  skipSetup,
  startTextInterview,
} from "./helpers";

test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

test.describe("G4 No horizontal scroll at 375 px", () => {
  test("the setup wizard", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem("ic.setupDone"));
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Choose how Mike runs", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("radio", { name: /^Ollama/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Quick mic check", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("home, archive, trash and settings, with a returning user's history", async ({ page, request }) => {
    await seedReturningUser(request);
    for (const [url, heading] of [
      ["/", "What are we practising today?"],
      ["/archive", "Archive"],
      ["/archive/trash", "Trash"],
    ] as const) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await page.goto("/settings/general");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a finished interview's debrief (the default view), with the long job title", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a finished interview's conversation (?view=conversation), with the long job title", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}?view=conversation`);
    await expect(page.getByRole("log", { name: "Conversation with Mike" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("radio", { name: "Debrief" }).click();
    await expect(page.getByRole("region", { name: /^Verdict/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a live interview session, with a long answer in the conversation", async ({ page }) => {
    await startTextInterview(page);
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(page.getByText("Follow-up", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a live English session", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Practise English" }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: /^B1/ }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Talk about your work" }).click();
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Type instead" }).click();
    await sendAnswer(page, ENGLISH_TURN);
    await expect(page.getByText("Turn 2")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
