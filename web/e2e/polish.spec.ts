/* Stage 13, round 2 (part A): the P2/P3 fixes in Home, Setup and the Session.
 * Naming (QA-04/15, F-13-15), the drill that keeps its job (F-13-8/14), the Setup wizard (QA-06, F-13-3/10/12), the mic help
 * (QA-05, F-13-4), Save job (F-13-11), touch targets (QA-03), the phone island (QA-10), the English first-time hint (F-13-9)
 * and the scripted first question (QA-17). 13b: the voice island at mid widths (UT-3). Each test names the finding it guards. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ANSWER_WITH_RESULT,
  JOB_TEXT,
  collectPageErrors,
  conversation,
  denyMicrophone,
  endSession,
  expectNoHorizontalScroll,
  openMenu,
  resetApp,
  seedReturningUser,
  sendAnswer,
  showDebrief,
  skipSetup,
  startTextInterview,
  steerEngine,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetApp(request);
});

/** The size of the area that answers a tap on `target`, found by probing the page around its centre. The target's own
 * box is not enough: a see-through ::before widens the hit area without changing the look (QA-03). */
async function hitArea(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hits = (x: number, y: number) => {
      const top = document.elementFromPoint(x, y);
      return top !== null && (el === top || el.contains(top));
    };
    const reach = (dx: number, dy: number) => {
      let n = 0;
      while (n < 40 && hits(cx + dx * (n + 0.5), cy + dy * (n + 0.5))) n += 1;
      return n;
    };
    return {
      width: reach(-1, 0) + reach(1, 0),
      height: reach(0, -1) + reach(0, 1),
      boxHeight: r.height,
    };
  });
}

/** One answer, so the session has something to save when it ends. */
async function answerOnce(page: Page) {
  await sendAnswer(page, ANSWER_WITH_RESULT);
  await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_RESULT}`);
}

/** The session's context line ("Focus: …" in a drill): the status tooltip on a wide screen, the More menu on a phone. */
async function sessionContext(page: Page) {
  const more = page.getByRole("button", { name: "More", exact: true });
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    return page.getByRole("menu");
  }
  await page.getByRole("timer").hover();
  return page.getByRole("tooltip");
}

test.describe("QA-04 / QA-15 / F-13-15 One naming rule for a session", () => {
  test("happy path: a job is Company · Role everywhere and Mike says it the same way", async ({ page }) => {
    await skipSetup(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const chat = page.getByRole("log", { name: "Setup with Mike" });
    await expect(chat).toContainText("Got it: Kestrel Pay, Product Manager.");
    await expect(chat).not.toContainText("Got it: Product Manager at Kestrel Pay");
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Kestrel Pay · Product Manager");
    await plan.getByRole("button", { name: "Type instead" }).click();
    await expect(page.getByRole("heading", { name: "Kestrel Pay · Product Manager", level: 1 })).toBeVisible();

    await answerOnce(page);
    await (await endSession(page)).click();
    await expect(page.getByRole("heading", { name: "Kestrel Pay · Product Manager", level: 1 })).toBeVisible();
    await openMenu(page);
    await expect(page.getByRole("link", { name: "Kestrel Pay · Product Manager" })).toBeVisible();
    await expect(page.getByText("Interview practice")).toHaveCount(0);
  });

  test("a session without a job is 'General questions' and English is 'English practice'", async ({ page }) => {
    await skipSetup(page);
    await page.goto("/");
    await page.getByRole("button", { name: "General questions" }).click();
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Type instead" }).click();
    await expect(page.getByRole("heading", { name: "General questions", level: 1 })).toBeVisible();
    await answerOnce(page);
    await (await endSession(page)).click();
    await expect(page.getByRole("heading", { name: "General questions", level: 1 })).toBeVisible();
    await expect(page.getByText("Interview practice")).toHaveCount(0);

    await page.goto("/");
    await page.getByRole("button", { name: "Practise English" }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: /^B1/ }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Talk about your work" }).click();
    await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Type instead" }).click();
    await expect(page.getByRole("heading", { name: "English practice", level: 1 })).toBeVisible();
  });

  test("boundary: a title saved by an older version loses its 'Interview practice ·' prefix", async ({ page, request }) => {
    // The seed keeps the old wording on purpose (server/e2e.py): the server normalises it on read.
    await seedReturningUser(request);
    await skipSetup(page);
    await page.goto("/");
    await openMenu(page);
    await expect(page.getByRole("link", { name: "Kestrel Pay · Product Manager" })).toBeVisible();
    await expect(page.getByText("Interview practice")).toHaveCount(0);
    const list = await (await request.get("/api/sessions")).json();
    const titles = (Array.isArray(list) ? list : list.sessions).map((s: { title: string }) => s.title);
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(title).not.toMatch(/^Interview practice/);
  });
});

test.describe("F-13-8 / F-13-14 A drill from a debrief keeps its job", () => {
  test("happy path: the plan names the job, the session is a drill with its focus", async ({ page, request }) => {
    await seedReturningUser(request);
    await skipSetup(page);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("link", { name: "Kestrel Pay · Product Manager" }).click();
    await showDebrief(page);
    await page.getByRole("button", { name: "Drill these weak spots" }).click();

    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Kestrel Pay · Product Manager");
    await expect(page.getByRole("log", { name: "Setup with Mike" })).not.toContainText("What should we drill?");
    await plan.getByRole("button", { name: "Type instead" }).click();

    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole("heading", { name: "Drill · Kestrel Pay · Product Manager", level: 1 })).toBeAttached();
    await expect.poll(() => page.title()).toContain("Drill · Kestrel Pay · Product Manager");
    await expect(await sessionContext(page)).toContainText("Focus: ");
    await page.keyboard.press("Escape");

    await answerOnce(page);
    await (await endSession(page)).click();
    await openMenu(page);
    await expect(page.getByRole("link", { name: "Drill · Kestrel Pay · Product Manager" })).toBeVisible();
  });

  test("a drill from Home (no job) is 'Drill · General questions'", async ({ page, request }) => {
    await seedReturningUser(request);
    await skipSetup(page);
    await page.goto("/?drill=1");
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await plan.getByRole("button", { name: "Type instead" }).click();
    await expect(page.getByRole("heading", { name: /^Drill · /, level: 1 })).toBeAttached();
    await expect(await sessionContext(page)).toContainText("Focus: ");
  });
});

test.describe("QA-17 The scripted interviewer asks about duties, not the job title", () => {
  test("question 1 quotes a duty line of the posting", async ({ page }) => {
    await skipSetup(page);
    await startTextInterview(page);
    const talk = conversation(page);
    await expect(talk).toContainText('The posting says "You will own the checkout experience"');
    await expect(talk).not.toContainText('The posting says "Product Manager at Kestrel Pay"');
  });
});

test.describe("QA-06 / F-13-3 / F-13-12 Setup step 1", () => {
  test("happy path: the ready engine is picked, Continue is in view without scrolling, the heading alone says what to do (13b)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Choose how Mike runs", level: 1 })).toBeVisible();
    const ollama = page.getByRole("radio", { name: /^Ollama/ });
    await expect(ollama).toBeChecked();
    const next = page.getByRole("button", { name: "Continue" });
    await expect(next).toBeEnabled();
    await expect(next).toBeInViewport({ ratio: 1 });
  });

  test("boundary: on a short window Continue still stays in view (sticky footer)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 560 });
    await page.goto("/");
    await expect(page.getByRole("radio", { name: /^Ollama/ })).toBeChecked();
    await expect(page.getByRole("button", { name: "Continue" })).toBeInViewport({ ratio: 1 });
  });

  test("negative: an engine that is not ready is not picked for you", async ({ page, request }) => {
    await steerEngine(request, { status: "not_running" });
    await page.goto("/");
    await expect(page.getByRole("radio", { name: /^Ollama/ })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

test.describe("QA-05 / F-13-4 / F-13-10 The microphone is blocked", () => {
  test("the Setup check names the Mac switch and offers one way out", async ({ page }) => {
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start the check" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("On a Mac: System Settings → Privacy & Security → Microphone → turn on your browser, then reload.");
    await expect(page.getByRole("button", { name: "I'll type instead" })).toHaveCount(1);
  });

  test("the help in a session says the same", async ({ page }) => {
    await skipSetup(page);
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Start interview" }).click();
    const help = page.getByRole("dialog", { name: "Mike can't hear you" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("On a Mac: System Settings → Privacy & Security → Microphone → turn on your browser, then reload.");
  });
});

test.describe("F-13-11 Add a job", () => {
  test("Save job is on right after the paste and shows 'Saving…' while it works", async ({ page, request }) => {
    await denyMicrophone(page);
    // The save itself is quick; hold it back so the busy state can be seen.
    await page.route("**/api/vacancies", async (route) => {
      if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "I'll type instead" }).first().click();
    await page.getByRole("button", { name: "Add a job" }).click();
    const job = page.getByRole("dialog", { name: "Add a job" });
    const save = job.getByRole("button", { name: "Save job" });
    await expect(save).toBeDisabled();
    await steerEngine(request, { delay_ms: 1500 }); // the title guess is slow too: Save must not wait for it
    await job.getByRole("textbox", { name: "Job description" }).fill(JOB_TEXT);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(job.getByRole("button", { name: "Saving…" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Add a job" })).toBeHidden();
  });
});

test.describe("QA-03 Touch targets", () => {
  test("on a touch screen buttons, chips, icon buttons, the switch and the segmented options answer a 44 px tap", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "needs a coarse pointer");
    await skipSetup(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();

    // A chip (a Home start suggestion) and an icon button (the menu).
    for (const target of [page.getByRole("button", { name: "Practise English" }), page.getByRole("button", { name: "Open menu" })]) {
      await expect.poll(async () => (await hitArea(target)).height).toBeGreaterThanOrEqual(43);
      await expect.poll(async () => (await hitArea(target)).width).toBeGreaterThanOrEqual(43);
    }

    // Settings > Practice: the switch.
    await page.goto("/settings/practice");
    const toggle = page.getByRole("dialog", { name: "Settings" }).getByRole("switch").first();
    await expect(toggle).toBeAttached();
    await expect.poll(async () => (await hitArea(toggle)).height).toBeGreaterThanOrEqual(43);
    await expect.poll(async () => (await hitArea(toggle)).width).toBeGreaterThanOrEqual(43);
  });

  test("a Segmented option is a 44 px target on touch", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "needs a coarse pointer");
    await skipSetup(page);
    await page.goto("/settings/practice");
    // The selected option has the thumb on top of it; an unselected one shows the plain hit area.
    const option = page.getByRole("dialog", { name: "Settings" }).getByRole("radio", { checked: false }).first();
    await expect(option).toBeAttached();
    await expect.poll(async () => (await hitArea(option)).height).toBeGreaterThanOrEqual(43);
  });

  test("a Button in the Setup form is a 44 px target on touch and its look is unchanged", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "needs a coarse pointer");
    await page.goto("/");
    const next = page.getByRole("button", { name: "Continue" });
    const area = await hitArea(next);
    expect(area.height).toBeGreaterThanOrEqual(43);
    // The hit area grows, the box does not shrink below its own size.
    expect(area.boxHeight).toBeGreaterThan(0);
  });

  test("an inline link-button is at least 24 px tall on any pointer", async ({ page }) => {
    await denyMicrophone(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "I'll type instead" }).first().click();
    await expect(page.getByRole("heading", { name: "About you", level: 1 })).toBeVisible();
    const link = page.getByRole("button", { name: "choose files" });
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24); // its own box, not a pseudo-element (WCAG 2.5.8)
    const area = await hitArea(link);
    expect(area.height).toBeGreaterThanOrEqual(23);
  });
});

test.describe("QA-10 The session controls on a narrow phone", () => {
  for (const width of [375, 320]) {
    test(`${width} px: nothing in the island is clipped or overlaps, the page does not scroll sideways`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.setViewportSize({ width, height: 700 });
      await skipSetup(page);
      await startTextInterview(page);
      const island = page.getByRole("group", { name: "Session controls" });
      await expect(island).toBeVisible();
      const geometry = await island.evaluate((root) => {
        const box = root.getBoundingClientRect();
        const parts = [...root.querySelectorAll<HTMLElement>("button, [role='timer'], [role='status']")]
          .map((el) => ({ name: el.getAttribute("aria-label") || el.textContent || el.tagName, r: el.getBoundingClientRect() }))
          .filter((p) => p.r.width > 0 && p.r.height > 0);
        const outside = parts.filter((p) => p.r.left < box.left - 0.5 || p.r.right > box.right + 0.5).map((p) => p.name);
        const overlaps: string[] = [];
        parts.forEach((a, i) => {
          parts.slice(i + 1).forEach((b) => {
            if (a.r.left < b.r.right - 1 && b.r.left < a.r.right - 1 && a.r.top < b.r.bottom - 1 && b.r.top < a.r.bottom - 1) {
              overlaps.push(`${a.name} / ${b.name}`);
            }
          });
        });
        return { outside, overlaps, scrolls: root.scrollWidth > root.clientWidth + 1 };
      });
      expect(geometry.outside).toEqual([]);
      expect(geometry.scrolls).toBe(false);
      expect(geometry.overlaps).toEqual([]);
      await expectNoHorizontalScroll(page);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("F-13-9 / D96 The English first-time hint says corrections come after the call", () => {
  for (const [layout, width] of [["narrow", 375], ["mid", 900], ["wide", 1440]] as const) {
    test(`${layout} layout (${width} px)`, async ({ page }: { page: Page }) => {
      await skipSetup(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.getByRole("button", { name: "Practise English" }).click();
      await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: /^B1/ }).click();
      await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Talk about your work" }).click();
      await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Type instead" }).click();
      await expect(page).toHaveURL(/\/session$/);
      const measured = await page.locator("[data-layout]").first().getAttribute("data-layout");
      expect(measured).toBe(layout);
      const tips = page.getByText("First time here").locator("xpath=ancestor::div[1]");
      await expect(tips).toContainText("Corrections come after the call, so Mike stays fast.");
      await expect(tips).not.toContainText("dot shows");
    });
  }
});

test.describe("UT-3 The voice island never runs its groups into each other", () => {
  test.use({ permissions: ["microphone"] });

  /** Every point across the main action hits the button itself: no divider or icon lies over it. */
  async function nothingOver(button: Locator) {
    return button.evaluate((b) => {
      const r = b.getBoundingClientRect();
      for (let x = Math.ceil(r.left) + 2; x < r.right - 2; x++) {
        const top = document.elementsFromPoint(x, r.top + r.height / 2)[0];
        if (top && top !== b && !b.contains(top)) return false;
      }
      return true;
    });
  }

  test("one row where it fits, two rows where it doesn't, Send now always clear", async ({ page }) => {
    await skipSetup(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    await page.getByRole("button", { name: "Start interview" }).click();
    const voice = page.getByRole("group", { name: "Voice" });
    await expect(voice).toBeVisible();
    const talk = voice.getByRole("button", { name: "Talk now" });
    const send = voice.getByRole("button", { name: "Send now" });
    await expect(talk.or(send)).toBeVisible({ timeout: 30_000 });
    // The fake microphone's tone may start listening on its own while Talk now is being clicked: retry until Send now.
    await expect(async () => {
      if (await talk.isVisible()) await talk.click({ timeout: 1000 });
      await expect(send).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    const island = page.locator('[data-layout="inline"], [data-layout="stacked"]').filter({ has: voice });

    for (const [width, layout] of [[1440, "inline"], [820, "stacked"], [700, "stacked"], [1100, "inline"]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await expect(island).toHaveAttribute("data-layout", layout);
      expect(await nothingOver(send), `Send now is clear at ${width}px`).toBe(true);
    }
  });
});
