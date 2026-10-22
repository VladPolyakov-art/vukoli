/* Flow A: the first run. Engine -> check -> about you -> the first question, in text mode (the suite has no microphone).
 * US-02 (wizard), US-03 (engine picker), US-06 (microphone), US-08 (CV), US-09 (job). */
import { expect, test } from "@playwright/test";
import {
  CV_TEXT,
  JOB_TEXT,
  NAME,
  collectPageErrors,
  denyMicrophone,
  resetApp,
  steerEngine,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetApp(request);
});

/** Engine step -> voice check -> About you, in text mode. */
async function reachAboutStep(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("radio", { name: /^Ollama/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I'll type instead" }).first().click();
  await expect(page.getByRole("heading", { name: "About you", level: 1 })).toBeVisible();
}

test.describe("US-02 First-run wizard", () => {
  test("happy path: engine, check, profile and a first question in text mode", async ({ page }) => {
    const errors = collectPageErrors(page);
    await denyMicrophone(page);

    // AC1: the first open lands on the wizard and shows the steps in order, with the current one visible.
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);
    const steps = page.getByRole("navigation", { name: "Setup steps" }).getByRole("listitem");
    await expect(steps).toHaveText([/AI engine/, /Check/, /About you/]);
    await expect(page.getByRole("heading", { name: "Choose how Mike runs", level: 1 })).toBeVisible();
    // 13 (QA-06): the recommended engine is picked for you when it is Ready, so Continue is on from the start.
    const ollama = page.getByRole("radio", { name: /^Ollama/ });
    await expect(ollama).toContainText("Ready");
    await expect(ollama).toBeChecked();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await expect(page.getByText("Connected.")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // The check step: no microphone, so the user goes on in text mode (AC4, see the negative test below).
    await expect(page.getByRole("heading", { name: "Quick mic check", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "I'll type instead" }).first().click();

    // AC3: the profile step; the name, the CV text and a job are all optional but can be filled in.
    await expect(page.getByRole("heading", { name: "About you", level: 1 })).toBeVisible();
    await page.getByRole("textbox", { name: "What should Mike call you?" }).fill(NAME);
    await page.getByRole("button", { name: "Add text instead" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill(CV_TEXT);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Add a job" }).click();
    const job = page.getByRole("dialog", { name: "Add a job" });
    await job.getByRole("textbox", { name: "Job description" }).fill(JOB_TEXT);
    await expect(job.getByRole("textbox", { name: "Company" })).toHaveValue("Kestrel Pay");
    await expect(job.getByRole("textbox", { name: "Role" })).toHaveValue("Product Manager");
    await job.getByRole("button", { name: "Save job" }).click();
    await expect(page.getByText("Kestrel Pay · Product Manager")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Keyboard" })).toBeChecked();

    // AC7: no account, survey or attribution question anywhere in the wizard.
    await expect(page.getByLabel(/e-?mail|password|how did you hear/i)).toHaveCount(0);

    // The first question comes from the job, in the user's name.
    await page.getByRole("button", { name: "Start the first round" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole("heading", { name: "Question 1", level: 2 })).toBeVisible();
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText(`Hi ${NAME}, I'm Mike`);
    await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();

    // AC6: once the wizard is done, the app opens on home, not on the wizard.
    await page.goto("/");
    // Q4 / US-08 AC3: Home greets by the name given in the wizard.
    await expect(page.getByRole("heading", { name: `What are we practising today, ${NAME}?`, level: 1 })).toBeVisible();
    await expect(page).not.toHaveURL(/\/setup/);
    expect(errors).toEqual([]);
  });

  test("the profile and the job are saved on this computer (US-08 AC1, US-09 AC1)", async ({ page, request }) => {
    await denyMicrophone(page);
    await reachAboutStep(page);
    await page.getByRole("button", { name: "Add text instead" }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill(CV_TEXT);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Add a job" }).click();
    const job = page.getByRole("dialog", { name: "Add a job" });
    await job.getByRole("textbox", { name: "Job description" }).fill(JOB_TEXT);
    await job.getByRole("button", { name: "Save job" }).click();
    await expect(page.getByText("Kestrel Pay · Product Manager")).toBeVisible();

    // The user sees it again after a reload (it is stored, not just on screen).
    await expect.poll(async () => (await (await request.get("/api/profile")).json()).text).toContain("Alex Morgan");
    await expect
      .poll(async () => JSON.stringify(await (await request.get("/api/vacancies")).json()))
      .toContain("Kestrel Pay");
  });

  test("not now: the wizard can be left after the engine, home works with general questions (US-08 AC3)", async ({
    page,
  }) => {
    await denyMicrophone(page);
    await reachAboutStep(page);
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "General questions" })).toBeVisible();
  });

  test("negative: the microphone is blocked, the wizard says why and finishes in text mode (AC4, US-06 AC2)", async ({
    page,
  }) => {
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("radio", { name: /^Ollama/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Start the check" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Vukoli can't use the microphone");
    await expect(alert).toContainText("Allow the microphone in your browser's address bar");
    // QA-05: the macOS system switch is named too, not only the browser's address bar.
    await expect(alert).toContainText("On a Mac: System Settings → Privacy & Security → Microphone");
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();

    // The way out is the keyboard, and the wizard can be finished that way.
    // F-13-10: one "I'll type instead" on the step, in the footer; the error does not repeat it.
    await expect(page.getByRole("button", { name: "I'll type instead" })).toHaveCount(1);
    await expect(alert.getByRole("button", { name: "I'll type instead" })).toHaveCount(0);
    await page.getByRole("button", { name: "I'll type instead" }).click();
    await expect(page.getByRole("heading", { name: "About you", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
  });

  test("boundary: a job with no text cannot be saved (US-09)", async ({ page }) => {
    await denyMicrophone(page);
    await reachAboutStep(page);
    await page.getByRole("button", { name: "Add a job" }).click();
    const job = page.getByRole("dialog", { name: "Add a job" });
    await expect(job.getByRole("button", { name: "Save job" })).toBeDisabled();
    await job.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Add a job" })).toBeHidden();
  });
});

test.describe("US-02 AC5 / US-03 The engine is not ready", () => {
  test("negative: Ollama is not running, the wizard says so and Connect brings it up", async ({ page, request }) => {
    await steerEngine(request, { status: "not_running" });
    await page.goto("/");
    const ollama = page.getByRole("radio", { name: /^Ollama/ });
    await expect(ollama).toContainText("Needs setup");
    await ollama.click();

    // Which prerequisite failed and how to fix it; the user cannot go on before it is fixed.
    await expect(page.getByText("Ollama is installed but not running")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByText("Continue once Ollama is Ready.")).toBeVisible();

    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByText("Connected.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("negative: Check again re-checks without restarting the wizard", async ({ page, request }) => {
    await steerEngine(request, { status: "not_running" });
    await page.goto("/");
    await expect(page.getByRole("radio", { name: /^Ollama/ })).toContainText("Needs setup");

    await steerEngine(request, { status: "ready" }); // the user opens Ollama in the meantime
    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByRole("radio", { name: /^Ollama/ })).toContainText("Ready");
    await expect(page.getByRole("heading", { name: "Choose how Mike runs", level: 1 })).toBeVisible();
    await page.getByRole("radio", { name: /^Ollama/ }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("negative: the model is missing, the wizard names it and does not let the user go on", async ({
    page,
    request,
  }) => {
    await steerEngine(request, { status: "no_model" });
    await page.goto("/");
    const ollama = page.getByRole("radio", { name: /^Ollama/ });
    await expect(ollama).toContainText("Needs setup");
    await ollama.click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByText("Ollama is running, but the model isn't downloaded yet.")).toBeVisible();
  });

  test("negative: Ollama is not installed, the wizard says so and does not let the user go on", async ({ page, request }) => {
    await steerEngine(request, { status: "not_installed" });
    await page.goto("/");
    const ollama = page.getByRole("radio", { name: /^Ollama/ });
    await ollama.click();
    await expect(page.getByText("Ollama wasn't found on this computer.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
