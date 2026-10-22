# E2E tests: Vukoli (Interview Coach)

Directive: `directives/_e2e_testing.md`. Stage 12d. Web only (Playwright); there is no mobile-native app, so no Maestro.

## 1. Stack and how to run

- Playwright `@playwright/test@1.64.0`, Chromium. Config: `app/web/playwright.config.ts`. Specs: `app/web/e2e/*.spec.ts`, shared steps in `app/web/e2e/helpers.ts`.
- Two projects, both run by default: `desktop` (1440x900) and `mobile` (375x812, `isMobile`, `hasTouch`).
- Almost every flow goes through "Type instead". Chromium runs with a fake microphone (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, set in `playwright.config.ts`; the permission is granted per describe), which `resume.spec.ts` uses to start a voice session and resume it. The speech loop itself (recognition, "heard as") is still a gap (section 5).
- Socket-level steering: `page.routeWebSocket` (helpers `watchSessionSocket`, `savedSessionId`) cuts, refuses or injects errors on `/ws/session`, because the real server does not end a session by itself mid-turn. `page.route` mocks the recheck HTTP 502.
- Reports: `app/web/playwright-report/` (HTML), `app/web/test-results/` (traces and screenshots on failure). Not committed (`.gitignore`).

Run (from `app/web`):

```
npm run test:e2e                          # both projects, fresh build + server
npm run test:e2e -- --project=mobile      # one project
npx playwright test e2e/history.spec.ts   # one file (use the e2e/ prefix, a bare word also matches the folder name)
npm run test:e2e:ui                       # Playwright UI mode, for debugging
```

`webServer` (`app/web/scripts/e2e-server.mjs`) does the rest: builds the web app into `.e2e-dist` (never `dist`), starts the backend on **port 8010** with `IC_E2E=1`, a fresh `IC_DATA_DIR` under `.e2e-data/`, serving `.e2e-dist`. Backend log: `.e2e-data/server.log`. With `reuseExistingServer` (off in CI) a server already on 8010 is reused: after a Python change, stop it first, because Python is cached per process. Nothing touches ports 8000, 8001, 8002, 11434, 11435.

### The scripted engine (test mode)

With `IC_E2E=1` the server puts a deterministic `ScriptedEngine` (`app/server/server/engines/scripted.py`) in the Ollama slot. The wizard shows "Ollama, Recommended, Ready, scripted-e2e", so the web app needs no test-only code. It answers all call kinds (questions, interviewer, content layer, language layer, stronger answer, debrief, English corrections, suggester) with canned or schema-valid replies:

- The interviewer follows up (up to 2 per question at standard strictness) unless the answer contains a digit or a number word. So `ANSWER_NO_RESULT` always gets a follow-up and `ANSWER_WITH_RESULT` never does.
- The language layer knows a small rule list ("since five years", "I am agree", ...), each with a reason. This is what makes corrections, dismissals and weak spots reproducible.
- A debrief needs at least 3 scored answers, otherwise it is "too short", as in production.

Test-only routes (exist only with `IC_E2E=1`; without it the engine is not listed and they return 404, covered in `app/server/tests/test_e2e_mode.py`):

| Route | What it does |
|---|---|
| `POST /api/_e2e/reset` | Wipes the data dir and resets the engine. Every test calls it first (`beforeEach`), so tests are independent. |
| `POST /api/_e2e/engine` | Steers the engine: `status` (ready, not_running, no_model, not_installed), `fail` (call kinds that must fail), `delay_ms`. |
| `GET /api/_e2e/engine` | Reads the steering state. |
| `POST /api/_e2e/storage` | `{writable:false}`: `GET /api/health` reports `storage_ok:false` (the data folder is not writable) until the next reset. Saving itself still works, so only the warnings are tested (US-23 AC4). |
| `POST /api/_e2e/seed` | `{fixture:"returning"}`: a returning user (CV, two jobs, three finished interviews 1, 8 and 15 days ago, a recurring content and language weak spot). |

Test data is fictional: Alex Morgan, product manager at Kestrel Pay; a second job at Northwind Logistics.

Rules followed: semantic locators (role, label, text); the only non-visible hook is `html[data-theme]` in the theme spec (commented there); no `waitForTimeout` for synchronisation; one worker, because all tests share one server and data dir; no retries, so a flake is a bug to fix, not to hide.

## 2. Plan

IDs are PRD user stories (`docs/prd.md`) and release gates. Flow letters follow the stage-09/11 flows: A first run, B interview, C return and drill, D history, E English. Every test runs on `desktop` and `mobile` unless noted.

| ID | User story / goal | Flow steps | Checks (AC) | Negative branches | Breakpoints | File |
|---|---|---|---|---|---|---|
| US-02, US-03, US-06, US-08, US-09 | A. First run: engine, check, about you, first question | Pick Ollama, Continue, "I'll type instead", name, CV text, job text, "Start the first round" | Steps in order (AC1); engine readiness shown; profile and job saved (API poll); first question uses the user's name and the job; wizard does not return after completion (AC6); no e-mail, password or survey field (AC7) | Engine not running (Connect brings it up), Check again, model missing, Ollama not installed (Continue stays disabled with the reason); microphone blocked (alert, "Try again", text mode finishes the wizard); "Not now"; job with no text cannot be saved | desktop, mobile | `first-run.spec.ts` (9) |
| US-10, US-14, US-15, US-19, US-20 | B. Text interview, feedback per thread, End, debrief | Paste job, round, plan, "Type instead", answer, follow-up, answer with a number, next question, panel, End, "Open debrief" | First question from the job (US-10); answer with no result gets a follow-up on the result, an answer with a number does not (US-14 AC1, AC3); one panel per thread with Content, Language, Delivery and "Nothing to fix" where true (US-15); text-mode delivery says what is unavailable (US-19); verdict on top, "1 follow-up", saved-locally link, question cards (US-20); session appears in Recents (US-21) | Fewer than 3 answers: no verdict, only cards (US-20 AC4); content and language layers fail: both blocks say "Not available for this answer.", chips read "n/a" (never "Good" or "Nothing to fix"), session goes on, answer saved (US-15 AC5); empty or blank answer cannot be sent | desktop, mobile | `interview.spec.ts` (14 incl. the rows below) |
| US-17, US-22 AC3 | B. Corrections with a reason, dismissal | Answer with "since five years", read the panel, "I wrote it right", finish, debrief | Correction shows "You typed / Say / Why" and the level label (US-17 AC1); a slip is a weak spot with a reason in the debrief | Dismissed correction is not counted in "What to work on" | desktop, mobile | `interview.spec.ts` |
| US-18 AC3 | B. "Edit my answer" in the live session | Panel, "Edit my answer", fix the text, "Save and check again" | Transcript line replaced; language layer made again ("Nothing to fix"); session carries on at the same question | Cancel keeps the answer and corrections; engine failing during the recheck leaves the answer unchanged | desktop, mobile | `interview.spec.ts` (3) |
| US-15 | B. First-time hint names where feedback opens | Start a text interview at 375, 900 and 1440 px | Narrow: "a dot shows on the feedback button ... slides up from the bottom"; mid (drawer): "... slides in from the right"; wide: "appears on the right"; the wording follows the layout the session measured (`data-layout`), not the window | Other layouts' wording is absent | one viewport per test | `interview.spec.ts` (3) |
| US-15 AC1, AC2, US-24 AC3 | B. Feedback shows up by itself (13, QA-01) | Finish thread 1 (answer, follow-up, answer) **without clicking the toggle** | Wide: the panel opens by itself with the thread's feedback and the toggle reads "Hide feedback (F)"; mid and narrow: nothing covers the stage, the toggle's name is "Show feedback (F), new feedback is ready", opening shows the panel and clears the cue; English talk, wide: corrections open by themselves | The user closes the panel: new feedback only lights the dot until they open it again, then it follows again | desktop, mobile (viewport set in the test) | `feedback-panel.spec.ts` (5) |
| US-10, US-09 | A. Home: the plan is not startable until its questions are ready (13, QA-02) | Paste a job, pick a round, watch the plan card (`/api/_e2e/engine` with `delay_ms`) | While "Preparing questions…" both "Start interview" and "Type instead" are disabled with a note; they enable when ready and Q1 comes from the job | `fail: ["p0"]`: the prep-error text shows, start is enabled (general questions), "Try again" recovers; a request that never answers: after 90 s (fake clock) the same error and an enabled start | desktop, mobile | `home-plan.spec.ts` (3) |
| US-22, US-20 AC1 | C. Return: weak spots and drill | Seeded user, home, "Drill my weak spots", pick a layer, plan, "Type instead", answer, follow-up | Mike names the weak spots with session counts and "misheard words aren't counted" (AC2); drill plan targets the chosen layer; session of 3 questions; follow-up asks for the result; debrief lists one weak spot per layer and "Go to question 3" jumps to it; "Drill these weak spots" in the debrief opens Home in the same drill (`/?drill=1`, same Mike script and plan as the chip) | No history: drill not offered, Recents says so (AC4); Language focus has a different plan from Content; Recents newest first; dismissing the language correction in each saved debrief takes Language out of the drill (US-22 AC3) | desktop, mobile | `return-drill.spec.ts` (7) |
| US-13 AC5 | B. Resume after an interruption | Text and voice session, cut or refuse the socket, the Paused card, "Resume", "Continue in text", "End and debrief" | Resume continues the same session (same id, earlier answers kept, the next question follows); Continue in text carries on by typing; End goes to the debrief of the same session; voice: "Resume voice" reconnects with the fake microphone; Resume stays off while the engine is down and turns on when it is back | Server cannot continue the session (`resume_unavailable`): the card says why, Resume can be tried again; before the first answer an engine error is a plain failure with nothing to resume | desktop, mobile | `resume.spec.ts` (7) |
| US-18 AC3, US-17 AC2, US-22 AC3 | B. The debrief of a saved session: Edit what I said, dismissals | Open a seeded session, a question card, "Edit what I said", type, "Save and check again"; dismiss a correction | The answer is checked again alone (badge "Edited by you", slip gone), saved on the computer (reload); `POST /api/sessions/:id/recheck` and `.../flags/:flag` return the refreshed debrief, so the weak spots follow a dismissal, restore or recheck; (13, QA-07) the verdict no longer names a weak spot the recheck removed (checked before and after a reload) and the editor does not promise that the rest of the debrief stays as it is | Recheck fails (HTTP 502): the editor reopens with the typed text and says so, the old answer is unchanged; dismissing the only slip removes the Language weak spot, restoring it brings it back | desktop, mobile | `debrief.spec.ts` (6 here, 3 in the next row) |
| US-23 AC4 | D. The data folder is not writable | Steer `/api/_e2e/storage`, open a debrief, start an interview | Debrief: "We couldn't save this debrief to your computer", Download (.md) works, "Fix in Settings"; live session: "We can't save to this computer" with the download promise | Warning is absent when the folder is writable | desktop, mobile | `debrief.spec.ts` |
| US-21 | D. One history | Archive a chat from its menu, Archive page, track filter, open a session, rename, move back | Row has title, date, track; filter counts (All, Interview, English) and narrows the list; opening shows the debrief; rename persists after reload and in Recents; restore returns it to Recents | Rename Cancel; empty history and empty Archive explain themselves and offer "Start a practice"; unknown session id shows a message, not an empty debrief | desktop, mobile (row actions are in a "..." menu on mobile) | `history.spec.ts` (7) |
| US-23 AC2 | D. Trash | Delete from the menu, Trash, restore; delete forever | Deleted chat leaves Recents and Archive and is in the Trash; restore returns it; delete forever asks first and removes it for good (checked through the API) | Cancel on either confirmation keeps the chat; empty Trash says so | desktop, mobile | `trash.spec.ts` (4) |
| US-24, US-17, US-21 AC4 | E. English track | "Practise English", level, topic, plan, "Type instead", send a turn with two slips, panel, "End practice", debrief, Archive filter "English" | Named track on home; level selector A2 to C1 (AC2); Mike is the partner; corrections appear after the turn, with a reason and the level label, Language only (no Content or Delivery) (AC3); debrief lists the corrections; the session is under the English filter; no cap or paywall copy (AC5) | Change level from the plan; dismissal removes a correction from the panel and the debrief; a clean turn says "Nothing to fix"; ending with no turns shows "Session ended, nothing was saved"; a session with no phrases to review never says "uses these 0 phrases" and offers a plain "Practise again" | desktop, mobile | `english.spec.ts` (6) |
| US-59 | Light and dark theme | Settings, Appearance, Theme radio group | System follows the OS in both directions; Dark and Light apply (page background lightness) and survive a reload; explicit choice wins over the OS; back to System removes the override | Unknown saved value falls back to System without a page error; `localStorage` that throws does not break the page | desktop, mobile | `theme.spec.ts` (5) |
| G4 (breakpoints) | No horizontal scroll at 375 px | Open each screen at 375x812 | `scrollWidth <= innerWidth` on: setup steps 1 and 2, home, Archive, Trash, Settings, a finished debrief, a live interview with a long answer, a live English session | Long job title and long answer text are the stress cases | 375 set in the file (same in both projects) | `layout.spec.ts` (5) |

Totals: 81 tests per project (81 run, 0 `test.fixme`), 162 across both projects. Per file: first-run 9, interview 14, return-drill 7, resume 7, debrief 9, history 7, english 6, trash 4, theme 5, layout 5, feedback-panel 5, home-plan 3.

### Placeholders (`test.fixme`)

None. The five placeholders of round 1 are all real tests now: US-15 AC5 (interview.spec), US-13 Resume (resume.spec), recheck from the debrief (debrief.spec), "Drill these weak spots" and dismissal in an old debrief (return-drill.spec).

### Changes in the app that came with the tests (round 2)

- **Weak spots follow a dismissal (US-22 AC3).** The server keeps weak spots in each session's saved debrief and Home's drill reads them from there. `POST /api/sessions/{id}/flags/{flag}` and `POST /api/sessions/{id}/recheck` now call `feedback.refresh_weak_spots` and return the refreshed `debrief`, which the debrief screen shows at once (pytest: `server/tests/test_weak_spots_refresh.py`). A verdict the model wrote keeps its wording (the "Rerun" button writes it again); only the weak-spot list is recomputed.
- **Drill from the debrief (US-20 AC1).** The button navigates to `/?drill=1`; Home starts the same "Drill my weak spots" script once its data has loaded. English debriefs still go to the English start.
- **A failed layer in the live panel (US-15 AC5).** Language and Content (and Delivery) say "Not available for this answer." and the chip reads "n/a" when every answer of the thread has no usable layer. Fixture and story: S14e.
- **First-time hint per layout (US-15).** `session.firstTime.text3` (wide), `text3Mid` (right drawer), `text3Narrow` (bottom sheet).
- **English debrief with no phrases.** No "uses these 0 phrases" line; the button reads "Practise again" (plural forms `_one` / `_other` for the hint otherwise). Story: `Screens/Debrief/EnglishNoPhrases`.

## 3. Must-have coverage: 15 of 38 stories, plus 5 partial (round 2 added acceptance criteria to stories already counted; US-13 stays partial)

The PRD has 38 Must stories (and 4 release gates). Counted as covered: a test asserts the story's main acceptance criteria and has a negative branch.

**Covered (15):** US-02, US-06, US-08, US-09, US-14, US-15, US-17, US-18 (AC3, live session and debrief), US-19 (text-mode line), US-20 (AC1 drill included), US-21, US-22 (AC3 included), US-23 (AC2 trash, AC4 storage not writable), US-24, US-59. Release gate G4 (375 px, no horizontal scroll) is also covered.

**Partial (5):**
- US-03 engine picker: only the Ollama slot is exercised (readiness, not running, no model, not installed). Other engines need external services.
- US-10 tailored questions: the flow starts from a pasted job and shows the first question, but the question text is not asserted against the job.
- US-12 round and strictness: the round is chosen in the flow; strictness and other rounds are not.
- US-13 voice loop: Resume after an interruption is covered in text and in voice (fake microphone, `resume.spec.ts`); the voice answer loop itself (speaking, listening, recognised words) is not asserted.
- US-28 zero-account start: AC7 is asserted in the wizard (no e-mail, password or survey field); no network or tracker check.

**Not covered (18), with reasons:**
- US-01 installer, US-04 free local path, US-05 hardware and disk check: OS installer and hardware level, outside a browser test. Covered by release gates G1 to G3 on clean machines.
- US-42 Gemini Live, US-56 Claude Code CLI, US-57 OpenAI-compatible: need a real key or a binary; the scripted engine stands in for Ollama only. Candidate for a later mocked-network spec.
- US-07 "where audio and text go" line, US-16 configurable layer order, US-58 answer suggester, US-44 opt-in telemetry: UI exists, no spec yet. Next in line.
- US-11 question bank as a data file: data-level, covered by server pytest, no UI flow of its own.
- US-25 interview-first IA, US-26 one product name, US-27 English UI locale file, US-29 sample panel and debrief, US-30 free-vs-premium table, US-31 practice-only statement: static copy and structure; checked by review and the design-system audit, not by flows. US-25, US-26 are touched indirectly (home heading, name in the wizard).
- US-32 README with quick start: a document, not the app.

## 4. Last run

- Date: 2026-10-22 (round 2 of 12d).
- Re-run by the orchestrator after round 2 (2026-10-22): first run 143/144 — `first-run` happy path still expected the greeting without the name (Q4 now greets by name; the test passed earlier only because Home briefly showed the greeting before settings loaded). Fixed both: the test asserts "What are we practising today, Alex?", Home keeps the greeting blank until settings load. Second full run: **144 passed**, 8.2 min.
- Command: `npx playwright test` from `app/web` (fresh build into `.e2e-dist`, backend on port 8010, both projects, one worker).
- Result: **desktop and mobile: 144 passed (72 per project), 0 skipped, 0 failed, 0 flaky**, 8.2 min.
- Other checks on the same day: `npm run typecheck` green, `npm run lint` green (ESLint, token and variable checks), `npm test` 152 passed (vitest), server `pytest` 150 passed (6 new for the weak-spot refresh, 2 new for the storage switch and its gating), `npm run build-storybook` green and the five changed stories open without errors (checked headless: S14e, the three first-time-tips stories, English debrief without phrases).

Fixes made to the tests after the first runs (worth knowing for the next author): the mobile layout differs from desktop in four places, all handled in `helpers.ts` or the specs: the question counter reads "Q2 of 5" (`questionCounter`), the feedback panel is a bottom-sheet dialog that must be hidden before typing (`sendAnswer`, `endSession`), the menu button must not be clicked when the drawer is already open (`openMenu`), and an Archive row keeps "Move back to Recents" in a "..." menu.

### Run after the stage-13 P1 fixes (QA-01, QA-02, QA-07), 2026-10-22
- `npx playwright test` from `app/web`: **162 passed (81 per project)**, 0 failed, 9.8 min. Two earlier full runs each had one mobile timeout in a different, untouched test (`history` "brought back to Recents", `theme` "pick Dark and Light"); both passed alone and in repeats. Cause: `openMenu` read the "Open menu" button once without waiting, so on a phone it could skip opening the sidebar. `openMenu` now waits for the button below 768 px.
- New tests were written first and seen red: `feedback-panel.spec.ts` (the wide panel never opened, no dot), `home-plan.spec.ts` first test (both start buttons enabled while "Preparing questions…"), `debrief.spec.ts` QA-07 (old editor copy, then the stale verdict "The one thing to fix: preposition").

- Stage 13 regression after fix round 1 (orchestrator, 2026-10-22, app d6d5f66): **162 passed** (81 per project), 9.9 min, 0 failed, 0 flaky. New: `feedback-panel.spec.ts`, `home-plan.spec.ts` and the QA-07 test in `debrief.spec.ts`.
- Stage 13 after fix round 2 (2026-10-22, app 796a1ec): **201 passed, 3 skipped** (mobile-only touch-target tests on desktop), 0 failed. New: `polish.spec.ts` (naming, drill, Setup step 1, mic help, Save job, touch targets, island geometry, English hint).

## 5. Known gaps

The app gaps found in round 1 are closed (section 2, "Changes in the app"). What is left:
1. Voice answers: with the fake microphone the session starts and resumes, but the recogniser has no speech to hear, so "heard as" word confidence (US-18 AC1, F27) and the spoken answer loop are not asserted.
2. The mid-width hint wording is asserted at 900 px; the session container width, not the window, decides the layout, so a different sidebar width could move the breakpoint (the test reads `data-layout` to stay honest).
3. The "storage not writable" switch (`/api/_e2e/storage`) reports the probe result only; a really read-only folder (failed writes) is covered by server pytest, not in the browser.

Not testable here:
- **Voice and microphone:** the fake device produces silence. The voice loop, "heard as" word confidence (US-18 AC1, F27) and local speech recognition are untested end to end. Needs `--use-file-for-fake-audio-capture` with a wav file and a recogniser in test mode.
- **Model quality:** the scripted engine checks the logic around the model (follow-up rules, corrections, dismissals, memory, debrief shape), not whether a real model gives good questions or fixes.
- **Installer and release gates G1 to G3** (first question within 15 minutes on clean macOS, Windows, Linux): manual, on clean machines.
- **Premium and paid stories (US-47 to US-55):** not in OSS v1.
- **Other engines** (Gemini Live, Claude Code CLI, OpenAI-compatible): see section 3.
- Browsers: Chromium only. No WebKit or Firefox run.
- The old live smoke run `app/web/scripts/e2e.mjs` is kept and is not part of this suite: it talks to a real engine.
