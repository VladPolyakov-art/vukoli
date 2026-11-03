/* D105 / US-61: search across past practices. The sidebar's "Search" row and ⌘K / Ctrl+K open a dialog; typing finds a
 * practice by its title, its job or what was said (the archived ones too); a hit opens its Debrief on the question it
 * was said in (`?q=n`). Fixture: the returning user (3 interviews that share the same three answers: yesterday, 8 and
 * 15 days ago). The second answer is "When two engineers disagreed about the release plan…". */
import { expect, test, type Page } from "@playwright/test";
import {
  ANSWER_NO_RESULT, expectNoHorizontalScroll, openMenu, questionTab, resetApp, seedReturningUser, skipSetup, startTextInterview, viewer,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const dialog = (page: Page) => page.getByRole("dialog", { name: "Search" });
const box = (page: Page) => dialog(page).getByRole("combobox", { name: "Search practices" });

/** The shell listens for the key once it is on the page: wait for it before pressing (a key sent during the load is lost). */
async function shellReady(page: Page) {
  await expect(page.locator("main")).toBeVisible();
}

/** The sidebar row (on a phone it is behind the menu button). */
async function openBySidebar(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}

test.describe("US-61 Search past practices", () => {
  test("happy path: open from the sidebar, type words from an answer, see the line with the words marked, Enter opens that question", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto("/");
    await openBySidebar(page);
    await expect(box(page)).toBeFocused();                                       // the cursor is in the input at once
    await expect(dialog(page)).toContainText("Search titles, jobs and what was said.");

    await box(page).fill("release plan");
    const rows = dialog(page).getByRole("option");
    await expect(rows).toHaveCount(3);                                           // all three practices share the answer
    const first = rows.first();                                                  // same hits: the newest first (yesterday's)
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(first).toContainText("Kestrel Pay · Product Manager");
    await expect(first).toContainText("Your answer · question 2");
    await expect(first).toContainText("disagreed about the");
    await expect(first.locator("mark")).toHaveText(["release", "plan"]);          // each word of the query is marked

    await box(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessions[0]!.id}\\?q=2$`));
    await expect(dialog(page)).toBeHidden();
    await expect(questionTab(page, 2)).toHaveAttribute("aria-selected", "true");   // question 2 is the one shown
    await expect(viewer(page).getByRole("article")).toContainText("two engineers disagreed about the release plan");
  });

  test("⌘K / Ctrl+K opens it from any page, Esc closes it and the page is where it was", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto("/archive");
    await expect(page.getByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toBeVisible();
    await expect(box(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/archive$/);

    // From a debrief too; the key typed again while it is open does not stack a second one.
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Search" })).toHaveCount(1);
    await expect(box(page)).toBeFocused();

    // Closed, the query is forgotten.
    await box(page).fill("northwind");
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(box(page)).toHaveValue("");
    await expect(dialog(page)).toContainText("Search titles, jobs and what was said.");
  });

  test("↓ and ↑ move the highlight, Enter opens the highlighted practice; a title hit opens its Debrief without a question", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto("/");
    await shellReady(page);
    await page.keyboard.press("ControlOrMeta+k");
    await box(page).fill("release plan");
    const rows = dialog(page).getByRole("option");
    await expect(rows).toHaveCount(3);
    await box(page).press("ArrowDown");
    await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(rows.first()).toHaveAttribute("aria-selected", "false");
    await expect(box(page)).toHaveAttribute("aria-activedescendant", (await rows.nth(1).getAttribute("id")) ?? "");
    await box(page).press("ArrowDown");
    await box(page).press("ArrowDown");                                          // wraps to the first
    await expect(rows.first()).toHaveAttribute("aria-selected", "true");
    await box(page).press("ArrowUp");                                            // and back round to the last
    await expect(rows.nth(2)).toHaveAttribute("aria-selected", "true");
    await box(page).press("ArrowUp");
    await box(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessions[1]!.id}\\?q=2$`));

    // The job in the title: the title row has no second line, the title carries the mark, and no question is picked.
    await page.keyboard.press("ControlOrMeta+k");
    await box(page).fill("northwind");
    const row = dialog(page).getByRole("option");
    await expect(row).toHaveCount(1);
    await expect(row.locator("mark")).toHaveText("Northwind");
    await expect(row).not.toContainText("Your answer");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessions[1]!.id}$`));
  });

  test("an archived practice is found, with its badge", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    const res = await request.patch(`/api/sessions/${sessions[2]!.id}`, { data: { archived: true } });
    expect(res.ok()).toBeTruthy();
    await page.goto("/");
    await shellReady(page);
    await page.keyboard.press("ControlOrMeta+k");
    await box(page).fill("release plan");
    const rows = dialog(page).getByRole("option");
    await expect(rows).toHaveCount(3);
    await expect(rows.last()).toContainText("Archived");
    await expect(rows.first()).not.toContainText("Archived");
    await rows.last().click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessions[2]!.id}\\?q=2$`));
  });

  test("negative: nothing matches → says so and names the words; Enter opens nothing; changing the words finds it again", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await shellReady(page);
    await page.keyboard.press("ControlOrMeta+k");
    await box(page).fill("blockchain");
    await expect(dialog(page)).toContainText("No practices match “blockchain”.");
    await expect(dialog(page).getByRole("option")).toHaveCount(0);
    await box(page).press("Enter");
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await box(page).fill("checkout");                                            // a word the seeded answers do have
    await expect(dialog(page).getByRole("option").first()).toBeVisible();
    await expect(dialog(page)).not.toContainText("No practices match");
  });

  test("negative: one character asks nothing; every word must match (a word that is nowhere → no hits)", async ({ page, request }) => {
    await seedReturningUser(request);
    const asked: string[] = [];
    page.on("request", (req) => { if (req.url().includes("/api/sessions/search")) asked.push(req.url()); });
    await page.goto("/");
    await shellReady(page);
    await page.keyboard.press("ControlOrMeta+k");
    await box(page).fill("r");
    await page.waitForTimeout(500);                                              // longer than the pause before a question is sent
    expect(asked).toEqual([]);
    await expect(dialog(page)).toContainText("Search titles, jobs and what was said.");
    await box(page).fill("release zzzz");
    await expect(dialog(page)).toContainText("No practices match “release zzzz”.");
  });

  test("negative: ⌘K does nothing in a running session (the answer box keeps its text)", async ({ page }) => {
    await startTextInterview(page);
    const answer = page.getByRole("textbox", { name: "Your answer" });
    await answer.fill(ANSWER_NO_RESULT.slice(0, 40));
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toHaveCount(0);
    await expect(answer).toHaveValue(ANSWER_NO_RESULT.slice(0, 40));
  });

  test("it fits the screen: the sidebar row, the box and the hits stay inside the window", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openBySidebar(page);
    await box(page).fill("checkout");
    await expect(dialog(page).getByRole("option").first()).toBeVisible();
    const width = page.viewportSize()?.width ?? 1440;
    const bounds = await dialog(page).boundingBox();
    expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width).toBe(true);
    await expectNoHorizontalScroll(page);
  });
  test("the ⌘K hint is a ghost pill that shows only while the row is hovered or keyboard-focused; never on a touch screen", async ({ page }, info) => {
    await page.goto("/");
    await shellReady(page);
    await openMenu(page);
    const row = page.getByRole("button", { name: "Search", exact: true });
    const hint = row.locator("kbd");
    const shown = hint.locator("xpath=..");                                           // its wrapper carries the fade
    await expect(row).toHaveAttribute("aria-keyshortcuts", /^(Meta|Control)\+K$/);   // the shortcut stays in the accessible description
    if (info.project.name === "mobile") {
      await expect(hint).toBeHidden();                                              // touch: never
      return;
    }
    await expect(shown).toHaveCSS("opacity", "0");                                    // at rest: nothing
    await expect(hint).toHaveCSS("border-radius", "9999px");                         // fully rounded
    await expect(hint).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");            // ghost: no fill
    await row.hover();
    await expect(shown).toHaveCSS("opacity", "1");
    await expect(hint).toHaveText(/^(⌘K|Ctrl K)$/);
    await page.mouse.move(700, 450);
    await expect(shown).toHaveCSS("opacity", "0");
    // Keyboard focus shows it too.
    for (let i = 0; i < 20 && !(await row.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(row).toBeFocused();
    await expect(shown).toHaveCSS("opacity", "1");
  });

  test("the search box is calm: no fill, no border and no outline when it has the cursor; it keeps its roles and placeholder", async ({ page }) => {
    await page.goto("/");
    await shellReady(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(box(page)).toBeFocused();
    await expect(box(page)).toHaveAttribute("placeholder", "Search practices");
    await expect(box(page)).toHaveCSS("outline-style", "none");
    await expect(box(page)).toHaveCSS("border-top-width", "0px");
    await expect(box(page)).toHaveCSS("border-bottom-width", "0px");
    await expect(box(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(dialog(page).getByRole("listbox")).toHaveCount(0);                  // no results yet: nothing expanded
    await expect(box(page)).toHaveAttribute("aria-expanded", "false");
  });
});
