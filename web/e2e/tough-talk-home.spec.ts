/* Tough talk, Home side (docs/features/tough-talk/web-foundation.md row A): the two practice chips, the chat setup of
 * each mode, the numbers form (validation, prefill from a saved job) and Start into the session. The session and the
 * debrief are covered by the B specs. Data is fictional (Kestrel Pay). */
import { expect, test, type Page } from "@playwright/test";
import { JOB_TEXT, resetApp, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const quick = (page: Page) => page.getByRole("group", { name: "Quick replies" });
const POST =
  "Senior Product Designer at Kestrel Pay\nYou will lead design for checkout and payments, work with engineering and research, and own the design system.\nSalary: EUR 85,000–98,000 per year.";
const POST_NO_PAY =
  "Product Designer at Lumen Health\nYou will design patient-facing flows, work with engineering and research, and help shape the design system for the whole product.";

async function seedJob(page: Page, text: string): Promise<string> {
  const res = await page.request.post("/api/vacancies", { data: { text } });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { id: string }).id;
}

async function openNegotiate(page: Page) {
  await page.goto("/");
  await page.getByRole("group", { name: "Other practice" }).getByRole("button", { name: "Negotiate salary" }).click();
  await expect(page.getByText("What kind of salary talk is this?")).toBeVisible();
  await quick(page).getByRole("button", { name: /^Offer call/ }).click();
}

test.describe("Tough talk on Home: chips", () => {
  test("the practice chips sit in their own row and the English track is unchanged", async ({ page }) => {
    await page.goto("/");
    const other = page.getByRole("group", { name: "Other practice" });
    for (const name of ["Practise English", "Tough questions", "Negotiate salary"]) {
      await expect(other.getByRole("button", { name })).toBeVisible();
    }
    await expect(page.getByRole("group", { name: "Suggestions" }).getByRole("button", { name: "Tough questions" })).toHaveCount(0);
    await other.getByRole("button", { name: "Practise English" }).click();
    await expect(quick(page).getByRole("button", { name: /^B1/ })).toBeVisible();
  });

  test("?track= opens the right setup chat", async ({ page }) => {
    await page.goto("/?track=tough");
    await expect(page.getByText("Which questions should I ask?")).toBeVisible();
    await page.goto("/?track=negotiate");
    await expect(page.getByText("What kind of salary talk is this?")).toBeVisible();
    await page.goto("/?track=negotiate&scenario=offer");
    await expect(page.getByText(/Which role are we negotiating for\?/)).toBeVisible();
  });
});

test.describe("Tough talk on Home: Tough questions", () => {
  test("happy path: chip, theme, plan with tactics, Start opens the session", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("group", { name: "Other practice" }).getByRole("button", { name: "Tough questions" }).click();
    await expect(page.getByText("Which questions should I ask?")).toBeVisible();
    await quick(page).getByRole("button", { name: "Money" }).click();

    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Money");
    await expect(plan.getByRole("button", { name: "Hide tactics" })).toBeVisible();
    await plan.getByRole("button", { name: "Start tough questions" }).click();
    await expect(page).toHaveURL(/\/session$/);
  });

  test("Hide tactics is remembered for this mode only", async ({ page }) => {
    await page.goto("/?track=tough");
    await quick(page).getByRole("button", { name: "Mix" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await plan.getByRole("button", { name: "Hide tactics" }).click();
    await expect(plan.getByRole("button", { name: "Show them" })).toBeVisible();
    await page.goto("/?track=negotiate&scenario=offer");
    await page.getByRole("button", { name: "No job, I'll type it" }).click();
    await expect(page.getByRole("button", { name: "Show them" })).toHaveCount(0);
  });
});

test.describe("Tough talk on Home: Negotiate salary", () => {
  test("happy path: chip, typed role, numbers, style, plan, Start opens the session", async ({ page }) => {
    await openNegotiate(page);
    await quick(page).getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");

    await page.getByLabel("From", { exact: false }).first().fill("85000");
    await page.getByLabel("to", { exact: true }).fill("98000");
    await page.getByLabel("My target").fill("95000");
    await page.getByRole("button", { name: "Use these numbers" }).click();

    await quick(page).getByRole("button", { name: /^Firm/ }).click();
    await quick(page).getByRole("button", { name: "No, start now" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Product Designer");
    await expect(plan).toContainText("85,000");
    await plan.getByRole("button", { name: "Start negotiation" }).click();
    await expect(page).toHaveURL(/\/session$/);
  });

  test("negative: an empty target keeps the card closed and says why", async ({ page }) => {
    await openNegotiate(page);
    await quick(page).getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");
    const use = page.getByRole("button", { name: "Use these numbers" });
    await expect(use).toBeDisabled();
    await page.getByLabel("My target").focus();
    await page.getByLabel("My target").blur();
    await expect(page.getByRole("alert").filter({ hasText: "Add your target." })).toBeVisible();
    await expect(quick(page).getByRole("button", { name: /^Firm/ })).toHaveCount(0);
  });

  test("negative: a reversed range and a bad currency code are named", async ({ page }) => {
    await openNegotiate(page);
    await quick(page).getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");
    await page.getByLabel("From", { exact: false }).first().fill("98000");
    await page.getByLabel("to", { exact: true }).fill("85000");
    await page.getByLabel("My target").fill("90000");
    await page.getByLabel("My target").blur();
    await expect(page.getByRole("alert").filter({ hasText: "The top of the range is below the bottom." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use these numbers" })).toBeDisabled();

    await page.getByLabel("Currency").click();
    await page.getByRole("option", { name: "Other…" }).click();
    await page.getByLabel("3-letter code").fill("EU");
    await page.getByLabel("3-letter code").blur();
    await expect(page.getByRole("alert").filter({ hasText: "Use a 3-letter code, like SEK." })).toBeVisible();
  });

  test("a saved job with a pay range prefills the numbers and says where they came from", async ({ page }) => {
    await seedJob(page, POST);
    await openNegotiate(page);
    await quick(page).getByRole("button", { name: "Kestrel Pay" }).click();
    await expect(page.getByText(/The post says 85,000–98,000 EUR/)).toBeVisible();
    await expect(page.getByLabel("From", { exact: false }).first()).toHaveValue("85,000");
    await expect(page.getByLabel("to", { exact: true })).toHaveValue("98,000");
    await expect(page.getByText("From the job post — check it")).toBeVisible();
  });

  test("a saved job with no range asks for the numbers", async ({ page }) => {
    await seedJob(page, POST_NO_PAY);
    await openNegotiate(page);
    await quick(page).getByRole("button", { name: "Lumen Health" }).click();
    await expect(page.getByText(/doesn't list a range/)).toBeVisible();
    await expect(page.getByLabel("My target")).toHaveValue("");
  });
});

test.describe("Negotiation v2 on Home: scenarios", () => {
  test("the scenario step lists the five calls, each with a one-line blurb", async ({ page }) => {
    await openNegotiateScenarios(page);
    for (const name of ["Screening call", "Offer call", "Internship to full-time", "Counteroffer", "Raise with your lead"]) {
      await expect(quick(page).getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expect(page.getByText("Ask your lead for a raise", { exact: false }).first()).toBeVisible();
  });

  test("a link with a scenario skips the question", async ({ page }) => {
    await page.goto("/?track=negotiate&scenario=raise");
    await expect(page.getByText("What kind of salary talk is this?")).toHaveCount(0);
    await page.getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Your pay now, per year")).toBeVisible();
    await expect(page.getByLabel("What you will ask for, per year")).toBeVisible();
  });

  test("raise: the plan names the scenario and starts a session", async ({ page }) => {
    await page.goto("/?track=negotiate&scenario=raise");
    await page.getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");
    await page.getByLabel("Your pay now, per year").fill("60000");
    await page.getByLabel("What you will ask for, per year").fill("72000");
    await page.getByRole("button", { name: "Use these numbers" }).click();
    await quick(page).getByRole("button", { name: /^Firm/ }).click();
    await quick(page).getByRole("button", { name: "No, start now" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Raise with your lead");
    await plan.getByRole("button", { name: "Start negotiation" }).click();
    await expect(page).toHaveURL(/\/session$/);
  });

  test("negative: a raise below the current pay is not accepted", async ({ page }) => {
    await page.goto("/?track=negotiate&scenario=raise");
    await page.getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");
    await page.getByLabel("Your pay now, per year").fill("72000");
    await page.getByLabel("What you will ask for, per year").fill("60000");
    await page.getByLabel("What you will ask for, per year").blur();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Use these numbers" })).toBeDisabled();
    await expect(quick(page).getByRole("button", { name: /^Firm/ })).toHaveCount(0);
  });

  test("counteroffer asks why you are leaving", async ({ page }) => {
    await page.goto("/?track=negotiate&scenario=counteroffer");
    await page.getByRole("button", { name: "No job, I'll type it" }).click();
    await page.getByPlaceholder(/Type the role/).fill("Product Designer");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("New offer, per year")).toBeVisible();
    await expect(page.getByLabel("Why you are leaving")).toBeVisible();
  });
});

test.describe("Negotiation v2 on Home: interview salary talk", () => {
  async function interviewPlan(page: Page) {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toBeVisible();
    return plan;
  }

  test("the interview plan offers a salary talk, off by default; turning it on asks for the numbers", async ({ page }) => {
    const plan = await interviewPlan(page);
    await expect(plan).toContainText("Salary talk");
    await expect(plan).toContainText("Off. The interview ends after the last question.");
    await plan.getByRole("button", { name: "Turn on" }).click();
    const dialog = page.getByRole("dialog", { name: "Salary talk numbers" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("My target").fill("95000");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(plan).toContainText("On. After the last question Mike asks about salary.");
    await expect(plan.getByRole("button", { name: "Turn off" })).toBeVisible();
  });
});

async function openNegotiateScenarios(page: Page) {
  await page.goto("/");
  await page.getByRole("group", { name: "Other practice" }).getByRole("button", { name: "Negotiate salary" }).click();
}
