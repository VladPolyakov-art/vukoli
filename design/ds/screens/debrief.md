# Composition map: Debrief (+ HistoryList)

> Stage 11, step 2 · 2026-10-20 · **Debrief view = layout D since 2026-10-27 (§3.2–3.5; choice record `debrief-variants.md`)** · ScreenId `Debrief` (variants `interview` · `english` · `example`) + `HistoryList` (Trash out of scope).
> Inputs: `docs/ia/wireframes/debrief.md`, `docs/ia.md` §2, §4, §6 (mock S1–S3, invariants 1–10), `docs/prd.md` US-18, US-19, US-20, US-21, US-23, US-24 AC4, US-29, US-58 AC5, `ds/CONTRACT.md`, `ds/components.md` (G1–G18), `docs/motion.md`, moodboard P1–P8 / R1–R11, D37, D45, D46.
> Replaces today's `screens/Debrief.tsx` (verdict and weak spots split over 3 cards, transcript at the bottom, Delete as a loose ghost button) and `screens/History.tsx` (meta as a "·" line, delete IconButton only, no rename, no filter, success-green notice).
> Legend: 🟡 assumption · **G<n>** = gap from `ds/components.md` §4 · **G19+** = new candidate from this map · R<n> / P<n> = moodboard.
> **D96 (2026-10-23):** feedback is made after the call. While it is being prepared the Debrief shows a preparing state with progress («n of N answers») and the hint that the page can be left; it polls every 2 s until the `post_call` marker clears. Edits return 409 `still_preparing` meanwhile.

## 0. Principles this screen applies
- **Otter summary structure, not its look (R5, Q3):** Overview → key points → per-item detail with quotes and timestamps → here: **Verdict** (overview) → **Weak spots + actions** (key points / action items) → **Question by question** (outline with quotes). No tokens from Otter.
- **Monochrome (P1), tints only here (Q2-b, CONTRACT §2.6):** content layer `--color-layer-content-tint` (blue-teal), language `--color-layer-language-tint`, delivery `--color-layer-delivery-tint` (greys). Verdict, scores, corrections never use status colours (CONTRACT §2.4).
- **A fix, not an error (P8, R11 pattern):** the fragment to change is marked inside the user's own sentence (`--color-mark-fix` + `--weight-semibold`), with the better version and a reason, one fix per row, dismissible. "Heard as" words the engine was unsure of get the grey dotted underline `--color-mark-heard`.
- **Nothing extra (P4):** no transcript section, no strength/next-step side card, no icons that only decorate.
- Decided, applied, not reopened: verdict scale `Not ready yet / Getting there / Ready` (US-20 AC1, D37; Q8 is closed), no CEFR label in the debrief (Q20, D37 33c), re-check only one question thread (Q22, D37 33e), misheard flags not counted until confirmed (D37 33f), example persona Sam Rivera, PM, Brightline (Q16, D37).

## 1. DS coverage

| Wireframe section | DS component (variant) | Gap / note |
|---|---|---|
| Back link "History" | `Button variant=link size=sm icon=chevronLeft` | — |
| H1 + rename in place | Page h1 + `IconButton icon=edit` → inline field | **G16** `InlineRename` sub-part (shared with the list row) |
| `⋯` menu: Export to Obsidian, Download as Markdown, Move to Trash | `IconButton` trigger + menu | **G4** Menu; **new icon `more`** (3 dots, horizontal) in `icons.tsx` |
| Meta line (round, date, length, questions, saved) | `Icon` + text items, `Badge tone=neutral` for "Example" / "Edited by you" | structured meta (invariant 7), no "·" chain |
| Example banner | `Callout tone=info` + `Button primary` | — |
| StorageNotWritable banner | `Callout tone=warning live=alert` (storage = system state) | — |
| Verdict | text block (h2 + line) + scale row of `Badge` (`live` for current, `outline` others) | no new component |
| Weak spots (≤ 3, one per layer) | **G18** Weak-spot strip, Debrief variant: 3 cards on layer tint | G18 `Context: home | debrief` (see §3.3) |
| Evidence links "Questions 1, 2, 4" | `Button variant=link size=sm` per question | — |
| Header toolbar | `Segmented` (Debrief / Conversation) + `Button` Practise again with a `Tooltip` hint | — |
| Actions block (debrief view) | `Button primary` (Drill, only without a plan) + helper text | — |
| Question cards (collapsed / expanded) | `Card as=li padding=md` + header disclosure button + `Badge tinted` summary | **G19 Disclosure** (new, §6): 5 copies on one screen + "Show full answer" + "Show a stronger answer" |
| Layer blocks inside a card | `components/Feedback` pattern, debrief mode: tinted block, items on `--color-raised` | pattern update (§3.5) |
| Correction row | Feedback item: `<dl>` Heard as / Say / Why + `Button ghost sm` actions | — |
| "Not what you said?" editor | `Textarea` + `Button secondary sm` "Save and check again" + `Button ghost sm` Cancel | — |
| Re-check / stronger answer loading | `Skeleton card` / `Skeleton lines=3` + text shimmer **G13** | Skeleton exists in code (`ds/index.ts`); `components.md` still says "in progress" → sync |
| Stronger answer | `Button secondary sm icon=sparkle` + rewrite text, placeholders `<mark>` | — |
| Loading | `Skeleton` (`lines`, `card`, `row`) | — |
| NotFound / load error | `EmptyState` (h1-level page) / `Callout tone=error` | — |
| Toast "Moved to Trash · Undo" | — | **G3** Toast (replaces today's success-green Callout) |
| History filter `All 3 · Interview 2 · English 1` | `Chip` ×3, single-select (same pattern as Home Focus chips) | — |
| History rows | — | **G16** List row (+ inline rename, row menu at narrow width via **G4**) |
| Truncated titles | `title` attribute today | **G6** Tooltip |
| Week group headers | `Section` title (`--text-sm`, `--weight-semibold`, secondary) | — |
| History empty / filtered empty / loading / error | `EmptyState` / `EmptyState compact` / `Skeleton row rows=4` / `Callout error` | — |

No candidate at all: none. Gaps used: **G3, G4, G6, G13, G16, G18** + new **G19 Disclosure** and icon `more`.
Options for G19 (owner/DS call): (a) **recommended** new DS component `Disclosure` (`Card`-friendly header button + region); (b) nearest: `Card` + local button in `screens/debrief/parts/QuestionCard` (allowed only until the 3rd copy, which this screen already has); (c) placeholder: always-expanded cards (breaks US-20 AC1).

## 2. Wireframe sufficiency — proposals (one yes/no block)
Checked: raw entities, empty zones, edge cases, CTA count, bare text, 1-item lists. The wireframe is strong; gaps are below.
1. **HistoryList has no wireframe.** Build it from ia.md §4 row + flow `history.mmd` as in §4 below, ≥ 3 rows in every data state (canonical 3 rows = invariant 1; overflow 7 rows: partial, renamed, long title, long English topic). — yes / no
2. **Question timestamps (Otter outline):** each card shows when the question started, `at 03:35`, next to its length. Needs a thread start time in the content model 🟡. — yes / no (no → hide the item, layout unchanged)
3. **Verdict scale row** under the verdict: `Not ready yet · Getting there · Ready`, current one marked (`Badge live` + check icon + `aria-current`). Explains the word without a tooltip. — yes / no
4. **Evidence links jump and open:** "Questions 1, 2, 4" in a weak spot scroll to the card, open it, move focus to its heading. — yes / no
5. **Download as Markdown always in `⋯`** (D27 "exportable to Markdown"; today's app has it as a page link). — yes / no
6. **Dismiss on each correction row** next to "Not what you said?" (P8 "dismissible"; the wireframe has only the second). — yes / no
7. **Load-error state** (file unreadable, GR4) in addition to NotFound. — yes / no
8. **Answered with a suggestion** (US-58 AC5): neutral badge on the card header. Whether such answers count toward weak spots → Owner decision O4. — yes / no
9. Not added (no AC, P4): full transcript section (answers already live inside cards), "Strength / Next step" card from today's code.

## 3. Map: Debrief

### 3.0 Frame, layout, containers
- Inside `AppShell` (rail visible, "History" nav row current). Content: `Page` (not narrow), max `--layout-content` (960), padding `--space-12` top / `--space-10` sides, `--space-16` bottom. Vertical rhythm: **sections `--space-10` · groups inside a section `--space-4` · rows inside a group `--space-2`** (write into `docs/frontend.md`).
- **Container queries, not viewport media queries** (screens render inside scaled review frames). `Page` root gets `container: page / inline-size` (pattern-level change, benefits every screen); `AppShell` root gets `container: shell / inline-size` and switches rail ↔ top bar on the shell width (today it uses `@media`). Breakpoints are **container widths of `page`**:
  - **wide ≥ 840px** (1440 desktop = 960 content): weak spots 3 columns; header actions on the H1 row; card summary on one line.
  - **medium 560–839px** (tablet with 64px rail): weak spots 1 column stacked (wireframe 768); actions row directly under them.
  - **narrow < 560px** (375 phone: 343 content, gutter `--layout-gutter` 16px): one column; H1 `--text-2xl`; rename + `⋯` stay on the H1 row; actions full-width buttons stacked `--space-2`; card summary badges wrap. 🟡 375 is not a PRD target (mobile Won't, ia.md); built as a clean stacked layout, no phone-only features.

### 3.0a Views (owner request 2026-10-27: chat-first)
- The page has two views of one session. **Debrief** (default, D101): layout D (§3.2–3.5), the summary, the plan and the question viewer at the same content width as the header row (the English body keeps its reading column, max `--layout-content`). **Conversation**: the chat across the full main width. Switch: DS `Segmented` "View" (label hidden) **Debrief | Conversation**, in the header toolbar under the meta; hidden when the session has no debrief (then the page is the chat alone).
- The view lives in the URL (D101, 2026-10-27): no param = debrief; `?view=conversation` = the chat; `?view=debrief` (old links, the "debrief ready" toast) is still the debrief; any other value = the default. Switching replaces the history entry and scrolls `<main>` to the top. The example (`/sessions/example`) works the same way. A session with no debrief to show (`model.empty`) is the chat alone, whatever the param.
- Conversation view: Mike's bubbles cap at `--layout-narrow`, the user's at `--layout-content`, right-aligned. With 2+ asked questions a sticky bar (`Segmented` "Jump to question", numbers) scrolls the chat to that question. In the Debrief view the question viewer (§3.5) shows one question at a time behind a sticky switcher.
- No nested scrollers: the old sticky two-column split with a height-capped breakdown and the folded verdict bar are gone. The page root clips sideways overflow (`overflow-x: clip`).

### 3.1 Header (`interview`, mock S2, user Alex Morgan, invariants 3–5)
1. `Button link sm chevronLeft` **History** → `/history`. Gap below `--space-4`.
2. H1 row (flex, `--space-3`, wrap): **Kestrel Pay · Senior Product Designer** (`--text-3xl`, `--weight-semibold`, `--tracking-tight`, wraps to 2 lines, then clamps with tooltip G6) · `IconButton sm edit` label "Rename session" · `IconButton sm more` label "More actions for this session" → **G4** menu: `Export to Obsidian` (icon `folder`, only when a folder is set, US-23 AC3) · `Download as Markdown` (icon `download`) · separator · `Move to Trash` (icon `trash`, **not** danger: reversible, CONTRACT §2.4).
3. Meta row (flex wrap, gap `--space-4`, `--text-sm`, `--color-text-secondary`, icons `--icon-sm`): `briefcase` Behavioural · Standard · `clock` Oct 19, 20:40 · 24 min · `chat` 5 questions, 4 follow-ups · `check` **Saved on this computer** (`--color-text-tertiary`, US-20 AC5, US-23 AC1; links to Settings → Storage).
3a. Toolbar under the meta (flex wrap, `--space-3`): the view `Segmented` (§3.0a) + the one **Practise again** button (§3.4), in both views.
4. Rename state (G16 `InlineRename Size=lg`): H1 swaps (`Swap`, `fast`) to `Input HideLabel` label "Session title", value selected, max 80, counter `37 / 80` (`--color-text-tertiary`), `IconButton check` "Save title", `IconButton x` "Cancel"; Enter saves, Esc cancels, empty → error "Add a title, or press Esc to keep the old one." (US-21 AC2).

### 3.2 Summary: verdict, level, the one score (layout D, 2026-10-27, replaces the old verdict + scale + scorecard block)
> The owner chose variant **D** (question switcher) for the real Debrief view on 2026-10-27. Full record of the choice, the three rounds of notes and the measurements: `ds/screens/debrief-variants.md` § D (variants A/B/C stay there as a comparison record). Local parts: `parts/Summary.tsx`, `LevelProgress.tsx`, `SkillsHoverCard.tsx`, `Plan.tsx`, `QuestionViewer.tsx` (`QuestionTabs.tsx`, `QuestionView.tsx`), shared helpers in `parts/debriefShared.tsx`.
- **No Scorecard block on the page.** The page is one content width (the same right edge as the header row; the English body keeps its reading column).
- Region **Verdict** (visually hidden h2; the headline is the visible one): headline (`--text-3xl`: the step's name when there is a step, else the model's sentence) · the model's sentence (`--text-md`, secondary, max 60ch; template-verdict note below it) · **Your level** · the D99 rule line. On the right: the one score.
- **Your level** (look C, "blocks", the owner's pick): the three steps as one line `Not ready yet › Getting there › Ready` (current in primary, semibold; passed filled), then one cell per skill that counts for the next step, the ones already there filled, caption **2 of 3 answer skills at 3/5 or more · 1 to go to “Getting there”**. Not a control. One `role="img"` sentence ("Your level: Getting there, step 2 of 3 (…). 5 of 6 skills at 4/5 or more, 1 to go to “Ready”."). The fill grows once on load (`--duration-base`, 0 under reduced motion). 🟡 The position between two steps is derived (`levelProgress`): Not ready yet → Getting there counts the answer rows at 3/5+; Getting there → Ready counts every shown row at 4/5+; "N to go" equals the verdict's `gap` exactly.
- **D99 rule line** unchanged: **To reach “Ready”: get Your part to 4 of 5 or more.** (`parts/verdictLine.ts`).
- **Without `verdict.step`** (a debrief written before the steps existed): the step, gap and target are derived from the scorecard rows with the same rule (`verdictStep.ts`); the headline stays the model's sentence. No scored row: no step, no level block, no score; the sentence stands alone.
- **The one score** `3.3/5 · Average of 7 skills` (`--text-3xl` figure; "Average of N skills" with a dotted underline and an info icon, `cursor: help`): the plain mean of the scored rows, one decimal, "Not asked" left out, hidden when no row has a score. 🟡 A plain mean is not in rubric §9; it can read as a grade (AC9 bans grade labels, not numbers) and can disagree with the step.
- **Skills hover card** (behind the score; `role="dialog"` "Your skills, weakest first"): opens to the **left** of the score, top edges aligned, on **mouse hover** after `--duration-fast` (the pointer may travel into the panel, grace `--duration-slow`; leaving both closes it; a mouse click changes nothing, there is no pin), on **keyboard focus** (Enter / Space moves focus to its heading), and on **tap** as a full-width sheet under the score below 640px of overlay width (tap again closes). Esc, ×, a press outside or a question link close it and give focus back to the score; Tab past its ends closes it. Inside: the rubric note **Practice scores from this app's rubric, not a hiring prediction.**, the skills weakest first (ties in scorecard order), two columns from 30rem: name · **3/5** (tabular, right-aligned; spoken "3 out of 5") · **Lost points in questions** `1, 2, 4` (`QuestionLinks`, "Go to question {n}") or **No points lost.**; then **Not asked this time: Lessons learned** and the misheard note **Words the app may have misheard are not counted. You can check them in each question.** A question link closes the card and shows that question in the viewer (§3.5). Monochrome, no meters (CONTRACT §2.4).

### 3.3 Plan for the next session + Drill (layout D; D98, US-20 AC8; rubric §9.3)
- One compact `Card` ("Your plan for the next session", an h2): a heading row with the hint (**3 questions on these 4 points · about 12 min**) and the page's **only primary button** `Button primary icon=play` **Drill these weak spots** (`data-track="drill-start"`), then up to **three one-line steps** (numbered `<ol>`): **weak-spot title.** the exercise sentence · **Questions** `1, 3, 4` links (switch the viewer). The weak spots are folded into the steps: the full "What you said / How it lands / How to fix" sits on the weak spot's **first evidence question** in the viewer's Feedback list (§3.5).
- Steps follow the configured layer order (GR8). An older debrief with no plan lists its weak spots in the same shape under the heading **What to work on** (text = the weak spot's fix).
- No drill (a too-short session, English): no button. Storage not writable: the drill is `secondary` (Download is the primary). Example: the button is disabled and the hint says **In your own debrief, you can drill these weak spots in a short session.**
- No "What to work on" section, no three-column weak-spot cards, no "Also:" line (dropped with the cards).

### 3.4 Actions
- **Practise again** is one button in the header toolbar next to the view switch, visible in both views (`Button icon=refresh`, `data-track="practise-again"`; primary only for English / partial without a storage error, else secondary). The hint **Same job and round, new questions** is a `Tooltip` (bottom-start) and the button's `aria-description`. None in the example.
- The Debrief view's actions block no longer holds a drill (it lives in the plan); it is now only the example's **Start your first interview** link. Only one primary on the page (CONTRACT §2.2).

### 3.5 Question viewer (layout D; replaces "Question by question" with Disclosure cards and the Segmented picker)
- Region **Question by question** (visually hidden h2): a **sticky switcher**, then exactly **one question at a time**, then **Previous / Next**.
- **Switcher** (`QuestionTabs`, `role="tablist"` "Questions from this interview", sticks to the top of `<main>`, `--z-sticky`, `--color-canvas`): one tab per question: number disc + the question's text clamped to **2 lines**. Overflow rule (the server caps a session at 10; 12 is the degrade case): (1) labels while each tab gets at least `--tab-min` (8rem) of the bar; (2) otherwise numbers only, with **Previous question / Next question** icon buttons at the bar's ends; (3) when the numbers (at least `--control-h-touch` each) do not fit, the strip scrolls sideways with an edge fade on the side that has more. The selected tab is always scrolled into view (sideways only). Always one row. Selected: black number disc + the strong underline. ←/→/Home/End move and select (`ds/roving`). A tab's accessible name is the number and the question's text.
- **Address:** `?q=n` holds the question (`/sessions/:id?q=4`); a reload or a shared link opens the same question. It is written when the user picks a question (the first one stays a clean URL), dropped when the user goes back to the conversation, and a number the session does not have is ignored (the first question shows). The example opens on question 3.
- **Question** (`QuestionView`, an `<article>`): meta line **Question 2 of 5 · 2:20 · at 03:35 · 1 follow-up · 1 marked misheard by you** (+ the "Answered with a suggestion" badge), the question as an `h3` (the focus target for every question link: the plan, the skills card), **Lost points on: Structure (STAR), English** (from the scorecard; **No points lost in this answer.**; none without a scorecard). Two columns from 840 (one below):
  - **left:** the follow-up question · **Your answer** (+ the **Edited by you** badge) with `Button ghost sm icon=edit` **Edit what I said** (US-18 AC3; the editor replaces the text; **Checking this answer again…** shimmer + skeleton while it is checked) · **Your follow-up answer** · `Disclosure plain` **Show a stronger answer** (loads on its first open; **Fill in your real number — we never invent results.**).
  - **right:** one **Feedback** list in the configured layer order, a small layer tag (`LayerTag`: icon + name, text never colour only, GR10) on each note: the weak spot whose first evidence question this is opens the list (**What you said** or **Measured** / **How it lands** / **How to fix**; a language spot skips "What you said": its correction below shows the same words) · content notes · **language corrections inline**, `heard → say` in the user's own sentence with the reason, **Not what you said?** (the inline editor) and **Dismiss** (row out, **Dismissed — not counted.** + **Undo**) · delivery numbers + the tip (+ engine note) · the removed lines (misheard / unchecked, not counted) · **Feedback wasn't available for this answer. It isn't counted in the verdict.** (`Callout info`) when it never arrived.
- **Footer:** `Button ghost` **Previous** and `Button secondary` **Next: question 3** (the last reads **Last question**), always present, disabled at the ends.
- **Behaviour:** a question link (plan, skills card) switches the viewer, scrolls its top into view and focuses the question heading. Switching by the tabs, ←/→ or the footer keeps the place: if the reader has scrolled past the viewer's top, it comes back to the top under the sticky switcher. The swap is the DS `Swap` (motion.md 3.1).

### 3.6 Variant `english` (mock S3, US-24 AC4)
- Header: **English · Talk about your work** · meta `language` B2 · `clock` Oct 18, 21:05 · 11 min · `chat` 9 turns · `check` Saved on this computer. No verdict, no content / delivery layers (US-24 AC3).
- **Summary** (Section label) — `--text-lg` medium: **5 corrections. 2 of them came up twice — they're in Phrases to review.**
- **Corrections** + helper **In the order they happened. "Heard as" is what speech recognition heard.** One language-tinted block, rows on `--color-raised` (same row as §3.5), each with `Turn 2 · 01:40` (tertiary) before **Heard as**:
  1. "we **discussed about** the plan" → "we **discussed** the plan" — "Discuss" takes no "about".
  2. "I **work here since** three years" → "I**'ve worked here for** three years" — A duration takes "for" and the present perfect.
  3. "it **depends of** the client" → "it **depends on** the client" — "Depend" takes "on".
  - `Button link sm` **Show 2 more** · removed line **You marked "Figma" as a name — not flagged.**
- **Phrases to review**: 2 rows (`--color-raised`, `--radius-md`): "discuss about" → "discuss" · `Badge neutral` **2 times**; "since three years" → "for three years" · **2 times**.
- Actions: `Button primary icon=practice` **Practise these phrases** + **A short talk that uses these 2 phrases · about 5 min** · `Button link` **Back to home**.

### 3.7 Variant `example` (US-29, Sam Rivera, Brightline)
- `Callout info` on top (not sticky; first element): title **Example debrief**, body **A fictional candidate: Sam Rivera, Product Manager at Brightline. Your own debrief appears here after your first interview.** action `Button primary` **Start your first interview**. `Badge neutral` **Example** next to the H1. No rename, `⋯`, Drill or Practise again; the actions slot shows text **In your own debrief, you can drill these weak spots in a short session.** + `Button link` **Start your first interview**.
- Header: **Brightline · Product Manager, Growth** · Behavioural · Standard · Oct 14, 19:30 · 22 min · 5 questions, 3 follow-ups. Verdict **Getting there** — **Strong on the why, but 3 answers skip the decision you made yourself.**
- Weak spots: **Content** Your own decision is missing in 3 of 5 answers · Questions 1, 3, 4 · Fix: name the call you made and why: "I chose to cut the referral flow because…" · **Language** "make a research" instead of "do research" — 2 times · Questions 3, 4 · Fix: "research" takes "do" and has no plural. · **Delivery** Answers run long: 3:10 on average · Most in question 3 (4:05) · Fix: one sentence of context, then what you did.
- Questions: **1** Tell me about a product decision you made with incomplete data. · **2** Describe a time you had to say no to a senior stakeholder. · **3** Tell me about a feature that failed. What did you learn? (expanded) · **4** How do you prioritise when everything is urgent? · **5** Why Brightline?
- Q3 answer: "Last year we launched a referral flow for small-business accounts. We expected around 15% of new sign-ups to come from referrals, but after six weeks it was under 3%. Honestly, the problem was we didn't make a research before, we just copied what consumer apps do. So we interviewed twelve customers and found they don't want to refer their competitors, which is obvious now. We shut it down and moved the team to onboarding." Fix row: "we **didn't make a research** before" → "we **didn't do any research** beforehand" — "Research" takes "do" and is uncountable. Q5 row: "I **am working in** Brightline since 2021" → "I**'ve worked at** Brightline since 2021" — "Since" + a start point takes the present perfect; use "at" for a company.
- Seeded for **both** layer orders (GR8, US-29 AC3): stories `example-content-first`, `example-delivery-first`. Same data as the README screenshot (US-29 AC2).

## 4. Map: HistoryList (`/history`, US-21, US-23)
- `Page` title **History**, sub **Interviews and English practice, saved on this computer.** Header action `Button link sm icon=trash` **Trash (1)** → `/history/trash`.
- Filter (`--space-2`, `role="group"` label "Show"): `Chip selected` **All 3** · `Chip` **Interview 2** · `Chip` **English 1** (invariant 1; URL `?track=`). Gap `--space-6` to the list.
- Groups by week: Section label **This week** / **Last week** / **Earlier in October**, `--space-6` between groups, rows `--space-1` apart.
- **G16 List row** (`<li>`, `--radius-md`, padding `--space-3` `--space-4`, min 64px, hover `--color-hover`, whole row is the title link via stretched `::after`; actions sit above it):
  - Lead: 40px disc (`--control-h-md`, `--radius-pill`, `--color-subtle`) with `briefcase` (interview) / `chat` (English).
  - Body: title (`--text-md`, `--weight-medium`, 1 line + ellipsis + G6 tooltip; 2 lines at narrow) · meta (wrap, `--space-3`, `--text-sm` secondary): `Badge outline` Interview / English · round text · `clock` date, time · length.
  - Right: result text (`--text-sm`, `--weight-medium`, primary; never coloured): verdict word / "5 corrections" / "No verdict — 2 of 5 answered".
  - Actions (wide/medium): `IconButton sm edit` "Rename {title}" · `IconButton sm trash` "Move {title} to Trash"; shown on row hover / `:focus-within`, always shown on `pointer: coarse`. Narrow: one `IconButton sm more` → G4 menu (Rename, Move to Trash).
- Rows, state `data` (invariant 1): **This week** — Kestrel Pay · Senior Product Designer · Interview · Behavioural · Standard · Oct 19, 20:40 · 24 min · **Getting there** · **Last week** — English · Talk about your work · English · B2 · Oct 18, 21:05 · 11 min · **5 corrections** — Lumen Health · Product Designer, Design Systems · Interview · HR screen · Gentle · Oct 17, 19:10 · 14 min · **Not ready yet** 🟡 (S1 verdict not in the mock).
- State `renaming`: the Lumen row becomes InlineRename (`Input`, value "Lumen Health · HR screen, first try", `35 / 80`, check / x); the rest unchanged.
- State `overflow` (7 rows, +30% text): adds **Kestrel Pay · Senior Product Designer** · Oct 20, 08:15 · 6 min · **No verdict — 2 of 5 answered** (partial) · **Lumen HR screen — calmer second try** (renamed by the user) · Oct 16 · **Getting there** · **Northwind Logistics International · Senior Product Designer, Platform and Internal Tools** (truncates, tooltip) · Oct 9 · **Not ready yet** · **English · Explaining a delayed release to a client without sounding defensive** · C1 · Oct 11 · **8 corrections**. Overflow fixtures are separate from the S1–S3 mock (invariant 1 stays true for `data`).
- State `filteredEmpty` (`?track=english`, no English sessions): `EmptyState compact icon=chat` **No English sessions yet** · **English practice is a relaxed talk at your level, with corrections after each turn.** · `Button secondary` **Start English practice** → `/?track=english`.
- State `empty` (US-21 AC4): `EmptyState icon=history` **Your sessions will appear here** · **Each interview and English practice is saved on this computer with its debrief.** · `Button primary icon=practice` **Start a session** · `Button link` **See an example debrief** → `/sessions/example`. Filter chips hidden.
- State `loading`: filter chips visible but disabled, `Skeleton variant=row rows=4`, `aria-busy`.
- State `error`: `Callout tone=error` **We couldn't read your saved sessions.** **The data folder may have moved or lost permissions.** actions `Button secondary sm icon=refresh` **Try again** · `Button link sm` **Open storage settings**.
- After Move to Trash: row exits; **G3 Toast** **Moved to Trash.** + `Button link sm` **Undo** (also after Move to Trash from the Debrief, which returns to History). Never a success-green Callout (P8: not a system state).

## 5. States to build (static, reachable by props; one story each)
Props: `DebriefScreen({ variant: "interview"|"english"|"example", state, layerOrder: "content-first"|"delivery-first", openQuestion?: number, longText?: boolean, hasConfidence?: boolean })`, `HistoryScreen({ state, filter })`. Stories `Screens/Debrief/*`, `Screens/History/*`, each at page container 960 and 343, light and dark (GR13). Code in `app/web/src/screens/debrief/` and `screens/history/`, local parts in `parts/`, fixtures in `fixtures.ts` (fictional only, GR2).

| Story | What is on screen |
|---|---|
| `interview-conversation` | default view: §3.0a conversation, full width, switch + Practise again under the meta, jump bar; `-mobile` |
| `interview-full` | Debrief view (the default, layout D): §3.1–3.5, Q2 shown, stronger answer open; `delivery-first` twin; `interview-q4` (opened with `?q=4`); `interview-ten`, `interview-twelve` (question switcher overflow); `interview-no-step` (verdict without a step); `skills-card-open` (hover card) |
| `interview-rename` | header in InlineRename |
| `interview-recheck` | Q2 language row in "Not what you said?" editor; second story: "Checking this answer again…" skeleton |
| `english` | §3.6 |
| `example` | §3.7, both layer orders |
| `partial` (US-20 AC4, Q11 = 3) | Header (Oct 20, 08:15, 6 min, 2 questions answered) · `Callout info` **Not enough answers for a verdict** · **You answered 2 of 5 questions. Answer at least 3 and you'll get a verdict and weak spots.** · action `Button primary` **Practise again** · cards 1–2 only (Q2 typed: "You typed:" rows, Delivery **Pace and fillers aren't available in text mode**, US-19 AC4) · tertiary line **Questions 3–5 weren't asked — the session ended early.** |
| `loading` | Back link, `Skeleton lines=2` (title + meta), `Skeleton lines=2` (verdict), 3 × `Skeleton card` in the weak-spot grid, `Skeleton row rows=5`; `aria-busy` on main |
| `preparing` | right after a session: shimmer **Writing your debrief. This takes a few seconds…** above the `loading` skeleton |
| `storageNotWritable` (US-23 AC4) | `Callout warning live=alert` first: **We couldn't save this debrief to your computer** · **The data folder isn't writable, so this session will be lost when you close the app.** · `Button primary icon=download` **Download debrief (.md)** · `Button link sm` **Fix in Settings**; meta shows `alert` **Not saved** (`--color-text-warning`); Drill becomes `secondary` (one primary) |
| `notFound` | `EmptyState icon=history` **This session no longer exists** · **It was deleted from Trash, or the link is wrong.** · `Button primary` **Open history** · `Button secondary` **Go to home** |
| `error` (proposal 7) | `Callout error` **We couldn't open this debrief.** **The session file may be damaged.** · **Try again** · **Open history** |
| `longTextConversation` | Conversation view with very long unbroken text: bubbles wrap, no sideways scroll at 960 and 343 |
| `longText` (+30%) | Title "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools" (2 lines), weak-spot texts +30% (cards stretch, equal height), summary badges wrap to 2 lines, answer clamp 6 lines + Show full answer, `overflow-wrap: anywhere` for long tokens, one card with "Feedback wasn't available" |
| History `data` · `renaming` · `overflow` · `filteredEmpty` · `empty` · `loading` · `error` | §4 |

Every PRD AC: US-20 AC1–AC5 (§3.2–3.5, `partial`, meta) · US-19 AC2 (card summary + Delivery block), AC3 (engine note), AC4 (`partial` Q2) · US-18 AC1–AC3 on debrief rows, AC4–AC5 via `hasConfidence` · US-21 AC1–AC4 (§4), AC5 n/a on screen (storage merge, stage 12) · US-23 AC1 (meta), AC2 (Move to Trash + Undo; restore = Trash screen, out of scope), AC3 (menu item conditional), AC4 (`storageNotWritable`), AC5 n/a (file format) · US-24 AC4 (`english` + History English filter) · US-29 AC1–AC3 (`example`) · US-58 AC5 (badge, proposal 8).

## 6. New DS candidates from this screen
- **G19 Disclosure** — anatomy: header `<button aria-expanded aria-controls>` (slot: leading, title, meta, trailing chevron) · region `role="region"` labelled by the header. Variants `Surface: card | plain` · `DefaultOpen: false | true` · `Chevron: end | none`. States: closed · open · hover `--color-hover` on the header · focus (offset 2px) · disabled. Tokens: Card tokens + `--icon-md`, `--duration-base`. Motion: new row in motion.md (§7). Story `ds-disclosure--card`, `--plain`. Used here 5× + "Show full answer" + stronger answer; later Session transcript.
- **G16 List row** gets sub-part `InlineRename` (`Size: md | lg`) used by HistoryList rows and the Debrief H1.
- **G18 Weak-spot strip** gets `Context: home | debrief` (debrief: tinted cards, evidence links, no Focus chips).
- **Icon `more`** (three dots, horizontal) in `icons.tsx`, same 24 grid / 1.75 stroke.
- **Layout D (2026-10-27), local parts that are DS candidates** (details: `debrief-variants.md` § D): **`QuestionTabs`** (anatomy `‹ · number disc · label (2-line clamp) · ›`; `Density: labels | numbers` by measured width, `Overflow: fit | scroll` with edge fade, `Sticky`; the DS `Tabs` takes one-line labels only) · **`HoverCard` / `Popover`** (the score's skills: anchored interactive panel, `Trigger: hover + focus | tap`, `Side: left → bottom → sheet`, title + close, grace delay; built on `ds/overlay` + `OverlayPortal` with a local `useSidePanel`; the DS has `Menu` and `Tooltip` but nothing for interactive content) · **`LevelProgress`** (`Step: 0 | 1 | 2`, derived position 🟡, look "blocks") · `LayerTag`. They stay in `screens/debrief/parts/` until a second screen needs them.
- `Feedback` pattern, debrief mode: layer block on its tint, correction rows on `--color-raised`, `Dismiss` action, `Turn n · mm:ss` prefix for English.

## 7. Motion (rows in `docs/motion.md`)
| Element | Motion | Row |
|---|---|---|
| Page enter | `rise-in` `--duration-slow` `--ease-enter`; rail still | §3.1 Route change |
| Debrief build-up (first open only, `useFreshOnce`) | verdict → weak-spot cards → actions → question cards, `rise-in` `slow`, `--duration-stagger` 80ms | **New row needed**: "Debrief build-up" = Take of §3.1 Home build-up (N3) — add to motion.md before code (CONTRACT §4.5) |
| Skeleton → content | skeleton sweep `skeleton` `--duration-loop-skeleton`; content `rise-in` `base` | §3.5 Skeleton |
| "Writing your debrief…" | text shimmer `--duration-loop-shimmer` | §3.5 L4, §3.7 debrief-pending |
| Card open / close | chevron `rotate(180deg)` `base`; region `rise-in` `base` on open, `soft-out` `exit` on close; **no height animation** (rule 6) | §3.2 P5 + **new row "Disclosure"** (Adapt) |
| Evidence link jump | `scrollIntoView` smooth (`auto` reduced), then open + focus heading (`tabindex=-1`, no ring) | §3.4 C10 |
| Re-check, stronger answer loading | shimmer line + `Skeleton card` / `lines`; result `card-in` `slow` | §3.7 pending card, §3.4 C7 |
| Dismiss a correction | row out (`opacity 0` + `translateX(-12px)` `exit`), removed line `fade-in` `base` | §3.1 rows delete (N10) |
| Rename swap | `Swap` cross-fade `fast` | §3.1 (Swap) |
| `⋯` menu | `menu-in` `base`, `soft-out` `exit` | §3.6 T2 |
| Toast | drop-in `slow`, `soft-out` `exit`, 5 s | §3.6 T1 |
| Buttons, chips, icon buttons | colour `fast`; press `.97` / `.96` / `.92` | §3.6, §3.2 Chips |
| History rows | enter `rise-in` (x −6px) `slow`, stagger 40ms, first load only; delete `exit` then gap closes `base`; row actions reveal opacity `fast` | §3.1 N10, §3.6 B11 |
| Filter switch | outgoing rows `soft-out` `exit`, incoming `rise-in` `base` | §3.1 Mode switch (Adapt) |
Reduced motion: every duration and delay 0, skeleton flat, shimmer = plain secondary text (CONTRACT §4.6).

## 8. Owner decisions (yes / no)
- O1. Accept sufficiency proposals 1–8 from §2 as a block? (default yes)
- O2. Show question timestamps `at 03:35` on cards (needs a per-question start time saved with the session)?
- O3. Partial-session threshold: a verdict needs at least **3** answers (Q11)?
- O4. Answers given with the answer suggester on: still count toward weak spots? (default no: marked "Answered with a suggestion" and excluded)
- O5. In `storageNotWritable`, is "Download debrief" the only primary, with Drill demoted to secondary?
- O6. The real-user fixture stays **Alex Morgan, Product Designer** (ia.md §6 invariants, matches Home and Session), while PM answers appear only in the Sam Rivera example?
- O7. 375 phone layout built as a plain stacked version although mobile is Won't in the PRD — keep it in the review set?

## 9. Open DS decisions touching this screen
1. **Card radius:** code `--radius-lg` 16px vs foundation 10px for cards and rows. This map uses `--radius-md` (10px) for weak-spot cards, question cards, list rows; Panel / composer stay 16px. Recommend aligning `Card` to 10px.
2. **Danger button:** red only for irreversible deletion. Here: `Move to Trash` is a neutral menu item; "Delete permanently" lives only in Trash (`ConfirmPermanentDelete`).
3. **Tooltip G6:** truncated History titles and the 2-line H1 clamp need it; until it lands, `title` + full text in `aria-label`.
4. **Toast G3:** needed for "Moved to Trash · Undo"; until it lands, an `info` (not success) Callout with Undo.
5. **Tint area:** whole weak-spot card and whole layer block tinted (this map), correction rows on raised so `--color-mark-fix` stays visible (on the language tint it is 1.07:1 apart). Alternative: tint only the layer Badge. Check in review.
6. **Skeleton** is in code and exported; `components.md` still lists it "in progress" with 🟡 bar height 10px off-scale → update the index.
7. **Container queries:** `Page` and `AppShell` move from `@media` to `container` queries (pattern change, all screens).
