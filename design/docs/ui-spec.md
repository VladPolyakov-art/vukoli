# Vukoli — UI spec (stage 11, step 7)

Date: 2026-10-21 · Track: SaaS · Stack: React + Vite + TS + Storybook (`app/web`)

## 0. How to read this file

**Source of truth.** The code (`app/web/src`) and the tokens (`tokens/tokens.json` → `ds/tokens.css`) are the truth. This file describes them. Where a composition map (`ds/screens/*.md`) or a review note says something else, the code wins, and the gap is listed in §10. Copy is quoted from `app/web/src/i18n/en.json`: change copy there, not here.

**How to open a state.**

| Where | Address | Example |
|---|---|---|
| Storybook (`npm run storybook`, port 6006; static build `app/web/storybook-static`) | `?path=/story/<story-id>` | `screens-session--s-3-listening` |
| Review page (`npm run build:review` → `docs/artifacts/11-design-review.html`) | `#<screen>-<state>`; frames 1440×900 and 375×812, light (dark optional) | `#session-s3` |
| Comment target in the review page | `data-review-id="<screen>/<state>@1440-light"` prefix + element id | `Home/Plan` |
| Live app | route below (needs `app/server` running) | `/sessions/<id>` |

Review screen ids: `setup`, `sidebar` (shell + Settings), `engine`, `home`, `session`, `debrief`, `history` (titled "Archive").

Story ids in the tables are written without their prefix. Each screen section names its prefix.

**PRD references.** `US-xx ACn` from `docs/prd.md`. Owner decisions: `Dnn` from `docs/scope/owner_decisions.md` (latest D93).

**Fixtures.** Alex Morgan, Product Designer. Jobs: Kestrel Pay, Lumen Health, Fieldnote. Sessions S1–S3. Example debrief: Sam Rivera, Product Manager at Brightline. All fictional.

---

## 1. Global

### 1.1 App boot and routes (`App.tsx`)

| Step | Condition | What the user sees |
|---|---|---|
| Health check | on load, once | `checking` → shimmer "Loading…" |
| Server down | `api.health()` fails | **ServerUnavailable** (§9). Not re-checked automatically. |
| First run gate | `/` and `!prefs.setupDone()` | redirect to `/setup` |
| Routes outside the shell | `/setup` (Setup), `/session` (Session) | full screen, no sidebar |
| Routes in the shell | `/` Home · `/archive` · `/archive/trash` · `/sessions/:id` Debrief · `/sessions/example` example debrief · `*` NotFound | sidebar + `<main id="main">` |
| Redirects | `/history` → `/archive`, `/history/trash` → `/archive/trash` | — |
| Settings | `/settings/<section>[#row]` | popup Dialog over the page you came from (D76/D77), §8 |

**Route swap.** The new page enters with `motion-page-in` (fade, `--duration-fast` 160 ms). The old page leaves with `motion-fade-out` (`--duration-exit` 200 ms). Focus moves to `#main`.

`main.tsx` calls `guardFileDrops()`, so a file dropped outside a drop zone never makes the browser open it. It also calls `applyTheme(prefs.theme())` before the first paint.

### 1.2 Shell (`components/AppShell.tsx`)

Prefix: `patterns-appshell--`. Review: `#sidebar-<state>`.

| Part | Content | Behaviour |
|---|---|---|
| Skip link | "Skip to content" | first Tab stop, goes to `#main` |
| Rail top | wordmark + toggle "Close sidebar" / "Open sidebar" | collapsed state saved in `ic.railCollapsed` |
| New practice | NavRow → `/` | — |
| Archive | NavRow "Archive" → `/archive` | — |
| Recents | heading "Recents"; ChatRow per non-archived session | reloads on every route change and on the `ic:sessions-changed` event |
| Row "…" menu ("Actions for {title}") | "Rename" · "Download as Markdown" · "Archive" · separator · "Delete" | Rename = InlineRename in the row (max 80) |
| Engine not ready | row "AI engine" + "Not ready" → `/settings/engine`; collapsed: alert icon with a tooltip | only when the engine in use is not ready |
| Account menu ("Account menu") | header: name (or "You") + "Saved on this computer"; items: Settings → `/settings`, Privacy → `/settings/privacy`, "Help & what's free" → `/settings/about#free` | placement right-end |
| Top bar (`shell` < 1024) | "Open menu" button · wordmark · engine badge link (only when not ready) | the menu opens the rail in a left Drawer |

| State | When | Sees | Story | Review |
|---|---|---|---|---|
| Expanded | ≥1024, default | 240 px rail | `expanded` | `expanded` |
| Collapsed | toggle | 52 px icon rail, tooltips | `collapsed` | `collapsed` |
| Account menu | click name | menu | `account-menu-open`, `account-menu-open-collapsed` | `account-menu`, `account-menu-collapsed` |
| Row menu | "…" on a row | menu | `row-menu-open` | `row-menu` |
| Recents loading | first load | skeleton rows | `loading` | `loading` |
| Recents empty | no sessions | "Your practice sessions will appear here." | `empty` | `empty` |
| Recents error | load fails | section renders empty (no message) | — | — |
| Engine not ready | engine in use not ready | warning row / icon / top-bar badge | `engine-not-ready`, `engine-not-ready-collapsed`, `engine-not-ready-tablet` | `engine-down`, `engine-down-collapsed` |
| Current chat | on `/sessions/:id` | row marked current | `debrief-current` | — |
| CLI engine | Claude Code / Codex / Antigravity | short engine name | `engine-cli` | — |
| Tablet / mobile | `shell` < 1024 | top bar | `tablet`, `mobile` | — |
| Drawer open | menu button | rail in a Drawer | `mobile-drawer-open`, `mobile-drawer-account-menu` | `drawer` |

**Row actions (D80).**

| Action | Result | On failure |
|---|---|---|
| Archive | the row leaves at once; toast "Moved to Archive." with "Undo" | Undo failure: error toast with the API message |
| Delete | Dialog: "Delete this chat?" / "“{title}” and its debrief leave the app. You can bring it back from Trash in Settings → Privacy and data." / "Cancel" + danger "Delete". On confirm the row leaves; toast "Chat deleted." with "Undo" | same as Archive |
| Delete of the open chat | also navigates to `/` | — |
| Rename | optimistic | list reloads, toast "Couldn't rename the chat." |
| Download | `GET` the session Markdown (browser download) | browser's own error |

**After End (D73).** Session's End goes to `/` and the shell watches the save: it polls every 2 s for up to 3 min.

| Phase | Toast |
|---|---|
| Saving | shimmer "Saving your session… It'll be ready in a moment" (stays until done) |
| Saved | "Your session is saved" + action "Open debrief" (12 s) |
| Not found in 3 min | error toast "Couldn't find the saved session yet. Check History in a minute." (stays until dismissed) |

Home stories for these: `screens-home--after-end-saving`, `screens-home--after-end-saved`. Review: `#home-after-end-saving`, `#home-after-end-saved`.

The Drawer closes by itself when the shell grows to ≥1024.

### 1.3 Breakpoints (container queries only)

Viewport media queries are used only for `pointer: coarse`, `prefers-reduced-motion` and `prefers-color-scheme`.

| Container | Where | Steps |
|---|---|---|
| `shell` | AppShell root | ≥1024 rail · <1024 top bar + Drawer |
| `page` | `<main>` | wide ≥840 · medium 560–839 (padding `space-8`) · narrow <560 (gap `space-8`, gutter, title `text-2xl`) |
| `session` | Session root | wide ≥1024 (floating feedback panel on the right) · mid 768–1023 (right Drawer) · narrow <768 (bottom sheet). Island stacks <560. JS mirror: `useSessionLayout` (1024 / 768 / 560) |
| `setup` | Setup frame | <768 single column |
| `dialog` | Dialog | <480 actions stack, primary on top; Settings <640 → phone list (D82) |
| `chat` | setup chat log | <560, <480 (ChatMessage) |
| unnamed | Composer <419 · SettingRow <30rem (control drops under the label) · WeakSpotStrip <759 · Card <559 / <319 · Captions <479 | — |

375 frames are drawn for every screen 🟡: mobile is "Won't" in the PRD, so 375 only proves nothing breaks.

### 1.4 Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 160 ms | route in, swaps, InlineRename |
| `--duration-base` | 240 ms | panels, menus |
| `--duration-slow` | 420 ms | scripted reply pause in the setup chat, toast in |
| `--duration-slower` | 560 ms | composer FLIP into the setup chat |
| `--duration-exit` | 200 ms | every exit |
| `--stagger` | 80 ms | debrief build-up, chips |
| Loops | dots 1200 · skeleton 1400 · shimmer 1800 · presence sweep 2800 | — |
| Eases | `standard`, `enter`, `exit`, `presence` | — |

**Rules.**
- Transform and opacity only.
- Exits never block: a timeout fallback removes the element even if `animationend` never fires.
- `[data-motion-quiet=true]` pauses every loop while the user speaks (Session).
- **Reduced motion is total.** Durations become 0 ms. Loops show one static frame. Shimmer becomes plain secondary text. Scrolling is instant.

### 1.5 Focus and keyboard

| Situation | Focus goes to |
|---|---|
| Route change | `#main` |
| Setup step change | the step heading |
| Plan card appears (Home) | plan heading `#home-plan` (tabindex -1, no ring for mouse users) |
| A list row leaves (Archive, Trash) | next row's control, else the previous one, else the page H1 |
| Dialog / Drawer / Menu closes | the control that opened it |
| Debrief evidence link "Go to question {n}" | that question's heading |

- **Dialogs.** In the app they are native `<dialog>` + `showModal()`, so the focus trap, Esc and the inert background come from the platform. In review frames the trap and Esc are scripted. A backdrop press closes them (Settings: `closeOnBackdrop`).
- **Session shortcuts:** §4.4.
- **Plain Enter:** sends in a Composer, submits in a form. **Shift+Enter** adds a new line.

### 1.6 Overlays

Everything floating (Dialog, Drawer, Menu, Tooltip, Toast) renders through `OverlayRoot`: a portal into the review frame there, `document.body` in the app.

**Toasts.**
- Neutral toasts hide after 5 s, paused while hovered or focused.
- Error toasts stay until dismissed and use `role="alert"`.
- The polite live region always exists.
- Toasts are queued while the user speaks.

### 1.7 i18n

- `t(key, {name})` fills placeholders.
- `tp(key, n)` picks `_one` / `_other`.
- `tMaybe(key, fallback)` is for keys that may not exist (server error codes).
- English only (US-27). No copy lives in components.

### 1.8 Privacy and trust copy

| Copy | Where |
|---|---|
| "Saved on this computer" | account menu, Debrief meta |
| "The file stays on this computer." | every file drop: Home, chat, VacancyEditor |
| "Practice only: no help during real interviews." | Home footer |
| "Free forever: no limits on English practice." | English footer and plan |
| "Practice only: this app is for rehearsal, never for help during a real interview." | Settings → About |

- Telemetry: one unticked checkbox on Setup's "It works" (US-44, US-02 AC7) and a toggle in Settings → Privacy.
- No account anywhere (US-28).

---

## 2. Setup (`/setup`)

- Code: `screens/Setup.tsx`, `screens/setup/*`.
- Story prefix `screens-setup--`. Review `#setup-<state>`.
- Map: no composition map. Sources are D81/D82 (three steps, nothing preselected), D83–D88 (engines) and `_index.md` §2. §2b of `_index.md` is superseded.
- PRD: US-02, US-03, US-04, US-05.

**Frame.** Brand, a stepper ("Setup steps": "AI engine" · "Check" · "About you", done steps marked "done"), one content column, then the step heading, body and a footer (Back on the left, actions on the right). Below 768 (`setup` container) it is a single column. Focus moves to the step heading on each change.

### 2.1 Step 1 — AI engine (`EngineStep`, `EngineChoice`)

| State | When | Sees | Can do | Story | Review |
|---|---|---|---|---|---|
| First run, nothing picked | `!setupDone` | four engines; footer note "Pick an engine to continue."; Continue disabled | pick one | `engine-first`, `-mobile` | `engine-first` |
| Picked, Ready | pick has `status.ready` | row status "Ready", Disconnect (D84); note "You can switch any time in Settings → AI engine." | Continue (saves `engine` if it changed) | `engine-picked` | `engine-picked` |
| Ollama not installed | — | "Download Ollama" | follow the link; status re-checks every 5 s | `engine-no-ollama`, `-mobile` | `engine-no-ollama` |
| Ollama not running | — | "Ollama is installed but not running, so Mike can't think yet." · "Connect starts it for you." | Connect | `engine-not-running` | `engine-not-running` |
| Ollama has no model | — | download from the app (D85), 16 GB+ also offered the smaller model; "Use Terminal instead" | download | `engine-no-model` | `engine-no-model` |
| Downloading | download runs on the server | progress (keeps going if the page closes) | wait / cancel | `engine-downloading`, `-mobile` | `engine-downloading` |
| Download cancelled / failed | — | cancelled / failed line | retry | `engine-download-cancelled`, `engine-download-failed` | — |
| Disconnected | user pressed Disconnect | "Mike won't use {name} until you connect it again." | Connect | `engine-disconnected`, `-mobile` | `engine-disconnected` |
| Claude Code not found | — | "Claude Code wasn't found on this computer." | install, then Connect | `engine-no-claude`, `-mobile` | `engine-no-claude` |
| CLI found, not checked | D85 | "Not connected" | Connect (one real request) | `engine-claude-connect`, `engine-codex-connect`(-mobile), `engine-antigravity-connect` | same ids |
| CLI signed out | — | "Claude Code isn't signed in." · "Open Terminal, run this and sign in. Then press Connect." + CopyField (Codex and Antigravity have their own copy) | copy the command, Connect | `engine-claude-signed-out`(-mobile), `engine-codex-signed-out`, `engine-antigravity-signed-out`(-mobile) | same ids |
| CLI not installed | — | not found copy | install | `engine-no-codex`, `engine-no-antigravity` | same ids |
| CLI Ready | — | "Ready" | Continue | `engine-codex-ready`, `engine-antigravity-ready` | same ids |
| Picked, not ready | — | note "Continue once {name} is Ready." | fix in place | — | — |
| Saving the choice | Continue pressed | Continue `loading` | — | — | — |
| Save error | `updateSettings` fails | error Callout with the API message | Continue again | — | — |

**Rules.**
- No text-mode way out on this step: the engine writes Mike's questions.
- On a rerun (Settings → About → "Run setup again") the engine in use is preselected if it is Ready.
- Picking does not switch the engine. Continue does.

PRD conflict: US-03 AC3 says Ollama is preselected when ready. D82 overrides this: nothing is preselected on the first run (owner: «нужно давать выбор людям»).

### 2.2 Step 2 — Check (`CheckStep`, `useVoiceCheck`)

| State | When | Sees | Can do | Story | Review |
|---|---|---|---|---|---|
| Idle | step opens | voice Select "Mike's voice" + "Listen"; MicButton "Start the check"; "Press the microphone and say something like “Hi Mike, can you hear me?”" | start, sample, "I'll type instead" | `check-idle`, `-mobile` | `check-idle` |
| Listening | mic open | Presence glow follows the mic; "Listening… Mike replies after a short pause."; "Done" | Done (or a short pause, or 12 s, ends it) | `check-listening`, `-mobile` | `check-listening` |
| Thinking | sent | user bubble pending "Recognising…", then Mike pending "Mike is answering…" | — | `check-thinking` | `check-thinking` |
| Done | reply played | heard text + Mike's reply, "Play again"; checkbox "Share anonymous usage counts to help improve the app" (unticked) | "It works" (primary), "Try again" | `check-done`, `-mobile` | `check-done` |
| Voice not installed | TTS unavailable | info "Mike's voice isn't installed on this computer, so he'll reply in text." instead of the voice row | check still runs | — | — |
| Mic denied | permission refused | warning "Vukoli can't use the microphone" / "Allow the microphone in your browser's address bar, then try again. Or answer with the keyboard." | Try again, "I'll type instead" | `check-mic-denied` | `check-mic-denied` |
| No mic | no input device | "No microphone found" / "Connect a microphone and try again, or answer with the keyboard." | same | — | — |
| No speech recognition | no server STT and no browser STT | "Speech recognition isn't set up" / "This computer can't turn speech into text yet. Answer with the keyboard; Mike still speaks." | "I'll type instead" (no Try again) | — | — |
| Not heard | too little audio / empty text | "Mike didn't catch that" / "Speak a little louder or closer to the microphone, then try again." | Try again | `check-not-heard` | `check-not-heard` |
| Engine error | STT worked, engine failed | error "Mike heard you, but the engine didn't answer" / `{message}` | Try again, "Back to AI engine" | `check-engine-error` | `check-engine` |
| Failed | any other error | error "The check didn't finish" / `{message}` | Try again | — | — |

**Leaving the step.**
- "It works" saves `input=voice`; telemetry is sent only if ticked.
- "I'll type instead" saves `input=text`.
- Back stops the mic.
- Changing the voice saves at once. A failed save is silent (`.catch(() => {})`), see §10.

### 2.3 Step 3 — About you (`AboutStep`)

| State | Sees | Can do | Story | Review |
|---|---|---|---|---|
| Empty | "What should Mike call you?" (placeholder "Your first name", max 60); CV ProfileEditor; "The job you're preparing for" + "Add a job"; "How you'll answer" Voice / Keyboard; hint "Five questions, about 20 minutes. Feedback comes after each answer, never while you talk." | everything optional (US-02 AC3) | `about` | `about` |
| Filled | job title with a briefcase icon + "Change" | — | `about-filled`, `-mobile` | `about-filled` |

| Action | Result |
|---|---|
| Name blur / Enter | saved, whitespace collapsed, cut to 60. A failed save is silent, see §10 |
| "Add a job" | VacancyEditor (§3.6). On save: the title shows, `ic.vacancyId` is set, questions are prepared in the background |
| "Not now" | `setupDone=true`, go to `/` |
| "Start the first round" | `setupDone=true`, go to `/session` with an interview, `roundType: mix`, the chosen job and title "Your first round" |

### 2.4 What happens if… (Setup)

| Event | Result |
|---|---|
| Engine stops between steps 1 and 3 | Nothing re-checks on steps 2–3. The check's engine error offers "Back to AI engine". On "Start the first round", Session fails with the engine Callout (§4.3) |
| Mic denied | Check shows the mic-denied callout and offers the keyboard (US-02 AC4) |
| STT mishears | The heard text is shown before Mike answers. "Try again" repeats. There is no edit |
| Storage not writable | Not detected in Setup. `localStorage` blocked → `setupDone` is never remembered, so the wizard opens on every visit 🟡 (§10) |
| Server down | ServerUnavailable before Setup renders |
| Long text | Name is capped at 60 by `maxLength`. A long job title is clamped on one line |
| User leaves mid-check | Back / step change calls `check.stop()`. Closing the tab ends the recording |
| Browser without speech API | Server STT is used. Without it, the "no speech recognition" state appears |

---

## 3. Home (`/`)

- Code: `screens/home/HomeScreen.tsx` (live), `HomeView.tsx`, `parts/*`, `script.ts`, `quickStart.ts`.
- Story prefix `screens-home--`. Review `#home-<state>`.
- Map: `ds/screens/home.md`: §3 Start, §4 Setup chat (§4.9 Plan card), §5 States, §6 Layout, §7 VacancyEditor, §8 Motion, §9 Backend gaps, §11 PRD AC.
- PRD: US-08, US-09, US-10, US-12, US-22, US-24, US-29.

**Decision on this screen:** what to practise now. The primary action is the quick start, or Start in the plan.

**Track.**
- `?track=english` switches to English. No param means Interview.
- The ModeMenu ("Practice type": "Interview" / "English practice") changes the param with `replace`.

### 3.1 Start step

**Layout, top to bottom.**
1. Banners.
2. Greeting H1.
3. Composer: "+" file, ModeMenu, text field, Send.
4. Quick start button with a quiet detail line.
5. Suggestions: max 3 chips.
6. Footer.

**Copy.**

| Element | Copy |
|---|---|
| Greeting | "What are we practising today?" / English "What shall we talk about?" (the `…, {name}?` variants exist but are not wired live, see §10) |
| Placeholder | "Paste a job or a link, or say what you want to practise" · narrow "Paste a job or say what you want" · English "Say a topic, or pick one below" |
| Quick start | "Start now — voice practice" / "Start now — typed practice"; detail e.g. "Kestrel Pay · Behavioural · 5 questions · voice" |
| Footer | "Practice only: no help during real interviews." (English: "Free forever: no limits on English practice.") + link "What's free" → `/settings/about#free` |

| State | When | Sees | Can do | Story | Review |
|---|---|---|---|---|---|
| Returning | ≥1 session | greeting, quick start with the last job and round, suggestions ("{company} again", "Drill my weak spots", …) | quick start, type, suggestion | `start-returning`, `-mobile` | `start-returning` |
| First visit | no sessions | quick start = general questions, unseen mix; suggestion "Show me an example" | — | `start-first-visit` | `start-first` |
| No name | name not set | greeting without name | — | `start-no-name` | — |
| English | `?track=english` | English greeting; topic chips "Free talk" / "Talk about your work" / "Small talk"; no quick start | pick a topic | `start-english` | `setup-english` (chat) |
| Mode menu open | — | two options with descriptions | switch | `start-mode-menu` | `start-mode` |
| Typed | text in the field | Send enabled | Enter / Send | `start-typed` | `start-typed` |
| Pasted job | ≥80 chars or a URL | — | Send → setup chat reads the job | `start-pasted` | `start-pasted` |
| File attached | "+" or drop | chip (name clamped at 28 chars) + "The file stays on this computer." + "Remove file" | Send | `start-file-attached` | — |
| Loading | data loading | quick start disabled | — | `start-loading` | — |
| Engine not ready | engine in use not ready | banner "Mike can't start yet" + reason + "Try again now" + link "Engine settings" + CopyField (e.g. `ollama serve`) + "We check again every 5 seconds."; quick start disabled | fix, retry | `start-engine-not-running` | `start-quick-engine-down` |
| Browser can't recognise speech | no server STT and no browser STT | banner "This browser can't run speech recognition. Use Chrome or Edge, or answer by typing." + "Use text mode" + "Dismiss for this session" | switch to text, dismiss | `start-browser-unsupported` | — |
| Storage unreadable | sessions list fails | error banner (`role="alert"`) "We can't read your saved sessions. Check the data folder in Settings." + "Open storage settings" → `/settings/storage` | — | `start-storage-unreadable` | — |
| Text mode | input pref = text | "Start now — typed practice" | — | `quick-start-text-mode` | `start-quick-text` |
| Quick start pressed | — | button busy, then the page soft-fades out (`--duration-exit`) and goes to `/session` | — | `quick-start-pressed` | — |
| Overflow | long names, many chips | clamped | — | `start-overflow`, `-mobile` | — |

**Interactions.**
- Enter in an empty field does nothing.
- Quick start is disabled while loading or while the engine isn't ready.
- On the server, "technical" runs as "mix" (map §9 B2).
- Accepted files: `.pdf, .docx, .txt, .md, .html`.
- The browser banner, once dismissed, stays hidden until the page reloads.
- The engine status refreshes every 5 s while not ready (every 30 s app-wide).

### 3.2 Setup chat (`parts/SetupChat.tsx`, `script.ts`)

**Entry.** The first message on the start screen opens the chat.

**Frame.**
- Header: "Setting up with Mike" · "Step {n} of {of}" · "Skip questions". The skip link is gone once the plan shows.
- Log: "Setup with Mike".
- The composer floats in a dock. It is the same object as the start composer, moved by a FLIP of `--duration-slower`. `--dock-h` is measured by ResizeObserver.

**Script.** A deterministic state machine. There is no LLM in setup 🟡 (`_index` §3).

| Track | Steps |
|---|---|
| Interview | T1 job · T2 round · T3 "anything else". Each is skipped when the first message already answered it |
| English | E1 level · E2 topic · phrases (only when there are some) |
| Again / Drill / Example | their own short paths |

**Pacing.** Scripted replies appear after `--duration-slow` with a rise-in and no dots: we don't fake thinking. A shimmer pending message shows only while real work runs: reading a job, opening a link, reading a file or a CV.

**Placeholders by stage.** Job: "Paste a job or a link" · reply: "Reply to Mike" · plan: "Ask Mike to change something" · dictating: "Listening… press stop when you're done" / "Writing down what you said…".

**Parsing typed replies (English keywords only).**

| Stage | Matched by | Not matched |
|---|---|---|
| Job | ≥80 chars or a URL → read as a job; saved company name; "general / any role / no job" | "I didn't find that job. Paste it here, or pick one:" + replies |
| Round | hr/screen/recruiter · behaviour/stories · technical/case study/whiteboard/portfolio · mix/unseen/random | "I didn't catch the round. Pick one:" |
| Anything else | any text becomes "Your note"; gentle/easy/nervous → Gentle; tough/hard/push → Tough | — |
| Level | A2 / B1 / B2 / C1 | "Which level should I talk at? Pick one:" |
| Topic | small talk/chat · work/job/project · free/anything; otherwise the text itself | — |
| Plan | round / strictness / job words | "I can change the job, the round or how strict I am. Use Change in the plan." |

| State | Sees | Story | Review |
|---|---|---|---|
| Reading a pasted job | user bubble (clamped, "Show all" / "Show less", meta "Job description · {n} characters"), Mike "Reading the job…" | `setup-job-reading`, `setup-job-pasted` | `setup-reading` |
| Link fetching | "Opening the page…" | `setup-link-fetching` | — |
| Link error | "I couldn't open this page: it needs a login. Paste the job text here instead, or carry on with general questions." + "Use general questions" | `setup-link-error` | — |
| File reading / error | "Reading the file…" / "I couldn't read this file. It may be a scan or password-protected. Paste the text instead." | `setup-file-reading`, `setup-file-error` | — |
| Job got | "Got it: **{company}**, {role}. I saved it to your jobs and I'm preparing questions from it." (+ "This text is short, so most questions will be general." under 400 chars) + "Edit details" | — | — |
| Ask job | "Which job are we preparing for? Paste a job or a link, or pick one you saved." + saved-job chips | `setup-ask-job`, `-mobile` | `setup-ask-job` |
| Saved job picked | "{company}, {role}. {n} questions from this job are ready." | `setup-saved-job-picked` | — |
| Keyword match | "{round} for {company}, got it." | `setup-keyword-match` | `setup-keyword` |
| Ask round | "What kind of round is it? Last time it was {round}." / first: "…If you're not sure, Behavioural is the most common first round." | `setup-ask-round` | — |
| Round not caught | see the table above | `setup-round-not-caught` | — |
| Ask anything | "Anything else I should know? …" + "Nothing else" / "Be gentle with me" / "Push me harder" (+ "I don't have your CV yet, so questions won't use your own projects.") | `setup-ask-anything`, `setup-ask-anything-no-cv` | — |
| Free-text note | "Noted. I'll keep it in mind." | `setup-free-text-note` | — |
| CV attached (D89) | a file sent outside the job question = CV → "Reading your CV…" | `setup-cv-attached`(-mobile), `setup-cv-reading` | `setup-cv-attached` |
| CV added | "Thanks, I added your CV to your profile. Questions will use your own projects now." | `setup-cv-added` | `setup-cv-added` |
| CV error | "I couldn't read this CV. It may be a scan or password-protected. Try another file, or paste the text in Settings → Profile." / full profile: "Your profile already has 10 files, the most it keeps. Remove one in Settings → Profile, then send the CV again." | `setup-cv-error` | — |
| Job file in chat | a file at the job question = the job | `setup-job-file-in-chat` | — |
| Dictating (D90) | mic button "Dictate" → "Stop and add the words" | `setup-dictating`, `-mobile` | `setup-dictating` |
| Dictation error | `chat.dictate.error.*`, e.g. "Vukoli can't use the microphone. Allow it in the browser's site settings and try again." · "Didn't catch any words. Try again a little closer to the mic." · "Couldn't turn the recording into text. Try again or type your reply." | `setup-dictation-error` | `setup-dictation-error` |
| Skipped | "Skip questions" fills the rest from the last session or the defaults | `setup-skipped` | — |
| Again | "Same as {date}: {company}, {round}, {strictness}. Change anything below, or start." | `setup-again` | `setup-again` |
| Drill | "From your last {n} interviews: {list}." + "What should we drill?" + "All {n}" | `setup-drill`, `setup-drill-plan` | `setup-drill` |
| Example | "This is what you get after each question. It's an example from Sam, a product manager, not you." + example card + "Want to try? Paste a job, or start with general questions." | `setup-example` | — |
| English level / phrases / plan | "What level should I talk at? …" / "Same level as last time, {level}?"; "{count} phrases came back twice: {list}. Shall I steer the talk so you can use them?" + "Yes, use them" / "Not today" | `setup-english-level`, `setup-english-phrases`, `setup-english-plan` | `setup-english` |
| Overflow | long messages | `setup-overflow`, `-mobile` | `setup-overflow` |

**Scrolling.** The newest message is kept in view. A message taller than the view (the plan card on a phone) is scrolled to its top.

**Quick replies.** They leave once answered, with an exit animation. Chips are disabled while leaving.

### 3.3 Plan card (`parts/PlanCard.tsx`, map §4.9)

Title: "Here's the plan".

**Rows.**
- Interview: "Job" · "Round" · "Mike" (strictness) · "Length" · "Based on" · "Your note" · "Watch for".
- Drill: "Focus", "Job", "Length".
- English: "Level" · "Topic" · "Corrections" · "Phrases".

**Changing a row.**
- Job: a listbox of saved jobs + "General questions, no job".
- Round / strictness / level / topic / focus: radio menus with descriptions.
- Note: "Remove".

| State | Sees | Story | Review |
|---|---|---|---|
| Ready | rows; "Start interview" (or "Start drill" / "Start talking"), icon mic or keyboard; ghost "Type instead" | `setup-plan`, `-mobile` | `setup-plan` |
| Preparing questions | Job row "Preparing questions…" (shimmer); "Start interview" and "Type instead" are **disabled** with the note "Start unlocks when the questions are ready." (13, QA-02: a session started now asked a general question). The quick-start mic on Start waits the same way while the remembered job is preparing. Failure or no answer in 90 s 🟡: the prep-error row below and Start unlocks | `setup-plan-preparing`, `-mobile`, `quick-start-waiting` | `setup-plan-preparing` |
| Prep error | "Couldn't prepare questions from this job. Mike will use general questions." + "Try again" | `setup-plan-prep-error` | — |
| Questions ready | "{n} questions ready" | — | — |
| No CV | "Add your CV so questions use your own experience." + "Add CV" → `/settings/profile` | `setup-plan-no-cv` | — |
| Engine down | Start disabled + "Start the AI model first." | `setup-plan-engine-down` | `setup-engine-down` |
| Text mode | Start with a keyboard icon + "You'll answer by typing." | `setup-plan-text-mode` | — |
| Change menu open | menu | `setup-plan-change-open` | `setup-plan-change` |
| Starting | Start becomes a dots pill "One moment…" | `setup-starting` | — |

**Change from chat.** Typing in the plan stage replies "Done: {what}." The plan updates, and Mike's earlier line is not rewritten.

**Focus.** When the plan appears, focus moves to its heading.

### 3.4 What happens if… (Home)

| Event | Result |
|---|---|
| Engine stops | banner on start, Start disabled in the plan; re-check every 5 s; recovers by itself |
| Mic denied (dictation) | `chat.dictate.error.not_allowed` under the composer; typing still works |
| STT mishears (dictation) | the words land in the field for editing before Send |
| Storage not readable | error banner + link to storage settings; Recents shows empty |
| Server down mid-use | API calls fail. Job read → link / file error copy. Vacancy save → `vacancy.error` |
| Long content | pasted job clamped with "Show all"; chips clamp at 28 chars; plan values wrap |
| User leaves mid-setup | the chat state is not kept: coming back starts again on the start step 🟡 |
| No speech API | "Use text mode" banner; quick start and Start become typed |

### 3.5 Example debrief entry

The "Show me an example" suggestion and the History empty state link "See an example debrief" open `/sessions/example`. See §5.

### 3.6 VacancyEditor (Dialog, map §7)

- Code: `components/VacancyEditor.tsx`.
- Story prefix `screens-vacancyeditor--`.
- Opened from: chat "Edit details", Setup → About you "Add a job" / "Change".
- PRD: US-09.

**Fields.**
- Segmented source: "Paste" / "File" / "Link".
- Paste: Textarea "Job description" (placeholder "Paste the job description", counter).
- File: FileDrop "Job description file", "Drop a file here or" "browse", hint "PDF, DOCX, TXT, MD or HTML · up to 5 MB", "The file stays on this computer."
- Link: "Link to the job posting" + "Fetch", hint "Some pages need a login. If it doesn't work, paste the text instead."
- Company / Role pair. When guessed from the text: "We filled these in from the text. Change them if they're wrong."

| State | When | Sees | Story |
|---|---|---|---|
| Paste empty | open | Save disabled | `paste-empty` |
| Paste filled | text | "Save job" enabled | `paste-filled`, `paste-filled-mobile` |
| Too short | 1–79 chars | info "This text is short, so questions will be mostly general." (a warning, Save stays enabled) | `too-short` |
| File empty / chosen / reading | — | "Reading the file…" while reading | `file-empty`, `file-chosen`, `file-reading` |
| File error | over 5 MB, wrong type, read failure | "Couldn't read the file" / "We couldn't read this file. It may be a scan or password-protected. Paste the text instead." + "Switch to Paste" | `file-error` |
| Link empty / fetching / fetched | — | "Opening the page…" | `link-empty`, `link-fetching`, `link-fetched` |
| Link error | fetch / save fails on a link | "Couldn't open the page" / API message or "We couldn't open this page: it needs a login. Paste the text instead." | `link-error` |
| Saving | Save pressed | "Saving…" | `saving` |
| Save error | API fails (paste) | error Callout "Couldn't add this job." + message | — |
| Edit | `editId` | title "Edit job", "Delete job" on the left | `edit` |
| Delete confirm | Delete | "Delete {name}?" / "Your sessions with this job stay in History." / danger "Delete job" | `delete-confirm` |

**Validation.**
- Save is enabled when: paste has non-empty text; or the link is non-empty; or a file is `chosen`.
- 80 characters is the "short" line, not a block (US-10 AC3).
- Enter in a field submits the form when Save is allowed.

**Saving an edit.** It saves a new copy, then deletes the old one. The plan follows the new id.

**Copy drift.** "History" in `vacancy.deleteBody` and `home.vacancies.deleteConfirm` is the old name (§10).

---

## 4. Session (`/session`)

- Code: `screens/Session.tsx` (live), `screens/session/SessionView.tsx`, `parts/*`, `session/useSession.ts`, `reducer.ts`, `startConfig.ts`.
- Story prefix `screens-session--`. Review `#session-<state>`.
- Map: `ds/screens/session.md`: V2.1 (D49), §V2 Island (V2.2 per state, V2.4 feedback panel, V2.5 text mode, V2.6 motion, V2.7 mobile, V2.8 keyboard), §4 states, §6 PRD AC.
- State line: a glass pill at the top, dot always blue (D91–D93).
- PRD: US-13, US-14, US-15, US-17, US-18, US-24, US-58.

**Decision on this screen:** answer this question, then move on. Everything else (feedback detail, sample answer, shortcuts) is one click away.

**Entry.**
- Needs `location.state.config` from Home / Setup. Without it: EmptyState "This session wasn't started from Practice." + "Back to Practice".
- `document.title` = "Question n of N · Company".

**Input mode (`buildSessionConfig`).**
1. Voice with server STT.
2. Else `browser_stt`: the pref is "browser", or the server has no STT and the browser supports it.
3. Else text.

### 4.1 Layout

- **Presence glow** along the top (listening = mic level, thinking = sweep, speaking = Mike's voice).
- **State pill** (glass) at the top: label + sub from `session.status.*` / `session.sub.*`. The hint folds after 6 s.
- **Transcript** in the centre. It follows the newest line; after a manual scroll up, "Jump to latest" appears.
- **Island** at the bottom, in groups:

| Group | Contents |
|---|---|
| Status | "Q{n} of {of}", timer (aria "Elapsed time {m} minutes {s} seconds") |
| Voice | mic + main button |
| Tools | "Redo answer (R)", "Type instead (T)" / "Switch to voice (T)", sample answer, "Show feedback (F)" / "Hide feedback (F)" |
| Exit | "Shortcuts and microphone help (?)" or "More", "End" |

- **Stacked island** (<560): two rows; Redo moves into More.
- **Feedback panel:** wide = floating on the right · mid = right Drawer · narrow = bottom sheet.
  - It opens by itself in p2/p3/p4/edit/recheck, but never in quiet phases. (13, QA-01) In the live app every phase is quiet, so what opens it is the feedback itself: on **wide** it opens by itself when feedback for a finished thread arrives (not while the user is listening-talking; then it opens when they stop). On **mid and narrow** it never covers the stage on its own: a dot on the "Show feedback (F)" toggle (accessible name "Show feedback (F), new feedback is ready") says it is ready; the dot clears when the panel opens. The first-time hint says so.
  - The user's own toggle wins. 🟡 (13, QA-01) A close the user made keeps the panel shut until they open it again; new feedback then only lights the dot. Feedback already there when the screen appears (a resumed session) counts as seen.

### 4.2 States

**Main button per phase (Island).**

| Phase | Main button |
|---|---|
| Mike speaking | "Interrupt" |
| Listening | "Send now" |
| Your turn (voice) | "Talk now" (disabled while muted) |
| Thinking | "Sent" (disabled) |
| Preparing / rechecking | dots "Preparing feedback" |
| After the last answer | "See your debrief" |

| State | When | Sees | Can do | Story | Review | Live? |
|---|---|---|---|---|---|---|
| Connecting | socket opening | pill "Connecting" / "Starting the local engine…"; island dots "Connecting to Mike…" + End | End | `s-9-connecting` | `s9` | yes |
| Mike speaking (Q1) | TTS playing | "Mike is speaking" / "Press Space to interrupt" | Interrupt, mute, End | `s-1-question-one`, `s-1-island-more-open` | `s1`, `s1-open`, `s1-more` | yes |
| Follow-up | follow-up asked | same, follow-up marked | — | `s-2-follow-up`, `s-2-reading` | `s2`, `s2-reading` | yes |
| Your turn | Mike done, mic not open yet | "Your turn" / "Answer when you're ready" (text: "Type your answer below") | Talk now | `s-2-your-turn-waiting` | `s2-turn` | yes |
| Listening | recording | "Listening" / "Take your time. Mike waits for {sec} s of quiet." (manual: "Press Send now when you're done."); loops paused (`data-motion-quiet`) | Send now (Enter), mute | `s-3-listening`, `s-3-b-listening-hint-gone` | `s3`, `s3b` | yes |
| Thinking | answer sent | "Thinking"; "Sent" disabled | — | `s-4-thinking` | `s4` | yes |
| Feedback ready | thread feedback in | panel p2/p3/p4 with layers in the configured order | read, toggle F | `s-5-a-feedback-content-first`, `s-5-b-feedback-delivery-first`, `s-5-panel-hidden`, `narrow-feedback`, `mid-feedback` | `s5a`, `s5b`, `s5-hidden` | yes |
| "That's not what I said" | heard-as row | marks a misheard phrase | — | `s-5-c-thats-not-what-i-said` | `s5c` | partly 🟡 |
| Edit what I said | — | editor "Question {n} · Edit what I said", "Save and check again" | — | `s-5-d-edit-what-i-said` | `s5d` | **no** (§10) |
| Preparing feedback | — | dots "Preparing feedback" | — | `s-14-a-preparing` | `s14a` | yes |
| Feedback unavailable | engine gave none | — | — | `s-14-b-unavailable` | `s14b` | yes |
| Muted | M | "Muted" / "Press M to unmute" | M | `s-14-c-muted` | `s14c` | yes |
| Muted while talking | voice detected while muted | tooltip "You're talking, but the microphone is muted. Press M to unmute." (6 s, also in the polite live region) | M | `s-14-c-2-muted-talking` | `s14c2` | yes |
| Sample answer | toggle | "Sample answer" panel | hide | `s-14-d-suggester`, `s-14-d-2-suggester-listening` | `s14d` | yes, when `answer_suggester` is on |
| Text mode | input = text | Composer "Type your answer" (Enter sends, Shift+Enter new line, max 6 rows); "Switch to voice (T)" enabled unless no speech | type, send | `s-6-text-mode`, `s-6-text-island` | `s6`, `s6-answer` | yes |
| Drill | drill config | 3 questions on the focus | — | `s-7-drill` | `s7` | yes |
| English | english config | corrections after each turn, never during speech | — | `s-8-english` | `s8` | yes |
| Interrupted, engine | — | "The AI model (Ollama) stopped responding" + CopyField `ollama serve` + "We check again every 5 seconds. Resume turns on when it's back." + "Resume" (disabled) + "End and see debrief" | — | `s-10-a-interrupted-engine` | `s10a` | **no** (§10) |
| Interrupted, voice | — | "The voice connection dropped" + "Resume voice" / "Continue in text" | — | `s-10-b-interrupted-voice` | `s10b` | **no** (§10) |
| Mic help | "?" → Microphone help | Dialog "Mike can't hear you", steps, "Use text mode", "Try again" | — | `s-11-mic-help` | `s11` | opens only from help |
| Storage banner | — | "We can't save to this computer" / "The data folder is read-only. Your debrief will be offered as a download at the end." + "Fix in Settings" | — | `s-12-a-storage-banner` | `s12a` | **no** (§10) |
| Browser banner | — | "This browser can't recognise speech" + "Use text mode" / "Dismiss for this session" | — | `s-12-b-browser-banner` | `s12b` | **no** (§10) |
| Overflow | long question / answer | wraps; transcript scrolls | — | `s-13-overflow` | `s13` | — |
| Shortcuts | "?" | Dialog "Keyboard shortcuts" | Esc | `shortcuts` | `shortcuts` | yes |
| Reduced motion | OS setting | static glow and dots | — | `reduced-speaking`, `reduced-listening`, `reduced-thinking` | `s1-reduced` | yes |
| Narrow island | <560 | stacked | — | `narrow-island` | — | yes |
| Closing (last answer) | `state.closing` | "That's the end of the round" / "Mike has finished. Your debrief takes a few seconds." + "See your debrief" (= End) | End | — | — | yes |

**Live flow (code).**
- Mike moves on by himself after each answer.
- Live never shows "between" except at closing, so "Next question" is never offered live. The panel updates beside the stage.

### 4.3 End and terminal states

| Situation | Result |
|---|---|
| End, ≥1 answer, live or connecting | `pendingSave.start(id)` → `/` (replace) → shell toasts (§1.2) (D73) |
| End, 0 answers | stays: EmptyState "Session ended" / "Nothing was saved: you didn't answer any questions." + "Back to Practice" |
| Socket closes with a saved id | `/sessions/:id` |
| Socket closes without a saved id | failed `connection_lost`: "The session stopped" / "The connection to Mike was lost. Any answers you gave are saved." |
| Engine fatal code (`not_installed`, `not_running`, `no_model`, `not_configured`, `unreachable`, `unauthorized`, `billing_required`) | Callout "Mike can't start: the AI engine isn't ready" + server message + hint + link "Fix the engine" → `/settings/engine` |
| `bad_start` | "The session couldn't start: {message}" |
| `session_failed` / unknown code | "Something went wrong and the session stopped. Your answers so far are saved." (or the server message) |
| Audio backlog | "The connection can't keep up with the audio. Ending the session and saving it." then end |
| Ending / saving / debrief pending | shimmer "Saving your session…" / "Writing your debrief…" |
| Done, save failed | "Session ended" + "Couldn't save the session." |

### 4.4 Keyboard (V2.8)

Ignored in text fields and with modifier keys.

| Key | Action |
|---|---|
| Space | Interrupt (Mike speaking) or Talk now (your turn) |
| Enter | Send now (listening) |
| M | mute / unmute |
| R | redo answer ("Nothing to redo yet" / "Redo is available after Mike finishes" when unavailable) |
| T | type ↔ voice |
| F | feedback panel |
| N | next question / debrief (only where the handler exists; not live) |
| ? | shortcuts |
| Esc | closes the wide panel, dialogs |

### 4.5 Notices in the dock

Notices are withheld while recording.

| Source | Copy |
|---|---|
| Mic not allowed | "The microphone is blocked, so we switched to the keyboard. Allow the microphone in the browser's address bar to use voice." |
| No mic | "No microphone found, so we switched to the keyboard." |
| Insecure origin | "Voice needs the app to be opened from localhost. We switched to the keyboard." |
| Can't record | "This browser can't record audio. We switched to the keyboard." |
| Mic failed | "The microphone didn't start, so we switched to the keyboard." |
| Browser STT unsupported / denied | "This browser can't recognise speech. Use Chrome or Edge, or the keyboard." / "The browser blocked speech recognition, so we switched to the keyboard." |
| Not heard | "I didn't catch that. Please try again a little louder or closer to the microphone." |

### 4.6 What happens if… (Session)

| Event | Result |
|---|---|
| Engine stops before start | fatal engine Callout + "Fix the engine" (US-13 AC5 partly) |
| Engine stops mid-session | the server closes the socket → saved id → Debrief; else `connection_lost`. The designed Interrupted state with Resume is not wired (§10) |
| Mic denied | warning notice + automatic switch to text; MicHelpDialog only via "?" (US-06 AC2 partly) |
| STT mishears | transcript shows what was heard; feedback marks "Heard as"; fix later in Debrief ("Not what you said?") |
| Storage not writable | not detected live (no storage banner); see Debrief (US-23 AC4 not met, §10) |
| Server down | socket fails → `connection_lost` / `bad_start` |
| Long text | wraps; transcript scrolls with "Jump to latest"; Composer grows to 6 rows then scrolls |
| User leaves mid-session (route change, back) | unmount closes the socket and the mic. No confirm, no `beforeunload` guard. Whether the server saves on disconnect needs confirming (§10) |
| Browser without speech API | server STT if installed; else text mode from the start |

---

## 5. Debrief (`/sessions/:id`, `/sessions/example`)

- Code: `screens/Debrief.tsx` (live), `screens/debrief/DebriefView.tsx`, `parts/*`, `mapRecord.ts`.
- Story prefix `screens-debrief--`. Review `#debrief-<state>`.
- Map: `ds/screens/debrief.md`: §3.0 frame, §3.1 header, §3.2 verdict, §3.3 weak spots, §3.4 actions, §3.5 question by question, §3.6 english, §3.7 example, §5 states, §7 motion.
- PRD: US-17, US-18, US-20, US-22, US-23, US-29.

**Decision on this screen:** what to fix next. The verdict and weak spots are folded into a bar (D80); the conversation and the picked answer's breakdown are open.

### 5.1 Layout

| Part | Contents |
|---|---|
| Header | H1 title + "Rename session" (pencil) + "More actions for this session" menu: "Export to Obsidian" (only with a folder set), "Download as Markdown", "Archive", "Delete" (confirm Dialog, same copy as §1.2). Meta list "Session details": questions, follow-ups, "Saved on this computer" |
| VerdictBar (interview, ≥3 answers) | folded; opens to: Verdict (scale "Not ready yet / Getting there / Ready", sr "Verdict: {step}, step {n} of 3") · "What to fix first" (weak spots, evidence "Go to question {n}") · "What next" ("Drill these weak spots" / "Practise again") |
| Conversation | "Conversation" / "Pick an answer to see its breakdown" |

**Conversation, wide** (`page` ≥840): two columns.
- Left: the chat ("Conversation with Mike").
- Right: the breakdown, sticky, height capped to `<main>`, with a Segmented question picker and a QuestionCard.

**Conversation, narrow** (`page` <840): stacked. Picking an answer scrolls to its breakdown.

**Build-up.** On the first open of each session in this visit, sections stagger in (`motion-stagger`).

### 5.2 States

| State | When | Sees | Can do | Story | Review |
|---|---|---|---|---|---|
| Loading | fetching | skeletons | — | `loading`, `-mobile` | `loading` |
| Preparing | debrief being written right after a session (polls every 3 s, up to 20 times) | Verdict section with shimmer "Writing your debrief. This takes a few seconds…" | wait | `preparing` | `preparing` |
| Interview, full | ≥3 answers, debrief ready | folded verdict bar + conversation | open the bar, pick answers | `interview-full`, `-mobile` | `interview-full` |
| Verdict open | bar opened | verdict, weak spots, actions | Drill / Practise | `interview-verdict-open` | `verdict-open` |
| Delivery first | `layer_order` = delivery-first | layers reordered | — | `interview-delivery-first` | `interview-delivery-first` |
| Template verdict | engine was unavailable | "The AI model wasn't available, so this debrief was built from your feedback without it." + "Write the debrief again" ("Writing…") | rerun | — | — |
| Missing verdict | no debrief, polling over, has feedback | "Write the debrief again"; without feedback: "No feedback was recorded for this session." | rerun | — | — |
| Partial | <3 answers (US-20 AC4; threshold 3 per Q11, not 12) | info "Not enough answers for a verdict" / "You answered {answered} of {total} questions. Answer at least 3 and you'll get a verdict and weak spots."; "Questions {from}–{to} weren't asked — the session ended early." | read per-question | `partial`, `-mobile` | `partial` |
| English | mode english | Summary, Corrections ("Turn {n} · {time}", "Show {n} more"), "Phrases to review", "Practise these phrases" | practise → `/?track=english` | `english`, `-mobile` | `english` |
| Example | `/sessions/example` | info "Example debrief" / "A fictional candidate: Sam Rivera, Product Manager at Brightline. …" + "Start your first interview"; badge "Example"; no menu | start → `/` | `example`, `example-delivery-first`, `example-mobile` | `example` |
| Rename | pencil | InlineRename (`lg`): Enter saves, Esc cancels, counter "{n} / {max}", max 80; empty → "Add a title, or press Esc to keep the old one." | save / cancel | `interview-rename` | `rename` |
| Rename failed | PATCH fails | title reverts; error Callout "Couldn't rename this session. Try again." | — | — | — |
| Recheck / rechecking | edit a correction or the answer | editor "What you actually said" / "We'll check this question again. What to work on and the verdict's main fix follow the new result." / "Save and check again" → "Checking this answer again…" | — | `interview-recheck`, `interview-rechecking` | `recheck` |
| Storage not writable | `storageError` | warning "We couldn't save this debrief to your computer" / "The data folder isn't writable, so this session will be lost when you close the app." + primary "Download debrief (.md)" + "Fix in Settings"; meta "Not saved" | download | `storage-not-writable` | `storage` |
| Not found | 404 | "This session no longer exists" / "It was deleted from Trash, or the link is wrong." + "Open Archive" | → `/archive` | `not-found` | `not-found` |
| Error | other load error | "We couldn't open this debrief." / "The session file may be damaged." + "Try again" + "Open Archive" | retry | `error` | `error` |
| Action error | dismiss / restore / archive / delete / rerun fails | error Callout with the API message; the view resets to saved data | — | — | — |
| Long text | long answers | "Show full answer" / "Show less" | — | `long-text`, `-mobile` | `overflow` |

**Corrections (US-17, US-18).**
- "Dismiss" leaves with an exit animation → "Dismissed — not counted." Restore is possible.
- "Not what you said?" opens the editor.
- A "Stronger answer" disclosure loads on its first open. Its note: "Fill in your real number — we never invent results."

**After Archive / Delete.**
- Navigates to `/` (replace).
- Toast "Moved to Archive." / "Chat deleted." with "Undo".
- Undo failure shows an error toast.

### 5.3 What happens if… (Debrief)

| Event | Result |
|---|---|
| Engine stops before the debrief is written | template verdict note + rerun; rerun failure → error Callout |
| Debrief still writing after ~60 s | polling stops → "Write the debrief again" |
| STT misheard | "“Heard as” is what speech recognition heard." + editor (designed); live has no `onRecheck`, so "Edit what I said" is not shown (§10) |
| Storage not writable | designed banner exists; live never passes `storageError` (§10) |
| Server down | load → Error state with Try again |
| Long content | answers clamp with "Show full answer"; the breakdown scrolls in its sticky column |
| Session deleted elsewhere | Not found state |

---

## 6. Archive and Trash (`/archive`, `/archive/trash`)

- Code: `screens/History.tsx` (`ArchiveScreen`, `TrashScreen`), `screens/history/HistoryView.tsx`.
- Story prefix `screens-history--`. Review `#history-<state>`.
- Map: `ds/screens/debrief.md` §4 (HistoryList; written for `/history`, renamed by D80).
- PRD: US-21, US-23.

**Decision on this screen:** reopen or bring back an archived chat. Recents in the sidebar hold every non-archived chat.

**Header.** H1 "Archive" · sub "Chats you moved out of Recents. Open any of them, or bring one back." · link "Trash" / "Trash ({n})".

**Filter.** Chips "All" / "Interview" / "English" with counts (role radio). Stored in `?track=`.

**Week groups.** "This week" / "Last week" / "Earlier in {month}" / "Earlier".

**Row.**
- Icon, title, first question, meta: badge, date · duration, result.
- Result is one of: the verdict, "{n} answers", "No verdict — {answered} of {total} answered", or "No debrief yet".
- Row actions:
  - `page` ≥560: inline icon buttons "Rename {title}" / "Move {title} back to Recents" / "Delete {title}".
  - <560: a "More actions for {title}" menu with "Rename" · "Move back to Recents" · separator · "Delete".

**Short sessions** (<3 answers, D69) fold per week: "{n} short sessions" · "Fewer than 3 answers, so no verdict" / "Hide short sessions".

| State | When | Sees | Story | Review |
|---|---|---|---|---|
| Data | archived rows | groups | `data`, `data-mobile` | `data` |
| Loading | first load | disabled chips + skeleton rows | `loading`, `-mobile` | `loading` |
| Empty | no archived chats | "No archived chats" / "Archive a chat from its … menu in the sidebar. It leaves Recents; nothing is deleted." + "Start a practice" + "See an example debrief" | `empty`, `empty-mobile` | `empty` |
| Filtered empty | none in this track | e.g. "No English sessions yet" / "English practice is a relaxed talk at your level, with corrections after each turn." + "Start English practice" | `filtered-empty` | `filtered-empty` |
| Error | list fails | "We couldn't read your saved sessions." / "The data folder may have moved or lost permissions." + "Try again" + "Open storage settings" | `error` | `error` |
| Renaming | Rename | InlineRename in the row (as §5.2) | `renaming` | `renaming` |
| Row menu | <560 | menu | `row-menu-mobile` | `row-menu` |
| Toast | after an action | "Moved to Trash." / "Moved back to Recents." + "Undo" | `toast` | `toast` |
| Action failed | API fails | error Callout "{title}: {message}" or "Couldn't rename this session. Try again."; the row comes back | `action-failed` | `failed` |
| Overflow | long titles | ellipsis | `overflow`, `-mobile` | `overflow` |

**Delete flow.** Confirm Dialog (same copy as §1.2), then the row slides out (focus moves on first, §1.5) and goes to Trash. The toast has Undo.

**Trash** (`/archive/trash`).
- H1 "Trash" + "Back to Archive".
- Rows: title, date · "Deleted {date}", "Restore".
- Restore → success Callout "Restored."; the row slides out.
- Empty: "The trash is empty."
- Restore error: error Callout.
- Load error: nothing rendered (§10).
- Permanent delete from Trash (US-23 AC2) is not in the UI (§10).

**What happens if…**

| Event | Result |
|---|---|
| Storage unreadable | Error state with the storage link |
| Server down mid-action | row returns, error Callout |
| Long title | ellipsis in the row; full title in InlineRename (max 80) |
| Rows stagger | first load of the visit only, capped at 8 |

---

## 7. AI engine panel (Settings → AI engine; Setup step 1)

- Code: `components/engine/*` (`EngineSettings`, `EngineChoice`, `bodies`, `OllamaDownload`, `PlanLimit`, `EngineStatus`).
- Story prefix `patterns-enginepanel--`. Review `#engine-<state>`.
- PRD: US-03, US-04, US-42, US-56, US-57.

**Layout (D78).**
- The engine in use on top: status, model, plan limit line, and its models or connection under a disclosure.
- The other engines under it: "Use this engine" when Ready, otherwise "Set up" in place.
- No Test button: the status is the check. It re-checks every 5 s while not ready.

**Statuses.** "Ready", "Not connected", "Not installed", "Not running", "No model", "Needs setup", "Can't connect", "Key rejected", "Needs billing", "Disconnected", "Error", "Not signed in".

| State | Story | Review |
|---|---|---|
| Ollama in use | `settings-ollama` | `settings-ollama` |
| Not ready | `settings-not-ready` | — |
| Ollama not installed / no model | `settings-ollama-not-installed`, `settings-ollama-no-model` | — |
| Gemini in use / set up | `settings-gemini`, `settings-set-up-gemini` | `settings-limit-gemini` |
| Other AI (OpenAI-compatible) set up | `settings-set-up-open-ai` | `settings-setup-openai` |
| Claude set up | `settings-set-up-claude` | — |
| Disconnected | `settings-disconnected` | — |
| Plan limits (D88) | `limit-codex`, `limit-claude`, `limit-claude-low`, `limit-claude-used-up`, `limit-claude-pending`, `limit-antigravity`, `limit-gemini` | `settings-limit-codex`, `settings-limit-claude-low`, `settings-limit-antigravity`, `settings-limit-gemini` |

**Forms.**

| Engine | Fields | Validation / messages |
|---|---|---|
| Other AI | presets (LM Studio, Jan, OpenRouter, OpenAI); "Base URL" ("The address that ends in /v1."); "API key" ("A key is saved. Leave empty to keep it.", "Remove the saved key", show/hide); "Model"; "Save and check" | "Saved. Checking the connection…"; then a status badge; "Online providers may charge for use. Check their pricing before you practise." |
| Gemini | "Gemini API key" + "Get a free key"; "Save and check" | "Key rejected" status on a bad key |

**Plan limit lines.**
- "{used} of your {window} limit used · resets {when}".
- Low: "Only {left} of your {window} limit left · resets {when}" (warning tone).
- Used up: "Your {window} limit is used up · resets {when}. Pick another engine meanwhile."

**Off-machine engines** (US-03 AC7) carry their own privacy and pricing lines in `engines.*`.

---

## 8. Settings (popup Dialog, `/settings/<section>`)

- Code: `screens/Settings.tsx`, `components/ProfileEditor.tsx`.
- Story prefix `screens-settings--`. Review `#sidebar-<state>` (`settings-general`, `settings-voice`, `settings-search`, `settings-list-mobile`).
- Map: none; sources are D76–D79, D82.
- PRD: US-08, US-16, US-23, US-30, US-31, US-44, US-58, US-59.

**Opening and closing.**
- Opens over the page you came from (D76). On a direct visit, Home is behind it.
- Close (×, Esc, backdrop) goes back in history when opened from inside the app; otherwise it replaces with the page or `/`.
- Section switches replace history.

**Sections.**
- `general` | `engine` | `voice` | `practice` | `privacy` | `about`.
- Aliases: `storage` → privacy, `profile` → general#profile-cv, `appearance` → general#general-theme. Unknown → general.
- A `#row` hash scrolls to the row and marks it (`data-found`, 2.6 s). It retries for 2 s while the section loads.

**Layout.**
- Wide: search + section nav on the left, the section on the right.
- `dialog` <640 (D82): a list of sections (search on top, chevron rows); a section opens alone with "All settings" back. Plain `/settings` on a phone opens on the list.

**Saving (D79).**
- Every change saves at once and says nothing.
- Only an error shows: "Couldn't save: {message}".

| Section | Rows |
|---|---|
| General | "Your name" (placeholder "e.g. Alex", max 60, saved on blur; "Mike calls you by it in practice. It also shows in the sidebar.") · "Your CV and files" (FileDrop "Drop your CV and other files here, or" "choose files", "PDF, DOCX, TXT or MD · up to {n} files", Replace / Remove per file, "Add text instead" disclosure; full: "That's {n} files, the most Mike takes. Remove one to add another.") · Theme System / Light / Dark |
| AI engine | §7 |
| Voice | voice Select + sample (disabled without TTS: "Mike's voice isn't installed. He'll show his questions as text.") · speed 0.8–1.2 · "Mike speaks aloud" toggle ("Off: Mike only writes. Useful in a quiet office.") · recognition Server / Browser (disabled options with "Local recognition isn't installed. Use the browser or the keyboard." / "This browser has no speech recognition.") · pause 2 / 3 / 5 s / manual |
| Practice | sample-answer toggle (US-58) · layer order content-first / delivery-first (US-16) · strictness · questions per session · English level |
| Privacy | telemetry toggle + clear (US-44) · data folder CopyField · "Markdown export folder · optional" + "Save folder" (US-23 AC3) · Trash link "Trash ({n})" |
| About | free-vs-premium table (`#free`, US-30) · practice-only statement (US-31) · "Run setup again" → `/setup` ("AI engine, voice check, your name and CV. Sessions and settings stay as they are.") · licence |

| State | Story | Review |
|---|---|---|
| Each section | `general`, `engine`, `voice`, `practice`, `privacy`, `about` | `settings-general`, `settings-voice`, `about` |
| Search results | `search` | `settings-search` |
| Search empty | `search-empty` ("No settings match “{q}”.") | — |
| Phone | `phone`, `phone-list`, `phone-search` | `settings-list-mobile` |
| Section loading | Skeleton rows while `settings` loads | — |

**Search.** Matches every word against the label, description, section and keywords. A result navigates to `/settings/<section>#<row>` and clears the query. The result count is announced ("{n} settings found").

**What happens if…**

| Event | Result |
|---|---|
| Save fails | "Couldn't save: {message}" under the section |
| Server down | section stays on skeletons; saves error |
| Long name / path | name capped at 60; path in CopyField scrolls |
| Unknown section | general |

---

## 9. NotFound and ServerUnavailable

| Screen | When | Sees | Can do |
|---|---|---|---|
| NotFound (`*`, in the shell) | unknown route | H1 "This page doesn't exist" · "The link may be old, or the session was deleted." · primary "Go to Practice" → `/` | go home |
| ServerUnavailable (no shell) | health check fails on load | card "The app server isn't answering" · "Vukoli runs a small server on this computer. Start it, then check again." · CopyField `cd app/server && .venv/bin/python -m server` · primary "Check again" (re-runs the health check, shows "Loading…") | copy, retry |

- No Storybook story or review frame exists for either 🟡.
- Server dying after load is not caught here: each call fails with its own error ("The app server is not answering." where shown).

---

## 10. Open questions (real gaps only)

| # | Gap | Where | Proposal |
|---|---|---|---|
| Q1 | Live Session passes `overlay="none"`: storage banner, browser banner and both Interrupted states (S10a/S10b, Resume) are never reachable. US-13 AC5 (resume / continue in text) and US-06 AC1 in-session are not met | `Session.tsx` | Wire `onResume`, `onDismissBanner`, `onFixSettings` and the server's interruption signal, or mark the states v1.1 |
| Q2 | Storage not writable is never detected live: Session has no banner, Debrief never gets `storageError`. US-23 AC4 not met | `Session.tsx`, `Debrief.tsx` | Read storage health from `/api/health` and pass it to both |
| Q3 | "Edit what I said" / recheck is designed (S5d, Debrief recheck) but live passes no `onEdit` / `onRecheck` | both | Wire to the recheck API or drop from v1 |
| Q4 | Home greeting never gets the name (D80 "Your name" says Mike calls you by it). `chat.start.greetingName` is unused live | `HomeScreen.tsx` | Pass `settings.name` to HomeView |
| Q5 | No `beforeunload` / leave guard mid-session; whether the server saves on disconnect is unconfirmed | `useSession.ts`, server | Confirm server behaviour; if it doesn't save, add a guard |
| Q6 | Engine-interrupted copy hard-codes "Ollama" / `ollama serve` for every engine | `session.interrupted.*` | Engine-specific copy (as in `engines.*`) |
| Q7 | Old "History" / "Practice" naming after D80: `session.afterEnd.failed` "Check History…", `vacancy.deleteBody`, `home.vacancies.deleteConfirm`, `notFound.home` "Go to Practice", `session.backHome` "Back to Practice" | `en.json` | Rename to Archive / Recents / Home |
| Q8 | Setup saves of name and voice fail silently (`.catch(() => {})`) | `AboutStep`, `CheckStep` | Show `settings.saveError` like Settings |
| Q9 | Trash: no load-error state; no permanent delete (US-23 AC2) | `TrashScreen` | Add both or record the AC as v1.1 |
| Q10 | 🟡 `localStorage` blocked → `setupDone` never sticks, so Setup opens on every visit | `lib/prefs.ts` | Accept for a local app, or mirror `setupDone` on the server |
| Q11 | 🟡 Setup chat state is lost on leaving Home mid-setup | `HomeScreen.tsx` | Accept (scripted, short), or keep a draft per tab |
| Q12 | Shell breakpoint 640 listed in `_index` §2 doesn't exist in code (only 1024) | `_index.md` | Update the index |
| Q13 | `Setup.module.css` uses `min-height: 100vh` (rule: no vh) | Setup | Switch to `dvh` / flex |
| Q14 | Review notes are stale: s6 "Switch to voice disabled" (code enables it, D64); s4 "Thinking над островком" (state line is at the top, D92) | `session/review.tsx` | Refresh notes |
| Q15 | No composition maps for Setup, Settings, Shell, NotFound / ServerUnavailable; no stories for the last two | `ds/screens/` | Short maps after the gate, or accept the code as the spec |
| Q16 | 🟡 "technical" round runs as "mix" on the server; Drill is a 3-question mix; no English phrases data yet (home.md §9 B2, B7) | server | Backend work at 12 |
| Q17 | MicHelpDialog never opens by itself on a mic failure, only from "?" (US-06 AC2 asks for the fix in place) | `Session.tsx` | Open it, or add "How to fix" to the notice |

### Status at 12d (2026-10-22)
| # | Status |
|---|---|
| Q1 | ✅ wired: Interrupted engine/voice, Resume continues the same saved record over a new socket, continue in text, both banners. Gemini Live voice can't be resumed (text or End) |
| Q2 | ✅ `/api/health` → `storage_ok`; banner in Session, `storageError` in Debrief, transcript download when saving fails |
| Q3 | ✅ live: WS `recheck`; saved: `POST /sessions/{id}/recheck`. Verdict/weak spots of the debrief are recomputed by "Rerun debrief" only; live editor covers the main answer and the last follow-up |
| Q4 | ✅ Home greets by `settings.name` |
| Q5 | ✅ server saves on disconnect (checked in `ws.py`); `beforeunload` guard while a live session has answers |
| Q6 | ✅ engine-specific copy, title "{engine} stopped responding" (was "The AI model (Ollama) stopped responding") |
| Q7 | ✅ Archive / Recents / Home in copy |
| Q8 | ✅ Setup save errors shown (`settings.saveError`) |
| Q9 | ✅ Trash load error + Delete forever with confirm (`DELETE /sessions/trash/{id}`) |
| Q10, Q11 | 🟡 accepted by the orchestrator: local app, scripted short setup |
| Q12 | ✅ `_index.md` lists the real breakpoints |
| Q13 | ✅ `dvh` (Setup, ServerUnavailable, body) |
| Q14 | ✅ review notes s4, s6 refreshed |
| Q15 | 🟡 code is the spec for NotFound / ServerUnavailable |
| Q16 | ❓ owner: backend content at 12 or v1.1 |
| Q17 | ✅ MicHelpDialog opens by itself on blocked / no mic |
