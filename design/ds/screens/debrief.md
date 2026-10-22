# Composition map: Debrief (+ HistoryList)

> Stage 11, step 2 · 2026-10-20 · ScreenId `Debrief` (variants `interview` · `english` · `example`) + `HistoryList` (Trash out of scope).
> Inputs: `docs/ia/wireframes/debrief.md`, `docs/ia.md` §2, §4, §6 (mock S1–S3, invariants 1–10), `docs/prd.md` US-18, US-19, US-20, US-21, US-23, US-24 AC4, US-29, US-58 AC5, `ds/CONTRACT.md`, `ds/components.md` (G1–G18), `docs/motion.md`, moodboard P1–P8 / R1–R11, D37, D45, D46.
> Replaces today's `screens/Debrief.tsx` (verdict and weak spots split over 3 cards, transcript at the bottom, Delete as a loose ghost button) and `screens/History.tsx` (meta as a "·" line, delete IconButton only, no rename, no filter, success-green notice).
> Legend: 🟡 assumption · **G<n>** = gap from `ds/components.md` §4 · **G19+** = new candidate from this map · R<n> / P<n> = moodboard.

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
| Actions row | `Button primary` (Drill) · `Button secondary` (Practise again) · `Button link` (Back to home) + helper text | — |
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

### 3.1 Header (`interview`, mock S2, user Alex Morgan, invariants 3–5)
1. `Button link sm chevronLeft` **History** → `/history`. Gap below `--space-4`.
2. H1 row (flex, `--space-3`, wrap): **Kestrel Pay · Senior Product Designer** (`--text-3xl`, `--weight-semibold`, `--tracking-tight`, wraps to 2 lines, then clamps with tooltip G6) · `IconButton sm edit` label "Rename session" · `IconButton sm more` label "More actions for this session" → **G4** menu: `Export to Obsidian` (icon `folder`, only when a folder is set, US-23 AC3) · `Download as Markdown` (icon `download`) · separator · `Move to Trash` (icon `trash`, **not** danger: reversible, CONTRACT §2.4).
3. Meta row (flex wrap, gap `--space-4`, `--text-sm`, `--color-text-secondary`, icons `--icon-sm`): `briefcase` Behavioural · Standard · `clock` Oct 19, 20:40 · 24 min · `chat` 5 questions, 4 follow-ups · `check` **Saved on this computer** (`--color-text-tertiary`, US-20 AC5, US-23 AC1; links to Settings → Storage).
4. Rename state (G16 `InlineRename Size=lg`): H1 swaps (`Swap`, `fast`) to `Input HideLabel` label "Session title", value selected, max 80, counter `37 / 80` (`--color-text-tertiary`), `IconButton check` "Save title", `IconButton x` "Cancel"; Enter saves, Esc cancels, empty → error "Add a title, or press Esc to keep the old one." (US-21 AC2).

### 3.2 Verdict (overview, R5)
- Section label **Verdict** (Section title style). Then h2 **Getting there** (`--text-2xl`, `--weight-semibold`, `--tracking-tight`, `--color-text-primary`; no colour, no icon). Line below (`--text-md`, `--leading-relaxed`, secondary, max 60ch): **Clear stories, but 3 of 5 answers end before the result.** No name used (US-20 AC2, GR2).
- Scale row (proposal 3), gap `--space-2`: `Badge outline` Not ready yet · `Badge live icon=check` Getting there (`aria-current="true"`) · `Badge outline` Ready. Screen-reader text: "Verdict: Getting there, the middle of three steps".

### 3.3 Weak spots (key points) — G18 Debrief variant
- Section label **What to work on** + helper `--text-sm` tertiary: **One per layer, from this session.** `<ul>` grid, `--space-4` gap, 3 equal columns (wide), cards stretch to equal height.
- Card: `--radius-md` 🟡 (DS decision 1), padding `--space-5`, background = layer tint, no shadow, `--color-border-subtle` hairline; stack `--space-3`. Order follows `layerOrder` (GR8): content-first = Content, Language, Delivery; delivery-first = Delivery, Language, Content.
  - Head: `Icon content` + **Content** (`--text-sm`, `--weight-semibold`, secondary) — the layer name is text, never colour only (GR10).
  - Title (h3, `--text-md`, `--weight-semibold`): **No measurable result in 3 of 5 answers**
  - Evidence: `Questions` + links **1**, **2**, **4** (`Button link sm`, proposal 4).
  - Fix: **Fix:** (semibold) End every story with a number or a decision: "conversion stayed at 4.1%", "we dropped the second screen".
  - Also (content only, hairline `--color-border-subtle` above, `--space-3`): **Also:** "we" instead of "I" in questions **2**, **4** — say "I" for what you did.
- Language card: **"I have led" for finished projects — 2 times** · Questions **2**, **5** · **Fix:** say "I led" when you name a finished time ("last spring", "in 2023"). Counts only kept flags: "figure file" (marked misheard) and the unchecked word are excluded (GR9, D37 33f).
- Delivery card: **9 fillers per answer on average** · Most in question **4** (12) · **Fix:** pause silently instead of "uh" and "like".

### 3.4 Actions
- Row (flex wrap, `--space-3`, align center), `--space-6` below the weak spots:
  - `Button primary size=lg icon=practice` **Drill these weak spots** + helper (`--text-sm`, secondary): **3 questions on these 4 points · about 12 min** (🟡 Q4) (US-22).
  - `Button secondary` **Practise again** + helper: **Same job and round, new questions**.
  - `Button link` **Back to home**.
- Only one primary on the page (CONTRACT §2.2).

### 3.5 Question by question (outline) — G19 Disclosure cards
- Section label **Question by question** + `Button link sm` **Open all** / **Close all**. `<ol>` of `Card as=li padding=md`, gap `--space-3`, `--radius-md`.
- Collapsed card (≈ 64–76px): header is one `<button aria-expanded aria-controls>` (full width, 44px+ hit area):
  - Line 1: number disc (`--control-h-sm`, `--radius-pill`, `--color-subtle`, `--text-sm` medium) **2** · question (`--text-md`, `--weight-medium`): **Tell me about a time you had to change a design late in a project.** · right: `Icon chevronDown` (rotates).
  - Line 2 (wrap, `--space-2`): `Badge content tinted icon=content` **No result · "we" → "I" ×2** · `Badge language tinted icon=language` **2 phrasings** · `Badge delivery tinted icon=delivery` **11 fillers** · text tertiary: `clock` 2:20 · at 03:35 (proposal 2) · 1 follow-up · **1 marked misheard by you**.
- Mock rows (invariant 4): **1** Tell me about yourself and your current role. — Content **No result** · Language **Nothing to fix** · 8 fillers · 1:50 · 1 follow-up · **3** How do you work with engineers during handoff? — Content **Nothing major to fix** · 6 fillers · 1:35 · no follow-up · **4** Describe a disagreement with a product manager. How did you resolve it? — No result · "we" → "I" · 12 fillers · 3:40 · 1 follow-up · **5** Why do you want to join Kestrel Pay? — Language **1 phrasing** ("I have led") · 8 fillers · 2:05 · 1 follow-up. Totals: follow-ups 4, fillers 45.
- **Expanded card, question 2** (default-open in the `interview` story; region `--space-4` stack, top hairline):
  1. **Follow-up:** What was the result for the merchants? (`--text-sm` secondary).
  2. **Your answer** (`--text-sm` semibold) + text (`--text-md`, `--leading-relaxed`, clamp 6 lines): "Two weeks before launch, legal _give_ us a new requirement: we needed an explicit consent step in checkout. Uh, we redesigned it, and I have led the redesign last spring, so I knew the flow really well. Like, the risk was that one more step kills conversion. We made it more easier for merchants — the consent is now inline with the pay button, not a separate screen. We tested it with five merchants and, uh, we shipped on time." (_give_ = `--color-mark-heard` grey dotted underline, no strikethrough: the unchecked low-confidence word, shown only when the engine gives confidence, Q21.) Footer: `Button link sm` **Show full answer** · `Button ghost sm icon=edit` **Edit what I said**.
  3. **Your follow-up answer**: "We shipped on time and… I think merchants were happy. Support tickets about checkout didn't go up."
  4. Layer blocks in `layerOrder`, each a tinted block (`--radius-md`, padding `--space-4`, head icon + layer name semibold):
     - **Content** — End with what changed: a number or a decision. The result is missing. · "we" → "I" ×2: "we redesigned it", "we tested it" — say "I" for what you did.
     - **Language** — note (`--text-sm` tertiary, `info` icon): **"Heard as" is what speech recognition heard.** Two correction rows, each on `--color-raised` + hairline, `--radius-md`, padding `--space-3`, `<dl>`:
       - **Heard as** "…and **I have led** the redesign last spring, so…" (fragment marked) · **Say** "I **led** the redesign last spring" · **Why** A finished time ("last spring") takes the past simple. · footer `Button ghost sm` **Not what you said?** · `Button ghost sm icon=x` **Dismiss**.
       - **Heard as** "…we made it **more easier** for merchants…" · **Say** "we made it **much easier**" · **Why** "Easier" is already a comparative, so it doesn't take "more".
       - Removed lines (`--text-sm` tertiary, `info` icon): **You marked "figure file" as misheard — not counted.** · **1 word we weren't sure about wasn't checked — not counted.**
     - **Delivery** — `<dl>` 3 columns (wide) / stacked (narrow): **Fillers** 11 · **Length** 2:20, 289 words · **Pace** 124 wpm, comfortable. Tip: Most fillers: "uh" (6), "like" (4) — pause silently instead. Engine note when the recogniser may drop fillers (US-19 AC3 🟡): **Your speech engine may skip some fillers, so the real count can be higher.**
  5. `Button secondary sm icon=sparkle` **Hide the stronger answer** (open in this story, US-20 AC3) → rewrite (`--leading-relaxed`): "Two weeks before launch, legal asked for an explicit consent step in checkout. I led the redesign: instead of a new screen, I put the consent inline next to the pay button, so checkout stayed one step. I tested it with five merchants in three days, and we shipped on time. Checkout conversion stayed at **[your number]**, and support tickets about checkout didn't rise." + note: **Fill in your real number — we never invent results.**
- Card sub-states: **Edited by you** (`Badge neutral icon=edit` next to "Your answer"; US-18 AC3) · **Checking this answer again…** (shimmer G13 + `Skeleton card`, after Save and check again) · **Feedback wasn't available for this answer. It isn't counted in the verdict.** (`Callout info`, US-15 AC5) · **Answered with a suggestion** (`Badge neutral icon=sparkle`, proposal 8).
- "Not what you said?" editor (inline, replaces the row): `Textarea` label **What you actually said**, prefilled "and I have led the redesign last spring", hint **We'll check this question again. The rest of the debrief stays as it is.** · `Button secondary sm` **Save and check again** · `Button ghost sm` **Cancel**. Dismissed row → line **Dismissed — not counted.** + `Button link sm` **Undo**.

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
| `interview-full` | §3.1–3.5, Q2 open, stronger answer open; `delivery-first` twin |
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
| `longText` (+30%) | Title "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools" (2 lines), weak-spot texts +30% (cards stretch, equal height), summary badges wrap to 2 lines, answer clamp 6 lines + Show full answer, `overflow-wrap: anywhere` for long tokens, one card with "Feedback wasn't available" |
| History `data` · `renaming` · `overflow` · `filteredEmpty` · `empty` · `loading` · `error` | §4 |

Every PRD AC: US-20 AC1–AC5 (§3.2–3.5, `partial`, meta) · US-19 AC2 (card summary + Delivery block), AC3 (engine note), AC4 (`partial` Q2) · US-18 AC1–AC3 on debrief rows, AC4–AC5 via `hasConfidence` · US-21 AC1–AC4 (§4), AC5 n/a on screen (storage merge, stage 12) · US-23 AC1 (meta), AC2 (Move to Trash + Undo; restore = Trash screen, out of scope), AC3 (menu item conditional), AC4 (`storageNotWritable`), AC5 n/a (file format) · US-24 AC4 (`english` + History English filter) · US-29 AC1–AC3 (`example`) · US-58 AC5 (badge, proposal 8).

## 6. New DS candidates from this screen
- **G19 Disclosure** — anatomy: header `<button aria-expanded aria-controls>` (slot: leading, title, meta, trailing chevron) · region `role="region"` labelled by the header. Variants `Surface: card | plain` · `DefaultOpen: false | true` · `Chevron: end | none`. States: closed · open · hover `--color-hover` on the header · focus (offset 2px) · disabled. Tokens: Card tokens + `--icon-md`, `--duration-base`. Motion: new row in motion.md (§7). Story `ds-disclosure--card`, `--plain`. Used here 5× + "Show full answer" + stronger answer; later Session transcript.
- **G16 List row** gets sub-part `InlineRename` (`Size: md | lg`) used by HistoryList rows and the Debrief H1.
- **G18 Weak-spot strip** gets `Context: home | debrief` (debrief: tinted cards, evidence links, no Focus chips).
- **Icon `more`** (three dots, horizontal) in `icons.tsx`, same 24 grid / 1.75 stroke.
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
