# Composition map: Home v2 (start screen + setup chat) + VacancyEditor

> Stage 11, iteration 2 · 2026-10-20 · author: product-designer · for: frontend-engineer, built in `app/web/src/screens/home/`.
> Inputs: D47 (`docs/scope/owner_decisions.md`), D45, D46, D35, D37 · `docs/moodboard.md` P1–P8, R1, R2, R4, R6 · `ds/CONTRACT.md` · `ds/components.md` · PRD US-08/09/10/12/22/24/25/29/30/31 · `docs/ia.md` §6 fixture (Alex Morgan; Kestrel Pay, Lumen Health, Fieldnote; S1–S3; example = Sam Rivera, PM).
> Legend: 🟡 assumption / to confirm · **B<n>** backend gap (§9) · **[Q<n>]** owner question (§10) · `§3.x` = row in `docs/motion.md` · DS changes: `ds/screens/_index.md` §4.1.
> The orb is a black box: `<Orb state size level/>`; its look is being redesigned through the orb moodboard (D47f). **Home has no orb at all** (D47b).

## Changelog v1 → v2 (D47)

| D47 point | Owner's words | What changed |
|---|---|---|
| (b) Hero | «хиру наша. Там зачем-то круг… просто хватит обычного текста» | Orb removed from Home. The hero is one line of text: "What are we practising today, Alex?" |
| (e) Overload | «очень перегружена менюшка… должен быть небольшой чат перед этим, где мы спрашиваем у человека, хочет ли он добавить какую-то информацию о вакансии… и уже после этого перейти к разговору, тем самым не будем перегружать сам экран» | The start screen keeps **greeting + one composer + at most 3 suggestion chips**. Track switch, "What to work on" strip, round chips, Strictness, Saved jobs, basis line, Start, Type instead and the example panel leave the first screen. They move into a **setup chat** with Mike (2–3 turns + a plan card), §4 |
| (a) Composer send | send button slid past the input | Fixed by the orchestrator (send inline inside the input). Not redesigned here |
| (d) Sidebar | nav rows closer | Fixed by the orchestrator. Not redesigned here |

**Overridden from v1:** O-1 (attached job + Saved jobs picker on the start screen → the picker moves into the chat and the plan card) · O-2 (Segmented track switch → mode chip inside the composer, [Q3]) · O-5 (English without a composer → English also starts from the composer) · O-6 (sticky Start bar → no Start on the start screen) · DS-6 (Home send `quiet` → `action`: the start screen has no other primary). **Kept:** O-3 in spirit (a pasted job is never saved silently: Mike says it was saved and offers "Edit details"), O-4, O-7, the rail with "Recent", VacancyEditor (§7).
**Retired screen parts:** `parts/WorkOn.tsx`, `parts/RoundType.tsx`, `parts/StartBlock.tsx`, `parts/EnglishPanel.tsx`; `parts/ExamplePanel.tsx` becomes the content of a Mike message (§4.7). `WeakSpotStrip context="home"` is no longer used on Home (kept for the debrief).

## 0. The idea in one paragraph
Home becomes what the owner uses every day in ChatGPT, Gemini and Ollama (P3, R2, R4, R6): a calm greeting and one input in the middle of the page. Whatever the user does first (pastes a job, types a sentence, taps a suggestion) turns the page into a **short chat with Mike**: he asks only what he still needs (the job, the round, anything else), each question with a few quick replies, and ends with **"Here's the plan"**: one card with every setting, each changeable, and the single primary "Start interview". Settings stop being a form to read; they become answers to Mike. The plan card is the one place where the user sees and changes everything before starting (US-10 AC2, US-12 AC1), so the start screen can stay empty (P4).

**Why a chat and not one "Options" disclosure** (decision): (1) the owner asked for the chat in his own words (D47e); (2) a disclosure still puts the form on Home, only folded: the overload returns the first time it is opened; (3) every v1 setting has a natural question ("which job?", "what kind of round?", "anything else?"), and strictness reads better as a reply ("Be gentle with me" / "Push me harder") than as "Strictness: Standard"; (4) the chat absorbs the onboarding blocks too: the first-visit example, the no-CV nudge and weak spots each become one sentence from Mike. The plan card keeps the precision of a form for whoever wants to change one thing.

**Principle 1 check** (PRD §5.5: "a step added before the first question must remove one"). v1 returning user: 1 click (Start). v2: "Kestrel Pay again" → plan → Start = **2 clicks**. New job: v1 paste → editor → Save → round chip → Start = 5 actions; v2 paste → round reply → "Nothing else" → Start = **4**. "Skip questions" jumps to the plan from any turn. The returning path costs one click more than v1: the price of an empty start screen, sent to the owner as [Q1].

## 1. The flow in five steps
1. **Start** (`step: "start"`): greeting + composer (mode chip inside: Interview / English practice) + up to 3 suggestion chips. Nothing else in the column.
2. **First input** → the greeting leaves, the user's input becomes the first message of the setup chat, the composer drops to the bottom of the page (chat layout, R2).
3. **Mike asks what he still needs**, one question per turn, each with quick replies + free text: T1 job (skipped when a job was given) → T2 round type → T3 anything else (note; gentle / tough). 2–3 turns; never more than 4 Mike messages including the plan.
4. **"Here's the plan"**: job, round, how strict Mike is, length, what questions are based on, your note, what to watch for. Each row has "Change". Primary **Start interview** + "Type instead".
5. **Start** → connecting pill → Session; the bottom composer hands over to the session island (`session.md` §V2.7).

English practice: same five steps, turns E1 level → E2 topic (+ phrases to review) → plan "Start talking" (§4.8).

## 2. DS coverage

| Block | Component (variant) | Status |
|---|---|---|
| Shell, rail, Recent, engine status | AppShell (unchanged, incl. D47d tighter rows) | exists |
| Banners (engine down, browser, storage) | Callout `warning` / `warning` / `error` + CopyField + Button `secondary sm` | exists |
| Greeting | Page `Layout: start` header (h1, centred) | exists |
| Composer | **Composer** G1: `toolbarStart` = mode chip (Button `secondary sm` + `chevronDown`, Menu `menu` radio items) + IconButton `sm` `plus` "Add a job file"; `attachment` = ComposerAttachment; `send` `action` inline; `submitOnEnter` | exists; Home switches to `send.variant="action"` |
| Mode menu | Menu `Kind: menu`, radio items with `description` | exists |
| Suggestion chips | ChipGroup `role="group"` `align="center"` + Chip used as an action (never selected) with icon | exists (checked in code: `Chip` with `selected` undefined renders no `aria-pressed`) |
| Setup chat log | **ChatMessage** `Speaker: mike \| user` · `State: final \| pending \| error` in a `role="log"` list | **new DS** (`_index.md` §4.1) |
| Quick replies | ChipGroup `group` + Chip actions, in ChatMessage `actions` | exists |
| "Skip questions", "Edit details", "Change", "Show all" | Button `ghost sm`, Button `link sm` | exists |
| Mike reading / opening / preparing | TextShimmer in ChatMessage `State: pending` | exists |
| Plan card | screen part `parts/PlanCard.tsx`: Card `subtle` `Padding: md` + `<dl>` + Button `link sm` + Menu (radio / listbox) + Button `primary lg` + Button `ghost sm` | new screen part (one use) |
| Job picker ("Change" job) | Menu `Kind: listbox` (v1 Saved jobs picker, unchanged) | exists |
| Example (first visit) | inside a Mike message: Card `subtle` + Badge `outline` + layer Badges (not tinted) + InlineMark `fix` + Button `secondary sm` | exists |
| Start → connecting | Button `primary lg` → Dots `pill` `shimmer` | exists |
| Bottom line | text `--text-sm --color-text-tertiary` + Button `link` | exists |
| VacancyEditor | VacancyEditor pattern (§7) | exists |

## 3. Start screen (`step: "start"`) — `data-review-id="Home/Start"`
**Layout.** `<main>` (`--color-canvas`); one column `max-width: --layout-narrow` (720), centred. The group greeting + composer + chips sits in the middle of the visible main area, a little above centre, like Gemini (R4) and Ollama (R6): at 1440 × 1024 its top ≈ y 300 🟡 (tune at build; flex column with `justify-content: center` and a bottom spacer of `--space-16`). Gaps: greeting → composer `--space-8`, composer → chips `--space-4`. The bottom line is pinned to the bottom of `<main>`, `--space-6` from the edge. `data-review-section` + `data-comment-target` on each block below.

### 3.1 Greeting `data-review-id="Home/Greeting"`
- h1, centred, `--text-3xl --weight-semibold --tracking-tight` (375: `--text-2xl`), `--color-text-primary`.
- Copy: Interview "What are we practising today, Alex?" · no profile (US-08 AC3) "What are we practising today?" · English mode "What shall we talk about, Alex?". No time-of-day greeting, no sub line, no orb.
- Mode change swaps the text `soft-out` `exit` → `rise-in` `base` (§3.1 N11).

### 3.2 Composer `data-review-id="Home/Composer"`
- Composer G1, `--radius-lg`, `--color-raised`, 1px `--color-border-control`, `--shadow-raised`. Field: hidden label "Message Mike", `minRows 1`, `maxRows 8`, `submitOnEnter` (Shift+Enter = new line; pasted text keeps its line breaks).
- Placeholder: Interview "Paste a job or a link, or say what you want to practise" · English "Say a topic, or pick one below" · 375 Interview "Paste a job or say what you want".
- `toolbarStart`:
  - **Mode chip** (R4 "Flash-Lite ▾", R6 model chip; the owner liked "приятный выбор модели"): Button `secondary sm`, icon `briefcase` "Interview" / `chat` "English practice", `chevronDown`; accessible name "Practice type: Interview". Menu `menu`, radio items: `briefcase` "Interview" + "Mike asks interview questions, with feedback after each answer." · `chat` "English practice" + "Just talk at your level. Corrections after each of your turns." Opens on Interview every time (US-25 AC2); `/?track=english` opens English.
  - IconButton `sm` `plus` "Add a job file" (Interview only): native file picker (PDF, DOCX, TXT, MD, HTML · up to 5 MB 🟡); the file shows in `attachment` (ComposerAttachment: Icon `file` · "kestrel-pay-senior-pd.pdf" · "184 KB" · IconButton `x` "Remove file"); while a file is attached, a line under the composer: Icon `lock` sm "The file stays on this computer." (GR7, US-09 AC5).
- `send`: `action`, Icon `arrowRight`, label "Send", inline at the end of the field, visible only with text or a file (`rise-in` `base`, §3.3 D6).
- Text ≥ 80 characters or a URL = a job (§4.2–4.3); anything shorter = a message (§4.4). Client-side, deterministic 🟡.

### 3.2a Quick start — the composer's end button (D51·1 «Начать сразу»; layout D52·2, chosen in D53)
- Gemini input (R4): `toolbarStart` = "+", then the mode chip; with an empty field the composer's end button (`send`, `action`, no label) is the quick start: Icon `mic`, name "Start now — voice practice", tooltip = what it starts ("Kestrel Pay · Behavioural · 5 questions · voice"); text mode / no speech recognition → Icon `keyboard`, "Start now — typed practice". One click opens the session, no setup chat (same soft-out as Start); spinner while starting.
- Text or a file morphs it into Send (`arrowRight`, fade) → setup chat. Enter in an empty field does nothing (Shift+Enter adds a line). No pill under the field (the D51 "Start now" pill was layout A, dropped in D53).
- Config (`quickStart.ts`, tested): returning = remembered job (if still saved, else general) + remembered round (`technical` sent as `mix`, §9 B2) + default strictness; first visit = general questions · Unseen mix · default strictness. Questions = settings `questions_per_session`; voice / "typing" follows the text-mode pref (and no speech recognition → typing). English track: no quick start, the end button is Send only.
- Disabled while loading and while the engine is not ready (the banner says why; typing and Send still work). States `returning`, `firstVisit`, `typed`, `fileAttached`, `quickTextMode`, `quickStarting`, `engineDown`, `loading`; review `start-returning`, `start-first`, `start-typed`, `start-quick-text`, `start-quick-engine-down`.

### 3.3 Suggestions `data-review-id="Home/Suggestions"`
ChipGroup `group`, hidden label "Suggestions", centred, wraps, **max 3**. A chip is a one-shot action: its label is sent as the user's first message.

| State | Chips (icon · label) | Tap leads to |
|---|---|---|
| Interview, returning (jobs + weak spots) | `briefcase` "Kestrel Pay again" · `content` "Drill my weak spots" · `chat` "Practise English" | plan with the last setup (§4.5) · drill turn (§4.6) · English mode, E1 |
| Interview, returning, no interview weak spots | `briefcase` "Kestrel Pay again" · `folder` "Another saved job" · `chat` "Practise English" | plan · T1 picker · E1 |
| Interview, first visit | `chat` "General questions" · `eye` "Show me an example" · `chat` "Practise English" | T2 · example (§4.7, US-29) · E1 |
| English, returning | `chat` "Talk about your work" · `chat` "Small talk" · `redo` "Practise my 2 phrases" | E1 with topic set · same · E1 with phrases on |
| English, first visit | `chat` "Free talk" · `chat` "Talk about your work" · `chat` "Small talk" | E1 with topic set |

"Kestrel Pay again" = the job of the last interview (S2); the company clamps at 24 characters + Tooltip G6.

### 3.4 Bottom line `data-review-id="Home/Footer"`
Centred `--text-sm --color-text-tertiary`: "Practice only: no help during real interviews." + Button `link` "What's free" → `/settings/about#free` (US-30, US-31 AC1). English: "Free forever: no limits on English practice." + "What's free" (US-24 AC5). Also under the bottom composer in the setup chat (like ChatGPT's line under its input).

### 3.5 Where weak spots went
No block on the start screen (D47e vs US-22 AC1 "weak spots first on Home" → [Q2]). They appear as the "Drill my weak spots" chip (entry, never primary), as one sentence in Mike's drill turn (§4.6) and as the "Watch for" row of the plan (§4.9).

## 4. Setup chat (`step: "setup"`) — `data-review-id="Home/Setup"`

### 4.1 Layout and common rules
- **Start → setup** (new motion row, §8): greeting `soft-out` `exit`; the user's first message `rise-in` `slow` at the top; the composer moves from the middle to the bottom of `<main>` by FLIP (`transform: translateY` `slower` `--ease-standard`, no layout animation).
- **Column** `--layout-narrow`, messages top-aligned, `padding-block-start --space-8`, between turns `--space-6`, inside a turn `--space-3`. Scrolls inside `<main>`; the newest message is scrolled into view (smooth; `auto` under reduced motion). Bottom padding = composer height + `--space-6`, so nothing hides behind it.
- **Header row** `data-review-id="Home/Setup/Header"`: sticky at the top of the column, `--color-canvas`, height `--control-h-md`, no border. Start: "Setting up with Mike" `--text-sm --color-text-secondary` + "Step 2 of 3" `--text-sm --color-text-tertiary` (the owner's «степы»: Mike's questions left). End: Button `ghost sm` "Skip questions" (gone once the plan is shown).
- **Composer** `data-review-id="Home/Setup/Composer"` pinned at the bottom (sticky, `--color-canvas` band, `--space-4` padding), same as §3.2 without the mode chip (the mode is fixed once the chat starts; "Start over" resets it). Placeholder follows Mike's question: T1 "Paste a job or a link" · T2/T3 "Reply to Mike" · after the plan "Ask Mike to change something" (goes to the note, B3).
- **Messages** (ChatMessage): Mike = no bubble, `--text-md --leading-relaxed --color-text-primary`; "Mike" `--text-sm --weight-medium --color-text-secondary` above the first message of a turn only (D51, Gemini style: quiet, no avatar, no orb, turns split by `--space-8`, no lines). User = end-aligned bubble `--color-subtle`, no border, `--radius-lg`, padding `--space-3` `--space-5`, max-width 75%, `--text-md`.
- **Quick replies** under Mike's question (ChatMessage `actions`): ChipGroup `group`, start-aligned, wraps, max 4 chips. A tapped chip is sent as the user's message and that turn's chips are removed (answered turns show only bubbles: the chat stays calm). Earlier answers are changed in the plan, not by scrolling up.
- **Scripted replies** (B1): a scripted Mike reply appears after `--duration-slow` with `rise-in`, **no dots** (we don't fake thinking). Dots / TextShimmer only while real work runs: reading a file, opening a link, preparing questions.
- **Start over**: the Practice nav row (and browser Back, `history.pushState` on entering setup) returns to the start screen and clears the chat (B6).
- **Skip questions**: drops the remaining turns, fills them with defaults (last used round and strictness, else Behavioural · Standard; no job → general questions), shows the plan, moves focus to "Start interview".
- **Accessibility**: list `role="log"` `aria-live="polite"` (Mike's new messages are read); focus stays in the composer after each Mike question (typing always works), the quick replies are the next Tab stops; the plan heading takes focus when it appears (`tabindex="-1"`, no ring).

### 4.2 The user pasted a job — `Setup/JobReading` → `Setup/JobPasted`
1. User bubble: the first 3 lines, clamped + `--text-sm --color-text-tertiary` "Job description · 1,240 characters"; Button `link sm` "Show all" opens the full text in the bubble.
2. Mike `pending`: TextShimmer "Reading the job…" (`aria-busy`).
3. Mike `final`: "Got it: **Kestrel Pay**, Senior Product Designer. I saved it to your jobs and I'm preparing questions from it." + Button `link sm` `edit` "Edit details" (VacancyEditor, edit mode, prefilled, §7). Same turn, next paragraph: T2.
4. Short text (80 characters up to the tailoring threshold 🟡, US-10 AC3): Mike adds "This text is short, so most questions will be general."

### 4.3 Link or file — `Setup/LinkFetching`, `Setup/LinkError`, `Setup/FileReading`, `Setup/FileError`
- Link: user bubble = the URL (ellipsis + Tooltip). Mike `pending` "Opening the page…" → success as §4.2 step 3 ("Added from a link") → `error`: "I couldn't open this page: it needs a login. Paste the job text here instead, or carry on with general questions." + reply `chat` "Use general questions"; placeholder "Paste the job text" (US-09 AC3).
- File: user bubble = Icon `file` · name · size. Mike `pending` "Reading the file…" → success as §4.2 → `error`: "I couldn't read this file. It may be a scan or password-protected. Paste the text instead." + "Use general questions".
- `State: error` = Mike's normal text + Icon `alert` sm `--color-text-secondary` before it. No status colour: a job that won't load is not a system failure (CONTRACT §2.4) 🟡.

### 4.4 Mike's turns (Interview)

| Turn | Shown when | Mike says | Quick replies | Free text |
|---|---|---|---|---|
| **T1 Job** | no job yet (typed sentence) | "Which job are we preparing for? Paste a job or a link, or pick one you saved." | 3 newest saved: `briefcase` "Kestrel Pay" · "Lumen Health" · "Fieldnote" + `chat` "General questions" | paste / link → §4.2–4.3; other text → note + general questions 🟡 |
| **T2 Round** | always, except "… again" | "What kind of round is it? Last time it was Behavioural." · first visit: "What kind of round is it? If you're not sure, Behavioural is the most common first round." | "HR screen" · "Behavioural" · "Technical" · "Unseen mix" | keyword match picks the round; no match → Mike: "I didn't catch the round. Pick one:" + the same chips |
| **T3 Anything else** | always, unless skipped | "Anything else I should know? For example a story from your CV you want to use, or a question that worries you." | "Nothing else" · "Be gentle with me" · "Push me harder" | the note (≤ 300 characters, B3); Mike: "Noted. I'll keep it in mind." |
| **Plan** | after T3 | "Here's the plan." + PlanCard (§4.9) | — | to the note (B3) |

- **Keyword match on the first message** (client-side, deterministic 🟡, B1): saved company names pick the job, round words ("HR", "behavioural", "technical", "mix", "unseen") pick the round, "gentle" / "tough" / "hard" pick strictness. Matched turns are skipped and Mike says what he took. Example: "I have an HR screen with Lumen tomorrow" → "HR screen for Lumen Health, got it." → T3 ("Step 1 of 1").
- **Saved job picked**: "Lumen Health, Product Designer, Design Systems. 8 questions from this job are ready." → T2. **General questions**: "General questions for any role, then." → T2.
- **Round copy** (US-12 AC2, used in the plan): HR screen "Motivation, salary, why this company." · Behavioural "Stories from your work: what you did and what changed." · Technical "Questions from your CV and the job: how you would do the work, in any role." · Unseen mix "Questions you can't prepare for, like a real first round."
- **Strictness** (Q10 wording 🟡): "Be gentle with me" → Gentle "At most one follow-up, only when a result is missing." · "Push me harder" → Tough "Up to two follow-ups, and Mike asks for numbers." · otherwise last used, else Standard "A follow-up when an answer misses your role, a result or a reflection."
- **No CV** (US-08 AC3): T3 starts with "I don't have your CV yet, so questions won't use your own projects." The plan carries the fix (§4.9).

### 4.5 "Kestrel Pay again" — `Setup/Again`
User bubble "Kestrel Pay again". Mike: "Same as Oct 19: Kestrel Pay, Behavioural, Standard. Change anything below, or start." + PlanCard. Header shows no steps and no "Skip questions". Two clicks to the first question (B8).

### 4.6 "Drill my weak spots" — `Setup/Drill` (US-22 AC1–AC4)
Mike: "From your last 2 interviews: no result in 4 answers, and “we” instead of “I” in 3. Two smaller ones too. What should we drill?" Replies: "All 4" · "Content 2" · "Language 1" · "Delivery 1"; under them `--text-sm --color-text-tertiary` "Words you marked as misheard aren't counted." (AC3). Then the drill plan (§4.9) and primary "Start drill". No interview history → the chip never shows (AC4). Layer choice needs B7.

### 4.7 First visit: "Show me an example" — `Setup/Example` (US-29)
Mike: "This is what you get after each question. It's an example from Sam, a product manager, not you." + Card `subtle` `Padding: md`: Badge `outline` "Example · Sam Rivera, Product Manager"; rows in the configured layer order (GR8, US-29 AC3): Badge `content` "Content" · "Missing result: end with what changed." / Badge `language` "Language" · "“I am responsible of” → “I'm responsible for”" (InlineMark `fix` on "for") · "B1 grammar" / Badge `delivery` "Delivery" · "14 fillers · 2:50 · 132 wpm: shorter answers land better"; Button `secondary sm` "Open example debrief" → `/sessions/example`. Then: "Want to try? Paste a job, or start with general questions." + replies "General questions" · "Practise English".

### 4.8 English practice — `Setup/EnglishLevel`, `Setup/EnglishPhrases`, `Setup/EnglishPlan`
| Turn | Mike says | Quick replies |
|---|---|---|
| **E1 Level**, first visit | "What level should I talk at? Pick B1 if you can talk about familiar things but often search for words." | "A2 · everyday topics" · "B1 · familiar topics" · "B2 · work topics" · "C1 · complex topics" |
| **E1 Level**, returning | "Same level as last time, B2?" | "Yes, B2" · "Easier: B1" · "Harder: C1" |
| **E2 Topic** (only if no topic chip was tapped) | "What would you like to talk about?" | "Free talk" · "Your work" · "Small talk" |
| **E2 phrases**, returning with recurring phrases (US-24 AC4) | adds "Two phrases came back twice: “discuss about the plan” and “since three years”. Shall I steer the talk so you can use them?" | "Yes, use them" · "Not today" |
| **Plan** | "Here's the plan." + PlanCard English | — |

Free text in E1 matches "A2"–"C1"; a typed sentence in E2 becomes the topic (≤ 80 characters, PROTOCOL `topic`). The level is never taken from the CV (Q18). Header "Step 1 of 2".

### 4.9 Plan card — `parts/PlanCard.tsx`, `data-review-id="Home/Setup/Plan"`
Inside Mike's last message, full column width. Card `subtle`, `Padding: md`, `--radius-md`.
- h2 "Here's the plan" `--text-md --weight-semibold` (focus target).
- `<dl>`, rows `--space-3` apart: term `--text-sm --color-text-tertiary` in a fixed first column (`calc(var(--space-16) * 2)` 🟡) · value `--text-sm --color-text-primary` · end Button `link sm` "Change" (names "Change job", "Change round", "Change how strict Mike is"). Container < 560: term above value, Change at the end of the value line.

| Row | Value (fixture) | "Change" opens |
|---|---|---|
| Job | "Kestrel Pay · Senior Product Designer" + `--color-text-tertiary` status: "12 questions ready" · TextShimmer "Preparing questions…" · "Couldn't prepare questions from this job. Mike will use general questions." + Button `link sm` "Try again" | Menu `listbox` (v1 picker: "General questions, no job" + 3 jobs newest first + footer "Add a job" → VacancyEditor) |
| Round | "Behavioural: stories from your work, what you did and what changed." | Menu radio, 4 rounds with descriptions |
| Mike | "Standard: a follow-up when an answer misses your role, a result or a reflection." | Menu radio Gentle / Standard / Tough |
| Length | "5 questions, about 20 minutes. Each question can have a follow-up." (D37 asked to re-explain 🟡) | — |
| Based on | "Your CV, the Kestrel Pay job and the general question bank" · "The Kestrel Pay job and the general question bank" · "Your CV and the general question bank" · "General questions for any role" (US-10 AC2) | — |
| Your note | "I freeze when they ask about salary." (only when given) | Button `link sm` "Remove" |
| Watch for | "No result in 4 answers. End each story with what changed." (returning; top weak spot, read-only reminder, B4) | — |

- No CV: line under the rows: Icon `info` sm "Add your CV so questions use your own experience." + Button `link sm` "Add CV" → `/settings/profile`.
- Actions, `--space-5` above, start-aligned: Button `primary lg` Icon `mic` **"Start interview"** (the only primary in the view) + Button `ghost sm` Icon `keyboard` "Type instead" (GR5). Browser without speech recognition (US-06): primary Icon `keyboard`, line "You'll answer by typing.", no "Type instead". Drill: "Start drill". English: "Start talking". Engine down: primary disabled (`--color-action-disabled` + `--color-text-disabled`), reason under it, `aria-describedby`: "Start the AI model first."
- **Drill plan rows:** Focus "No result · “we” instead of “I”" [Change: Menu radio All / Content / Language / Delivery] · Length "3 questions, about 12 minutes" 🟡 · Job "Kestrel Pay job" [Change].
- **English plan rows:** Level "B2: work topics, natural pace" [Change: Menu radio A2–C1 with descriptions] · Topic "Talk about your work" [Change] · Corrections "After each of your turns, up to 3, with a reason. Nothing appears while you speak." (US-24 AC3, D29) · Phrases "discuss the plan · for three years" (if "Yes, use them") [Remove] · line "Free forever: no limits on English practice." (US-24 AC5).
- A change made in the card cross-fades the value (`fast`); Mike adds no message (the card is the state).

### 4.10 Starting — `Setup/Starting`
"Start interview" cross-fades into the connecting pill (Dots `pill` `shimmer` "One moment…", §3.3 D1/D2); the rest is static and inert. On `/session`, the bottom composer `soft-out` `exit` and the session island `dock-in` `slower` takes its place (bottom centre): one input object becomes the other (`session.md` §V2.7).

## 5. States (each a story, light + dark, 1440 + 375; every one reachable by props)

| Story | What differs |
|---|---|
| `Home/Start/Returning` | §3, Interview, returning chips |
| `Home/Start/FirstVisit` | first-visit chips; rail Recent "Your sessions will appear here." |
| `Home/Start/NoName` | h1 without the name |
| `Home/Start/English` | mode chip "English practice", English h1, placeholder, chips, footer |
| `Home/Start/ModeMenu` | mode Menu open (inline) |
| `Home/Start/Typed` · `/Pasted` · `/FileAttached` | composer with a sentence / 6 lines of Kestrel Pay text / attached file + privacy line; send visible |
| `Home/Start/Loading` | h1 and composer render at once; the chips area keeps its height with one Skeleton `lines` `Lines: 1` until jobs and memory load; `aria-busy` on the group; no spinner |
| `Home/Start/EngineNotRunning` | Callout `warning` above the h1: "Mike can't start yet" / "The AI model (Ollama) isn't running. Open the Ollama app, or paste this into Terminal:" + CopyField `ollama serve` + "We check again every 5 seconds." + Button `secondary sm` `refresh` "Try again now" · Button `link sm` "Engine settings". The composer and the setup chat still work (no engine needed, B1); only Start in the plan is disabled. Check passes → banner leaves, no toast |
| `Home/Start/BrowserUnsupported` | Callout `warning` "This browser can't run speech recognition. Use Chrome or Edge, or answer by typing." + Button `secondary sm` `keyboard` "Use text mode" + IconButton `x` "Dismiss for this session" |
| `Home/Start/StorageUnreadable` | Callout `error` "We can't read your saved sessions and jobs. Check the data folder in Settings." + Button `secondary sm` "Open storage settings"; first-visit chips without "Show me an example"; T1 lists no saved jobs |
| `Home/Start/Overflow` (+30%) | h1 "What are we practising today, Alexandra-Marie Okonkwo-Lindqvist?" wraps to 2–3 lines; chip "Kestrel Payments Internati… again" clamped + Tooltip; footer wraps |
| `Setup/JobReading` · `/JobPasted` | §4.2 |
| `Setup/LinkFetching` · `/LinkError` · `/FileReading` · `/FileError` | §4.3 |
| `Setup/AskJob` · `/SavedJobPicked` | T1 with 3 saved jobs + General questions · Lumen Health picked → T2 |
| `Setup/KeywordMatch` | "I have an HR screen with Lumen tomorrow" → job + round taken → T3 |
| `Setup/AskRound` · `/AskAnything` · `/RoundNotCaught` | T2 · T3 · free text without a round word |
| `Setup/FreeTextNote` | T3 answered "I freeze when they ask about salary." → "Noted." → plan with the note |
| `Setup/Plan` | full plan, returning, ready |
| `Setup/PlanPreparing` · `/PlanPrepError` | job status shimmer, Start and Type instead disabled with "Start unlocks when the questions are ready." (13, QA-02) · error + Try again; Start enabled (general questions) |
| `Setup/PlanNoCv` · `/PlanEngineDown` · `/PlanTextMode` | Based on without CV + Add CV · banner + disabled Start with reason · keyboard Start, "You'll answer by typing." |
| `Setup/PlanChangeOpen` | Round Menu open from "Change" |
| `Setup/Skipped` | "Skip questions" pressed at T2: plan with defaults, focus on Start |
| `Setup/Again` · `/Drill` · `/Example` | §4.5 · §4.6 · §4.7 |
| `Setup/EnglishLevel` · `/EnglishPhrases` · `/EnglishPlan` | §4.8 |
| `Setup/Starting` | §4.10 |
| `Setup/Overflow` (+30%) | job "Kestrel Payments International Holdings · Senior Staff Product Designer, Platform Experience and Growth" wraps in the plan; 300-character note wraps; 40-line pasted job clamped to 3 lines + Show all; 7 saved jobs in the Change picker (search on) |
| `VacancyEditor/*` | §7 |

**Props of the pure `HomeView`:** `step: "start" | "setup"` · `track` · `name?` · `loading?` · `engineReady`, `engineBanner?`, `browserBanner?`, `storageError?`, `textMode?` · `suggestions: { id, icon, label }[]` · `composer: { text, file?: { name, size } }` · `setup: { turns: SetupTurn[], step?: { n, of }, canSkip, plan?: PlanModel }` · `starting?` · `overlay?` (VacancyEditor) · `initialOverlay?: "mode" | "change-job" | "change-round" | "change-strictness"`.
`SetupTurn = { id, speaker: "mike" | "user", state: "final" | "pending" | "error", text, pendingLabel?, attachment?: { kind: "job" | "link" | "file", label, meta }, replies?: { id, label, icon? }[], example?: boolean, plan?: boolean }`.
`PlanModel = { kind: "interview" | "drill" | "english", job: JobItem | null, jobStatus: "ready" | "preparing" | "error", round, strictness, questions, minutes, basis: "cv+job" | "job" | "cv" | "general", note?, watch?, hasCv, focus?, level?, topic?, phrases? }`.
Handlers: `onSend`, `onSuggestion`, `onReply(turnId, replyId)`, `onSkip`, `onChange(row, value)`, `onRemoveNote`, `onEditJob`, `onRetryPrep`, `onStart`, `onTypeInstead`, `onModeChange`, `onStartOver` + v1 banner handlers.

## 6. Layout 1440 · 375 (container queries)
- `shell` (AppShell) unchanged: ≥ 1024 rail 240 + main · 640–1023 top bar + drawer · < 640 top bar (menu, name, engine badge).
- **1440** (main 1200): start group centred, column 720; setup column 720, bottom composer the same 720, header row sticky.
- **375**: gutter `--layout-gutter`; h1 `--text-2xl`, 2 lines; start group top `--space-12` (not centred: the phone keyboard covers the lower half); chips wrap to 2 lines, never scroll sideways (P4); composer full width. Setup: bubble max-width 88%; plan full width, terms stack above values; actions stack (Start `FullWidth` lg, Type instead under it); menus become full-width sheets (Menu < 640); header row keeps "Step 2 of 3" + "Skip questions" ("Setting up with Mike" visually hidden).
- `page` (`<main>`) < 560: plan `<dl>` stacks, replies wrap, bubble 88%.
- No viewport media queries, no `vh` / `dvh`; sticky header and composer work inside the scaled review frame. `@media (pointer: coarse)`: chips and link buttons get the 44px hit area (DS-2).

## 7. VacancyEditor (unchanged from v1; opened by "Edit details" and "Add a job")
Dialog `--layout-dialog` (560). Title "Add a job" / "Edit job". Segmented full width, hidden label "Source": `file` "Paste" · `upload` "File" · `link` "Link".
- **Paste:** Textarea "Job description" (8 rows, `ShowCount`) + Inputs "Company" and "Role" side by side; hint "We filled these in from the text. Change them if they're wrong." (US-09 AC1). Too short: Callout `info` "This text is short, so questions will be mostly general." Save stays enabled.
- **File (FileDrop G9):** Icon `lock` sm "The file stays on this computer." first; drop zone "Drop a file here or browse", hint "PDF, DOCX, TXT, MD or HTML · up to 5 MB" 🟡; reading "Reading the file…"; error Callout `error` "We couldn't read this file. It may be a scan or password-protected. Paste the text instead." + Button `secondary sm` "Switch to Paste".
- **Link:** Input `url` "Link to the job posting", hint "Some pages need a login. If it doesn't work, paste the text instead." + Button `secondary md` "Fetch"; fetching TextShimmer "Opening the page…"; error Callout `error` "We couldn't open this page: it needs a login. Paste the text instead." + "Switch to Paste" (keeps the URL).
- Actions: edit mode Button `ghost` `trash` "Delete job" → confirm Dialog "Delete Kestrel Pay?" / "Your sessions with this job stay in History." / "Cancel" + Button `danger` "Delete job". End: "Cancel" · Button `primary` "Save job"; saving → Dots pill "Saving…". Saved from the chat's "Edit details": the plan's Job row updates; Mike's earlier line is not rewritten.
- Stories `VacancyEditor/PasteEmpty`, `PasteFilled`, `TooShort`, `FileEmpty`, `FileChosen`, `FileReading`, `FileError`, `LinkFetching`, `LinkError`, `Saving`, `Edit`.

## 8. Motion (new rows go into `docs/motion.md` first, CONTRACT §4.5)

| Element | Motion | Row |
|---|---|---|
| Start build-up (h1, composer, chips) | `rise-in` `slow` `--ease-enter`, stagger 80ms; first load and return from a session | §3.1 Home build-up (N3), now 3 items |
| Mode switch | h1, placeholder, chips `soft-out` `exit` → `rise-in` `base` | §3.1 N11 |
| Start → setup | greeting `soft-out` `exit`; composer FLIP `translateY` `slower` `--ease-standard`; first bubble `rise-in` `slow` | **New: "Home → setup chat"** |
| Chat message in (Mike, user) | `rise-in` `slow` (y 8px + opacity); scripted reply delay `--duration-slow` | **New: "Setup message"** (adapts §3.4 C6) |
| Quick replies in / out | in `fade-in` `base`, stagger 40ms after the message; answered `soft-out` `exit` | **New: "Quick replies"** |
| Plan card | `card-in` `slow` | §3.4 C7 |
| Plan value change | cross-fade `fast` | §3.2 label cross-fade |
| Mike pending | TextShimmer `loop-shimmer` | §3.5 L4 |
| Start → connecting → Session | §3.3 D1/D2; composer `soft-out` `exit`, island `dock-in` `slower` | §3.3 Home → Session (rewrite: no orb scale from Home any more) |
| Menus (mode, Change) | `menu-in` `base`, exit `soft-out` | §3.6 T2 |

Reduced motion: all instant, FLIP skipped (the composer simply appears at the bottom).

## 9. Backend gaps 🟡
- **B1 Scripted setup.** Mike's setup turns are fixed locale strings + a client-side keyword match (company names, round words, A2–C1, gentle / tough). No LLM call in setup, so it works while the engine is down. LLM-led setup is later 🟡.
- **B2 "Technical" round.** PROTOCOL `round_type` takes `hr | behavioural | mix`; Technical runs as `mix` today (`HomeScreen.tsx` note). Add `technical` (US-12 AC1).
- **B3 The user's note.** `start` has no field for "anything else". Add `notes` (≤ 300 characters) → interviewer prompt. Until it exists, T3 keeps its three chips and free text is not offered there (we never collect text Mike ignores).
- **B4 Watch for.** From `GET /api/memory` (exists), read-only.
- **B5 Job questions status.** `POST /vacancies/{id}/questions` exists; the plan needs a status to poll (`questions_status: preparing | ready | error` on `GET /vacancies/{id}` 🟡). Starting before "ready" = general questions first. **13, QA-02:** the plan no longer allows it: Start waits while preparing, and unlocks on ready, error or 90 s.
- **B6 Setup state** kept for the tab (sessionStorage 🟡), not saved to History.
- **B7 Drill focus.** Drill is a 3-question mixed session today; the layer choice needs a `focus: all | content | language | delivery` field in `start` (US-22 AC2).
- **B8 Last setup.** "Kestrel Pay again" needs the last interview's job id, round and strictness (`GET /api/sessions` latest interview 🟡).

## 10. Owner questions (default taken in this map)
- **[Q1]** The start screen has no Start button: a returning user starts with "Kestrel Pay again" → plan → Start (2 clicks instead of 1). *Default: accept.* Alternative: the plan of the last session is shown right away under the composer for returning users (the screen gets busier again).
- **[Q2]** Two PRD criteria change with D47: US-22 AC1 "weak spots shown first on Home" → a chip + Mike's drill sentence + "Watch for" in the plan; US-29 AC1 "example visible on first visit" → one tap away ("Show me an example"). *Default: update both ACs in the PRD.*
- **[Q3]** Interview / English as a mode chip inside the composer (like Gemini's and Ollama's model chip) instead of a pill switch above it. *Default: chip in the composer.* Alternative: small Segmented under the greeting (more visible English track, one more element).

## 11. PRD acceptance criteria → where
US-08 AC3 h1 without name + T3 no-CV sentence + plan "Add CV". US-09 AC1 §4.2 (Mike names company and role + "Edit details") · AC2 Change job picker newest first · AC3 §4.3 · AC4 T1 copy + placeholder · AC5 privacy line, no folder named. US-10 AC2 plan "Based on" · AC3 §4.2 step 4. US-12 AC1 T2 + T3 / plan Mike row · AC2 Technical copy · AC3 nothing round-related in Settings · AC4 T2 "Last time…", "… again", Skip defaults. US-22 AC1 **changed** ([Q2]) · AC2 §4.6 (B7) · AC3 misheard line · AC4 chip hidden without history · AC5 drill free. US-24 AC1 mode chip, named track · AC2 E1 · AC3 plan Corrections row · AC4 E2 phrases · AC5 footer + plan line. US-25 AC1–AC2 opens on Interview, `?track=english`. US-29 AC1 **changed** ([Q2]) · AC3 configured order. US-30 "What's free". US-31 AC1 footer line.
