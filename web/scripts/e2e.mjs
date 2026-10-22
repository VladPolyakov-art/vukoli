/*
 * Headless end-to-end run of the built app (served by the backend on :8000) with screenshots.
 * Flow: setup wizard (engine shows Ollama ready) → first interview in TEXT mode → two answers → Mike replies →
 * feedback panel shows layers → End → debrief → History lists the session. Light + dark screenshots, session at 375 px.
 *
 * Usage: start the backend with a scratch IC_DATA_DIR, `npm run build`, restart the backend, then `npm run e2e`.
 * Env: E2E_URL (default http://127.0.0.1:8000), E2E_SHOTS (default .screens), E2E_TIMEOUT_MS (default 240000).
 * Uses the Chromium that Playwright keeps in ~/Library/Caches/ms-playwright (playwright-core, no browser download).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_URL ?? "http://127.0.0.1:8000";
const SHOTS = process.env.E2E_SHOTS ?? ".screens";
const LONG = Number(process.env.E2E_TIMEOUT_MS ?? 240000);
mkdirSync(SHOTS, { recursive: true });

// Fictional answers only (no personal data).
const ANSWERS = [
  "I'm a product manager at Kestrel Pay. I lead the checkout team of six people and I own the payments roadmap. Last year I led the redesign of our onboarding flow, and activation went up by twelve percent in one quarter.",
  "When two engineers disagreed about the release plan, I set up a short call, wrote down both options with the risks, and asked the team lead to decide by Friday. We shipped on time and I learned to write decisions down early.",
];

const problems = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function shot(page, name, full = true) {
  const path = join(SHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: full });
  log("screenshot", path);
}

async function both(page, name, full = true) {
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(150);
  await shot(page, `${name}-light`, full);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(150);
  await shot(page, `${name}-dark`, full);
  await page.emulateMedia({ colorScheme: "light" });
}

/** Mike's lines in the conversation log. */
const mikeCount = (page) => page.evaluate(() =>
  [...document.querySelectorAll("section[aria-labelledby='transcript-title'] li")]
    .filter((li) => li.textContent?.startsWith("Mike")).length);

/** Mike is idle: not thinking and not speaking (orb status text). */
const mikeIdle = (page) => page.waitForFunction(() => {
  const s = [...document.querySelectorAll("[role=status]")].map((x) => x.textContent ?? "").join(" ");
  return !s.includes("Mike is thinking") && !s.includes("Mike is speaking") && !s.includes("getting ready") && !s.includes("Connecting");
}, null, { timeout: LONG });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });

try {
  /* 1. First run → setup wizard, engine step. */
  await page.goto(BASE + "/");
  await page.waitForURL("**/setup");
  await page.getByRole("heading", { name: "Choose how Mike runs" }).waitFor();
  await page.getByText("Ready", { exact: true }).first().waitFor({ timeout: 30000 });
  const ollamaReady = await page.evaluate(async () => {
    const r = await fetch("/api/engines").then((x) => x.json());
    const list = Array.isArray(r) ? r : r.engines;
    return list.find((e) => e.id === "ollama")?.status?.ready === true;
  });
  log("ollama ready:", ollamaReady);
  if (!ollamaReady) throw new Error("Ollama is not ready");
  await both(page, "01-setup-engine");

  // D54: step 1 is choose (Ollama preselected) → connect (Ollama is ready) → Continue switches and moves on.
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Connect Ollama" }).waitFor();
  await both(page, "01b-setup-engine-connect");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Let's check everything works" }).waitFor();
  await both(page, "02-setup-test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "About you and the job" }).waitFor();
  await both(page, "03-setup-about");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("heading", { name: "Your first round" }).waitFor();
  await page.getByRole("radio", { name: "Keyboard" }).click();
  await both(page, "04-setup-first");

  /* 2. Text interview. */
  await page.getByRole("button", { name: "Start my first interview" }).click();
  await page.waitForURL("**/session");
  await page.waitForFunction(() => document.querySelectorAll("section[aria-labelledby='transcript-title'] li").length > 0, null, { timeout: LONG });
  await mikeIdle(page);
  log("Mike asked the first question");
  await both(page, "05-session-start");
  const box = page.getByRole("textbox", { name: "Your answer" });

  for (const [i, answer] of ANSWERS.entries()) {
    const before = await mikeCount(page);
    await box.fill(answer);
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Send");
      return b && !b.disabled;
    }, null, { timeout: LONG });
    await box.press("Enter");
    log(`answer ${i + 1} sent`);
    await page.waitForFunction(
      (n) => [...document.querySelectorAll("section[aria-labelledby='transcript-title'] li")]
        .filter((li) => li.textContent?.startsWith("Mike")).length > n,
      before, { timeout: LONG },
    );
    await mikeIdle(page);
    log(`Mike replied to answer ${i + 1}`);
  }

  /* 3. Feedback panel layers. */
  const panel = page.getByRole("complementary", { name: "Feedback" });
  for (const layer of ["Content", "Language", "Delivery"]) {
    // Layer headings read "Content" or "Delivery · 2 fixes".
    await panel.getByText(new RegExp(`^${layer}( ·|$)`)).first().waitFor({ timeout: LONG });
  }
  log("feedback layers visible");
  await page.waitForTimeout(1500);
  await both(page, "06-session-feedback");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await both(page, "07-session-375");
  await page.setViewportSize({ width: 1440, height: 900 });

  /* 4. End → debrief. */
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.waitForURL("**/sessions/**", { timeout: LONG });
  await page.getByRole("heading", { name: "What to fix first" }).waitFor({ timeout: LONG });
  log("debrief rendered", page.url());
  const sessionId = page.url().split("/sessions/")[1];
  await both(page, "08-debrief");
  await page.setViewportSize({ width: 375, height: 812 });
  await shot(page, "08-debrief-375-light");
  await page.setViewportSize({ width: 1440, height: 900 });

  /* 5. History. */
  await page.getByRole("link", { name: "History" }).first().click();
  await page.waitForURL("**/history");
  await page.locator(`a[href="/sessions/${sessionId}"]`).waitFor();
  log("history lists the session", sessionId);
  await both(page, "09-history");

  /* 6. Other screens. */
  await page.goto(BASE + "/");
  await page.getByRole("tab", { name: /Interview/ }).waitFor();
  await page.waitForTimeout(800);
  await both(page, "10-home");
  await page.setViewportSize({ width: 375, height: 812 });
  await shot(page, "10-home-375-light");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + "/?track=english");
  await page.getByRole("heading", { name: "Your level" }).waitFor();
  await both(page, "11-home-english");
  for (const section of ["engine", "voice", "practice", "profile", "appearance", "privacy"]) {
    await page.goto(`${BASE}/settings/${section}`);
    await page.getByRole("navigation", { name: "Settings sections" }).waitFor();
    await page.waitForTimeout(800);
    await both(page, `12-settings-${section}`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/settings/engine`);
  await page.waitForTimeout(800);
  await shot(page, "12-settings-engine-375-light");
  log("E2E PASSED");
} catch (error) {
  problems.push(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  await shot(page, "zz-failure").catch(() => {});
  process.exitCode = 1;
} finally {
  if (problems.length) console.log("Problems:\n" + problems.map((p) => "  - " + p).join("\n"));
  await browser.close();
}
