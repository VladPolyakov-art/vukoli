/* The debrief of an interview with follow-ups (synthetic runs c1-r1 C3, c1-r2 R2-1, R2-2, R2-3): a saved session of five
 * questions where question 4 has two follow-ups (server fixture `followups`, a real test-engine session). The numbers in
 * the plan and in "Lost points" are question numbers (the tabs), a question shows each follow-up with its own question
 * and answer after the main answer, and a question's feedback is about that question. Desktop and mobile project. */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { openSkills, questionTab, resetApp, seedReturningUser, skipSetup, viewer } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

async function seedFollowUps(request: APIRequestContext) {
  const res = await request.post("/api/_e2e/seed", { data: { fixture: "followups" } });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { sessions: { id: string }[] }).sessions[0]!.id;
}

const plan = (page: Page) => page.getByRole("region", { name: "Your plan for the next session" });
const article = (page: Page) => viewer(page).getByRole("article");

/** The numbers of the question links of one block ("Go to question 5" → 5). */
async function linkedQuestions(block: ReturnType<Page["locator"]>) {
  const labels = await block.getByRole("button", { name: /^Go to question \d+$/ }).evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return labels.map((label) => Number(/\d+/.exec(label)![0]));
}

test.describe("Question numbers in a debrief with follow-ups (R2-1)", () => {
  test("happy path: the plan names only questions the session has, and a number opens that question", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}`);
    await expect(plan(page)).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(5);
    const numbers = await linkedQuestions(plan(page));
    expect(numbers.length).toBeGreaterThan(5);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(5);
    // The first step: "End with the result", seen in questions 4 and 5 (was "5, 6, 7").
    const first = plan(page).getByRole("listitem").first();
    await expect(first).toContainText("End with the result");
    expect(await linkedQuestions(first)).toEqual([4, 5]);
    await first.getByRole("button", { name: "Go to question 5" }).click();
    await expect(page).toHaveURL(/[?&]q=5\b/);
    await expect(questionTab(page, 5)).toHaveAttribute("aria-selected", "true");
    await expect(article(page)).toContainText("Tell me about a project that did not go as planned.");
  });

  test("the skills card lists question numbers of the tabs too, and a link opens its question", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}`);
    const card = await openSkills(page);
    const numbers = await linkedQuestions(card);
    expect(numbers.length).toBeGreaterThan(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(5);
    await card.getByRole("button", { name: "Go to question 5" }).first().click();
    await expect(questionTab(page, 5)).toHaveAttribute("aria-selected", "true");
  });

  test("negative: a session without follow-ups keeps its numbers (one answer, one question)", async ({ page, request }) => {
    const { sessions } = await seedReturningUser(request);
    await page.goto(`/sessions/${sessions[0]!.id}`);
    await expect(plan(page)).toBeVisible();
    const tabs = await page.getByRole("tab").count();
    const numbers = await linkedQuestions(plan(page));
    expect(Math.max(...numbers)).toBeLessThanOrEqual(tabs);
  });
});

test.describe("The plan steps (C3)", () => {
  test("each step has the title of its own weak spot", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}`);
    const steps = plan(page).getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("End with the result");
    await expect(steps.nth(1)).toContainText("Say what you did");
    await expect(steps.nth(1)).not.toContainText("End with the result");
    await expect(steps.nth(1)).toContainText("Retell one story using only sentences that start with");
    await expect(steps.nth(2)).toContainText("Answers too short");
  });
});

test.describe("A question with two follow-ups (R2-2)", () => {
  test("happy path: the main answer, then each follow-up with its own question and answer", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}?q=4`);
    const card = article(page);
    await expect(card).toContainText("2 follow-ups");
    const text = await card.innerText();
    const order = [
      "We changed the plan and it was fine.",
      "Follow-up 1:", "What was the first thing you did when you heard?", "I called the team together and we re-ranked the backlog in an hour.",
      "Follow-up 2:", "What would you ask earlier next time to avoid the surprise?", "Next time I would ask stakeholders about open assumptions during kickoff.",
    ].map((s) => text.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await expect(card.getByRole("heading", { name: "Your follow-up answer" })).toHaveCount(2);
  });

  test("negative: a question with no follow-up has none of it", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}?q=2`);
    await expect(article(page)).toContainText("no follow-up");
    await expect(article(page).getByRole("heading", { name: "Your follow-up answer" })).toHaveCount(0);
    await expect(article(page)).not.toContainText("Follow-up:");
  });
});

test.describe("Feedback of the last question (R2-3)", () => {
  test("Q5 says where it lost points and does not quote question 4", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}?q=5`);
    const card = article(page);
    await expect(card).toContainText("Tell me about a project that did not go as planned.");
    await expect(card).toContainText("Lost points on");
    await expect(card).not.toContainText("No points lost");
    await expect(card).not.toContainText("I called the team together");
  });

  test("question 4 starts its feedback with the weak spot and what was said in it", async ({ page, request }) => {
    const id = await seedFollowUps(request);
    await page.goto(`/sessions/${id}?q=4`);
    await expect(article(page)).toContainText("End with the result");
    await expect(article(page)).toContainText("I called the team together");
  });
});
