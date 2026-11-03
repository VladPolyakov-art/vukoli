/* Flow C: coming back. Home knows the weak spots from earlier interviews and offers to drill them.
 * US-22 (mistake memory + "drill my weak spots"), US-20 AC1 ("what next" in the debrief), US-17 (dismissed corrections). */
import { expect, test, type Page } from "@playwright/test";
import {
  ANSWER_NO_RESULT,
  ANSWER_WITH_RESULT,
  conversation,
  openMenu,
  questionCounter,
  resetApp,
  seedReturningUser,
  sendAnswer,
  showDebrief,
  viewer,
  questionTab,
  skipSetup,
  startTextInterview,
} from "./helpers";

/** What the page sends and receives on the session socket (JSON frames only). */
function watchSocket(page: Page) {
  const sent: Record<string, unknown>[] = [];
  const got: Record<string, unknown>[] = [];
  const read = (payload: string | { length: number }, into: Record<string, unknown>[]) => {
    if (typeof payload !== "string") return;
    try {
      into.push(JSON.parse(payload));
    } catch {
      /* not JSON */
    }
  };
  page.on("websocket", (socket) => {
    socket.on("framesent", (frame) => read(frame.payload, sent));
    socket.on("framereceived", (frame) => read(frame.payload, got));
  });
  return {
    start: () => sent.find((m) => m.type === "start"),
    started: () => got.find((m) => m.type === "session_started") as { focus?: unknown; questions: { competency: string }[] } | undefined,
  };
}

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

test.describe("US-22 Weak spots and drill", () => {
  test("happy path: home offers the drill, Mike names the recurring weak spots, the drill targets one", async ({
    page,
    request,
  }) => {
    await seedReturningUser(request);
    const socket = watchSocket(page);
    await page.goto("/");

    // AC1: a returning user sees the drill next to the other starts.
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Drill my weak spots" }).click();

    // Mike names what keeps coming back, with the number of sessions, and lets the user pick a layer (AC2).
    const chat = page.getByRole("log", { name: "Setup with Mike" });
    await expect(chat).toContainText("From your last 3 interviews");
    await expect(chat).toContainText("end with the result (3 sessions)");
    await expect(chat).toContainText("Words you marked as misheard aren't counted.");
    const replies = page.getByRole("group", { name: "Quick replies" });
    await expect(replies.getByRole("button", { name: "All 2" })).toBeVisible();
    await expect(replies.getByRole("button", { name: "Language 1" })).toBeVisible();
    await replies.getByRole("button", { name: "Content 1" }).click();

    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Content: end with the result");
    await expect(plan).toContainText("3 questions");
    await plan.getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);

    // The session is a short one aimed at the gap: an answer with no result gets a follow-up about the result.
    await expect(questionCounter(page, 1, 3)).toBeVisible();
    // C1b: the chosen focus is what the start message carries, and the server planned its questions for it.
    expect(socket.start()).toMatchObject({ drill: true, focus: [{ layer: "content", tag: "no_result" }] });
    await expect.poll(() => socket.started()?.focus).toEqual([{ layer: "content", tag: "no_result" }]);
    expect(socket.started()!.questions.map((q) => q.competency).every((c) => "BEGCD".includes(c))).toBe(true);
    await sendAnswer(page, ANSWER_NO_RESULT);
    await expect(conversation(page).getByText("Follow-up", { exact: true })).toBeVisible();

    // A number in the follow-up answer satisfies the drill and Mike moves on.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await expect(questionCounter(page, 2, 3)).toBeVisible();
  });

  test("the layer can be chosen: the Language drill is a different focus from the Content drill", async ({
    page,
    request,
  }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "Language 1" }).click();
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Language");
    await expect(plan).not.toContainText("end with the result");
  });

  test("C1b: with the focus on All, the start carries every weak spot, with its layer", async ({ page, request }) => {
    await seedReturningUser(request);
    const socket = watchSocket(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    await page.getByRole("group", { name: "Quick replies" }).getByRole("button", { name: "All 2" }).click();
    await page.getByRole("region", { name: "Here's the plan" }).getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect.poll(() => socket.start()).toMatchObject({
      drill: true,
      focus: [{ layer: "content", tag: "no_result" }, { layer: "language", tag: "preposition" }],
    });
  });

  test("C1b: an ordinary session starts without a focus", async ({ page, request }) => {
    await seedReturningUser(request);
    const socket = watchSocket(page);
    await startTextInterview(page);
    await expect.poll(() => socket.start()).toBeTruthy();
    expect(socket.start()).not.toHaveProperty("focus");
    expect(socket.start()).not.toHaveProperty("drill");
  });

  test("home shows the finished interviews in Recents, newest first", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    const recents = page.getByRole("region", { name: "Recents" }).getByRole("listitem");
    await expect(recents).toHaveCount(3);
    await expect(recents.nth(0)).toContainText("Kestrel Pay · Product Manager");
    await expect(recents.nth(1)).toContainText("Northwind Logistics · Product Owner");
  });

  test("negative: with no history the drill is not offered (AC4)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are we practising today?", level: 1 })).toBeVisible();
    const suggestions = page.getByRole("group", { name: "Suggestions" });
    await expect(suggestions.getByRole("button", { name: "General questions" })).toBeVisible();
    await expect(suggestions.getByRole("button", { name: "Practise English" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drill my weak spots" })).toHaveCount(0);
    await openMenu(page);
    await expect(page.getByText("Your practice sessions will appear here.").locator("visible=true")).toBeVisible();
  });
});

test.describe("US-20 AC1 What next, in the debrief", () => {
  test("the debrief lists one weak spot per layer, each pointing at its question", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("link", { name: "Kestrel Pay · Product Manager" }).click();

    await showDebrief(page);
    const work = page.locator("[data-review-id='Debrief/Plan']");
    await expect(work).toContainText("End with the result");
    await expect(work).toContainText("Prepositions");
    await expect(work.getByRole("listitem")).toHaveCount(2); // one for content, one for language
    await work.getByRole("button", { name: "Go to question 3" }).click();
    await expect(viewer(page).getByRole("article")).toContainText("Question 3");
    await expect(questionTab(page, 3)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Drill these weak spots" })).toBeVisible();
  });

  test("'Drill these weak spots' in the debrief starts the same drill as Home's chip", async ({ page, request }) => {
    await seedReturningUser(request);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("link", { name: "Kestrel Pay · Product Manager" }).click();
    await showDebrief(page);
    await page.getByRole("button", { name: "Drill these weak spots" }).click();

    // F-13-14: Home opens the drill plan straight away, no "What should we drill?" question, and it keeps the job.
    await expect(page).toHaveURL(/\/\?drill=1&session=[^&]+&job=/);
    const chat = page.getByRole("log", { name: "Setup with Mike" });
    await expect(chat).toContainText("Here's a drill on the weak spots we found");
    await expect(chat).not.toContainText("What should we drill?");
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("Kestrel Pay · Product Manager");
    await expect(plan).toContainText("end with the result");
    await expect(plan).toContainText("3 questions");
  });
});

test.describe("C1 The drill from a debrief works on THAT debrief's weak spots", () => {
  test("negative: a debrief with one weak spot starts a drill on that one, not on the shared memory (C1)", async ({
    page,
    request,
  }) => {
    // All three seeded interviews have the same two weak spots (end with the result, prepositions). Dismiss the language
    // correction in the newest one only: its debrief now has one weak spot, while the memory (last 5 interviews) still
    // holds both. Before C1 the drill from that debrief planned "All 2" from the memory.
    const { sessions } = await seedReturningUser(request);
    const id = sessions[0]!.id;
    const socket = watchSocket(page);
    await page.goto(`/sessions/${id}?view=debrief`);
    await questionTab(page, 2).click();
    const card = viewer(page).getByRole("article");
    await expect(card).toContainText("since five years");
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card).toContainText("marked misheard by you");

    await showDebrief(page);
    const work = page.locator("[data-review-id='Debrief/Plan']");
    await expect(work).toContainText("Focused on this weak spot");
    await page.getByRole("button", { name: "Drill these weak spots" }).click();

    await expect(page).toHaveURL(new RegExp(`/\\?drill=1&session=${id}`));
    const chat = page.getByRole("log", { name: "Setup with Mike" });
    await expect(chat).toContainText("Here's a drill on the weak spots we found");
    const plan = page.getByRole("region", { name: "Here's the plan" });
    await expect(plan).toContainText("All 1: end with the result");
    await expect(plan).not.toContainText("prepositions");
    // The focus can still be changed, to the layers of THIS debrief only.
    await plan.getByRole("button", { name: "Change focus" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Content 1" })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: /^Language/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // The focus reaches the session itself: its context line names the same weak spot.
    await plan.getByRole("button", { name: "Type instead" }).click();
    await expect(page).toHaveURL(/\/session$/);
    // C1b: the start names exactly this debrief's weak spot, and the server echoes it back.
    await expect.poll(() => socket.start()).toMatchObject({ drill: true, focus: [{ layer: "content", tag: "no_result" }] });
    await expect.poll(() => socket.started()?.focus).toEqual([{ layer: "content", tag: "no_result" }]);
    const more = page.getByRole("button", { name: "More", exact: true });
    let context;
    if (await more.isVisible().catch(() => false)) {
      await more.click();
      context = page.getByRole("menu");
    } else {
      await page.getByRole("timer").hover();
      context = page.getByRole("tooltip");
    }
    await expect(context).toContainText("Focus: end with the result");
    await expect(context).not.toContainText("prepositions");
  });
});

test.describe("US-22 AC3 Dismissed corrections are not counted", () => {
  test("negative: dismissing the language correction in an old debrief takes it out of the weak spots", async ({
    page,
    request,
  }) => {
    // The weak spots come from each session's saved debrief (memory.py); the server recomputes them on every
    // dismiss / restore / recheck (feedback.refresh_weak_spots), so Home's drill follows.
    const { sessions } = await seedReturningUser(request);
    for (const session of sessions) {
      await page.goto(`/sessions/${session.id}?view=debrief`);
      await questionTab(page, 2).click();
      const card = viewer(page).getByRole("article");
      await expect(card).toContainText("since five years");
      await card.getByRole("button", { name: "Dismiss" }).click();
      // The correction is gone from the card (the answer itself is still there); it says why it is not counted.
      await expect(card.getByText("You typed")).toHaveCount(0);
      await expect(card).toContainText("marked misheard by you");
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Drill my weak spots" }).click();
    const replies = page.getByRole("group", { name: "Quick replies" });
    await expect(replies.getByRole("button", { name: "Content 1" })).toBeVisible();
    await expect(replies.getByRole("button", { name: /^Language/ })).toHaveCount(0);
  });
});
