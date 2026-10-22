# Composition map: Session

> Stage 11, step 2 · 2026-10-20 · ScreenId `Session` · variants `interview` · `drill` · `english` · overlays `BrowserBanner`, `MicHelpDialog`, `SessionInterrupted`, `StorageNotWritable`.
> Inputs: `docs/ia/wireframes/session.md`, `ds/CONTRACT.md`, `ds/components.md`, `docs/motion.md`, `docs/moodboard.md` (R1–R11, P1–P8), `docs/prd.md` US-13–19, US-04 AC5, US-24, US-58. Redesigns `app/web/src/screens/Session.tsx` + `components/Feedback.tsx`.
> Legend: G<n> = gap from `ds/components.md` §4 · G19 Disclosure, G20 InlineMark = new DS candidates from this map · 🟡 = assumption · Owner decisions are at the end (yes/no only).
> **Fixture:** `docs/ia.md` §6 as is — Alex Morgan, **Kestrel Pay · Senior Product Designer**, every §6 number (Q2 of 5, 07:12, 11 fillers, 289 words, 124 wpm, the same flags). Same fixture as Home and Debrief (orchestrator, 2026-10-20: the PM role in the first brief was a mistake; PM answers live only in the Sam Rivera example).

## Changelog v1 → v2 (D47, 2026-10-20)

| D47 point | Owner's words | What changed |
|---|---|---|
| (c) Controls | «я хотел бы чтобы у нас был какой-то так сказать островок…» | Every control moves into **one floating island** at the bottom centre of the stage (§V2). The top bar (v1 §3.1), the dock and its help line (v1 §3.8) are removed. The feedback column on wide (v1 §3.9 "Wide") becomes a floating panel opened from the island |
| (f) Orb | orb redesign through the orb moodboard | Not in this map: the orb stays a black box `<Orb state size level/>` at the centre of the stage |

**Superseded in v1:** §3.1 Top bar (G14) · §3.8 Dock (row, help line, narrow sticky dock, connecting row, text composer, suggester card position) · §3.9 "Wide: column `--color-sidebar`" and the narrow "Feedback for question 2" reopen button. **Kept as is:** §3.2 banners, §3.3 stage (bottom padding changes, §V2.1), §3.4 question block, §3.5 orb + StatusPill, §3.6 captions, §3.7 first-time tips (the "press Enter" line now points at the island), §3.9 panel content P0–P4 and editing, §3.10 interrupted, §3.11 mic help, §3.12 overflow, §4 states.

## V2.1 (D49, 2026-10-20): transcript in the centre, Presence along the top

Version 2.1 of this map (not to be confused with §V2.1 "Anatomy and placement" of the island). Owner's words (A6 / D49): «по центру фигачим транскрибацию нашего диалога» · «сверху нам не нужна такая полоса градиентовая, нужен только сам эффект когда разговариваешь» · «бг паттерн … под этим свечением вместо полос» · «когда думает ИИ … волна … из стороны в сторону, а не шарик» · «цвет … меньше белого и больше синего» · «движение … не только по центру, но и по сторонам». D48: no teal, a Gemini-like blue.

| D49 point | What changed in code |
|---|---|
| 1. Transcript in the centre | `parts/Transcript.tsx` on DS `ChatLog size="lg" live={false}` + `ChatMessage`: the whole dialogue, newest at the bottom, in the `--layout-narrow` column. "Question N" `<h2>` (`session.captions.question`) before the turn that opens each question (not in English); Mike's follow-ups carry a quiet `Follow-up` label (`--text-sm`, secondary; D51: no outlined pill); each turn starts with a visually hidden speaker name. Mike's streamed chunks fade in (opacity only); new Mike turns rise in, turns present at the first render never animate; the user's words never animate (rule 3). The answer being recorded is the **last item**, `ChatMessage state="interim"` (D51: no stroke, bubble fill at 65%) with interim words in `--color-text-secondary`. Mike preparing = a Mike line with `Dots`. Footer `session.heard` under the last user turn (voice, not interrupted) |
| 1. Auto-scroll | `transcriptScroll.ts` (pure, tested): stuck to the bottom → new content scrolls into view (instant on first render and while listening, smooth otherwise); the user scrolls up (more than 48px from the bottom) → nothing moves, new content counts as unread and **Jump to latest** (Button `secondary` sm, `arrowDown` right, `--shadow-raised`) appears above the dock; at the bottom again → it goes away. 🟡 |
| 1. Layout | Stage: `.presenceBox` (absolute, full stage width, `--stage-reach` tall) · `.scroll` (margin-top `--stage-reach`, so the transcript starts under the glow; padding-bottom = dock height + offset + `--space-8`) · `.dock` (StatusPill + sub line, then the island). Both ends of the scroller fade (mask on the scroller's box): older turns fade out at the glow line, and while reading above, turns fade out before the dock instead of running under the state text. Phone: `--stage-reach: --presence-reach-sm` (set on `.body`; a container query cannot style its own container) |
| 2. No permanent line | The A6 3px line along the top is gone. Presence draws nothing at idle |
| 2. Glow only while talking | `Presence` (DS, replaces Orb): `stage.ts → stageFor()` maps phases: Mike speaking → `speaking`; listening → `listening` (muted → `idle`); thinking → `thinking`; your turn before the first word (voice and text, unmuted) → `waiting` = faint inviting glow (~35%, slow lobes, D50); everything else (muted, connecting, preparing, interrupted, ended) → `idle` = no glow, fades out over `--duration-slow` |
| 3. Dot pattern | The owner's pattern (`docs/assets/presence-dots.webp`) → a seamless tile (`app/web/src/ds/assets/presence-dots.webp`, cut by `app/web/scripts/presence-tile.mjs`) shown **only inside the glow**, in its colour (CSS mask on a copy of the glow) |
| 4. Thinking = a wave | One broad crest sweeping side to side, ping-pong, `--duration-presence-sweep` (2800ms) per pass |
| 5. Colour | `--color-presence-*` = blue.700 → .600 → .500 → .400 (no white, never paler than .400), drifting slowly across the width; dark theme blends with `screen` |
| 6. Movement at the sides | Five phase-offset lobes across the width (centre, both sides, two between) for speaking and listening |

- **Text safety:** the glow box bottom is the first text line; columns never reach it (tested at 220 / 170px, D51); the glow fades to 12% over 64px above it; text primary / secondary ≥ 4.5:1 over the worst glow left there, light and dark (tested from `tokens.css`).
- **A11y:** Presence is `aria-hidden`; the state is always the StatusPill text (`role="status"`). The transcript log is not announced (`live={false}`: Mike is heard through TTS, the user is speaking). The island and keyboard map are unchanged.
- **Reduced motion:** one still frame per state (speaking: lobes raised · listening: lower · thinking: crest held at the left · idle: nothing); no smooth scrolling.
- **Props (`SessionData`):** `captions` → `transcript: TranscriptTurn[]` (`CaptionTurn` + `question?: number`, `followUp?: boolean`) · `voiceLevel?` optional (no value → a speech-like envelope until the real playback level is wired at 12d 🟡) · `initialFollow?: "latest" | "reading"` (review: start scrolled up) · `reducedMotion?: boolean` (review / stories). Live container: `Session.tsx` maps the reducer's `transcript` (first `question` item per thread → `question: n`, `follow_up` → `followUp`), the interim preview is pushed as the last turn.
- **Review ids:** `Session/Presence` (+ `Presence/<state>`), `Session/Transcript`, `Session/Transcript/mike`, `…/user`, `…/user-interim`, `…/mike-pending`, `Session/Status`, `ChatLog/lg`.
- **Review states added:** `s2-turn` (your turn, faint glow D50, dark), `s2-reading` (scrolled up, Jump to latest), `s1-reduced` (reduced motion, thinking). `s1`, `s4`, `s5-hidden` gain dark frames. Stories: `Session/S2YourTurnWaiting`, `S2Reading`, `ReducedSpeaking|Listening|Thinking`; `DS/Presence/*`; `DS/ChatMessage/SessionTranscript`.
- **Superseded by V2.1:** §3.4 question block (the question is now Mike's turn in the transcript, with the "Question N" heading) · §3.5 orb (StatusPill stays, now above the island) · §3.6 captions (the transcript replaces them; "What we heard" stays as the footer) · §5.1 orb concepts · §V2.1 "captions and the follow-up are never under the island" now reads "the transcript". `parts/QuestionBlock.tsx` and DS `Orb` are deleted.

## §V2 Island — `parts/Island.tsx` on DS `Island` · `data-review-id="Session/Island"`

### V2.1 Anatomy and placement
- **One object, bottom centre of the stage** (R7 ElevenLabs conversation bar, R4/R6 floating input). `position: sticky; bottom` inside the stage column, horizontally centred, width = content (wide/mid), never wider than `--layout-narrow`. Offset from the bottom `--space-6` (narrow `--space-4`). `--z-sticky`.
- Surface: `--color-raised`, 1px `--color-border-subtle`, `--shadow-raised`, `--radius-pill` (voice) / `--radius-lg` (text mode, V2.5). Height `--control-h-lg` + `--space-2` padding-block; padding-inline `--space-3`. No glow, no blur, no glass.
- The stage reserves room for it: stage `padding-block-end` = island height + `--space-8`, so captions and the follow-up are never under it.
- **Four groups**, gap `--space-2` inside a group, `--space-3` between groups, separated by a 1px vertical hairline `--color-border-subtle` (height `--control-h-sm`):
  1. **Status** `Session/Island/Status`: progress `2 of 5` (`--text-sm --weight-medium`, `aria-label="Question 2 of 5"`) + timer `07:12` (`clock` sm, `--text-sm --color-text-secondary`, `tabular-nums`, static, D37). Changes only between questions; the timer ticks once a second as text, no pulse, no colour.
  2. **Voice** `Session/Island/Controls`: MicButton (48, thin ring when live, O4) + **main action slot** (fixed min-width = the longest label, so the island never changes width): per state, V2.2.
  3. **Tools**: IconButton md `redo` "Redo answer (R)" · IconButton md `keyboard` "Type instead (T)" · IconButton md `panel` "Show feedback (F)" with `aria-pressed` (toggle, checked tokens when open).
  4. **Exit** `Session/Island/More`: IconButton md `more` "More" → Menu · Button `secondary` md `stop` **End** (English **End practice**; never `danger`).
- **The content set is fixed per variant**: a tool that can't be used now is **disabled, not hidden** (`--color-action-disabled` / `--color-text-disabled`, reason in its tooltip). The island keeps one shape for the whole session; only the main action label and the Feedback toggle change.
- **Nothing in the island changes while `phase = listening`** except the mic ring (GR6). The main action becomes **Send now** at the moment listening starts, not during it.

### V2.2 Island per state

| State | Status | Mic | Main action slot | Redo | Type | Feedback toggle | Notes |
|---|---|---|---|---|---|---|---|
| S1 Q1 start, Mike speaking, tips | `1 of 5` `00:12` | on | `secondary` `hand` **Interrupt** | disabled "Nothing to redo yet" | on | disabled "Feedback comes after your first answer" | tips card on the stage |
| S2 follow-up, Mike speaking | `2 of 5` `06:58` | on | **Interrupt** | disabled | on | off, enabled (shows last feedback) | |
| S3 listening, mic 0.6 | `2 of 5` `07:12` | live ring | `primary` `send` **Send now** | disabled | on | disabled "Feedback after your answer" | quiet mode, nothing animates but the ring |
| S4 thinking | `2 of 5` | on | empty (D55: the glow + the state pill say it; slot keeps width) | on | on | disabled | |
| S5a/b feedback ready | `2 of 5` `09:40` | on | `primary` `arrowRight` **Next question** (Q5: **See your debrief**) | on | on | **pressed** (panel open) | panel opens on its own, V2.4 |
| S5c/d not-what-I-said / editing | `2 of 5` | on | **Next question** becomes `secondary` | on | on | pressed | focus stays in the panel |
| S6 text mode | `2 of 5` | — (no mic) | composer row, V2.5 | on | **Switch to voice** `mic` (same slot) | pressed | box shape |
| S7 drill | `1 of 3` | on | **Interrupt** | disabled | on | disabled | drill badges in More header |
| S8 English | `Turn 4` `11:05` | on | your turn: `secondary` `mic` **Talk now** · after: no Next (turns continue) | on | on | pressed after each turn | End practice |
| S9 connecting | — | — | Dots `pill` `shimmer` "Connecting to Mike…" fills groups 1–3 | — | — | — | only End stays |
| S10a/b interrupted | `2 of 5` `07:40` | disabled | empty (Resume lives in the stage callout) | disabled | disabled (10b: on, "Continue in text") | on | End = "End and see debrief" removed from the callout; End here does it |
| S11 mic help | unchanged under the dialog (inert) | | | | | | |
| S12 storage / browser banner, between | `2 of 5` | on (browser: disabled "Voice isn't available in this browser") | **Next question** | on | on | pressed | banners on the stage, above the question |
| S13 overflow | `2 of 5` `1:02:14` (h:mm:ss, slot sized for it) | on | **Next question** | on | on | pressed | long title only in More header (ellipsis + tooltip) |
| S14 preparing · unavailable · muted · suggester | `2 of 5` | muted: `micOff`, `aria-pressed` | preparing: Dots "Preparing feedback" · unavailable: **Next question** | on | on | preparing: pressed, panel shows P2 | suggester on: card on the stage, toggle in More |

`your-turn` (between Mike and the user speaking): main action `secondary` `mic` **Talk now**.

### V2.3 What leaves the top bar and where it goes
- **Title, round · strictness, drill focus badges, English level/topic** → the **More menu header** (Menu header slot, new DS): `Kestrel Pay · Senior Product Designer` (`--text-sm --weight-semibold`, 2 lines max) + `Behavioural · Standard` (`--text-sm --color-text-secondary`); drill: `Drill` + Badges `outline` `No result` · `"we" instead of "I"`; English: `English · Talk about your work` + Badge `outline` `B2`. Also in `document.title` ("Question 2 of 5 · Kestrel Pay").
- **Question N of M** → island Status (short form `2 of 5`, full name in `aria-label`).
- **Timer** → island Status, always visible (D37).
- **Voice / Text Segmented** → the Type instead IconButton (T) and, in text mode, the Switch to voice button in the same slot.
- **End** → island Exit group.
- **Shortcut help line** → More → "Keyboard shortcuts" (opens a small Dialog with the Kbd list) and every tooltip ("Redo answer (R)").
- **More menu items** (Menu `menu`): header (above) · checkbox item `Show a sample answer` + description `Practice only. Say it in your own words.` (D35, US-58; needs Menu checkbox items) · item `keyboard` `Keyboard shortcuts` (shortcut hint `?`) · item `mic` `Microphone help` (opens MicHelpDialog) · item `Switch to voice` disabled with description `Voice isn't available in this browser` (only when the browser can't recognise speech).
- The stage starts directly with banners / question: the page gains `--layout-topbar` of quiet space on top (P4).

### V2.4 Feedback panel opened from the island
- **Wide (≥ 1024):** a floating Panel on the right of the stage, not a column: `--layout-panel` (440) wide, inset `--space-4` from the top, right and bottom of the session container, `--radius-lg`, `--color-raised`, `--shadow-overlay`, no scrim (the session stays usable). Content = v1 §3.9 P0–P4, editing, text mode, English, unchanged; the Footer keeps **Next question** too (two ways to the same action; the island's is the primary, the panel footer's becomes `secondary` 🟡 so the view has one primary).
- When the panel is open, the stage content (question, orb, captions, island) shifts left by `translateX(calc(var(--layout-panel) / -2))` so it stays centred in the free space (`slower`, `--ease-standard`).
- **Opens on its own** when feedback is ready (P3) and stays open between questions; **closes on its own** when the next question starts (Mike speaking). The F toggle reopens it any time Mike isn't speaking and the user isn't talking; it is disabled before the first answer and while listening (GR6: nothing appears while you speak) [Session v2 Q5 in `_index` §3].
- Panel header gets IconButton `x` "Hide feedback (F)"; Esc closes it; focus returns to the Feedback toggle.
- **Mid (768–1023):** G5 Drawer `Side: right`, modal with scrim (as v1). **Narrow (< 768):** G5 bottom sheet (v1). In both, the island is covered; the sheet footer carries **Next question** `primary` lg FullWidth, so the primary stays reachable. Closing returns to the island, whose Feedback toggle reopens it (replaces v1's "Feedback for question 2" button).

### V2.5 Text mode (GR5, US-13 AC3)
- The island morphs from pill to box (`--radius-lg`, width `--layout-narrow`): **row 1** = Composer with `surface: none` (new prop: no own border, shadow or radius, lives inside the island) — Textarea hidden label `Your answer`, placeholder `Type your answer`, `minRows 1`, `maxRows 6`, inline send `action` `send` (Enter; Shift+Enter new line); **row 2** = the control row minus the Mic: Status · main slot (Next question / Dots) · Redo · **Switch to voice** `mic` · Feedback · More · End. Hairline `--color-border-subtle` between rows.
- Captions on the stage switch to `Mode: transcript` (v1 §3.6); orb `sm`.
- Swap: control row cross-fades (`soft-out` `exit` → `rise-in` `base`); the island grows from the bottom (scaleY on a wrapper + opacity, no height animation) — new row in `docs/motion.md` "Island text-mode morph". Reduced motion: instant.

### V2.6 Motion (rows in `docs/motion.md` before build)
- Island in: reuse §3.3 D5 `dock-in` (`slower`, translateY 16px + opacity) when the session starts, taking over from the Home composer (`home.md` §4.10). Out: `soft-out` `exit` on the way to the debrief.
- Main action label change: §3.2 label cross-fade `fast`, never during listening.
- Stage shift with the panel: **new row "Stage shift"** (translateX `slower` `--ease-standard`).
- Panel in/out: §3.6 panel slide (translateX 24px + opacity) — existing drawer row.
- Island text-mode morph: **new row**, V2.5.
- `data-motion-quiet="true"` (listening) freezes all of the above.

### V2.7 Mobile 375 (`session` < 768)
- Island full width minus `--layout-gutter` on each side, `--radius-xl` 🟡 (a two-row pill reads as a capsule), **two rows**, gap `--space-2`:
  - row 1: Status `2 of 5` · `07:12` · spacer · Feedback IconButton · End `secondary` sm;
  - row 2: Mic (48) · main action Button `lg` flex 1 (Interrupt / Talk now / Send now / Next question) · Type instead IconButton · More IconButton (Redo moves into More as the first item `Redo answer`).
- All targets 44px on coarse pointers (DS-2). The island sits above the home indicator: `padding-bottom: env(safe-area-inset-bottom)` added to the offset.
- Text mode on narrow: row 1 the composer, row 2 Status · main slot · Switch to voice · Feedback · More · End sm. When the phone keyboard opens, the island follows the visual viewport (it is sticky at the bottom of the session container).
- Container < 560 is the switch to two rows (DS `Island` `Layout: inline | stacked`).

### V2.8 Keyboard
Space interrupt / talk now · Enter send now · M mute · R redo · T type instead / switch to voice · **F show or hide feedback** (new) · **N next question** (new; only when the action is available) · **Esc** closes the panel, the menu or the shortcuts dialog (never ends the session) · **?** opens Keyboard shortcuts (new). Shortcuts are ignored while focus is in a text field, except Enter (send) and Esc. Tab order: island left to right, then the panel when open.

### V2.9 Props and review ids
- `SessionViewProps` additions: `panelOpen: boolean` (wide: floating panel; mid/narrow: drawer/sheet) · `initialOverlay?: "more" | "shortcuts"` · `island?: "inline" | "stacked"` (forced for the review; otherwise from the container). Removed: nothing; `input` drives the island shape.
- Review ids: `Session/Island`, `Session/Island/Status`, `Session/Island/Controls`, `Session/Island/Tools`, `Session/Island/More`, `Session/Panel` (floating), `Session/Stage`. Each with `data-review-section` + `data-comment-target`.
- New stories: `Session/S1-Island-MoreOpen` (menu with header), `Session/S5-PanelHidden` (feedback ready, panel closed by the user, toggle not pressed), `Session/S6-TextIsland`, `Session/Shortcuts`, plus every S1–S14 story re-rendered with the island at 1440 and 375.

## 0. Build contract for the engineer
- Split into a pure view and a live container: `screens/session/SessionView.tsx` renders from props only (no audio, no store); `SessionScreen` maps the reducer to `SessionViewProps`. The review page renders `SessionView` with fixtures.
- `SessionViewProps`: `variant: interview | drill | english` · `input: voice | text` · `phase: connecting | mike-speaking | your-turn | listening | thinking | between | preparing | feedback | unavailable | editing | rechecking | interrupted | saving` · `overlay: none | browser | storage | mic-help | interrupted-engine | interrupted-voice` · `firstTime: bool` · `muted: bool` · `micLevel: 0..1` (static number in review, e.g. 0.6) · `voiceLevel: 0..1` (Mike's playback level) · `layerOrder: content-first | delivery-first` · `withChecks: bool` (engine gives word confidence) · `suggester: off | on` · `fixture: default | overflow`.
- Root: `data-motion-quiet="true"` whenever `phase = listening` (CONTRACT §3.5, motion.md §3.7). Every section carries `data-review-id="session.<section>"` for the review artifact comments.
- **Layout by container queries only** (screens render inside scaled review frames): root `container: session / inline-size`; panel `container: panel / inline-size`. Height comes from the frame (`height: 100%`), not `100vh` (today's `min-height: 100vh` must go). Breakpoints, as container widths:

| Name | `session` width | Layout |
|---|---|---|
| wide | ≥ 1024px (review frame 1440) | Two columns: stage `minmax(0, 1fr)` + panel column `--layout-panel` (440) |
| mid | 768–1023px | Stage full width; panel becomes a right drawer G5 `Side: right` (`--layout-panel`), opens on P3, closes when the next question starts |
| narrow | < 768px (review frame 375) | One column; compact top bar; panel becomes a bottom sheet G5 `Side: bottom`; dock sticky at the bottom |

`@media (pointer: coarse)` and `prefers-reduced-motion` stay media queries (they are not about width).

## 1. DS coverage

| Wireframe section | DS component · variant | Status |
|---|---|---|
| Top bar (context, progress, timer, mode switch, End) | **G14 SessionTopBar** `Variant: interview \| drill \| english` · `Density: default \| compact`; inside: Badge `outline`, Segmented, Button `secondary` | gap, build (screen-local `.topbar` today) |
| Timer | part of G14: `clock` Icon sm + `tabular-nums`, `role="timer"` | in G14 |
| BrowserBanner, StorageNotWritable | Callout `warning` + Button `secondary` sm + IconButton `x` | exists |
| Interviewer block (question + follow-up) | local `parts/QuestionBlock` (Session only) + Badge `outline` "Follow-up" | local, one use |
| Orb | Orb `State: idle \| listening \| thinking \| speaking \| muted \| offline` · `Size: md \| sm`, **new motion §5** | exists, redesign |
| Orb state text | **G11 StatusPill** `State: connecting \| speaking \| your-turn \| listening \| thinking \| muted \| offline` · `Live: false \| true` | gap, build (screen-local today) |
| Subtitles / transcript | **G15 Captions** `Mode: subtitles \| transcript` · line `Speaker: mike \| user` · `Interim: false \| true` | gap, build |
| "What we heard" caption | G15 footer slot (static text) | in G15 |
| First-time tips | Card `subtle` `Padding: sm` + `info` Icon + list | exists (radius deviation, §7) |
| Dock: mic | MicButton (code exists as `ds/MicButton.tsx`, = **G10**, not yet indexed) | exists, fix §7 |
| Dock: main action, Redo, Type instead | Button `primary \| secondary` md · Button `ghost` md (wide) / IconButton md (narrow) | exists |
| Shortcut help line | Kbd ×5 + text-sm secondary | exists |
| Connecting pill | **G12** Dots (code exists as `ds/Dots.tsx`) + pill wrapper `Variant: dots \| pill` | partly built, index it |
| Waiting lines ("Thinking", "Preparing feedback…") | **G13 TextShimmer** (today the global `.shimmer-text` class) | gap, wrap as component |
| Text mode composer | **G1 Composer** `Size: md` · send `Disabled: false \| true` | gap, build |
| Answer suggester (US-58) | Card `subtle` sm + Toggle | exists |
| Feedback column (wide) | Panel `As: aside` + `Footer: node` | exists |
| Feedback drawer / sheet (mid, narrow) | **G5 Drawer** `Side: right \| bottom` (add `bottom`) | gap, build |
| P0 / P1 lines | plain text-sm secondary inside Panel body | — |
| P2 preparing / rechecking | G13 + Skeleton `card` | Skeleton in progress |
| P3 layered panel | Feedback pattern (`ThreadFeedback`), **extend**: Edit what I said, inline "What did you say?", check copy, stronger-answer disclosure | pattern, extend |
| Summary row | Badge `Tone: content \| language \| delivery`, `Tinted: false`, icon | exists |
| Fix / heard-as marks inside a sentence | **G20 InlineMark** `Kind: fix \| heard \| unsure` (candidate: Session, Debrief, HomeEnglish phrases = 3 uses) | new candidate |
| Correction card | inside Feedback pattern: `Kind: flag \| check \| removed` · `Source: heard \| typed` | pattern part |
| Delivery metrics | muted block (`--color-subtle`) with 3 label/value pairs (invariant 7: no "·" string) | local in pattern |
| Stronger answer | Button `secondary` sm + `chevronDown` (rotates), body text | exists |
| Next question / See your debrief | Button `primary` md `FullWidth`, `iconRight="arrowRight"` | exists |
| SessionInterrupted | Callout `error` `Live: alert` + CopyField + Button `primary` / `ghost`, in the stage | exists |
| MicHelpDialog | Dialog | exists |
| Live announcements | visually hidden `role="status"` | — |

No section is left without a candidate.

## 2. Wireframe sufficiency: proposals (one yes/no block)
1. **One state text, not two.** The orb label and the top-bar status pill say the same thing. Merge: G11 StatusPill sits under the orb (R7 state chips under the orb) and is the orb's `role="status"`; the top bar keeps only the static timer. (P4)
2. **Name the interviewer "Mike"** (D24, US-26) in the question block and captions, with "Interviewer" / "Coach" as a tertiary role word next to it. The wireframe still says "Interviewer" (Q1).
3. **A "between questions" stage state.** While P3 is open the stage shows the orb `idle` + StatusPill "Your feedback is ready" + sub line "Mike asks question 3 when you press Next question." The wireframe leaves the stage undefined here.
4. **SessionInterrupted inside the stage, not a modal Dialog** (ia.md: "overlay over the stage only, the panel stays"), so the user can still read feedback. `components.md` maps it to Dialog; this map follows the wireframe.
5. **Captions take Otter's live-transcript structure** (R5, Q3): speaker name + start time on each turn, interim words in `--color-text-secondary` that turn `--color-text-primary` once final, no avatars, no colours. Text mode shows the full transcript in the same structure.
6. **One primary at a time:** the composer send button is disabled while P3 waits for Next question; in Edit what I said, "Save and check again" is primary and Next question drops to `secondary`.
7. **Drop the `sparkle` icon** on "Show a stronger answer" (an AI default, brand-direction §7); use a `chevronDown` disclosure.
8. **Earlier questions** stay reachable at the bottom of the panel as a collapsed "Earlier questions (1)" (exists in code, not in the wireframe).
9. **Build the 375 frame** (ia.md says mobile is Won't; directive 11 requires mobile + desktop): bottom sheet panel, compact top bar.

## 3. Map, top to bottom (wide 1440 · narrow 375)
Rhythm: sections `--space-8` · panels / cards padding `--space-5` · groups `--space-4` · rows `--space-2`. Canvas `--color-canvas`; panel column `--color-sidebar` (R2's grey sidebar, mirrored right).

**3.1 Top bar · G14** — *superseded by §V2 (D47c): no top bar; content moved per §V2.3.* `data-review-id="session.topbar"` (P3, R7, D37)
- Wide: height `--layout-topbar`, padding-inline `--space-6`, `--color-canvas` + bottom hairline `--color-border-subtle`, `--z-sticky`. Grid `1fr auto 1fr`:
  - left: title `Kestrel Pay · Senior Product Designer` (`--text-md`, `--weight-semibold`, ellipsis, full text in G6 tooltip / `title`), sub `Behavioural · Standard` (`--text-sm`, secondary);
  - centre: `Question 2 of 5` (`--text-sm`, `--weight-medium`); changes only between questions;
  - right, gap `--space-3`: timer `07:12` (`clock` sm, `--text-sm`, secondary, `tabular-nums`, `aria-label="Elapsed time 7 minutes 12 seconds"`, static, never pulses or recolours) · Segmented hidden label "Answer mode": `Voice` (`mic`) | `Text` (`keyboard`) (US-13 AC3) · Button `secondary` md `icon="stop"` **End** (monochrome, never `danger`).
- Narrow (`Density: compact`): two rows, padding `--layout-gutter`, gap `--space-2`. Row 1: title (ellipsis, `--text-sm` semibold) + End `secondary` sm. Row 2: `Question 2 of 5` · timer · Segmented with icons only (labels visually hidden, `aria-label` kept).
- Drill: left reads `Drill` + Badge `outline` `content` icon `No result` + Badge `outline` `"we" instead of "I"`; centre `Question 1 of 3`. English: left `English · Talk about your work` + Badge `outline` `language` icon `B2`; centre `Turn 4`; End reads **End practice**.

**3.2 Banners** (between top bar and stage, stage width, gap `--space-3`; never inserted while `phase = listening`)
- BrowserBanner: Callout `warning`, icon `globe`, title `This browser can't recognise speech`, body `Use Chrome or Edge for voice, or answer by typing. You can switch back any time.`, actions Button `secondary` sm `keyboard` **Use text mode** + IconButton `x` "Dismiss for this session" (US-06 AC1, AC4).
- StorageNotWritable: Callout `warning`, icon `folder`, title `We can't save to this computer`, body `The data folder is read-only. Your debrief will be offered as a download at the end.`, action Button `secondary` sm **Fix in Settings** (US-23 AC4). Shown between questions only.

**3.3 Stage** `data-review-id="session.stage"`: column centred, max `--layout-narrow`, padding `--space-10` top / `--space-8` sides (narrow: `--space-6` / `--layout-gutter`); flex column, gap `--space-8`; the dock sits at the bottom (`margin-top: auto`).

**3.4 Question block** (local part) (US-14, P5) — *superseded by V2.1 (D49): the question is Mike's turn in the transcript.*
- Label row: `Mike` (`--text-sm`, `--weight-semibold`) + `Interviewer` (`--text-sm`, tertiary); English: `Coach`.
- Question: `Tell me about a time you had to change your plan late in a project. What happened?` `--text-xl`, `--weight-medium`, `--tracking-tight`, `--leading-normal`, centred. Narrow: `--text-lg`.
- Follow-up (added below, never replaces): Badge `outline` **Follow-up** + `What was the result for the merchants?` `--text-lg` primary; the main question then switches to `--color-text-secondary` (static).

**3.5 Orb + StatusPill** `data-review-id="session.orb"` (P2, P6, R7) — *superseded by V2.1 (D49): Presence along the top edge; the StatusPill sits above the island.*
- Orb `md` (220) wide; narrow `calc(var(--orb-size-sm) * 1.5)` 🟡 (no mid token); text mode `sm` (96). Gap to pill `--space-4`.
- G11 StatusPill: height `--control-h-sm`, padding-inline `--space-3`, `--radius-pill`, `--color-subtle`, `--text-sm` `--weight-medium`, dot `calc(var(--space-1) * 1.5)`. Dot is `--color-mic-live` only while the mic is open (your-turn, listening), grey `--color-text-tertiary` otherwise. Sub line under it, `--text-sm` secondary, static.
- Copy per phase: connecting `Connecting` / `Starting the local engine…` · mike-speaking `Mike is speaking` / `Press Space to interrupt` · your-turn `Your turn` / `Answer when you're ready` · listening `Listening` / `Take your time. Mike waits for 5 s of quiet.` · thinking `Thinking` · between `Your feedback is ready` / `Mike asks question 3 when you press Next question.` · muted `Muted` / `Press M to unmute` (icon `micOff`, no dot) · interrupted `Paused`.

**3.6 Captions · G15** `data-review-id="session.captions"` (R5 structure, P8) — *superseded by V2.1 (D49): the running transcript.*
- `Mode: subtitles` (voice): one turn block; header `Mike 07:02` or `You 07:05` (`--text-sm` semibold + tertiary `tabular-nums`); body `--text-lg`, `--leading-relaxed`, at most 3 lines (`max-height: calc(var(--text-lg) * var(--leading-relaxed) * 3)`, hard clip, content aligned to the bottom, no gradient mask: P4).
- User line, listening: `Two weeks before launch legal asked us to add a consent step to checkout. We re-planned the sprint, and I have led the redesign last spring, so I knew the flow… we tested it with` + interim `five merchants in two` in secondary.
- Footer (static, never changes while speaking): `What we heard. A wrong word? Fix it after you answer.` `--text-sm` secondary.
- `Mode: transcript` (text mode): all turns of this question, each block as above, `--space-4` between, scrolls inside, newest at the bottom; the user's lines read `You typed`.

**3.7 First-time tips** (`firstTime`, Question 1 only; static, removed after the first answer, never animated while speaking)
Card `subtle` sm, title `First time here` with `info` Icon; list `--space-2`: `Answer aloud when Mike stops. Pause to think: he waits up to 5 s.` · `When you're done, stop talking or press Enter.` · `Subtitles show what we heard. You can fix a wrong word after you answer.` Text mode: second line `When you're done, press Send (Enter).`

**3.8 Dock** — *superseded by §V2 Island (D47c); the suggester card stays on the stage, its toggle moves to More.* `data-review-id="session.dock"` (R7 conversation bar, US-13 AC1)
- Row, centred, gap `--space-3`: MicButton (48) `Mute`/`Unmute` · main action slot: mike-speaking → Button `secondary` `hand` **Interrupt**; your-turn → Button `secondary` `mic` **Talk now**; listening → Button `primary` `send` **Send now**; between → slot empty · Button `ghost` `redo` **Redo answer** · Button `ghost` `keyboard` **Type instead**.
- Help line under it (`--space-2`), `--text-sm` secondary: `Kbd Space` Interrupt · `Kbd M` Mute · `Kbd R` Redo · `Kbd Enter` Send now · `Kbd T` Type instead. Hidden on narrow and on coarse pointers.
- Narrow: dock sticky at the bottom, `--color-canvas` + top hairline, padding `--space-3` `--layout-gutter`; main action Button `lg` (48); Redo and Type instead become IconButton md with labels (44px hit area, §7).
- Connecting: the dock row is replaced by the G12 pill: Dots + `Connecting to Mike…` (`--control-h-lg`, `--radius-pill`, `--color-subtle`).
- Text mode: G1 Composer replaces the row: Textarea hidden label `Your answer`, placeholder `Type your answer`, `--radius-lg`, round send IconButton (pill, `--color-action`, `send`), hint `Enter to send · Shift+Enter for a new line` as Kbd pairs.
- Suggester (US-58, `suggester: on`): Card `subtle` sm under the dock: Toggle `Show a sample answer` / `Practice only. Say it in your own words.`; body `Story: Checkout consent step` + 3–5 sentences + `Points to cover` list. Generated once per question, static while speaking.

**3.9 Feedback column** `data-review-id="session.panel"` (US-15, P8, Q2 = a)
- *Wide column superseded by §V2.4 (floating panel opened from the island); content below unchanged.* Wide (v1): column `--color-sidebar`, Panel `aside` inset `--space-4`, `--radius-lg`, `--color-raised`, title `Feedback` (h2). Body scrolls; Footer holds Next question so it never moves.
- P0: `Feedback appears here after each question: one fix for content, language and delivery. Nothing will pop up while you're talking.` · P1 (listening / Mike speaking): `Listening. Feedback comes after your answer.` (previous feedback hidden, no counts, no spinner) · P2: TextShimmer `Preparing feedback for question 2…` + Skeleton `card` · P4: Callout `info` `Feedback isn't available for this answer. Your answer is saved.` + Next question.
- **P3 order (content-first; delivery-first swaps slots 1 and 3, GR8):**
  1. Head: `Question 2` h3 (`--text-md` semibold, `tabindex="-1"`, focus target) + `· Your answer + 1 follow-up` secondary.
  2. Summary row (gap `--space-2`, wraps): Badge `content` `Content · 1 fix` · Badge `language` `Language · 2 phrasings +1 to check` · Badge `delivery` `Delivery · 1 fix`.
  3. Answer row: Button `link` sm `eye` **Show your answer as we heard it** · Button `link` sm `edit` **Edit what I said**.
  4. Layer blocks, gap `--space-5`; each: left rule `--border-width-strong` `--color-layer-session-rule`, padding-left `--space-4`, header = layer Icon + name (`--color-layer-session-text`, semibold) + count. Monochrome: no tints in the Session.
     - **Content · 1 fix:** `End with what changed: a number or a decision.` · STAR row as 4 Badges `outline`: `Situation` `check`, `Task` `check`, `Action` `check`, `Result: missing` · `"we" → "I" ×2 in the action part. Say "I" for what you did.`
     - **Language · 2 phrasings:** header line `We may have misheard some words. If a quote isn't what you said, tell us: it won't count.` Cards (`--radius-md`, `--color-subtle`, padding `--space-4`, dl rows `--space-2`):
       - flag 1: `Heard as` "I have led the redesign last spring" (G20 `heard` dotted underline `--color-mark-heard`) · `Say` "I **led** the redesign last spring" (G20 `fix`: `--color-mark-fix` + semibold) · `Why` `A finished time ("last spring") takes the past simple.` · Badge neutral `B1 grammar` · actions Button `ghost` sm: **I said it right** · **It's a name or term** · **That's not what I said**.
       - flag 2: "we made it more easier for merchants" → "we made it **much** easier for merchants" · `"Easier" is already a comparative.` · `A2 grammar`.
       - check (`withChecks`): dashed `--color-border-control` border, title `Not counted until you confirm` · `Heard as` "legal give us two weeks" + G20 `unsure` + `(may be misheard)` · `Say` "legal **gave** us two weeks" · `Did you say this?` Button `secondary` sm **Yes, I said that** · Button `ghost` sm **No, I said…**.
       - removed line: `You marked "figure file" as misheard: not counted.` + Button `link` sm **Undo**.
       - "That's not what I said" open: `That's not what I said: removed, not counted.` · Input `What did you say? (optional)` prefilled `I have led the redesign last spring`, cursor in field · Button `secondary` sm **Save** · Button `ghost` sm **Skip**.
     - **Delivery · 1 fix:** muted block (`--color-subtle`, `--radius-md`, 3 columns, label tertiary / value primary): `Fillers` 11 · `Length` 2:20 (289 words) · `Pace` 124 wpm, comfortable. Tip: `Most fillers were "uh" (6) and "like" (4) at the start of a sentence. Pause silently instead.` Note (engine-flagged 🟡): `Filler counts may be low: the local recogniser can drop some "um"s.`
  5. Button `secondary` sm `chevronDown` **Show a stronger answer** → `Two weeks before launch, legal asked us to add a consent step to checkout. I cut two lower-priority items from the sprint, agreed the new scope with legal and engineering in one meeting, and we tested the step with five merchants in two days. We shipped on time, and drop-off at that step stayed under 2%.` (`--leading-relaxed`).
  6. Earlier questions: collapsed `Earlier questions (1)`.
  7. Footer: Button `primary` md FullWidth `arrowRight` **Next question**; on question 5 **See your debrief**.
- Editing (Edit what I said): body replaced: `Question 2 · Edit what I said` + `Change any word we misheard. Only this answer is checked again.` · Textarea `Your answer` (full text) · Textarea `Your follow-up` `We shipped on time and… I think merchants were happy.` · `Words we weren't sure about are underlined.` (only `withChecks`) · Button `primary` **Save and check again** + Button `ghost` **Cancel**; footer Next question becomes `secondary`. Rechecking: TextShimmer `Checking question 2 again…` + Skeleton `card`.
- Text mode: flags read `You typed`; the misheard line, checks and "That's not what I said" are hidden; Edit reads **Edit my answer**; Delivery: `Length 289 words. Pace and fillers aren't available in text mode.`
- English: panel title `Turn 4`, language block only (≤ 3 phrasings): "we discussed about the roadmap" → "we **discussed** the roadmap" (`"Discuss" takes no "about".` · `B1 grammar`), "I work here since three years" → "I **have worked** here **for** three years" (`B1 grammar`); no footer button. P0: `Corrections appear here after each of your turns. Nothing will pop up while you're talking.`
- Mid: G5 Drawer right, `--layout-panel`, `--shadow-overlay`, scrim `--color-scrim`. Narrow: G5 bottom sheet, top radius `--radius-xl`, max height `calc(100% - var(--layout-topbar))`, header with IconButton `x` **Hide feedback**; when hidden, a Button `secondary` sm `chevronDown` rotated **Feedback for question 2** sits above the dock to reopen it; footer Next question `lg` FullWidth, sticky.

**3.10 SessionInterrupted** (in stage, replaces question + captions + dock; panel stays) (US-04 AC5, US-13 AC5, F1)
Orb `offline` + StatusPill `Paused` · Callout `error` `Live: alert`, title `The AI model (Ollama) stopped responding`, body `Your answers so far are saved. Open the Ollama app, or paste this into Terminal:` CopyField `ollama serve` · line `We check again every 5 seconds. Resume turns on when it's back.` · Button `primary` **Resume** (disabled, reason is the line above) · Button `ghost` **End and see debrief**. No "Continue in text" (GR5). Voice-drop variant: title `The voice connection dropped`, body `Your answers so far are saved. Mike is still running, so you can carry on by typing.`, actions **Resume voice** (`primary`) · **Continue in text** (`secondary`).

**3.11 MicHelpDialog** (US-06 AC2) Dialog title `Mike can't hear you`; blocked: `The microphone is blocked in this browser.` ordered list `Click the lock icon left of the address bar.` · `Set Microphone to Allow.` · `Press Try again.`; no device: `No microphone found. Plug in a headset or pick another input in your system sound settings, then press Try again.` Actions Button `ghost` `keyboard` **Use text mode** · Button `primary` `refresh` **Try again**.

**3.12 Overflow fixture (+30%)** Title `Kestrel Pay Financial Services · Senior Product Designer, Merchant Payments and Risk` (ellipsis + tooltip); question `Tell me about a time you had to change your plan late in a project because of a requirement you didn't control, such as legal, security or a partner. What happened, and what did you decide?`; 3 phrasings + 1 check → the third phrasing collapses to `1 more phrasing not shown`, the check never collapses; stronger answer of 6 sentences; panel body scrolls, footer stays.

## 4. States for the review page (each a static `SessionView` fixture, light + dark, 1440 + 375)

| # | State | Props |
|---|---|---|
| S1 | Question 1 start, first-time tips, Mike speaking, panel P0 | `phase=mike-speaking firstTime` |
| S2 | Mike asks the follow-up (Q2), Interrupt in the dock, panel P1 | `phase=mike-speaking` |
| S3 | User speaking, quiet mode, mic at 0.6, interim words, panel P1 | `phase=listening micLevel=0.6` |
| S4 | Thinking: glow sweep + the one state pill «Thinking» (D55: no transcript dots, no island dots) | `phase=thinking` |
| S5a / S5b | P3 feedback, content-first / delivery-first, with check | `phase=feedback layerOrder=… withChecks` |
| S5c / S5d | "That's not what I said" field open / Edit what I said | `phase=feedback` + flag open / `phase=editing` |
| S6 | Text mode: transcript + composer, P3 with "You typed" | `input=text phase=feedback` |
| S7 | Drill, Question 1 of 3, Mike speaking | `variant=drill phase=mike-speaking` |
| S8 | English, Turn 4, language-only panel | `variant=english phase=feedback` |
| S9 | Connecting | `phase=connecting` |
| S10a / S10b | SessionInterrupted: engine / voice drop | `overlay=interrupted-engine \| interrupted-voice` |
| S11 | MicHelpDialog (blocked) | `overlay=mic-help` |
| S12 | StorageNotWritable + BrowserBanner, between questions | `overlay=storage` / `browser`, `phase=between` |
| S13 | Overflow +30% | `fixture=overflow phase=feedback withChecks` |
| S14 | Small states: P2 preparing · P4 unavailable · muted · suggester on | `phase=preparing \| unavailable`, `muted`, `suggester=on` |

## 5. Motion

### 5.1 The orb: three concepts (owner picks at review) — superseded by V2.1 (D49, Presence)
The v1 ChatGPT-like motion (clouds, glow, sky gradient) is not reused. In every concept one blue hue only; idle / muted / offline are the grey `--color-orb-idle` (not live, P2); the StatusPill text always names the state (P6). Listening never moves (quiet mode). A new row goes into `docs/motion.md` §3.4 before code (CONTRACT §4.5).

| | 1 · Voice-led (**recommended**) | 2 · Ripple | 3 · Clock arc |
|---|---|---|---|
| Shape | Matte disc + an "open ear" ring (2px `--color-orb-core`, `--space-2` gap) | Disc + up to 2 thin rings | Disc + a 2px ring track at `--space-2` gap |
| Speaking | Disc scale follows Mike's real playback level: `scale(1 + var(--voice) × 0.05)`, `--voice` written by rAF from the TTS analyser, smoothed like the mic, 120ms linear. Silence between phrases = still | A ring leaves the edge every `--duration-orb` / 2: scale 1 → 1.2, opacity .6 → 0 over `--duration-orb`, `--ease-enter` | Disc breath `scale(.98 ↔ 1.02)` `--duration-orb` `--ease-orb` alternate; no ring |
| Thinking | "Held breath": scale 1 → .94, hold, back; one cycle per `--duration-orb`, `--ease-orb` | One ring rests at 1.08, opacity .2 ↔ .6 `--duration-orb` | Ring shrinks to a 90° arc turning once per 2 × `--duration-orb`, linear |
| Listening / your turn | Static disc + static ring | Static ring at 1.08 | Full static ring |
| State change | scale / ring opacity `--duration-slow` `--ease-standard` | same | same |
| Reduced motion | All static at scale 1; ring only for listening | Rings static (speaking .4 at 1.14) | Arc static at 12 → 3 o'clock |
| Why / risk | Moves only when Mike's sound moves; mirrors the mic ring ("your voice moves your ring, Mike's voice moves his disc"). Needs an AnalyserNode on TTS playback 🟡 (stage 12); fallback = concept 3's breath | Reads as generic "voice assistant sonar" | Thinking arc reads like a spinner (Spinner is limited, motion §3.5) |

**Gradient conflict (P4 vs current Orb).** The current fill is off-centre (`circle at 35% 30%`), so the lighter edge colour reads as a specular highlight: a light source, which P4 and brand-direction row 1 forbid. CONTRACT §2.9 allows only "the orb's own two stops". Fix (recommended): centre it, `radial-gradient(circle at 50% 50%, var(--color-orb-core) 0 60%, var(--color-orb-edge) 100%)`, so the edge fades into the canvas (lighter on light, darker on dark) as pigment, not light. Alternative: flat `--color-orb-core`, no gradient (owner O3). The listening ring replaces today's `box-shadow` ring built on `--color-orb-edge` (#8DB4F5 on white is below 3:1; `--color-orb-core` is used instead).

### 5.2 Other elements (rows of `docs/motion.md`)

| Element | Motion | Row |
|---|---|---|
| Enter the Session | Orb `orb-in` scale `--duration-slower` `--ease-standard`; top bar meta `meta-in` `--duration-slow` | §3.3 Home → Session |
| Dock | `dock-in` `--duration-slower` `--ease-enter`; buttons press `scale(.92)` / `.97` `--duration-fast` | §3.3 D5, D9/D10 |
| Main-action swap | `rise-in` `--duration-base`, except into Send now (user just started talking: no animation) | §3.3 D6 |
| Connecting pill | Start pill cross-fades `--duration-fast` into Dots pill; label TextShimmer `--duration-loop-shimmer` | §3.3 D2/D3, §3.5 L5 |
| StatusPill | Label cross-fade `--duration-fast` (none into Listening); dot grey `pulse-dot` while thinking / connecting; blue dot static | §3.2 P6/P7, §3.7 |
| Mike's captions | New suffix fades in `--duration-slow` `--ease-enter` (see §7 item 6 on blur) | §3.4 C1 |
| Caption block / user line | `rise-in` `--duration-slow` for a new turn block; user's words update in place, no animation | §3.4 C2/C3 |
| Thinking dots | Dots `--duration-loop-dots`, grey | §3.4 C4 |
| Transcript (text mode) | Turn `rise-in` `--duration-slow`; auto-scroll smooth, `auto` under reduced motion | §3.4 C6, C10 |
| MicButton level | Thin ring follows `--mic`: opacity `.4 + level × .6`, scale `1 + level × .15`, 120ms linear; stays under reduced motion without transition | §3.3 D8 (fix §7) |
| Mode switch | Segmented thumb `--duration-base`; dock ↔ composer `soft-out` `--duration-exit` / `rise-in` `--duration-base`; orb md ↔ sm via `transform` | §3.2, §3.1 |
| Panel (wide) | P3 content `card-in` `--duration-slow`, held until the user stops | §3.4 C7/C8 |
| Drawer / sheet | Right `panel-in-x`, bottom `panel-in-y` `--duration-slower`, opacity delayed 120ms; scrim fade `--duration-base`, no blur | §3.3 N1/N2, D12 |
| P2 / rechecking | TextShimmer + Skeleton sweep `--duration-loop-skeleton` | §3.5 L1–L4 |
| Stronger answer chevron | `rotate(180deg)` `--duration-base` | §3.2 P5 |
| Flag dismissed | Card → removed line: `soft-out` `--duration-exit`, line `fade-in` `--duration-base` | 🟡 new row needed |
| MicHelpDialog | `dialog-in` `--duration-slow`, exit `--duration-exit`, never blocks | §3.3 D11 |
| Banners, Interrupted Callout | Appear without animation (Callout has no row) | components.md Callout 🟡 |
| Quiet mode | `data-motion-quiet` pauses every `.motion-loop` and `.shimmer-text`; nothing enters | §3.7, rule 3 |

## 6. PRD acceptance criteria on this screen
| Story | Where it is visible | Not on this screen |
|---|---|---|
| US-13 | AC1 dock + shortcuts + captions (S2, S3) · AC2 sub line "Mike waits for 5 s of quiet" · AC3 Segmented mic / keyboard · AC4 StatusPill `role="status"` · AC5 S10b · AC7 static timer in every state | AC6 latency (measured at 12) |
| US-14 | AC1 follow-up in the question block (S2) · AC2 `Standard` in the top bar | AC3, AC4 (prompt logic) |
| US-15 | AC1 P3 three layers + stronger answer · AC2 P1 · AC3 "nothing to fix" line · AC4 S5a/S5b · AC5 P4 · AC6 height budget at 1024 (Language shows flag 1 + `1 more phrasing`) | — |
| US-16 | AC1, AC4 S5a/S5b | AC2, AC3 (config) |
| US-17 | AC1 Say + Why + `B1 grammar` · AC2 removed line + Undo · AC3 "Nothing to fix in this answer." · AC4 ≤ 3 items | AC5 (debrief) |
| US-18 | AC1 Heard as · AC2 removed + not counted · AC3 field + Edit what I said (S5c, S5d) · AC4 check card · AC5 no checks without `withChecks` | — |
| US-19 | AC1 delivery block · AC3 filler note · AC4 text-mode line (S6) | AC2 (debrief) |
| US-04 AC5 | S10a | — |
| US-24 | AC2 level badge · AC3 language-only, after each turn (S8) · AC5 no upsell anywhere | AC1, AC4 (Home, History) |
| US-06 | AC1, AC4 BrowserBanner · AC2 MicHelpDialog · AC3 S6 | — |
| US-23 AC4 · US-58 | Storage banner (S12) · suggester card (S14), AC4 "Practice only", AC7 static | US-58 AC5 (debrief) |

## 7. Open DS decisions touching this screen
1. **Mic-live dot.** Build G11 StatusPill as its own component (state, dot, pulse, label cross-fade, `role="status"`) rather than adding `Tone: mic-live` to Badge: Badge stays static by contract and never blue. Recommended.
2. **44px touch targets on coarse pointers.** No 44px token exists. Add primitive `size.touch-target = 2.75rem` → semantic `--touch-target`; under `@media (pointer: coarse)` Button sm, IconButton, Chip and Segmented options get a centred `::before` of `--touch-target` without changing visual size. In the Session the narrow dock uses `lg` (48) directly and panel `ghost` sm buttons rely on the `::before`.
3. **Mic disc reads as a heavy ring.** At full level the solid blue disc (`inset: -8px`, opacity 1, scale 1.15) is a 74px blue mass around a 48px face. Fix (recommended): replace the disc with a 2px `--color-mic-live` ring (`--border-width-strong`) whose opacity (.4 → 1) and scale (1 → 1.15) follow the level; same ring language as the orb's listening ring. Alternative: keep the disc, cap opacity at `.15 + level × .35`.
4. **Index what already exists:** `MicButton` (G10) and `Dots` (G12) are in `ds/index.ts` but missing from `ds/components.md` (CONTRACT §7.2). `Dots` uses literal `5px` / `6px`; Orb has no `offline` story.
5. **Card radius:** the tips card and correction cards use `--radius-md` (CONTRACT §2.7); Card code is `--radius-lg` (components.md deviation).
6. **Caption blur vs CONTRACT §4.4** ("motion never adds blur"): `word-in` animates `blur(3px)`. Recommended: opacity only, `--duration-slow`.
7. **Container queries in DS components:** Tabs (hint hidden < 768px) and Session CSS use viewport `@media (max-width)`; switch to container queries so review frames render correctly.
8. **G5 Drawer** needs `Side: right | bottom`; **G20 InlineMark** `Kind: fix | heard | unsure` (Session, Debrief, HomeEnglish).

## 8. Owner decisions (yes / no)
- O1. ~~Shared PM fixture~~ — closed by the orchestrator: the shared fixture is ia.md §6 (Product Designer).
- O2. Orb motion: **concept 1 "Voice-led"** (no = pick 2 or 3 at review)?
- O3. Orb fill: **centred two-stop matte gradient** (no = flat single blue, no gradient)?
- O4. Live mic indicator as a **thin blue ring** instead of the solid disc?
- O5. **One state text** under the orb (StatusPill), no status pill in the top bar?
- O6. SessionInterrupted **inside the stage**, with the feedback panel still readable (no = modal Dialog)?
- O7. Build the **375 mobile frame** with a bottom-sheet feedback panel, although ia.md lists mobile as Won't?
- O8. Answer suggester **off by default** in a new session (US-58 AC2)?
- O9. English practice ends **only by End practice**, never by itself (Q17)?
