/* Negotiation v2: an interview that ends with a salary talk (docs/features/tough-talk/prd-v2.md, Orchestrator decisions).
 * Home plan: "Salary talk" row, off by default; on, with numbers, Start sends money_talk and the negotiate block. The
 * session shows the switch to the salary part ("Salary talk" in the progress), and the debrief gets a "Salary talk" frame. */
import { expect, test, type Page } from "@playwright/test";
import { JOB_TEXT, conversation, endSession, resetApp, sendAnswer, showDebrief, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

async function planWithSalaryTalk(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Behavioural", exact: true }).click();
  await page.getByRole("button", { name: "Nothing else" }).click();
  const plan = page.getByRole("region", { name: "Here's the plan" });
  await expect(plan).toBeVisible();
  return plan;
}

const ANSWER = "I led the checkout team, and activation went up by twelve percent in one quarter.";

test.describe("Interview that ends with a salary talk", () => {
  test("turning it on without a target asks for the numbers; the session switches to the salary part; the debrief has a Salary talk frame", async ({ page }) => {
    test.setTimeout(120_000);
    const plan = await planWithSalaryTalk(page);
    await expect(plan).toContainText("Off. The interview ends after the last question.");
    await plan.getByRole("button", { name: "Turn on" }).click();
    const dialog = page.getByRole("dialog", { name: "Salary talk numbers" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("My target").fill("95000");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(plan).toContainText("On. After the last question Mike asks about salary.");

    await page.getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();

    // Answer until Mike switches to the salary part: the progress reads "Salary talk".
    const salary = page.getByText("Salary talk", { exact: true }).first();
    for (let i = 0; i < 12 && !(await salary.isVisible()); i++) {
      await sendAnswer(page, ANSWER);
      await page.waitForTimeout(700);
    }
    await expect(salary).toBeVisible();
    await sendAnswer(page, "Based on the scope and my results, I am aiming for 95,000.");
    await expect(conversation(page)).toContainText("95,000");

    await (await endSession(page, "End")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Salary talk", level: 2 })).toBeVisible();
  });

  test("off by default: an interview without it has no Salary talk frame", async ({ page }) => {
    const plan = await planWithSalaryTalk(page);
    await expect(plan.getByRole("button", { name: "Turn on" })).toBeVisible();
    await expect(plan.getByRole("button", { name: "Turn off" })).toHaveCount(0);
  });
});
