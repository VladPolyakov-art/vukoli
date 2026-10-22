# Screens — stage 11 index

> 2026-10-20 · composition maps by `product-designer`, reconciled by the orchestrator. Build order and shared rules for `frontend-engineer`.
> The owner works "by edits on the review artifact": code is built from the maps with the **defaults below**; each default is listed on the review page as a question with the default pre-chosen. Nothing here is approved yet.

## 1. Maps

| Screen | Map | States (stories) | Key references |
|---|---|---|---|
| Home v2: start screen + setup chat (+ English, VacancyEditor) | `home.md` | 11 start + 30 setup + 11 editor | R4 Gemini, R6 Ollama, R2 ChatGPT (D47) |
| Session (interview / drill / english + overlays), v2 island | `session.md` §V2 | S1–S14 + 4 island stories | R7 ElevenLabs bar, R5 Otter live transcript, orb = black box |
| Debrief (interview / english / example) + HistoryList | `debrief.md` | 12 + 7 | R5 Otter summary, R11 fix pattern |

## 2. Shared rules for all screens (orchestrator decisions)

1. **Fixture:** `docs/ia.md` §6 everywhere — Alex Morgan, Product Designer; Kestrel Pay / Lumen Health / Fieldnote; S1–S3. PM answers only in the Sam Rivera example. Stress fixtures (overflow) live apart from the main mock.
2. **Container queries, no viewport media queries for layout.** Screens are rendered inside scaled frames on the review page. Two named containers:
   - `shell` — the AppShell root: `≥ 1024` full rail · `< 1024` top bar + drawer (one shell breakpoint, `@container shell`); content inside pages reflows at `page < 840` and `page < 560`, Setup and Session at `< 768` (checked in code 2026-10-21, ui-spec Q12).
   - `page` — the `<main>` content box: `wide ≥ 840` · `medium 560–839` · `narrow < 560`. Session uses its own thresholds on `page` (see `session.md` §0).
   - Container-query widths are the one place where literal px is allowed (CSS can't read custom properties in a query); they are listed here and in `docs/frontend.md`.
   - `@media (pointer: coarse)`, `(prefers-reduced-motion)` and `(prefers-color-scheme)` stay media queries.
3. **No `vh` / `dvh`:** heights come from the parent (`height: 100%` down from the app root / frame).
4. **Overlays render inside the frame on the review page.** Dialog, menu, drawer, toast, tooltip take an optional portal container (an `OverlayRoot` context); the review frame provides one, the app uses `document.body` / top layer.
5. **`data-review-id`** on every meaningful block (`Screen/Section` or `Component/variant`), plus `data-review-section` + `data-comment-target` on the section roots. The review page prefixes them per frame.
6. **Every state is reachable by props** (`<Screen>View` pure component + live container). No audio, no network in review states.
7. **Motion:** new uses get a row in `docs/motion.md` before code (CONTRACT §4.5): Debrief build-up, Disclosure, banner in/out, weak-spot "Show all", sticky Start bar, orb concept 1.
8. **Shell (D57, claude.ai sidebar; supersedes D51·6 / D52·1):** brand + sidebar toggle · New practice (round filled plus) · Recents = all sessions, one line each, no dates, a "…" menu on hover (Open, Move to Trash) · AI engine warning (only when not ready) + account row that opens a menu upward (Settings, Appearance, Privacy and data) at the bottom; collapses to a narrow icon rail at ≥ 1024 (remembered), a Drawer below; set off by fill, no line. Details: `ds/components.md` → AppShell.

## 2b. AI engine: choose, then connect (D54, 2026-10-21) — superseded

> **Superseded by D78 (one view in Settings), D81 and D82 (Setup, 2026-10-21):** no A / B / C sub-screens. Setup step 1 (D82) is a choice of the four engines with nothing preselected on the first run; picking one that isn't Ready opens its setup under the row (Ollama → "Download Ollama"), Continue once Ready. Kept below as history.

Setup step 1 and Settings → AI engine no longer list all four engines expanded (a ~2500px wall). Owner: «сначала дать выбор человеку, какой моделью он будет пользоваться, а потом уже подключить».
- **A · choose:** heading "Choose how Mike runs" + one line; four radio rows (icon · name · one plain line · one status word "Ready" / "Needs setup"); Ollama carries "Recommended"; the engine in use (else Ollama) is preselected. Primary "Continue" (Setup) / "Connect" (Settings). Choosing does not switch the engine.
- **B · connect:** Back link, "Connect <name>", only that engine's connection UI (reused forms), cost and data in a closed "Cost and your data" disclosure; primary "Continue" (Setup → step 2 Test) / "Use <name>" (Settings → C) switches the engine once it is Ready.
- **C · Settings default:** one compact card for the engine in use ("Ollama · qwen3:8b · Ready", "Test the engine", "Change engine" → A → B → C; Ollama models under "Models").
- 🟡 Two sub-screens with Back (chosen by the orchestrator) rather than expand-in-place. 🟡 In Setup, a Ready engine still goes A → B → test (two Continue clicks); a shortcut A → test is possible if the owner finds it long.
- Component record: `ds/components.md` → EnginePanel. Review screen: "AI engine" (A ×2, B ×3, C). Stories: `Patterns/EnginePanel`.

## 3. Defaults taken until the review (owner can overturn any)

| # | Question | Default |
|---|---|---|
| Home O-1 | Saved jobs inside the composer instead of a row of cards | ~~yes~~ overridden by D47e: picker in the setup chat + plan card |
| Home O-2 | Segmented pill for Interview / English instead of underline tabs | ~~yes~~ overridden by D47e: mode chip in the composer (v2 Q3) |
| Home O-3 | Pasting a job opens the editor prefilled; Start with unsaved text offers "Save and start" | yes |
| Home O-4 | Remove the "Questions" select and the answer-mode switch | yes |
| Home O-5 | English tab without a composer | ~~yes~~ overridden by D47e: English starts from the composer too |
| Home O-6 | Sticky Start bar on mobile | ~~yes~~ overridden by D47e: no Start on the start screen |
| Home O-7 | Engine status stays in the rail, no model chip in the composer | yes |
| Home rail | "Recent" (3 sessions + All history) in the rail — overrides ia.md §2 "no chat list in the rail" (P3) | yes |
| Session O2 | Orb concept 1 "voice-led" (scale follows Mike's playback level; thinking = slow held breath; listening = still disc + still ring) | yes, 🟡 playback level checked at 12 |
| Session O3 | Orb gradient: centred stops, no off-centre highlight | yes (alt: flat blue) |
| Session O4 | Mic live indicator: thin 2px blue ring instead of the solid disc | yes |
| Session O5 | One state text under the orb, none in the top bar | yes |
| Session O6 | SessionInterrupted inside the stage, not a modal | yes |
| Session O8 | Answer suggester off by default | yes |
| Session O9 | English practice ends only by "End practice" | yes |
| Session caption | Caption word-in: opacity only, no blur (CONTRACT §4.4) | yes |
| 375 frames | Built for all three screens although mobile is "Won't" in the PRD | yes, 🟡 |
| Debrief O2 | Per-question timestamps | yes, 🟡 needs a start time per question saved at 12 |
| Debrief O3 | Verdict needs ≥ 3 answers | yes |
| Debrief O5 | Storage error: "Download debrief" is the only primary | yes |
| DS-1 | Card radius 10px (`--radius-md`) | yes |
| DS-2 | 44px hit area on coarse pointers via `--control-h-touch` (added 2026-10-20) | yes |
| DS-3 | `role="radio"` for single-choice Chip / SelectableCard | yes |
| DS-4 | Below 1024: top bar + drawer, no 64px icon rail | yes |
| DS-5 | Disabled = colour tokens (CONTRACT §2.3), no opacity token | yes |
| DS-6 | Composer send button "quiet" (outline) on Home, so Start stays the only primary | ~~yes~~ overridden by D47e: Home send is `action` (no other primary on the start screen) |
| Danger | Red danger button only for permanent delete; "Move to Trash" stays neutral | yes |
| G11 | StatusPill as its own component, not a Badge tone | yes |
| Home v2 Q1 | No Start on the start screen: a returning user goes "Kestrel Pay again" → plan → Start (2 clicks instead of 1) | yes |
| Home v2 Q2 | Update PRD US-22 AC1 (weak spots first on Home → chip + Mike's drill line + plan "Watch for") and US-29 AC1 (example visible → one tap away) | yes |
| Home v2 Q3 | Interview / English as a mode chip inside the composer, not a pill switch above it | yes |
| Session v2 Q4 | No top bar at all: title, round and strictness live in the island's More menu header | yes |
| Session v2 Q5 | Feedback panel opens on its own when feedback is ready (and closes when the next question starts); F toggles it | yes |
| Home v2 setup | Setup chat is scripted (fixed lines + keyword match), no LLM call; works while the engine is down | yes, 🟡 LLM-led later |

Open for the owner, no default changes the build: Debrief O4 (do answers given with the suggester count toward weak spots), Q4 / Q10 / Q13 copy (question count, strictness wording, level descriptions).

## 4. New DS work before screens (gaps from the maps)

- **Layout & overlays:** AppShell + Page on container queries, G17 Nav row, G16 List row (+ compact) with InlineRename, G5 Drawer (`right | bottom`), G4 Menu / listbox popover, G6 Tooltip, G3 Toast, Dialog inline mode, `OverlayRoot`.
- **Content:** G1 Composer (with attachment + `Send: action | quiet`), G7 Checkbox, G8 radio SelectableCard + Chip `role: toggle | radio`, G9 File drop zone, G10 MicButton thin ring, G11 StatusPill, G12 connecting pill (Dots), G13 Text shimmer, G15 Captions, G18 Weak-spot strip (`context: home | debrief`), G19 Disclosure, G20 InlineMark (`fix | heard | unsure`), Orb concept 1 + centred gradient.
- Session-only parts (G14 top bar + timer) stay in `src/screens/session/parts/`.

### 4.1 DS changes for v2 (D47, 2026-10-20; checked against `ds/components.md` and `app/web/src/ds`)
- **New `Island`** (G21): floating control container. `Shape: pill | box` · `Layout: inline | stacked` (stacked below 560 container width) · slots `groups[]` with hairline dividers · `--color-raised`, `--border-subtle`, `--shadow-raised`, `--radius-pill` / `--radius-lg` (stacked `--radius-xl`). Used by Session; replaces the session TopBar + Dock parts.
- **New `ChatMessage`** (G22): `Speaker: mike | user` · `State: final | pending | error` · slots `attachment`, `actions` (quick replies, links), `children` (rich content: plan card, example card). Mike = no bubble; user = `--color-subtle` bubble `--radius-lg`. Lives in a `role="log"` list.
- **Composer**: new `surface: own | none` (none = no border, shadow or radius, for the text-mode island). Home now uses `send.variant="action"` (DS-6 retired; `quiet` stays in the API, unused 🟡 remove at 12).
- **Menu**: `header` slot (title + meta + badges above the items) · **checkbox items** (`role="menuitemcheckbox"`, for the suggester) · `shortcut` hint on items (Kbd at the end). Radio items with `description` already exist.
- **Icons**: add `panel` (feedback panel toggle). All other v2 icons exist (`more`, `hand`, `stop`, `clock`, `redo`, `keyboard`, `briefcase`, `chat`, `plus`, `file`, `lock`, `alert`).
- **Chip as action**: no change: `Chip` with `selected` undefined renders a plain button (no `aria-pressed`); quick replies and suggestions = `ChipGroup role="group"` + Chips.
- **Retired / unused on Home**: `WeakSpotStrip context="home"` (kept for the debrief), Segmented track switch on Home, Home parts `WorkOn`, `RoundType`, `StartBlock`, `EnglishPanel`; Session parts `TopBar`, `Dock`. `PlanCard` is a Home screen part (one use), not DS.
- **Motion rows to add to `docs/motion.md`** before build: "Home → setup chat" (FLIP composer to the bottom), "Setup message", "Quick replies", "Stage shift" (panel open), "Island text-mode morph"; island in/out reuses §3.3 D5 `dock-in`; "Home → Session" rewritten (no orb scale from Home).

## 5. Edit log (review comments)

| Date | Comment | Level | Change |
|---|---|---|---|
| 2026-10-20 | D47a «кнопка отправки уехала» (composer send slid past the input) | DS | Fixed by the orchestrator: send inline inside the Composer field. Not redesigned in v2 |
| 2026-10-20 | D47b «хиру наша. Там зачем-то круг… просто хватит обычного текста» | screen | Home: orb removed; hero = one h1 "What are we practising today, Alex?" (`home.md` §3.1) |
| 2026-10-20 | D47c «какой-то так сказать островок» for the session controls | screen + DS | Session: one floating Island at the bottom centre holds every control; top bar and dock removed; feedback panel opens from the island (`session.md` §V2). New DS `Island`, Menu header + checkbox items, icon `panel` |
| 2026-10-20 | D47d sidebar rows too far apart | DS | Fixed by the orchestrator: tighter NavRow spacing. Not redesigned in v2 |
| 2026-10-20 | D47e «очень перегружена менюшка… небольшой чат перед этим» | screen + DS | Home v2: greeting + composer + ≤ 3 suggestion chips; settings move into a scripted setup chat (job → round → anything else) ending with a "Here's the plan" card and the only primary "Start interview" (`home.md` §3–§4). New DS `ChatMessage`; Home send `action`; O-1, O-2, O-5, O-6, DS-6 overridden |
| 2026-10-20 | D47f orb redesign | DS (orb) | Out of this iteration's maps: orb stays a black box `<Orb state size level/>`; redesigned through the orb moodboard |
