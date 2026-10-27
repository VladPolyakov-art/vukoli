# Debrief: four ways to organise the feedback

> Stage 11 exploration · 2026-10-27 · product-designer.
> These are variants for the owner to pick from and are not wired into the app; the live `DebriefView` is unchanged.
> Code: `app/web/src/screens/debrief/variants/`. Storybook: **Debrief/Variants** (`Current`, `A_*`, `B_*`, `C_*`).
> Screenshots: `.tmp/screens/debrief-variant-{a,b,c,d}-{1440,375}.png` and `debrief-current-{1440,375}.png`, light theme.
> D was added the same day from the owner's functional asks (see §D); the owner did not pick A, B or C.

## Why

The owner dislikes the current split into three layer columns (Content / Language / Delivery) and asked for three variants before any change ships.

Reading the current page (`debrief-current-1440.png`) as P1 (PRD persona: anxious, non-native, reads the debrief in a burst the evening before an interview), the problem goes beyond looks:

1. **One finding appears three times.** Take "no measurable result":
   - it is a weak spot in the Content column;
   - it is step 1 of the plan;
   - it is the low Result row in the scorecard.

   Three blocks say the same thing in different words.
2. **The columns make the layers look equal, and they are not.** On interviewS2, Content is the gap to "Ready" and Delivery is a habit. P1 has to work out the priority alone (I5: the debrief should drive the next session).
3. **The page is long.** At 1440 the questions part starts 1835 px down, so the plan (the thing to do next) sits at the bottom of a long page.

All three variants keep the following:
- the verdict with the scale step and the line that names the gap (D99);
- weak spots with "What you said → How it lands → How to fix" and question links (AC7);
- the plan and the drill (AC8);
- the 7-row scorecard with lost-points links (AC6);
- the per-question breakdown;
- the header toolbar with "Conversation | Debrief" and **Practise again**.

They differ in what organises the page.

| | A · One main focus | B · Skills, weakest first | C · Question by question | D · Question switcher |
|---|---|---|---|---|
| Organised by | Priority (plan step) | Skill (scorecard row) | Question | Question, one at a time |
| Layers shown as | Small tinted tags (Q2-b) | Icon + name under the skill | Rows inside each question card | A small tinted tag on each note |
| Scorecard | Folded to one line "Lowest: …" | **Is** the page | One strip of 7 numbers | One average score; the scorecard opens on hover, to its side |
| Plan | Step 1 = hero, steps 2–3 = list | Card next to the verdict | One line under each takeaway | One block, a line per step, with the drill |
| Questions part starts at (1440) | 1393 px | 1621 px | **883 px** (and all questions are open) | **672 px** (switcher, v3); question 1 heading at 799 px |
| Same at 375 | 2623 px | 2677 px | 1907 px | **1358 px** (1.7 screens of 812); heading at 1468 px |
| Whole page at 1440 | 2709 px | 2937 px | 3340 px | **1491 px** (one question shown) |
| Current, for reference | 1835 px at 1440 · 2982 px at 375 · 3171 px whole page ||||

## A · One main focus

**Idea.** The debrief answers one question first: what to do before the next session. The top weak spot, in the configured layer order (GR8), becomes one hero card. It is step 1 of the plan and holds the one primary.

The other weak spots follow as a short ranked list (steps 2–3). Weak spot and plan step become one thing, so there is no separate "Plan" block.

**Composition map (top to bottom)**
1. `Header`, unchanged: title, meta, toolbar (`Segmented` + `PractiseAgain`).
2. Verdict: headline (`--text-3xl`), the model's line, then on one row `ScaleBadges` + the D99 line ("To reach Ready: …").
3. Hero: `Card padding="lg"` with `--shadow-raised`.
   - Eyebrow: "Start here · Step 1 of 3 in your plan" + `LayerTag`.
   - `h2` with the spot title, then "Seen in questions 1, 2, 4" (`QuestionLinks`).
   - "You said in question 1" → "Stronger version of question 1", stacked on the right half at ≥840.
     - The stronger side comes only from saved data: the stronger answer for content, the first correction for language, nothing for delivery ("Measured 12 fillers in 3:40").
   - `dl`: How it lands / How to fix / Also.
   - Footer: "Your first step" + plan text, with the primary `Button` "Drill these weak spots" and its hint.
4. "Then": steps 2 and 3, two columns at ≥840.
   - Each has a number disc (`card.num`), title + `LayerTag`, the fix, "Plan, step n: …" and the evidence.
   - "What you said and how it lands" sits in a `Disclosure surface="plain"`.
5. Scorecard: `Disclosure` card, closed, meta "Lowest: Lessons learned 1/5 · Structure (STAR) 3/5 · Result 3/5". Open, it is a 2-column grid of `ScoreMeter` + lost-points links + the "Not asked this time" line.
6. Question by question as today: `Segmented` picker + `QuestionCard fixed`.

**Persona fit.**
- P1 in a burst gets one thing to do, its proof and a better version of their own words in the first screen. This is the I5 loop (debrief → next session) at its shortest.
- S (stress persona) gets one decision instead of nine blocks.
- The "Stronger version" next to "You said" is the strongest teaching moment on the page (P8: a fix, not an error).

**Trade-offs.**
- The scorecard is folded. AC6 says the scorecard "shows" below the verdict 🟡, so this needs the owner's yes or an AC change.
- Steps 2–3 look secondary even when they are close in weight.
- Delivery-first order (story `A_DeliveryFirst`) puts a number in the hero, and a number has no "stronger version", so the hero is plainer.
- "Measured / You said" needs the evidence's first question to have a quote.

**Moodboard.**
- R6/R7 and P4: one thing per screen, nothing extra.
- R11 and P8: a fix shown inside your own sentence, with "a better version".
- P1: monochrome; the only black is the primary.
- Q2-b: layer tint only on the small tags.
- R5 (Otter summary, 🟡 structure only): summary first, details on demand.

## B · Skills, weakest first

**Idea.** The scorecard becomes the page. One list of the seven skills, weakest first, replaces the three layer columns and the separate scorecard.

Each row has:
- the score;
- "Needed for Ready" when the row is in the D99 gap;
- the weak spot that explains it (title + fix), or a one-line tip;
- the questions that lost points;
- What you said / How it lands behind a fold.

The plan and the drill sit next to the verdict.

**Composition map**
1. `Header`, unchanged.
2. Top grid (`1fr | 22rem`, one column under 840):
   - Verdict: label, headline, line, `ScaleBadges`, D99 line.
   - Plan `Card`: "Your plan for the next session", an `ol` of up to 3 steps, each with its layer icon + name; the primary Drill button + hint.
3. "Your skills in this session": `SectionHead` + sub "Weakest first. Practice scores from this app's rubric, not a hiring prediction." + the misheard note.
4. Rows on a 3-column grid (`13rem | meter | 1fr`; under 640 the meter wraps beside the name):
   - Name + layer icon/name + outline `Badge` target "Needed for Ready".
   - `ScoreMeter` (5 segments + "3/5", the scorecard's own grammar, no status colours).
   - Main: spot title + fix (or 🟡 `ROW_TIP`, or "No points lost."), "Lost points in questions …", `Disclosure surface="plain"` with `LayerTag` + said / lands / also.
5. "Not asked this time" line for null rows, then Question by question as today.

**Persona fit.**
- P1 sees "which skill is weakest and what blocks Ready" without having to translate layers into skills. The rows map 1:1 to the rubric and the D99 line.
- It is the closest to the PrepLab pattern (verdict + competencies + quotes, `docs/research/competitors/preplab.md`) and the most "honest" view: every score is visible and explained.
- It suits a return visit ("did my Result go up?").

**Trade-offs.**
- It is the longest of the three and the most "report-like". On a burst evening P1 has to scan 7 rows to find the first action; the plan card on the right carries that.
- Rows without a weak spot need a tip. `ROW_TIP` is new content written from the rubric (§2.3, §9.3) 🟡 and needs the owner's yes plus a rubric table.
- Mapping a content weak spot to a row is a heuristic in the client, plus an explicit `contentRow` override in the stories. 🟡 The server knows the rubric tag (`no_result` → Result) and should send the row.
- The plan sits at the top, not at the end. AC8 says "ends with a plan" 🟡.

**Moodboard.**
- R5 (structure of a summary 🟡).
- P1: the meter is monochrome segments, never red or green; P8 says so.
- P4: one list instead of three blocks.
- Q2-b: the tint appears only inside an opened row.

## C · Question by question

**Idea.** The person remembers the interview as questions, so the debrief follows them. A short summary fits in one screen at 1440:
- verdict + drill;
- three numbered takeaways (= the weak spots with their plan step);
- the seven scores as one strip.

Then every question is an open card with its content, language and delivery notes in rows and the corrections inline. There is no picker: the whole interview reads top to bottom.

**Composition map**
1. `Header`, unchanged.
2. Verdict row: headline, line, `ScaleBadges`, D99 line on the left. The primary Drill button + hint on the right (full width under 560).
3. "Three things to take away": `ol`, 3 columns at ≥840, one column below. Each item has a number disc, title, fix, `LayerTag` + evidence links, and "Plan, step n: …".
4. "Scores": the line "Practice scores out of 5, not a hiring prediction." + misheard note, then an auto-fit strip of 7 cells. Each cell has label, value "3/5" and lost-points links; 2 columns under 560. Then the "Not asked this time" line.
5. Question by question: sub "5 questions, in the order Mike asked them. Each one has its own notes."
   - `ol` of cards (`--color-surface-card`, `--radius-md`).
   - Each card's heading: number, question as `h3` (focus target for every evidence link), facts (time, at, follow-ups, misheard marks), then "Lost points on: Structure (STAR), Result, Delivery" or "No points lost in this answer.".
   - `dl` with one row per layer in the configured order:
     - Content items.
     - Language: compact corrections "heard → say" + why, with ghost buttons "Not what you said?" / "Dismiss" and `RemovedLines`.
     - Delivery: metrics on one line + tips.
   - A `Callout` when an answer is unavailable (long-text story, q3).
   - `Disclosure surface="plain"` "Your answer and a stronger version" (follow-up, answer, Edit, the stronger answer with the strong left rule).

**Persona fit.**
- The fastest summary (883 px vs 1835 today). Every claim sits next to the answer it is about, so P1 can check "did I really say that?" without jumping (US-18 trust, misheard marks visible in place).
- Good for the night before: read the summary, then skim your own five answers.
- The layers stop being columns and become three short rows per answer, which is exactly what the owner asked to lose.

**Trade-offs.**
- The longest page overall (5 open cards; 5717 px at 375), and the answers' text is behind a fold to keep it in check.
- The summary is dense: three columns of small text at 1440.
- The scores strip drops the meters (numbers only) to stay one line.
- The plan is spread across the three takeaways, not one list. AC8 wording 🟡.
- The drill sits above the takeaways that explain it.

**Moodboard.**
- R5 (Otter: summary first, then the transcript in order, Q3 "both").
- R11 and P8: corrections inline in your own sentence, one line each, dismissable.
- P3: reads like a chat log you scroll.
- P4 and P1: monochrome cards; the tint only on the takeaway tags (Q2-b).

## D · Question switcher (from the owner's functional asks)

**Brief (owner, 2026-10-27, voice, gist).** Start from what the user must be able to do, not from the layout:
1. hide the scorecard and give one final score; expand it to see where the gaps were;
2. walk through every question with a switcher: see how you answered and the feedback on it;
3. scroll less: click 1, 2, 3 and read one thing at a time.

**v2 — the owner's notes on D (voice, 2026-10-27), было → стало.**

| # | Note | Было (v1) | Стало (v2) |
|---|---|---|---|
| 1 | The scale under "Getting there" reads as random objects | Three chips "Not ready yet · Getting there ✓ · Ready" (`ScaleBadges`) with the "To reach Ready" line wrapping beside them | **"Your level"**: one track of three equal segments, filled up to the current step, the names under their segment (current one in primary, semibold; the rest tertiary). No borders, pills or hover: nothing looks pressable. One `role="img"` sentence for screen readers. "To reach “Ready”: …" on its own line below |
| 2 | Open the scorecard from the score, not from a separate fold | `Disclosure` "Where you lost points" between the summary and the plan | The fold is gone. The score is the trigger: "3.3/5 · Average of 7 skills · <u>See skills</u> ⌄" (hover fill, chevron turns). Mouse hover = preview after `--duration-slow`; keyboard focus = preview; click / tap / Enter / Space = pinned. Pinned closes on Esc, ×, a press outside or a question link (the link switches the viewer). Inside: "Your skills, weakest first", the rubric note, 7 rows with `ScoreMeter` and "Lost points in questions 1, 2, 4" links, "Not asked this time", the misheard note. Below 640 px of overlay width it is a full-width sheet under the score (the Menu's narrow rule) |
| 3 | What if there are more than 10 questions | 10 equal tabs; numbers only under 640 by a container query | **Overflow rule** (server caps at 10, 12 = degrade case): (1) labels while each tab gets ≥ `--tab-min` 8rem of the bar; (2) otherwise numbers only, and Previous / Next icon buttons at the bar's ends; (3) when the numbers (≥ `--control-h-touch` each) do not fit, the strip scrolls sideways with an edge fade on the side that has more, and the selected tab is always scrolled into view (sideways only, the page never jumps). The bar stays one row. Footer Previous / Next are always there (disabled at the ends; the last reads "Last question"). Stories `D_TenQuestions`, `D_TwelveQuestions`, `D_TwelveQuestionsMobile` |
| 4 | The body is narrower than the header row | Header and icons to x≈1399, summary / plan / viewer stop at the 960 px reading column (x≈1240) | One content width: the D body drops the reading-column cap (`VariantPage bodyClassName`). Right edges, measured: 1440 → icons, summary, plan, viewer all at **1399**; 1024 → **991**; 375 → **358** |
| 5 | Meta row | — | Unchanged; it now shares the body's right edge (note 4) |

**v3 — the owner's notes on D v2 (voice, 2026-10-27), было → стало.** «Your level — сделать классный прогресс-бар… skills чтобы вбок, а не вниз… при наведении, а не при нажатии.»

| # | Note | Было (v2) | Стало (v3) |
|---|---|---|---|
| 1 | "Your level" as a real progress bar | Three flat dashes, filled up to the step | **Progress toward Ready** that keeps the three steps named and marks the user's place. Three looks for the owner, same four states each (`D_Level_A/B/C`, `debrief-level-{a,b,c}.png`): **A · Track** (default in D): one rail, a notch at "Getting there", a ring marker at the user's place, names under the stops; **B · Journey**: three discs on a thin line (passed = check, current = ring with a dot), the line fills toward the next; **C · Blocks**: the steps as "Not ready yet › **Getting there** › Ready", then one cell per skill that counts. All: caption "**3 of 7 skills at 4/5 or more** · 4 to go to “Ready”", the D99 line under it, the fill grows once on load (`--duration-slower` `--ease-enter`, clip-path; 0 under reduced motion via global.css), monochrome, one `role="img"` sentence |
| 2 | Skills open to the side, not down | Popover under the score, over the plan | **To the left of the score, top edges aligned**, as wide as the room up to the content's left edge allows (max `--layout-dialog` + `--space-16` = 624 px; two columns of skills from 30rem, so it is 394 px tall at 1440). Fallback when the room is under `--layout-panel` − `--space-10` (400 px, e.g. the score wrapped under the verdict): under the score, right-aligned; under 640 px of overlay width: the full-width sheet. Measured: 1440 → 624–1247 px, 1024 → 272–839 px (one column of 2, 463 px tall), 375 → sheet 17–358 |
| 3 | Hover opens it, no click | Hover = preview, click = pin | **Hover opens it** after `--duration-fast`; the pointer can travel into the panel (grace `--duration-slow`, a diagonal move does not close it) and click its links; leaving both closes it. A mouse click changes nothing (no pin step). Fallbacks keep it open until Esc, ×, a press outside or a link: keyboard focus (preview), Enter / Space (focus moves to its heading), a touch tap (tap again closes). The cue: "Average of 7 skills" with a **dotted underline** and an info icon, `cursor: help`; "See skills ⌄" and the chevron are gone |

**v3.1 — the owner's decisions on v3 (2026-10-27), было → стало.** «Вариант C» · «чтобы убрались вот эти прогресс-бары… просто была оценка без этих чёрточек».

| # | Decision | Было (v3) | Стало (v3.1) |
|---|---|---|---|
| 1 | Level look: **C · Blocks** (open question 7 → decided) | A · Track by default; A/B/C side by side | **C is the default** in `VariantD` and every D story (`level = "blocks"`). A · Track and B · Journey stay in code only for the `D_Level_A/B` stories (comparison record); drop them when the live debrief takes `LevelProgress` |
| 2 | Skills panel without the small meters | Each row: name · `ScoreMeter` (5 dashes + "3/5") · lost points | Each row: **name · "3/5"** (`--text-md`, semibold, tabular figures, right-aligned in its own column) · "Lost points in questions 1, 2, 4" / "No points lost.". Screen readers get "3 out of 5". Weakest-first order and two columns from 30rem stay. The panel's max width is now `--layout-dialog` (560 px; was + `--space-16` = 624): the rows no longer need the meter's room. Measured at 1440: 688–1247 px, 560 × 415 (taller than v3's 394 because the misheard note wraps once more in the narrower panel); 1024: 280–839 px, 415 tall; 375: sheet |

**Composition map (top to bottom, v3)**

| # | Block | Built from | Owner's ask |
|---|---|---|---|
| 1 | `Header`, unchanged (title, meta, `Segmented` view switch, `PractiseAgain`) | existing parts | — |
| 2 | Summary: verdict headline (`--text-3xl`), the model's line, **"Your level"** progress (look C · Blocks, decided v3.1), the D99 line; on the right **the final score**, which shows the skills on hover: "3.3/5 · <u>Average of 7 skills</u> ⓘ" (dotted underline) | local `LevelProgress`, `levelProgress`, `ScoreSkills`, `verdictLine` | 1 (final score), v3 notes 1, 3 |
| 2a | Skills panel (hover card, to the left of the score): title + ×, rubric note, 7 rows weakest first in two columns (name · "3/5" in a right-aligned column, no meter (v3.1) · lost-points `QuestionLinks` or "No points lost."), "Not asked this time", misheard note. The Menu's surface (`--color-raised`, `--shadow-overlay`, `--radius-lg`), vertical scroll inside, never sideways | `OverlayPortal`, `place` / `useOutsidePress` / `focusables` (`ds/overlay`), `IconButton`, `QuestionLinks` | 1 (see the gaps), v3 notes 2–3, v3.1 note 2 |
| 3 | Plan + drill: one `Card`, heading row "Your plan for the next session" + drill hint + the primary **Drill these weak spots**; then up to 3 lines: number · **weak-spot title.** plan step · "Questions 1, 2, 4" links | `Card`, `Button`, `QuestionLinks`, `drillHintText` | 3 (one block, no separate weak-spot section) |
| 4 | **Question viewer**: a switcher that sticks to the top of `<main>` (`position: sticky`, `--z-sticky`, `--color-canvas`), then exactly one question | local `role="tablist"` + `Swap` | 2, 3 |
| 4a | Switcher: one tab per question. Labels mode: number disc + the question's text clamped to 2 lines. Numbers mode (by measured width, not by breakpoint): number discs, `‹ ›` at the ends, sideways scroll + edge fade past the fit. Selected: black number disc + the strong underline. ←/→/Home/End move and select (`ds/roving` `nextIndex`). `?q=n` in the URL | local, `nextIndex`, `IconButton` | 2, v2 note 3 |
| 4b | Question: "Question 2 of 5 · 2:20 · at 03:35 · 1 follow-up · 1 marked misheard", the question as `h3` (focus target for every question link), "Lost points on: …" | local | 2 |
| 4c | Two columns ≥840 (one below): **left** follow-up question, "Your answer" + "Edit what I said", follow-up answer, `Disclosure plain` "Show a stronger answer"; **right** "Feedback": one list of notes, each with a small `LayerTag` (weak spot with What you said / How it lands / How to fix, content items, language corrections inline, delivery metrics + tip); `RemovedLines`; `Callout` when feedback is unavailable | `Disclosure`, `Marked`, `Said`, `LayerTag`, `RemovedLines`, `Callout` | 2, no layer columns |
| 4d | Footer: "Previous" (ghost) · "Next: question 3" (secondary), both always present, disabled at the ends | `Button` | 3 |

**Behaviour.**
- Any question link (popover, plan) switches the viewer and scrolls the viewer's top into view, then focuses the question heading. A popover link closes the popover first.
- Switching keeps the place: if the reader has scrolled into a long answer, the viewer comes back to its top (under the sticky switcher).
- The panel has a height floor (`--space-16 × 7`). The swap is the DS `Swap` (motion.md 3.1); the popover fades in `fast` like the Tooltip; the chevron turns `base`.
- Skills panel focus: opened with Enter / Space, focus goes to its heading; Tab walks the question links; Tab past the last (or Shift+Tab past the first) closes it and returns focus to the score; Esc closes and returns focus. The hover card is reachable by the pointer and dismissable with Esc (WCAG 1.4.13).
- 🟡 The level position is derived, not in the rubric: between two steps the bar fills by the skills already past the next step's bar (Not ready yet → Getting there: answer rows at 3/5+; Getting there → Ready: every shown row at 4/5+). "N to go" equals the verdict's `gap` exactly (verdictStep.ts), so the caption and the D99 line never disagree.

**Checked in Storybook (port 6006, Playwright), v3.**
- Skills at 1440 and 1024: hover the score → opens to the left (`data-side="left"`), top aligned with the score (212 / 212 px); a 12-step diagonal move to link "4" keeps it open; clicking "4" closes it, the viewer shows question 4, its heading is focused. Hover then leave → closed after the grace. Mouse click → stays in hover mode, leaving closes it (no pin). Focus-visible → open; Enter → focus on the heading; Tab Tab → link "2"; Esc → closed, focus on the score. No console errors.
- 375 (touch): tap → sheet under the score, stays open; tap link "2" → closed, question 2; tap, tap → closed.
- Level looks A/B/C: four states each (Not ready yet 2 of 4, Getting there 3 of 7, Getting there 5 of 6 with English not asked, Ready), no console errors.

**Checked in Storybook, v2 (kept for the record).**
- Popover at 1440: hover → preview; leave → closed; hover onto the panel → stays; click → pinned and stays after the pointer leaves; Esc → closed, focus on the score; Tab to the score → preview; Enter → pinned, focus on its heading; Tab → × then link "2"; link "4" → closed, viewer on question 4, heading focused; press outside → closed. No console errors.
- Popover at 375 (touch tap): pinned, full-width sheet 341 px wide at the 17 px gutter.
- 12 questions at 375: opens on 9 with the strip scrolled to 197 px, 9 in view, fade on both sides; →×3 → 12 in view; Home → 1, scroll 0; bar "Next question" → 2.
- 1024: five labelled tabs still fit (720 px bar). 10 and 12 at 1440: numbers only, one row, no scroll.

**Owner's goal measured (v3.1 with Blocks; v3 Track and v2 in brackets).**
- 1440: switcher at **675 px** (672; 652; v1 743), question heading at 802 px; whole page 1495 px.
- 375: switcher at **1358 px** (1358; 1338; v1 1406), heading at 1468 px.
- 1024: 773 px. Example: 851 px. Long text: 792 px. 10 / 12 questions at 1440: 675 px.

**Checked, v3.1.** Fresh load (no HMR) of every D story and D_Level_A/B/C: no console errors. Hover at 1440 / 1024, tap at 375: as v3. `tsc` clean, lint only the known `src/uui/styles/theme.css:277`, tests 44 files / 339 passed.

**Persona fit.**
- P1 in a burst sees the step, one number and the plan with the drill on the first screen, then walks their own answers one by one (I5, US-18 trust: the note sits next to the exact answer).
- "Your level" now reads as a position on a path, not as three buttons: closer to P1's "how far am I" question.
- S (stress persona) never faces a long page: one question, one list.

**Trade-offs.**
- One number is new: "Average of 7 skills" is a plain mean, not in rubric §9 🟡. It can read as a grade (AC9 bans grade labels, not numbers) and can disagree with the step. Owner decides.
- The scorecard is behind the score (AC6 says it "shows" below the verdict 🟡). A hover-only reveal would hide it from touch and keyboard, so click / tap / Enter pin it too.
- The plan sits above the questions (AC8 "ends with a plan" 🟡).
- Full width at 1440 makes the "To reach Ready" line and the plan steps one line each; the answer and feedback columns are ~540 px each, still a comfortable measure. The model's line keeps `60ch`.
- Numbers-only tabs hide the question's text from sighted users; it stays in the heading right below and in each tab's accessible name.
- The 10 / 12-question stories reuse answers 1–5 with new question texts (layout stress set), and the header meta still says "5 questions".

**Moodboard.**
- R6/R7 and P4: one thing at a time, nothing extra; the scorecard is one hover away.
- R5 (Otter: summary first, then the talk in order).
- R11/P8: corrections inline in your own sentence, dismissable.
- P1: monochrome; the black is the one primary, the selected number and the reached level.
- Q2-b: tint only on the note tags.

**Local pieces (D) — DS candidates if D is chosen.**
- `QuestionTabs` (the switcher): anatomy `‹ · number disc · label (clamped) · ›`; `Density: labels | numbers` (auto by `--tab-min`), `Overflow: fit | scroll` (edge fade), `Sticky: on | off`. The DS `Tabs` takes one-line string labels only.
- `HoverCard` / `Popover` (the score's skills): anchored panel, `Trigger: hover | click`, `Side: left | bottom`, `Narrow: sheet`, title + close, focus rules above. Built on `ds/overlay` (`place`, `useOutsidePress`, `focusables`, `OVERLAY_NARROW_MAX`) + `OverlayPortal` and a local side placement (`useSidePanel`): `ds/overlay` places only below, above or to the right. The DS has `Menu` and `Tooltip` but nothing for interactive content.
- `LevelProgress` (v3): `Step: 0 | 1 | 2`, `Position: 0…1` (derived 🟡); look decided: **Blocks** (v3.1), so the DS version needs no `Look` prop. Could replace `ScaleBadges` in the live debrief.
- The skills panel is now a **hover card** (`Trigger: hover + focus | tap`, `Side: left → bottom → sheet`) rather than a click popover.
- New strings in `copy.ts`: levelCaption, levelToGo (v3; seeSkills removed); skillsTitle, close, level, levelSr, prevQuestion, nextQuestion, lastQuestion (v2); average, averageSr, outOf, questionOf, questionsNav, feedback, prev, nextQ, fromWeakSpot (v1). `lostWhere` removed.
- `shared.tsx`: `VariantPage` takes an optional `bodyClassName` (D uses it to drop the reading-column cap; A/B/C unchanged). `FullStage` ignores the query string when it marks the current session.

**Open (owner's side question, not built).** Why only 5 questions per session?
- The server default is `questions_per_session = 5`, configurable 1–10 in Settings.
- D now handles 10 (and degrades to 12+) by the overflow rule above.
- "Go deeper into a topic" was mentioned for later; it would need its own PRD story.

## What is local, what is new

- **No new DS components.** Everything is composed from `app/web/src/ds` (Badge, Button, Card, Disclosure, Icon, Segmented, Callout) and the existing debrief parts (Header, PractiseAgain, SectionHead, Said, QuestionLinks, QuestionCard, Marked, RemovedLines, drillHintText, verdictLine, the scorecard's CSS module), all reused read-only.
- **Local to `variants/`:**
  - `shared.tsx`: `VariantPage`, `QuestionPicker`, `ScaleBadges`, `ScoreMeter`, `LayerTag`, the helpers `weakestFirst`, `orderedSpots`, `orderedPlan`, `spotRow`, `rowsLostIn`.
  - `FullStage`, which is story-only: the page in the full shell at a real width, grown to its content for full-page screenshots.
  - When a variant is picked, `ScoreMeter` (now in two places: `parts/Scorecard.tsx` and here) and `LayerTag` are candidates to lift into `parts/`, not into the DS.
- **New strings** live in `variants/copy.ts` (GR3 deviation for the exploration only). When a variant is chosen they move to `i18n/en.json` under `debrief.*`:
  - startHere, planStep, seenIn, youSaid, measured, stronger, firstStep, planStepLabel, then, detail, scorecardMeta;
  - skills, skillsSub, holds, noPointsLost, weakSpot, planCard;
  - takeaways, takeawaysOne, scores, scoresSub, lostOn, noLoss, answerAndStronger, questionsSub, heardAs, say.
- **Data the variants need from the server** (🟡, not built):
  - the scorecard row for each weak spot (B, and A's "Lowest" meta);
  - the plan in the configured layer order. The client sorts it now; rubric §9.3 says the server builds it in that order, but the fixtures are content-first.
- **Tokens:**
  - Only semantic tokens; `calc()` only over tokens.
  - Container queries on `page` (840 / 640 / 560).
  - Min text `--text-sm` (14 px); radii md/lg.
  - One primary per view (the Drill button); blue nowhere.

## Open questions for the owner

1. Which organising idea: A (priority), B (skills), C (questions) or D (one question at a time, from the owner's functional asks)? Hybrids are cheap, for example:
   - C's summary + A's hero;
   - B's rows inside A's scorecard fold;
   - D's switcher under A's hero.
2. A folds the scorecard and D puts it behind the score (popover): is that acceptable under AC6, or should it stay open?
3. All four move the plan up from the end (I5). Should AC8 change from "ends with a plan" to "the plan is the first thing after the verdict"?
4. B's one-line tips for rows without a weak spot (`ROW_TIP`) are new content. Keep them (then they need a rubric table), or show only "Lost points in questions …"?
5. D: keep the one final score ("Average of 7 skills", 🟡 not in the rubric), or show the step only?
6. Questions per session: keep the default of 5 (1–10 in Settings), or change the default? "Go deeper into a topic" is noted for later.
7. ~~D "Your level": look A, B or C?~~ **Decided 2026-10-27: C · Blocks** (default in D; A/B only in `D_Level_A/B`). Still open: is the derived position between steps (🟡 "3 of 7 skills at 4/5 or more") acceptable as rubric content?
