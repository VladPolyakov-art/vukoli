# Composition map: Tough talk — Tough questions + Negotiate salary

> 2026-11-08 · `product-designer` · stage-11 style map for F68–F72 (D113, D114, D115). Spec: `docs/features/tough-talk/prd.md` (§3, §5, §8, §9). Code map: `docs/features/tough-talk/code-map.md`.
> Builds **only** from the DS: `ds/CONTRACT.md`, `ds/components.md`, `ds/foundation.md`, `docs/motion.md`. Extends `home.md` §3.3 / §4, `session.md` §V2, `debrief.md` §3.0b / §4. Rules not repeated here: D101 (light theme, Debrief first), D107 (no feedback panel), D108 (modals close outside; no paid / premium mentions), D109 (frames), D112 (no mode dropdown).
> Modes: `tough` = **Tough questions**, `negotiate` = **Negotiate salary**. Fixture: Alex Morgan, Senior Product Designer; Kestrel Pay job post "EUR 85,000–98,000"; target 96,000; Firm style.
> 🟡 = default taken here, open to the owner at review. No new visual style anywhere: monochrome, status colours only for system states, selection = checked tokens.

## 0. Principles applied
- **Same shapes as the English track** (owner's chat-style setup, D47): Mike asks, quick-reply chips answer, a plan card closes the setup; one primary per view (Start).
- **Calm studio (PRD §5.5):** tactics are offered, never forced; Hint is on demand; nothing appears while the user speaks (GR6).
- **Hidden state stays hidden until End (US-67):** no ceiling, floor, round cap or "they can go higher" in the setup, the island, the hint or the More menu. The range Mike had is revealed **only in the debrief** (US-70 AC1).
- **Numbers are said, not guessed:** non-native speakers lose numbers to speech recognition, so typing a number is always one key away (T), and the first-time tip says so.

## 1. DS coverage
| Need | DS component / pattern |
|---|---|
| Home mode chips, theme / style quick replies, History filters | `Chip` + `ChipGroup` |
| Setup messages | `ChatMessage` (G22), `Composer` (G1) |
| Numbers form | `Card subtle` + `Field` Input / Select + `Checkbox` + `Button secondary` |
| Plan card | `parts/PlanCard.tsx` (home.md §4.9) + `Menu` radio for Change + `Dialog` for numbers |
| Tactic tiles, hint, debrief tactic links | **TacticCard (DS candidate, §9)**, built from `Card` / note rows |
| Island Hint | `IconButton md` `bulb` `pressed` + `Kbd` in `ShortcutsDialog` |
| Debrief frames | `parts/Frame.tsx` (Card + h2), `Badge outline / neutral`, `Disclosure plain`, `Callout info`, `QuestionTabs` |
| History / Recents | `ListRow`, `Badge outline`, `EmptyState`, `NavRow` end slot (`.track` text) |

Icons (existing set only): Tough questions `hand` (pushback, "hold on"), Negotiate salary `target` (your target number), Hint `bulb` (free: the suggester is hidden in both modes). 🟡 `hand` is also Interrupt in the island, `target` is Settings → Practice; contexts never meet. Dedicated glyphs = §9 gap 5.

## 2. Home

### 2.1 Chips `Home/Suggestions` (US-62 AC1)
Five chips do not fit one row of `--layout-narrow` (≈ 800px of chips), and home.md caps a row at 3. **Two ChipGroups, centred, `--space-2` between rows**:
- Row 1 `ChipGroup group` hidden label "Suggestions": the personal chips (max 2).
- Row 2 `ChipGroup group` hidden label "Other practice": the three practice modes, always the same order.

| State | Row 1 | Row 2 |
|---|---|---|
| First visit | `chat` "General questions" · `eye` "Show me an example" | `chat` "Practise English" · `hand` "Tough questions" · `target` "Negotiate salary" |
| Returning | `briefcase` "Kestrel Pay again" · `content` "Drill my weak spots" (or `folder` "Another saved job") | same three |
| English track | unchanged (English topic chips, home.md §3.3); no Tough / Negotiate chips (D112: back to modes via New practice) | — |

375: each row wraps on its own, centred; row 2 becomes 2 + 1. A chip is a one-shot action: its label goes in as the user's first message and the setup chat starts (same motion as English, home.md §4.1). `?track=tough|negotiate` opens the same chat (AC5).

### 2.2 Shared setup rules
Header row "Setting up with Mike" + "Step n of m"; "Skip questions" (ghost sm) fills defaults and jumps to the plan. Quick replies vanish once answered (bubble only). Footer under the composer: "Practice only: no help during real interviews." Composer placeholder follows the turn (below). Text typed while a form is open goes to the plan's note, Mike: "Noted. Fill in the numbers above when you're ready."

### 2.3 Negotiate salary — `Setup/NegRole`, `Setup/NegNumbers`, `Setup/NegStyle`, `Setup/NegPlan`
| Turn | Mike says | Quick replies / input | Free text |
|---|---|---|---|
| **N-1 Role** (skipped when a job is attached or matched) | "Which role are we negotiating for? Pick a saved job and I'll take the range from the post, or type the role." | `briefcase` 3 newest saved jobs ("Kestrel Pay" · "Lumen Health" · "Fieldnote") + `edit` "No job, I'll type it" | role title, ≤ 80 chars; placeholder "Type the role, e.g. Product Designer" |
| job picked | "Kestrel Pay, Senior Product Designer. The post says 85,000–98,000 EUR." · no range: "Kestrel Pay, Senior Product Designer. The post doesn't list a range, so add your numbers." | — | — |
| **N-2 Numbers** | "What numbers are we working with? Your target is the yearly base you'd be happy to sign for." | inline numbers card (§2.4) | goes to the note |
| **N-3 Style** | first: "How tough should I be? For a first try, Friendly is a good start." · returning: "Same as last time, Firm?" | "Friendly · easy" · "Firm · medium" · "Tight budget · hard" · "Surprise me" (returning: "Yes, Firm" · "Easier: Friendly" · "Harder: Tight budget" · "Surprise me") | words "friendly / firm / tight / surprise" match |
| **Plan** | "Here's the plan." + PlanCard (§2.6) | — | to the note |

Header: "Step 1 of 3" (job matched: "Step 1 of 2"). Default style (US-64 AC2) = Friendly first time, else last used. Answered N-2 collapses into a user bubble: "85,000–98,000 EUR · target 96,000 · no competing offer".

### 2.4 Numbers card `Home/Setup/NegNumbers` (US-63)
Inside Mike's message: `Card subtle` `Padding: md`, `--radius-md`. Grid two columns from 560 (`page`), one below; rows `--space-3`.
- `Input` **Role** (required; prefilled from the job title, AC3; hidden when N-1 gave it, shown in the plan instead).
- `Input` **Job range, from** · `Input` **to** (optional pair, `inputmode="decimal"`, Adornment = the currency code as `--color-text-tertiary` text). Prefilled → hint with Icon `info` sm: "From the job post — check it".
- `Input` **My target** (required, same format) · `Select` **Currency**: USD · EUR · GBP · CAD · AUD · CHF · PLN · "Other…" (then `Input` "3-letter code", e.g. SEK). Under the row, `--color-text-tertiary`: "Per year".
- `Checkbox` **I have a real competing offer** (default off) + description "Mike counts it as a reason only when it's real."
- Note (`--text-sm --color-text-secondary`, Icon `info` sm): "Use a number you researched yourself. Vukoli has no salary data. Mike's budget is built from these numbers."
- `Button secondary` **Use these numbers** (not primary: Start is the view's one primary). Enter in any field submits. Disabled until valid; reason under it: "Add the role and your target to continue."
- Remembered values (AC6): last values per job, else last used; prefilled silently.

**Validation** (inline Field error, icon + text, `role="alert"`, on blur and on submit; never status-coloured beyond the Field's own error stroke):
| Case | Field | Message |
|---|---|---|
| empty role / target | Role / My target | "Add the role you're negotiating for." / "Add your target." |
| not a number | any amount | "Use numbers only, like 95,000 or 95k." |
| ≤ 0 | any amount | "Use a number above zero." |
| one range end | the empty end | "Add both ends of the range or leave both empty." |
| to < from | to | "The top of the range is below the bottom. Check the order." |
| target < from | My target | "Your target is below the range. Use at least 85,000." |
| other code ≠ 3 letters | code | "Use a 3-letter code, like SEK." |
| target > to (allowed) | hint, not error | "Above the posted range: Mike's budget will stop at the top of the range." |
| to > 3 × from (allowed) 🟡 | hint | "These ends are far apart. Check the numbers." |

### 2.5 Tough questions — `Setup/ToughTheme`, `Setup/ToughPlan`
| Turn | Mike says | Quick replies |
|---|---|---|
| **T-1 Theme** | "Which questions should I ask? Pick a theme, or Mix for one from each." | "Money" · "Leaving and gaps" · "Weak spots" · "Fit" · "English at work" · "Personal questions" · "Mix" |
| Personal picked | adds: "In many places an interviewer may not be allowed to ask these. I won't press for details: you practise a short, calm answer." | — |
| **Plan** | "Here's the plan." + PlanCard | — |

Header "Step 1 of 1". 7 replies exceed home.md's 4-chip cap → this turn only, wraps (375: 3 rows) 🟡. Themes follow PRD §5.2 (no "Pressure" theme: pressure lines run in every theme). Personal questions only as their own theme, never in Mix (D114·2). Free text matches theme words; no match: "I didn't catch the theme. Pick one:" + the same chips.

### 2.6 Plan card (home.md §4.9 shape: `<dl>` rows + "Change" links + actions)
**Negotiate** — h2 "Here's the plan":
| Row | Value | Change |
|---|---|---|
| Role | "Kestrel Pay · Senior Product Designer" | Menu listbox (jobs + "Type a role") |
| Numbers | "Range 85,000–98,000 EUR · your target 96,000 · per year" · no range: "No range in the post · your target 96,000 EUR · per year" | `Dialog` "Change your numbers" = §2.4 form; Save / Cancel; backdrop = Cancel (D108), typed values kept as draft |
| Mike | "Firm: polite, holds the line, moves when you give a reason." · Friendly "Warm, has room, gives a little even without a reason." · Tight budget "Little room on base. Gives later, not now." · Surprise "A surprise: you'll see which style after the call." | Menu radio with the 4 options + Easy / Medium / Hard as item descriptions |
| Competing offer | "You have a real offer: Mike counts it as a reason." · off: "None. If you mention one, Mike won't count it." | Button link sm "Change" toggles |
| Length | "Up to 12 of your turns, about 10 minutes." 🟡 | — |
| Tactics | §3 strip | — |
| Your note | as home.md | "Remove" |

**Tough** — rows: Theme "Money: salary, current pay, budget" (Change: Menu radio, 7 themes) · Mike "Asks a follow-up and pushes back when an answer is long, vague or apologetic. At most two pushes per question." · Length "5 questions, about 15 minutes." 🟡 · After the call "The answer that hurt most, with your own words, and a calmer way to say it." · Tactics (§3).

**Actions:** `Button primary lg` Icon `mic` **Start negotiation** / **Start tough questions** + `Button ghost sm` Icon `keyboard` "Type instead". No speech recognition: Icon `keyboard`, "You'll answer by typing."
**Engine not running** (decision from PRD §6 Offline, both modes run in-call without a model): Start stays enabled; line under it, Icon `info` sm: Negotiate "The AI model is off. Mike will use his scripted lines." · Tough "The AI model is off. The after-call check waits until it's back." 🟡

## 3. Tactic cards before the call (US-65, D115)
**Where:** the last row of the plan card, right above Start (the eye passes it on the way to Start; it never blocks Start: one click, AC2). Not a separate chat step (that would add a click), not above the plan (it would scroll out of view when the plan heading takes focus).
- Row header: "Tactics for this call" (`--text-sm --weight-medium`) · "1–2 of 9" (`--color-text-tertiary`, `aria-live="polite"`) · IconButton sm `chevronLeft` "Previous tactic" · `chevronRight` "Next tactic" · Button link sm **Hide tactics**.
- Strip: horizontal list (`role="list"`, `aria-label="Tactics for this call"`, `tabindex="0"`, scroll-snap), TacticCard `tile` width `calc(var(--space-16) * 4.5)` 🟡; wide shows 2 + a peek, 375 shows 1 + a peek. Edge fade on the side that has more (the QuestionTabs rule, debrief.md §3.5). Chevrons scroll by one tile; disabled at the ends. Under reduced motion the scroll jumps.
- **Tile** (TacticCard `tile`, `--note-fill` on the subtle plan card, `--radius-md`, `Padding sm`): title `--text-sm --weight-semibold` · rule `--text-sm` · example in quotes `--text-md` (the phrase to say) · evidence label `--text-sm --color-text-tertiary` (e.g. "Common advice", "Lab studies; who goes first is debated for job offers"). No numbers from surveys (AC4).
- **Order = order of the call.** Negotiate: N2 Ask for their range · N1 Know your number · N3 Keep your current pay private · N4 Pause before you answer · N5 Give a reason with every number · N6 If base is stuck, ask about the package · **N9 Bridge the gap with a step-up** · **N10 Make the step-up real** · N7 Only mention offers you really have (only when the competing-offer box is on) · N8 Ask for time and the terms in writing → 9 tiles (10 with N7). Tough: T1 Personal question · T2 Pushed back · N3 (N3 first when theme = Money or Mix) → 3 tiles, no chevrons needed (they fit).
- **Hide tactics** = "Don't show again" for this mode (reversible: Settings → Practice, Toggle "Show tactics before Tough questions and Negotiation"). Hidden state: one line "Tactics are hidden." + Button link sm "Show them". Cards stay reachable through Hint and in the debrief (AC3).

## 4. Session (island, `session.md` §V2)

### 4.1 Hint button (US-69)
- **Island tools group:** `[Redo] [Type instead] [Hint]` — Hint takes the suggester's slot (the suggester and its More-menu switch are not rendered in these modes, AC5). Stacked (< 560): row 2 `[Type] [Hint] [More]`, Redo moves into More as in §V2.7.
- `IconButton md` Icon `bulb`, `data-track="hint-toggle"`: label "Show a hint (H)" · pressed (`aria-pressed`, `--color-selected`) "Hide the hint (H)".
- **Disabled, not hidden** (§V2.1), reason in the tooltip: connecting "Hints are ready once Mike starts" · listening "Hints wait until you stop speaking" (GR6) · thinking "A hint is ready after Mike replies" · closing "Practice finished". Enabled while Mike speaks and on your turn.
- Key **H** (ignored in the text box, C2 rules). ShortcutsDialog adds a row: `Kbd H` "Show or hide a hint (Tough questions and Negotiation)".

### 4.2 Hint card `Session/Hint` (reuses the Suggester placement)
- Same place and shape as `parts/Suggester.tsx`: `Card padding="sm"` at the end of the transcript flow, `max-width: --layout-narrow`, `--radius-md`. Enters `card-in` `slow` (motion §3.4 C7), leaves `soft-out` `exit`.
- Content (TacticCard `hint`): head row Icon `bulb` sm + "Hint" (`--text-sm --color-text-secondary`) + IconButton sm `x` "Hide the hint" · title `--text-md --weight-semibold` · rule `--text-sm` · "Try saying" (`--text-sm --color-text-tertiary`) + the example phrase `--text-md`. Optional second block after a hairline (`--color-border-subtle`): "Or" + second card's title and phrase (picker "N2 and N1 underneath").
- Fixture (Mike asked for expectations): **Ask for their range** · "Asking first is a fair move, not a dodge." · Try saying "Before I give a number, what range did you plan for this role?" · Or: **Know your number, then pick who goes first** · "Based on the scope, I'm looking at 96,500."
- Picker = PRD §5.4 + §9: N9 wins when base is final, the offer is below the user's ask and no step-up was asked ("If 90,000 is the limit today, could we agree on 98,000 after the three-month probation?"); N10 when a step-up was given without goals or writing ("Great. Can we write the 98,000 at three months and the goals into the offer?"). Tough: personal question → T1; after a pressure line → T2; else the question's card + its answer-shape line as the rule.
- Stays until "Hide", H, or Mike's next line (then `soft-out`); never changes while the user speaks (AC4). A press is logged (`hints_used`). Never a hint about hidden state (AC3). Works offline (no model).

### 4.3 Island status, state pill, More menu
| | Tough questions | Negotiate salary |
|---|---|---|
| Status | `2 of 5` (`aria-label` "Question 2 of 5"); a push is not a new question | `Turn 3` (`aria-label` "Turn 3"), like English; no cap shown (the turn cap is not a goal) |
| Main action | interview set: Interrupt / Talk now / Send now / See your debrief | same; after an outcome: **See your debrief** |
| Exit | **End** | **End practice** |
| More header | "Tough questions · Money" + "5 questions · pushes back on weak answers" | "Negotiation · Senior Product Designer" + "Firm · EUR per year" (Surprise: "Style revealed after the call") + "Offer on the table: 91,000 EUR" (only what Mike has said aloud; before the first offer the line is absent) |
| `document.title` | "Question 2 of 5 · Tough questions" | "Turn 3 · Negotiation" |
| Closing pill | interview copy | "Practice finished" / "See your debrief" (outcome line from Mike, US-66 AC6) |
| First-time tip (FirstTime card) | "Mike pushes back on purpose. Press H for a hint." | "Say numbers in full, like “ninety-six thousand”, or press T to type them. Press H for a hint." |

### 4.4 Resume (US-73)
Interrupted callout and Resume are unchanged (S10a/b). After Resume Mike's first line is scripted: Negotiate "Where were we? The offer on the table is 91,000 EUR." · Tough "Let's pick up at question 3 of 5." Status shows the restored turn / question; the hint card, if it was open, is gone.

## 5. Debrief: Negotiate (US-70, D115)
Header (debrief.md §3.1): H1 **Negotiation · Senior Product Designer · Firm** (Surprise: "· Surprise (Firm)"); meta `target` "Negotiation · Firm" · `clock` Nov 8, 19:40 · 11 min · `chat` 9 turns · `check` "Saved on this computer". Toolbar: Segmented **Debrief | Conversation** + **Practise again** (`Button secondary icon=refresh`, tooltip "Opens the setup with your last numbers", → `/?track=negotiate`). Frames stacked full width (`--space-4` apart); no two-column split (rows are long sentences).

### 5.1 Frame "Your result" `Debrief/Neg/Result`
- **Headline** (`--text-3xl`, same slot as the level headline): **You moved the offer from 88,000 to 91,000 EUR.**
- **The deal line** (`--text-lg --weight-medium`, `tabular-nums`): **Now 91,000 → 98,000 after 3 months** + marker: Icon `check` sm + "In the offer letter" · or Icon `x` sm + "Not in writing" (text always next to the icon; monochrome, `--color-text-secondary`: not a status). No step-up: the line is **91,000 EUR from the start**.
- **The figures** (aside on the title row, like the one score; below the headline under 560): `30%` **of the room captured now** · `100%` **after 3 months** (two figures, `--text-2xl`, captions `--text-sm --color-text-secondary`, dotted underline + Tooltip "Share of the gap between Mike's first offer and his top of range"). Third line, quiet, `--text-sm`: "Year one: 96,250 EUR" (only with a step-up).
- **Rows** (`<dl>`, term `--color-text-tertiary`): Mike's first offer 88,000 EUR · Your target 96,000 EUR · **Mike's range was 85,000–98,000 EUR** (revealed now; no range in the post: "…built from your target") · Outcome "You accepted" / "You asked for time (3 days)" / "You declined" / "Mike closed at the turn limit" / "You ended the practice" · Style "Firm (medium)" / "Surprise me: Mike was Firm".
- **Bonuses and other levers** (separate group, never added to base): `Badge neutral` each: "Performance bonus up to 5%" · "Sign-on 2,000 EUR" · "Review at 6 months" · "+2 days off" · "2 remote days". None: "No other levers this time."
- Footer line `--text-sm --color-text-tertiary`: "Practice settings, not real recruiter data."

### 5.2 Frame "What moved the offer" `Debrief/Neg/Moves` (AC2, AC3, AC5)
Ordered rows on `--note-fill`, one per change: `Turn 3` (tertiary) · **88,000 → 91,000** · cause ("Counter with a reason" / "Lever ask" / "Step-up agreed" / "Competing offer") · the user's quote in quotes (`--text-md`; never shown if not in the transcript).
- Step-up row: **91,000 now → 98,000 after 3 months** · "Step-up agreed" · quote · sub-line "Goals named: yes · In writing: asked".
- Held rows when relevant: "Turn 5 · Offer unchanged · Same number without a new reason".
- Pressure rows: Icon `clock` sm "Mike used a 48-hour deadline. Real recruiters may or may not."
- Competing offer with the box off: "You mentioned another offer. Mike didn't count it: the practice was set up without one."
- Group **Levers you didn't ask about**: "Sign-on bonus · Early review" (from the style's available list).

### 5.3 Frame "Say it better" `Debrief/Neg/Better` (AC4, §9)
1–3 rows, picked by code priority (+ N9 / N10 from §9). Each row: title (TacticCard `inline` title, e.g. **Bridge the gap with a step-up**) · "What you said" + quote · "Try" + the card's example phrase (`--weight-semibold`) · `Disclosure plain` "Why it works" → rule + evidence label. Footer line: "Hints you used: Ask for their range (turn 1) · Bridge the gap with a step-up (turn 6)." (none: no line).
Conversation = the existing second view (not a frame).

### 5.4 Edge states
| State | Result frame | Other frames |
|---|---|---|
| Ended before any offer (1+ turns) | headline "No offer yet"; figures "—"; text "You ended before Mike made an offer. Start with these next time:" + TacticCard `tile` N2, N1 | Moves hidden; Say it better only if a signal fired |
| Accepted the first offer | "You accepted Mike's first offer: 88,000 EUR." · `0%` captured now · range shown | Say it better row 1 = N4 Pause before you answer ("Thank you. Let me think about that for a second.") |
| Range = first offer (no room) | figures "—" + "Mike had no room to move on base this time." | levers still listed |
| Named a number below Mike's opening | row in Moves: "You said 84,000 before Mike made an offer. He was ready to open at 88,000." | — |
| Refused everything / declined twice | headline "No deal: you declined." · deal line "Last offer 91,000 EUR" | — |
| Step-up without writing | marker `x` "Not in writing" | Say it better includes N10 |

## 6. Debrief: Tough questions (US-71)
Header: H1 **Tough questions · Money** (Mix: "· Mix"); meta `hand` "Tough questions" · `clock` · 14 min · `chat` "5 questions, 3 pushes". Toolbar: Segmented + **Practise again** (→ `/?track=tough`, same theme).
- **Preparing** (D96 progress screen, existing): "Checking your answers… 2 of 5" (TextShimmer + Dots); code signals show at once.
- **Frame "Summary"** `Debrief/Tough/Summary`: headline **Handled calmly: 3 of 5** · group **The answer that hurt most** (`--note-fill` row): question 2 "And what do they pay you right now?" · label "Shares personal info" · quote "I make 72,000 now but honestly I'd take less to get out." · Button link sm "Go to question 2" (switches the viewer). 1–2 answers: no "N of M"; headline "You answered 2 questions." No bad signal anywhere: "Nothing hurt this time. Every answer stayed calm and on the job."
- **Frame "Questions"** `Debrief/Tough/Questions` = the existing question viewer (`QuestionTabs`, one at a time, `?q=n`, Previous / Next; debrief.md §3.5). Per question: meta "Question 2 of 5 · Money · 1 push" · h3 the question · Mike's follow-up and pressure line (`--color-text-secondary`, "Mike pushed:") · **Your answer** · **What hurt** list: label ("Shares personal info", "Blames others", "Argues instead", "Rambling: 190 words", "Apologised 3 times", "No example") + verbatim quote; model signals carry `Badge outline` "May be wrong" (dropped if the quote isn't in the answer) · **Calmer wording** (model; `--text-md`) · **Answer shape** (content line, `--color-text-secondary`) · tactic link: TacticCard `inline` "T2 · Pushed back: “fair point”, then shorter" in `Disclosure plain` (rule + example).
- No hurt signals: "Calm and on the job." in place of the list.
- Personal question: `Callout info` (neutral, not a status): "In many places this may not be a lawful question to ask. A short answer that steers back to the job is enough." No country's law named.
- Model failed: Calmer wording = the shape line + `--text-sm --color-text-tertiary` "The after-call check didn't run, so this is the shape of a good answer." 
- No language corrections in v1 (Should).

## 7. History, Recents, Search (US-72)
- **History filter chips** (`ChipGroup` "Show", counts in the label): All 7 · Interview 3 · English 1 · Tough questions 2 · Negotiation 1. 375: wraps. URL `?track=tough|negotiate`.
- **Rows** (ListRow): lead disc `hand` / `target`; title "Tough questions · Money" / "Negotiation · Senior Product Designer · Firm"; meta `Badge outline` "Tough questions" / "Negotiation" · date, time · length; result (`--text-sm --weight-medium`, never coloured): Tough "Calm in 3 of 5" · Negotiate "+3,000 EUR now · 30%" / with step-up "91,000 → 98,000 at 3 months" / "No offer yet".
- **Filtered empty:** `EmptyState compact` · Tough: icon `hand` "No tough questions yet" · "Mike asks the questions people rehearse least and pushes back on weak answers." · `Button secondary` "Start tough questions" → `/?track=tough`. Negotiate: icon `target` "No negotiations yet" · "Bargain with Mike over your real numbers, then see which moves raised the offer." · "Start a negotiation" → `/?track=negotiate`.
- **Recents rail:** end text like "EN" (`.track`, `title` for the full word): **TQ** (title "Tough questions") · **PAY** (title "Salary negotiation") 🟡. Pending row: same as today.
- **Search:** mode words "tough", "negotiation", "salary"; result rows use the same titles. Markdown / Obsidian export: the result rows of §5.1 / §6 Summary as text.

## 8. Very short sessions and other edges
| Case | Behaviour |
|---|---|
| End before the first user turn | nothing saved; Session EmptyState "Session ended" · Tough "Nothing was saved: you didn't answer any questions." · Negotiate "Nothing was saved: you didn't reply to Mike yet." |
| Tough, 0 answers | as above · 1–2 answers: saved, per-question cards, no "N of M" |
| Negotiate, 1 turn, no offer | saved; §5.4 "No offer yet" |
| Unparsed number in the call | Mike: "Sorry, what was the figure?" (once); the hint for that moment stays N5 / N1 |
| Long content | role 80 chars (ellipsis + Tooltip in plan, More header, History); quotes wrap; amounts ≥ 1,000,000 keep separators, `tabular-nums` |
| Both themes / keyboard | every element through tokens; strip, chevrons, Hint, tiles reachable by Tab; tiles are not buttons (no fake affordance) |

## 9. DS gaps (candidates; compose existing parts until approved)
1. **TacticCard** — used on 3 surfaces (plan strip, hint, debrief) → DS component per CONTRACT §6.1. Anatomy: title · rule · "Try saying" + example · evidence label · optional "Or" block. `Size: tile | hint | inline` (inline = title + Disclosure). Tokens: Card / note fill, `--text-sm|md`, `--radius-md`. Story `ds-tacticcard--tile|hint|inline|overflow`.
2. **Horizontal strip with chevrons + edge fade** — exists only inside `QuestionTabs`. Extract a `ScrollStrip` (list, chevrons, counter, edge fade, snap) or keep it local to PlanCard 🟡.
3. **Two figures in a frame aside** — the one-score slot holds one figure; allow 2 (`now` / `later`) in `parts/Frame.tsx` aside. No meter, no range bar in v1 (a range line floor·first offer·final·top would help; new viz = owner call).
4. **Quick replies > 4** (Tough theme turn, 7 chips) — exception to home.md §4.1.
5. **Icons** — no money / negotiation glyph; `target` + `hand` reused. Candidate new line icons `coins` (Negotiate) and `shield`-like pushback glyph, 24 grid, 1.75 stroke 🟡.
6. **Field number formatting** — Input has no number mask; parse on blur, display with thousands separators (helper, not a component).

## 10. For the review artifact (light + dark, 1440 + 375)
1. Home start: first visit and returning (two chip rows).
2. Negotiate setup: N-1 role picker · N-2 numbers card prefilled ("From the job post — check it") · N-2 with errors (target below range, one range end) · target above range note · N-3 style first / returning · plan with tactic strip (2 + peek; 375 1 + peek) · plan, tactics hidden · Change your numbers dialog · engine off line.
3. Tough setup: theme chips (7, wrapping at 375) · Personal questions note · plan with 3 tiles.
4. Session: Negotiate Mike speaking (Hint enabled) · your turn + hint card N2 with N1 below · listening (Hint disabled, card static) · N9 hint after "base is final" · More menu header with the offer · Tough `2 of 5` + T2 hint after a pressure line · stacked island 375 · closing "Practice finished" · resume line.
5. Negotiate debrief: step-up in writing ✓ (fixture §5.1) · step-up not in writing ✗ + N10 in Say it better · no step-up · accepted first offer (0%) · no offer yet · no room ("—") · Surprise reveal.
6. Tough debrief: summary + Q2 personal-info signal · personal question callout · model failed (shape line) · 2 answers only · nothing hurt.
7. History: filters with 5 chips · rows of both modes · each filtered empty · Recents with TQ / PAY.

## 11. Owner questions (default taken)
1. Tactic cards inside the plan card above Start (default) vs a separate "Before we start" step. 
2. Recents labels **TQ / PAY** (default) vs words "Tough" / "Salary".
3. Engine off: allow Start with scripted lines (default, PRD §6) vs block like Interview.
