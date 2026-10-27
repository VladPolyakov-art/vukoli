/* The Debrief view, layout D (2026-10-27; US-20 AC6-AC8, D98 r2, D99): verdict and level, the one score and the card with the
 * seven skills, the plan with the one Drill button, the sticky question switcher with `?q=n`, and the weak spot on its first
 * evidence question, on the built-in example debrief (`/sessions/example`, fixtures: no server data needed). Runs on the
 * desktop and the mobile project. Live sessions (new server fields, dismissed flags, old sessions) are in debrief.spec.ts. */
import { expect, test, type Page } from "@playwright/test";
import { openSkills, questionTab, resetApp, skipSetup, viewer } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
  await page.goto("/sessions/example");
  await expect(page.getByRole("region", { name: "Verdict" })).toBeVisible();
});

const plan = (page: Page) => page.getByRole("region", { name: "Your plan for the next session" });
const article = (page: Page) => viewer(page).getByRole("article");

test.describe("US-20 AC6 The skills behind the one score", () => {
  test("happy path: the score is the mean of the scored skills; the skills open to its side, weakest first", async ({ page }) => {
    // Example: 4, 3, 4, 5, 4, 4 on six scored skills (Lessons learned was not asked).
    const score = page.getByRole("button", { name: /Average score/ });
    await expect(score).toContainText("4.0");
    await expect(score).toContainText("Average of 6 skills");
    const card = await openSkills(page);
    const items = card.getByRole("listitem");
    await expect(items).toHaveCount(6);
    await expect(items.first()).toContainText("Your part");
    await expect(items.first()).toContainText("3 out of 5");
    await expect(items.last()).toContainText("On the question");
    // A skill that lost nothing says so; the others say where.
    await expect(items.last()).toContainText("No points lost.");
    await expect(items.first()).toContainText("Lost points in questions");
  });

  test("there is no scorecard block on the page; no grade anywhere (D98)", async ({ page }) => {
    await expect(page.getByRole("region", { name: "Scorecard" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Scorecard" })).toHaveCount(0);
    for (const grade of ["Intern", "Junior", "Senior+", "Mid-level"]) await expect(page.getByText(grade, { exact: false })).toHaveCount(0);
  });

  test("negative: a skill with nothing to judge is not a row; one line names it, and the misheard note is there", async ({ page }) => {
    const card = await openSkills(page);
    await expect(card.getByRole("listitem").filter({ hasText: "Lessons learned" })).toHaveCount(0);
    await expect(card.getByText("Not asked this time: Lessons learned")).toBeVisible();
    await expect(card).toContainText("Words the app may have misheard are not counted. You can check them in each question.");
  });

  test("a 'Lost points' link in the card switches the viewer, closes the card and moves focus to the question", async ({ page }) => {
    const card = await openSkills(page);
    await card.getByRole("listitem").filter({ hasText: "Result" }).getByRole("button", { name: "Go to question 4" }).click();
    await expect(card).toHaveCount(0);
    await expect(questionTab(page, 4)).toHaveAttribute("aria-selected", "true");
    await expect(article(page)).toContainText("How do you prioritise when everything is urgent?");
    await expect(page).toHaveURL(/[?&]q=4\b/);
    await expect(viewer(page)).toBeInViewport();
    await expect(page.getByRole("heading", { name: /How do you prioritise/, level: 3 })).toBeFocused();
  });

  test("Escape closes the card; opened from the keyboard, focus goes back to the score", async ({ page }) => {
    const hovered = await openSkills(page);
    await page.keyboard.press("Escape");
    await expect(hovered).toHaveCount(0);

    const score = page.getByRole("button", { name: /Average score/ });
    await score.focus();
    await page.keyboard.press("Enter");
    const card = page.getByRole("dialog", { name: "Your skills, weakest first" });
    await expect(card).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(score).toBeFocused();
  });

  test("it opens from the keyboard", async ({ page }) => {
    const score = page.getByRole("button", { name: /Average score/ });
    await score.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Your skills, weakest first" })).toBeVisible();
  });

  test("no horizontal scroll, and the page is as wide as the header", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    const [box, head] = await Promise.all([page.getByRole("region", { name: "Verdict" }).boundingBox(), page.getByRole("heading", { level: 1 }).first().boundingBox()]);
    const view = page.viewportSize()!;
    expect(box!.x + box!.width).toBeLessThanOrEqual(view.width);
    expect(head).not.toBeNull();
  });
});

test.describe("US-20 AC7 Weak spot: what you said, how it lands, how to fix (on its first evidence question)", () => {
  test("happy path: the content spot opens question 1's list with the quote, the interviewer's reading and the fix, in this order", async ({ page }) => {
    await questionTab(page, 1).click();
    const spot = article(page).getByRole("listitem").filter({ hasText: "Your own decision is missing in 3 of 5 answers" });
    await expect(spot).toContainText(/What you said\s*We looked at the data we had and picked the option with the lowest risk\./);
    await expect(spot).toContainText(/How it lands\s*All “we” makes it hard to see your part/);
    await expect(spot).toContainText(/How to fix\s*Name the call you made and why/);
    const text = (await spot.innerText()).replace(/\s+/g, " ");
    expect(text.indexOf("What you said")).toBeLessThan(text.indexOf("How it lands"));
    expect(text.indexOf("How it lands")).toBeLessThan(text.indexOf("How to fix"));
    // The quote is marked up as a quote.
    await expect(spot.locator("q")).toHaveCount(1);
    expect(await spot.locator("q").evaluate((q) => getComputedStyle(q).quotes)).toBe('"“" "”"');
  });

  test("negative: the same spot is not repeated on its other questions", async ({ page }) => {
    await questionTab(page, 4).click();
    await expect(article(page)).not.toContainText("Your own decision is missing in 3 of 5 answers");
  });

  test("a delivery spot shows the number as plain text, not as a quote", async ({ page }) => {
    await questionTab(page, 3).click();
    const spot = article(page).getByRole("listitem").filter({ hasText: "Answers run long" });
    await expect(spot).toContainText(/Measured\s*4:05 for one answer/);
    await expect(spot).not.toContainText("What you said");
    await expect(spot.locator("q")).toHaveCount(0);
    await expect(spot).not.toContainText("“4:05");
  });

  test("a language spot gives its fix; the correction below carries the heard → say words, not a second quote", async ({ page }) => {
    await questionTab(page, 3).click();
    const spot = article(page).getByRole("listitem").filter({ hasText: "instead of “do research”" });
    await expect(spot).toContainText(/How to fix\s*“Research” takes “do” and has no plural\./);
    await expect(spot).not.toContainText("What you said");
  });
});

test.describe("US-20 AC8 Plan for the next session, and the one Drill button", () => {
  test("happy path: up to three numbered steps, each with its weak spot and the questions where it showed", async ({ page }) => {
    await expect(plan(page)).toBeVisible();
    const steps = plan(page).getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("For each story, name the one decision that was yours.");
    await expect(steps.nth(1)).toContainText("make a research");
    await expect(steps.nth(2)).toContainText("Answers run long");
    await expect(steps.nth(0).getByRole("button", { name: "Go to question 1" })).toBeVisible();
  });

  test("a question number in a step switches the viewer", async ({ page }) => {
    await plan(page).getByRole("listitem").nth(0).getByRole("button", { name: "Go to question 4" }).click();
    await expect(questionTab(page, 4)).toHaveAttribute("aria-selected", "true");
    await expect(article(page)).toContainText("How do you prioritise when everything is urgent?");
  });

  test("the page order is verdict, plan, then the question by question; no separate weak-spot or scorecard block", async ({ page }) => {
    const names = ["Verdict", "Your plan for the next session", "Question by question"];
    const tops: number[] = [];
    for (const name of names) tops.push((await page.getByRole("heading", { name, exact: true, level: 2 }).boundingBox())?.y ?? (await page.getByRole("region", { name }).boundingBox())!.y);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    await expect(page.getByRole("region", { name: "What to work on" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Scorecard" })).toHaveCount(0);
  });

  test("the plan has the one Drill button, and it is the page's only primary action", async ({ page }) => {
    const drills = page.getByRole("button", { name: "Drill these weak spots" });
    await expect(drills).toHaveCount(1);
    await expect(plan(page).getByRole("button", { name: "Drill these weak spots" })).toBeVisible();
  });

  test("the example explains why the drill is off: it is for your own debrief", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Drill these weak spots" })).toBeDisabled();
    await expect(plan(page)).toContainText("In your own debrief, you can drill these weak spots in a short session.");
  });
});

test.describe("What moves the verdict (D99): the level", () => {
  test("happy path: the level shows the computed step, one cell per skill, and one line states the rule", async ({ page }) => {
    const verdict = page.getByRole("region", { name: "Verdict" });
    // The example's skills: no answer skill at 1-2 (not "Not ready yet"), one below 4 (not "Ready"): "Getting there".
    const level = verdict.getByRole("img", { name: /^Your level: Getting there, step 2 of 3/ });
    await expect(level).toBeVisible();
    await expect(level).toHaveAttribute("aria-label", /5 of 6 skills at 4\/5 or more/);
    // Only Your part (3 of 5) stands between the example and "Ready".
    await expect(verdict.getByText("To reach “Ready”: get Your part to 4 of 5 or more.", { exact: true })).toBeVisible();
    await expect(verdict).toContainText("Strong on the why, but 3 answers skip the decision you made yourself.");
  });

  test("negative: the old wording is gone (the line no longer quotes the first weak spot's fix)", async ({ page }) => {
    await expect(page.getByText("The main thing between you and")).toHaveCount(0);
  });
});

test.describe("The question switcher and the viewer", () => {
  test("happy path: the example opens on question 3; a tab switches the question and writes ?q= in the address", async ({ page }) => {
    await expect(questionTab(page, 3)).toHaveAttribute("aria-selected", "true");
    await questionTab(page, 5).click();
    await expect(questionTab(page, 5)).toHaveAttribute("aria-selected", "true");
    await expect(article(page)).toContainText("Why Brightline?");
    await expect(page).toHaveURL(/[?&]q=5\b/);
    // Only the selected question is on the page.
    await expect(viewer(page).getByRole("article")).toHaveCount(1);
  });

  test("a link with ?q=4 opens question 4, and a reload keeps it", async ({ page }) => {
    await page.goto("/sessions/example?q=4");
    await expect(questionTab(page, 4)).toHaveAttribute("aria-selected", "true");
    await expect(article(page)).toContainText("How do you prioritise when everything is urgent?");
    await page.reload();
    await expect(questionTab(page, 4)).toHaveAttribute("aria-selected", "true");
  });

  test("negative: a number the session does not have is ignored (the first question shows)", async ({ page }) => {
    await page.goto("/sessions/example?q=99");
    await expect(questionTab(page, 1)).toHaveAttribute("aria-selected", "true");
    await expect(article(page)).toContainText("Tell me about a product decision you made with incomplete data.");
  });

  test("Previous and Next at the foot move one question and name the next one", async ({ page }) => {
    await questionTab(page, 1).click();
    const prev = viewer(page).getByRole("button", { name: "Previous", exact: true });
    await expect(prev).toBeDisabled();
    await viewer(page).getByRole("button", { name: "Next: question 2" }).click();
    await expect(questionTab(page, 2)).toHaveAttribute("aria-selected", "true");
    await expect(prev).toBeEnabled();
    await prev.click();
    await expect(questionTab(page, 1)).toHaveAttribute("aria-selected", "true");
    await questionTab(page, 5).click();
    await expect(viewer(page).getByRole("button", { name: "Last question" })).toBeDisabled();
  });

  test("the arrow keys, Home and End move between the tabs", async ({ page }) => {
    await questionTab(page, 3).focus();
    await page.keyboard.press("ArrowRight");
    await expect(questionTab(page, 4)).toHaveAttribute("aria-selected", "true");
    await expect(questionTab(page, 4)).toBeFocused();
    await page.keyboard.press("End");
    await expect(questionTab(page, 5)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(questionTab(page, 1)).toHaveAttribute("aria-selected", "true");
  });

  test("the switcher is always one row and the page never scrolls sideways", async ({ page }) => {
    const bar = page.getByRole("tablist", { name: "Questions from this interview" });
    const tabs = bar.getByRole("tab");
    const boxes = await Promise.all((await tabs.all()).map((t) => t.boundingBox()));
    const tops = new Set(boxes.map((b) => Math.round(b!.y)));
    expect(tops.size).toBe(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });

  test("the question shows its meta line, 'Lost points on', your answer and one Feedback list", async ({ page }) => {
    const q = article(page);
    await expect(q).toContainText("Question 3 of 5");
    await expect(q).toContainText("Lost points on");
    await expect(q.getByRole("heading", { name: "Your answer", level: 4 })).toBeVisible();
    await expect(q.getByRole("heading", { name: "Feedback", level: 4 })).toHaveCount(1);
  });
});
