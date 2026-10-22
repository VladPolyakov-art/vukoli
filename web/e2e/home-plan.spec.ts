/* QA-02: the plan card says "Preparing questions…" while Mike writes the job's questions. Starting in that window used
 * to open a session with a general-bank first question, although the plan claims the questions come from the job
 * (US-10 AC1). A slow engine (`delay_ms`) makes the window observable. */
import { expect, test, type Page } from "@playwright/test";
import { JOB_TEXT, resetApp, skipSetup, steerEngine } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** Home: paste a job, pick the round, "Nothing else": the plan card. */
async function planFromPastedJob(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Behavioural", exact: true }).click();
  await page.getByRole("button", { name: "Nothing else" }).click();
  const plan = page.getByRole("region", { name: "Here's the plan" });
  await expect(plan).toBeVisible();
  return plan;
}

test.describe("US-10 AC1 QA-02 Start waits for the job's questions", () => {
  test("both start buttons are off while the plan says 'Preparing questions…', then the first question is from the job", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { delay_ms: 5000 });
    const plan = await planFromPastedJob(page);
    await expect(plan).toContainText("Preparing questions…");
    await expect(plan.getByRole("button", { name: "Start interview" })).toBeDisabled();
    await expect(plan.getByRole("button", { name: "Type instead" })).toBeDisabled();
    await expect(plan).toContainText("Start unlocks when the questions are ready");

    await steerEngine(request, { delay_ms: 0 }); // the interviewer itself need not be slow
    await expect(plan).toContainText(/questions? ready/, { timeout: 30_000 });
    await expect(plan).not.toContainText("Preparing questions…");
    await expect(plan.getByRole("button", { name: "Start interview" })).toBeEnabled();
    await expect(plan.getByRole("button", { name: "Type instead" })).toBeEnabled();

    await plan.getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);
    // The scripted engine writes job questions as 'The posting says "..."'; a general-bank question never does.
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("The posting says");
  });

  test("negative: preparing fails, the plan says general questions will be used and start works; Try again recovers", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { fail: ["p0"] });
    const plan = await planFromPastedJob(page);
    await expect(plan).toContainText("Couldn't prepare questions from this job. Mike will use general questions.");
    await expect(plan.getByRole("button", { name: "Start interview" })).toBeEnabled();
    await expect(plan.getByRole("button", { name: "Type instead" })).toBeEnabled();

    await steerEngine(request, { fail: [] });
    await plan.getByRole("button", { name: "Try again" }).click();
    await expect(plan).toContainText(/questions? ready/, { timeout: 30_000 });
    await expect(plan.getByRole("button", { name: "Start interview" })).toBeEnabled();
  });

  test("negative: the questions never arrive, so after the wait the plan says general questions will be used and start unlocks", async ({
    page,
  }) => {
    // The request hangs (a stand-in for an engine that never answers); the page's clock jumps over the wait.
    await page.route("**/api/vacancies/*/questions", () => { /* never answered */ });
    await page.clock.install();
    const plan = await planFromPastedJob(page);
    await expect(plan).toContainText("Preparing questions…");
    await expect(plan.getByRole("button", { name: "Start interview" })).toBeDisabled();

    await page.clock.fastForward(95_000);
    await expect(plan).toContainText("Couldn't prepare questions from this job. Mike will use general questions.");
    await expect(plan.getByRole("button", { name: "Start interview" })).toBeEnabled();
    await expect(plan.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
