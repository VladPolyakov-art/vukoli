/* US-13 AC5: a session that was interrupted (the connection dropped, or the engine stopped) can be picked up again.
 * The page's WebSocket is watched through `watchSessionSocket`, so the test can cut it and push errors into it. */
import { expect, test } from "@playwright/test";
import {
  ANSWER_WITH_RESULT,
  conversation,
  resetApp,
  savedSessionId,
  sendAnswer,
  showDebrief,
  viewer,
  skipSetup,
  startTextInterview,
  JOB_TEXT,
  steerEngine,
  watchSessionSocket,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetApp(request);
  await skipSetup(page);
});

/** A text interview with one answer in, waiting at question 2. */
async function answeredOnce(page: import("@playwright/test").Page) {
  await startTextInterview(page);
  await sendAnswer(page, ANSWER_WITH_RESULT);
  await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
}

test.describe("US-13 AC5 A dropped connection", () => {
  test("happy path: Resume continues the same session, the earlier answers are kept", async ({ page, request }) => {
    const socket = await watchSessionSocket(page);
    await answeredOnce(page);
    await socket.drop();

    const card = page.getByRole("region", { name: "Paused" });
    await expect(card.getByRole("alert")).toContainText("The voice connection dropped");
    await expect(card).toContainText("Your answers so far are saved.");
    const id = await savedSessionId(request); // the server saved what was said when the connection ended

    await card.getByRole("button", { name: "Resume" }).click();
    await expect(card).toBeHidden();
    // The new connection asks the server to continue the saved session, not to start another one.
    expect(socket.starts()).toHaveLength(2);
    expect(socket.starts()[1]).toMatchObject({ resume_session_id: id, input: "text" });
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_RESULT}`);
    await expect(conversation(page)).toContainText("Mike:");

    // The user carries on by typing, and the session still has the one record.
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
    const list = (await (await request.get("/api/sessions")).json()) as { sessions: { id: string }[] };
    expect(list.sessions.map((s) => s.id)).toEqual([id]);
  });

  test("End from the interrupted card goes to the debrief of the same session", async ({ page, request }) => {
    const socket = await watchSessionSocket(page);
    await answeredOnce(page);
    await socket.drop();
    await expect(page.getByRole("region", { name: "Paused" })).toBeVisible();
    const id = await savedSessionId(request);

    await page.getByRole("button", { name: "End", exact: true }).click();
    await page.getByRole("button", { name: "Open debrief" }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${id}(\\?view=debrief)?$`));
    await showDebrief(page);
    await expect(viewer(page).getByRole("article")).toContainText(ANSWER_WITH_RESULT);
  });

  test("negative: the server cannot continue the session, the card says why and Resume can be tried again", async ({
    page,
    request,
  }) => {
    const socket = await watchSessionSocket(page);
    await answeredOnce(page);
    await socket.drop();
    const card = page.getByRole("region", { name: "Paused" });
    await savedSessionId(request);

    socket.failNextResume("resume_unavailable");
    await card.getByRole("button", { name: "Resume" }).click();
    await expect(card).toContainText("We couldn't continue this session: This session cannot be continued.");
    await expect(conversation(page)).toContainText(`You typed: ${ANSWER_WITH_RESULT}`); // nothing lost

    socket.failNextResume(null);
    await card.getByRole("button", { name: "Resume" }).click();
    await expect(card).toBeHidden();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
  });
});

test.describe("US-13 AC5 The engine stops", () => {
  test("Resume stays off while the engine is down and turns on when it is back", async ({ page, request }) => {
    const socket = await watchSessionSocket(page);
    await answeredOnce(page);
    await steerEngine(request, { status: "not_running" });
    socket.injectError("not_running", "Ollama is installed but not running.");

    const card = page.getByRole("region", { name: "Paused" });
    await expect(card.getByRole("alert")).toContainText("Ollama stopped responding");
    await expect(card).toContainText("We check again every 5 seconds. Resume turns on when it's back.");
    await expect(card.getByRole("button", { name: "Resume" })).toBeDisabled();

    await steerEngine(request, { status: "ready" }); // the user opened Ollama again
    await expect(card.getByRole("button", { name: "Resume" })).toBeEnabled({ timeout: 15_000 });
    await card.getByRole("button", { name: "Resume" }).click();
    await expect(card).toBeHidden();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
  });

  test("negative: before the first answer an engine error is a plain failure, nothing to resume", async ({ page }) => {
    const socket = await watchSessionSocket(page);
    await startTextInterview(page);
    socket.injectError("not_running", "Ollama is installed but not running.");
    await expect(page.getByRole("region", { name: "Paused" })).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("Ollama is installed but not running.");
  });
});

test.describe("US-13 AC5 A dropped voice session", () => {
  // The config's fake microphone stands in for a real one; here the page is allowed to use it.
  test.use({ permissions: ["microphone"] });

  /** A voice interview, one answer typed (the fake microphone says nothing useful), back on voice, then cut. */
  async function droppedVoiceSession(page: import("@playwright/test").Page) {
    const socket = await watchSessionSocket(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message Mike" }).fill(JOB_TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("button", { name: "Behavioural", exact: true }).click();
    await page.getByRole("button", { name: "Nothing else" }).click();
    await page.getByRole("button", { name: "Start interview" }).click();
    await page.getByRole("button", { name: "Type instead (T)" }).click();
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 2", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "Switch to voice (T)" }).click();
    await expect(page.getByRole("group", { name: "Voice" })).toBeVisible();
    await socket.drop();
    return socket;
  }

  test("the card offers voice or text; Continue in text carries on in the same session by typing", async ({ page, request }) => {
    const socket = await droppedVoiceSession(page);
    const card = page.getByRole("region", { name: "Paused" });
    await expect(card).toContainText("Pick up where you left off, by voice or by typing.");
    await expect(card.getByRole("button", { name: "Resume voice" })).toBeVisible();
    const id = await savedSessionId(request);

    await card.getByRole("button", { name: "Continue in text" }).click();
    await expect(card).toBeHidden();
    expect(socket.starts()[1]).toMatchObject({ resume_session_id: id, input: "text" });
    await expect(page.getByRole("group", { name: "Voice" })).toHaveCount(0);
    await sendAnswer(page, ANSWER_WITH_RESULT);
    await expect(page.getByRole("heading", { name: "Question 3", level: 2 })).toBeVisible();
  });

  test("Resume voice reconnects the same session with the microphone", async ({ page, request }) => {
    const socket = await droppedVoiceSession(page);
    const card = page.getByRole("region", { name: "Paused" });
    const id = await savedSessionId(request);
    await card.getByRole("button", { name: "Resume voice" }).click();
    await expect(card).toBeHidden();
    expect(socket.starts()[1]).toMatchObject({ resume_session_id: id });
    expect(socket.starts()[1]!.input).not.toBe("text");
    await expect(page.getByRole("group", { name: "Voice" })).toBeVisible();
  });
});
