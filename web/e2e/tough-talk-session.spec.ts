/* Tough talk, the session and the debrief (US-69, US-70, US-71, US-73; ds/screens/tough-talk.md §4-§6): start a Negotiate
 * salary or a Tough questions session, ask for a hint (the button and the H key), answer a few turns, end, and read the
 * debrief frames. The scripted engine stands in for the model: recruiter lines carry only the amounts the server gave
 * them, and the after-call check flags nothing. Home's chips for the two modes are another change; the session is opened
 * the way Home opens it, by navigating to /session with the start configuration in the router state. */
import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, conversation, endSession, expectNoHorizontalScroll, resetApp, sendAnswer, showConversation, showDebrief, skipSetup } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

const NEGOTIATE = {
  mode: "negotiate", input: "text", speak: false, suggest: false,
  negotiate: { role: "Designer", job_low: 80000, job_high: 100000, target: 98000, currency: "USD", style: "friendly", has_real_offer: false },
};
const TOUGH = { mode: "tough", input: "text", speak: false, suggest: false, tough: { theme: "leaving" } };

/** Open /session the way Home does (router state), without the chips that belong to another change. */
async function startTalk(page: Page, start: Record<string, unknown>, title: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.evaluate(({ start, title }) => {
    window.history.pushState({ usr: { config: { start: { type: "start", ...start }, browserStt: false, pauseSec: 5 }, title }, key: "talk", idx: 1 }, "", "/session");
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, { start, title });
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
}

const hintButton = (page: Page) => page.getByRole("button", { name: /(Show a hint|Hide the hint) \(H\)/ });

/** Focus is outside the answer box, the way a shortcut is pressed. For two seconds after Send a letter counts as typing
 * (SENT_GUARD_MS in SessionView), so the key waits that out. */
async function pressH(page: Page) {
  await page.waitForTimeout(2100);
  await page.mouse.click(5, 5);
  await page.keyboard.press("h");
}

test.describe("US-70 Negotiate salary: the session", () => {
  test("hint by the button and by H, then the result frames in the debrief", async ({ page }) => {
    const errors = collectPageErrors(page);
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    const log = conversation(page);
    await expect(log).toContainText("what are you expecting for the salary?");   // Mike asks first; the offer follows your number

    // The Hint button sits in the island, in the place of the suggester, and the shortcuts list names H.
    await expect(hintButton(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: /suggest/i })).toHaveCount(0);

    await sendAnswer(page, "I was hoping for around 98k");
    await expect(log).toContainText("88,000 USD");

    // Button: the card opens (Try saying + an example), the button is pressed; the second press hides it.
    await hintButton(page).click();
    const card = page.getByText("Try saying").first();
    await expect(card).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide the hint (H)" })).toHaveAttribute("aria-pressed", "true");
    // Another hint: the refresh button on the card asks for a different tactic for the same moment.
    const title = page.getByRole("region", { name: "Hint" }).getByRole("heading");
    const first = await title.innerText();
    await page.getByRole("button", { name: "Another hint" }).click();
    await expect(title).not.toHaveText(first);
    await expect(page.getByRole("button", { name: "Another hint" })).toBeEnabled();
    await page.getByRole("button", { name: "Hide the hint (H)" }).click();
    await expect(card).toHaveCount(0);

    // H does the same from the keyboard; typing a word with an h in the answer box is left alone.
    await pressH(page);
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await pressH(page);
    await expect(page.getByText("Try saying")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Your answer" }).fill("h");
    await expect(page.getByText("Try saying")).toHaveCount(0);

    await sendAnswer(page, "Based on my results, I shipped the design system and cut review time in half, so I am asking for 98,000.");
    await sendAnswer(page, "Great, I accept the offer");
    // Mike closes the round: "See your debrief" in the closing card ends the session.
    await expect(page.getByText("That's the end of the round")).toBeVisible();
    await page.getByRole("button", { name: "See your debrief" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Open debrief" }).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: "Salary talk · Offer call · Friendly", level: 1 })).toBeVisible();
    await showDebrief(page);

    // The frames carry titles (D109). A start without a scenario is the Offer call of Negotiation v2: Mike's first offer is 88,000.
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Say it better", level: 2 })).toBeVisible();
    await expect(page.getByText(/Hints you used:/)).toBeVisible();

    // The conversation view carries the whole talk.
    await showConversation(page);
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("I was hoping for around 98k");
    expect(errors).toEqual([]);
  });

  test("a very short session: ended before any answer saves nothing", async ({ page }) => {
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    await page.getByRole("button", { name: "End practice", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Session ended", level: 2 })).toBeVisible();
    await expect(page.getByText("Nothing was saved: you didn't answer any questions.")).toBeVisible();
  });

  test("a short talk with no offer from Mike: No offer yet, tactic tiles, no deal line, no moves frame", async ({ page }) => {
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    await sendAnswer(page, "Great, I accept the offer");
    await (await endSession(page, "End practice")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expect(page.getByText("No offer yet", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Say it better", level: 2 })).toBeVisible();
    await expect(page.getByText("Ask for their range", { exact: true })).toBeVisible();
    await expect(page.getByTestId("deal-line")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "What moved the offer", level: 2 })).toHaveCount(0);
  });

  test("on a phone the hint card and the debrief do not scroll sideways", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startTalk(page, NEGOTIATE, "Negotiation · Designer · Friendly");
    await sendAnswer(page, "I was hoping for around 98k");
    await hintButton(page).click();
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await sendAnswer(page, "Based on my results, I shipped the design system, so I am asking for 98,000.");
    await (await endSession(page, "End practice")).click();
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

const RAISE = {
  mode: "negotiate", input: "text", speak: false, suggest: false,
  negotiate: { scenario: "raise", role: "Designer", current_pay: 60000, ask: 72000, target: 72000, currency: "USD", style: "friendly", has_real_offer: false },
};

test.describe("Negotiation v2: raise with your lead", () => {
  test("a raise talk runs to a debrief with the raise frames and the objections Mike raised", async ({ page }) => {
    const errors = collectPageErrors(page);
    await startTalk(page, RAISE, "Salary talk · Raise with your lead · Friendly");
    const log = conversation(page);
    await expect(log).toContainText("Mike");
    await sendAnswer(page, "I shipped the onboarding redesign and activation rose 12 percent, so I am asking for 72,000.");
    await sendAnswer(page, "The redesign also cut support tickets by a quarter, which is why 72,000 is fair.");
    await (await endSession(page, "End practice")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await expect(page.getByRole("heading", { name: "Salary talk · Raise with your lead · Friendly", level: 1 })).toBeVisible();
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Your result", level: 2 })).toBeVisible();
    await expect(page.getByTestId("scenario-facts")).toBeVisible();
    await expect(page.getByText("May be wrong").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Mike checks with the hiring manager: a status shows, the answer box stays usable, then he comes back", async ({ page }) => {
    // The scripted engine's check depends on its seed, so the web side is driven with the two frames the server sends
    // (protocol.md §7.3): turn_complete kind "checking", then the come-back line with came_back.
    await page.routeWebSocket(/\/ws\/session/, (ws) => {
      const server = ws.connectToServer();
      let held = false;
      server.onMessage((m) => ws.send(m));
      ws.onMessage((m) => {
        const msg = typeof m === "string" ? (JSON.parse(m) as { type?: string }) : {};
        if (msg.type !== "user_turn" || held) { server.send(m); return; }
        held = true;
        const say = (full_text: string, extra: Record<string, unknown>) => {
          ws.send(JSON.stringify({ type: "turn_start", speaker: "model" }));
          ws.send(JSON.stringify({ type: "transcript_delta", speaker: "model", delta: full_text, full_text }));
          ws.send(JSON.stringify({ type: "turn_complete", speaker: "model", full_text, ...extra }));
          ws.send(JSON.stringify({ type: "response_complete" }));
        };
        say("Let me check with the hiring manager and come back to you.", { kind: "checking", checking: true, check_s: 4 });
        setTimeout(() => say("I am back. The hiring manager can look at 66,000 from the next quarter.", { kind: "turn", came_back: true }), 2500);
      });
    });
    await startTalk(page, RAISE, "Salary talk · Raise with your lead · Friendly");
    await sendAnswer(page, "I shipped the onboarding redesign and activation rose 12 percent, so I am asking for 72,000.");
    await expect(page.getByText("Mike is checking…").first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
    await expect(conversation(page)).toContainText("I am back");
    await expect(page.getByText("Mike is checking…")).toHaveCount(0);
  });
});

test.describe("US-69 Tough questions: the session", () => {
  test("hint shows the answer shape, then Summary and Questions in the debrief", async ({ page }) => {
    const errors = collectPageErrors(page);
    await startTalk(page, TOUGH, "Tough questions · Why you left");
    const log = conversation(page);
    await expect(log).toContainText("Mike");

    await hintButton(page).click();
    await expect(page.getByText("How to build this answer")).toBeVisible();
    await expect(page.getByText("Try saying").first()).toBeVisible();
    await page.getByRole("button", { name: "Hide the hint (H)" }).click();
    // Owner 08.11: every press moves on to a card not shown yet for this question.
    await pressH(page);
    await expect(page.getByText("What they are really checking")).toBeVisible();
    await pressH(page);

    for (const text of ["The role changed and I wanted more product ownership.", "I wanted to grow into product work, and I learned a lot there.", "I enjoyed the team and I am ready for a new challenge."]) {
      await sendAnswer(page, text);
      await expect(log).toContainText(text);
    }
    await (await endSession(page, "End")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);

    await expect(page.getByRole("heading", { name: "Summary", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions", level: 2 })).toBeVisible();
    await expect(page.getByText(/Handled calmly: \d of \d|You answered \d questions?\./)).toBeVisible();
    await showConversation(page);
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("The role changed and I wanted more product ownership.");
    expect(errors).toEqual([]);
  });

  test("a very short session: one answer shows no counts", async ({ page }) => {
    await startTalk(page, TOUGH, "Tough questions · Why you left");
    await sendAnswer(page, "The role changed and I wanted more product ownership.");
    await expect(conversation(page)).toContainText("product ownership");
    await (await endSession(page, "End")).click();
    await expect(page).toHaveURL(/\/sessions\/s-/);
    await showDebrief(page);
    await expect(page.getByRole("heading", { name: "Summary", level: 2 })).toBeVisible();
    await expect(page.getByText(/Handled calmly/)).toHaveCount(0);
    await expect(page.getByText("You answered 1 question.")).toBeVisible();
  });
});
