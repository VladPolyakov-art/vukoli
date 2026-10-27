/* The saved-session page opens on the Debrief (D101, 2026-10-27): a "Debrief | Conversation" switch sits under the title,
 * `?view=conversation` deep-links the chat (`?view=debrief`, the old links, is still the debrief), one "Practise again" sits
 * next to the switch in both views, and nothing scrolls sideways. Runs on the desktop and the mobile project. */
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, resetApp, seedReturningUser, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const log = (page: Page) => page.getByRole("log", { name: "Conversation with Mike" });
const verdict = (page: Page) => page.getByRole("region", { name: /^Verdict/ });
const radio = (page: Page, name: "Conversation" | "Debrief") => page.getByRole("radio", { name, exact: true });

/** The newest seeded session's id. */
async function openSession(page: Page, request: Parameters<typeof seedReturningUser>[0], search = "") {
  const { sessions } = await seedReturningUser(request);
  await page.goto(`/sessions/${sessions[0]!.id}${search}`);
}

/** Sideways wheel (a trackpad swipe) over the page: nothing may move. */
async function swipeSideways(page: Page) {
  const box = (await page.locator("main").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(300, 0);
  await page.waitForTimeout(150);
  const moved = await page.evaluate(() => {
    const scrollers = [document.scrollingElement!, ...Array.from(document.querySelectorAll("main, main *"))];
    return scrollers.filter((el) => el.scrollLeft !== 0).length;
  });
  expect(moved).toBe(0);
}

test.describe("Debrief-first saved session", () => {
  test("happy path: opens on the debrief, with the switch under the title, Debrief first", async ({ page, request }) => {
    await openSession(page, request);
    await expect(page.getByRole("heading", { name: "Kestrel Pay · Product Manager", level: 1 })).toBeVisible();
    await expect(verdict(page)).toBeVisible();
    await expect(radio(page, "Debrief")).toBeChecked();
    await expect(log(page)).toHaveCount(0);
    // The order of the switch is Debrief, Conversation (the keyboard follows it).
    await expect(page.getByRole("radiogroup", { name: "View" }).getByRole("radio")).toHaveText(["Debrief", "Conversation"]);
    // The switch is under the title.
    const [title, sw] = await Promise.all([
      page.getByRole("heading", { level: 1 }).boundingBox(),
      page.getByRole("radiogroup", { name: "View" }).boundingBox(),
    ]);
    expect(sw!.y).toBeGreaterThan(title!.y);
  });

  test("the switch moves to the conversation and back, and keeps the view in the URL", async ({ page, request }) => {
    await openSession(page, request);
    await radio(page, "Conversation").click();
    await expect(page).toHaveURL(/\?view=conversation$/);
    await expect(log(page)).toBeVisible();
    await expect(verdict(page)).toHaveCount(0);
    // The conversation takes the main area's width instead of a narrow column.
    const [main, chat] = await Promise.all([page.locator("main").boundingBox(), log(page).boundingBox()]);
    expect(chat!.width).toBeGreaterThanOrEqual(main!.width * 0.8);
    await radio(page, "Debrief").click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(verdict(page)).toBeVisible();
    await expect(log(page)).toHaveCount(0);
  });

  test("arrow keys on the switch follow its order: Debrief, then Conversation", async ({ page, request }) => {
    await openSession(page, request);
    await radio(page, "Debrief").focus();
    await page.keyboard.press("ArrowRight");
    await expect(radio(page, "Conversation")).toBeChecked();
    await expect(log(page)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, "Debrief")).toBeChecked();
    await expect(verdict(page)).toBeVisible();
  });

  test("a deep link ?view=conversation opens the chat, and a reload keeps it", async ({ page, request }) => {
    await openSession(page, request, "?view=conversation");
    await expect(log(page)).toBeVisible();
    await expect(radio(page, "Conversation")).toBeChecked();
    await expect(verdict(page)).toHaveCount(0);
    await page.reload();
    await expect(log(page)).toBeVisible();
  });

  test("an old link ?view=debrief is still the debrief", async ({ page, request }) => {
    await openSession(page, request, "?view=debrief");
    await expect(verdict(page)).toBeVisible();
    await expect(radio(page, "Debrief")).toBeChecked();
    await expect(log(page)).toHaveCount(0);
    await page.reload();
    await expect(verdict(page)).toBeVisible();
  });

  test("negative: an unknown ?view= value falls back to the debrief", async ({ page, request }) => {
    await openSession(page, request, "?view=nonsense");
    await expect(verdict(page)).toBeVisible();
    await expect(radio(page, "Debrief")).toBeChecked();
  });

  test("the example opens on the debrief too, and ?view=conversation is its chat", async ({ page }) => {
    await page.goto("/sessions/example");
    await expect(radio(page, "Debrief")).toBeChecked();
    await expect(page.getByRole("radiogroup", { name: "View" }).getByRole("radio")).toHaveText(["Debrief", "Conversation"]);
    await radio(page, "Conversation").click();
    await expect(page).toHaveURL(/\?view=conversation$/);
    await expect(radio(page, "Conversation")).toBeChecked();
  });

  test("one 'Practise again' near the top in both views, with the hint as a description", async ({ page, request }) => {
    await openSession(page, request);
    const again = page.getByRole("button", { name: "Practise again" });
    for (const view of ["Debrief", "Conversation"] as const) {
      await radio(page, view).click();
      await expect(radio(page, view)).toBeChecked();
      await expect(again).toHaveCount(1);
      await expect(again).toHaveAttribute("aria-description", "Same job and round, new questions");
      // Next to the switch, above the content.
      const [btn, sw] = await Promise.all([again.boundingBox(), page.getByRole("radiogroup", { name: "View" }).boundingBox()]);
      expect(Math.abs(btn!.y - sw!.y)).toBeLessThan(120);
    }
    // The old lower copy and its hint line are gone.
    await expect(page.getByRole("region", { name: "What next" })).toHaveCount(0);
    await expect(page.getByText("Same job and round, new questions", { exact: true })).toHaveCount(0);
  });

  test("the question jump bar in the conversation scrolls to that question", async ({ page, request }) => {
    await openSession(page, request, "?view=conversation");
    const jump = page.getByRole("radiogroup", { name: "Jump to question" });
    await expect(jump).toBeVisible();
    await jump.getByRole("radio").nth(1).click();
    await expect(jump.getByRole("radio").nth(1)).toBeChecked();
    await expect(page.locator("[data-question='2']")).toBeInViewport();
  });
});

test.describe("Nothing scrolls sideways", () => {
  for (const view of ["", "?view=conversation"]) {
    test(`no horizontal overflow and no sideways scroll (${view || "debrief"})`, async ({ page, request }) => {
      await openSession(page, request, view);
      await expect(view ? log(page) : verdict(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
      await swipeSideways(page);
    });
  }
});
