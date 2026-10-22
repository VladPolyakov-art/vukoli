# Components: Interview Coach (working name)

> Stage 10, step 3B.3 · 2026-10-20 · branch B (own DS) · direction A "Quiet chat, one live thing" (D46).
> **Source of truth is the code:** `app/web/src/ds/` (React + CSS modules, exported from `index.ts`) + Storybook stories `DS/*`. This file is the index agents work from. If code and this file disagree, fix one of them the same day (`ds/CONTRACT.md` §7).
> Tokens: `ds/foundation.md` (generated from `tokens/tokens.json`). Motion: `docs/motion.md` (§ numbers below point there). Rules: `ds/CONTRACT.md`.
> No Figma (design in code). The **Story** field is the Storybook id (`npm run storybook` → `?path=/story/<id>`), used where the directive says "Node ID".
> Legend: 🟡 to check or decide · **Deviation** = code differs from the approved foundation or the contract, fix at stage 11.

Inventory: **16 DS components in code** (Badge + Chip, Button + IconButton, Callout, Card + SelectableCard, CopyField, Dialog, EmptyState, Field = Input / Textarea / Select, Icons, Kbd, Presence (replaced Orb, D49), Panel, Segmented, Spinner, Tabs + TabPanel, Toggle) · **1 in progress** (Skeleton) · **5 app patterns** (AppShell, Page, Feedback, EnginePanel, VacancyEditor) · **18 gaps** from the ia.md inventory (§4).

---

## 0. Shared states (apply to every component; not repeated below)

| State | Rule | Tokens |
|---|---|---|
| Hover | Background step to `--color-hover`, or text from secondary to primary; never a colour hue | `--color-hover`, `--color-text-primary` |
| **Selected (pair with hover)** | Hover and selected greys are close on purpose (1.07:1 light, 1.11:1 dark, `docs/design-system.md` §4.4). **Selected always carries a non-colour cue + an aria state:** nav row → `--color-selected` + weight 500 + `aria-current`; chip → inverted fill `--color-surface-chip-selected` + `aria-pressed`; card / engine → check icon + a quiet 1px inset `--color-border-control` outline (D51) + `aria-pressed`/`aria-checked`; tab → 2px underline + `aria-selected`; segment → inverted thumb + `aria-checked`; icon button → `--color-selected` + "on" glyph + `aria-pressed` | `--color-selected`, `--color-checked`, `--color-text-on-checked`, `--color-border-selected` |
| Focus | Global `:focus-visible` in `global.css`: 2px `--color-focus` ring, **2px offset** (`--focus-ring-width`, `--focus-ring-offset`). Flush against a black/white fill it fails (2.93:1 / 2.57:1), with the offset it sits on the surface (≥ 4.69:1). Text fields are the one exception (offset 0, see Field) | `--color-focus` |
| Pressed | Primary steps to `--color-action-pressed`; press scale per motion.md §3.6 (`.97` buttons, `.96` chips, `.92` round icon buttons) | `--color-action-pressed` |
| Disabled | `disabled` attribute (not only a class); `cursor: not-allowed`. Primary uses readable tokens (4.67:1); others use opacity 🟡 (0.5 / 0.55 / 0.6 today, no token). A disabled primary has its reason in visible text nearby | `--color-action-disabled`, `--color-text-disabled` |
| Loading | Content areas → Skeleton; a working button → 3-dot pill (gap, §4) or `Button loading`; inline → Spinner. Container gets `aria-busy` | — |
| Themes | Every component works in light and dark through tokens only (GR13); no theme branches in components | — |
| Reduced motion | `global.css` zeroes durations and stops loops; see CONTRACT §4.6 | `--duration-*` |

---

## 1. DS components (in code)

### Badge · `ds/Badge.tsx`
- **Purpose:** static status label (engine Ready / Not ready, Local, layer name, "Selected"). Tone is never the only signal: always text, often an icon.
- **Anatomy:** pill · optional dot · optional icon (sm) · label.
- **Variants:** `Tone: neutral | live | success | warning | error | outline | content | language | delivery` · `Tinted: false | true` (layer tones only, **debrief only**) · `Dot: false | true` · `Icon: none | IconName`.
- **States:** static (no hover / focus). `title` for a tooltip.
- **Tokens:** neutral `--color-subtle` + `--color-text-secondary` · live `--color-selected` + `--color-text-primary` · success / warning / error `--color-{success|warning|error}-tint` + `--color-text-{success|warning|error}` (system states only) · outline `--color-border-subtle` + `--color-text-secondary` · layers `--color-subtle` + `--color-layer-session-text`; tinted `--color-layer-{content|language|delivery}-tint` · size `calc(--control-h-sm − --space-2)` = 24px, `--space-2`, `--radius-pill`, `--text-sm`, `--weight-medium`, `--leading-tight`.
- **Motion:** status pill and tab counter rows, §3.2 (pending dot `pulse-dot` `--duration-loop-dots`; new-item bump; label cross-fade `fast`). Paused while the user speaks.
- **Story:** `ds-badge--tones`, `ds-badge--debrief-tints`.
- **Deviation / gap:** the `dot` is `currentColor`, never blue. motion.md §3.2 needs a dot that is `--color-mic-live` **only while the mic is live** → resolved by StatusPill (§4 G11, built 2026-10-20).

### Chip · `ds/Badge.tsx`
- **Purpose:** toggleable or actionable pill: engine presets, topic / round / level pickers, history filters, Focus chips.
- **Anatomy:** `<button>` pill · optional icon · label (+ optional count in text).
- **Variants:** `Selected: false | true` · `Icon: none | IconName`.
- **States:** default · hover `--color-hover` · selected = inverted fill + `aria-pressed="true"` · focus ring (offset 2px, mandatory: the selected fill is black/white) · disabled (opacity 0.5).
- **Tokens (D51, no stroke):** `--control-h-sm`, `--space-3`, `--radius-pill`, `--text-sm`, `--color-text-primary`; fill `--color-surface-chip`, hover `--color-surface-chip-hover` · selected `--color-surface-chip-selected` + `--color-text-on-checked`, selected hover / press `--color-surface-chip-selected-hover` (label unchanged: the selected rule outranks plain hover) · disabled `--color-surface-chip` + `--color-text-tertiary`, hover does nothing.
- **Motion:** §3.2 Chips: fill `--duration-base`, press `scale(.96)` `fast`. Checkbox chips (briefing) §3.2: check icon `scale(.6 → 1)` `base`.
- **Story:** `ds-badge--chips`, `ds-badge--radio-chips`, `ds-badge--radio-chips-centred`, `ds-badge--radio-chips-narrow`, `ds-badge--with-counts`.
- **Update 2026-10-20 (G8):** `Role: toggle | radio` (radio = `role="radio"` + `aria-checked`), `Count` (tabular, part of the name), disabled = colour tokens (no opacity, DS-5), 44px hit area on coarse pointers. New `ChipGroup` (`label`, `hideLabel`, `role`, `align: start | center`): `radiogroup` / `group`, one Tab stop, arrows move and select (`ds/roving.ts`).
- **Note:** motion.md §3.2 writes `--color-action` for the selected chip; the contract uses `--color-checked` (same value today, separate role). Code is right.

### Button · `ds/Button.tsx`
- **Purpose:** actions. One `primary` per view (Start interview, Send, Save).
- **Anatomy:** pill · optional left icon or spinner · label · optional right icon.
- **Variants:** `Variant: primary | secondary | ghost | link | danger` · `Size: sm | md | lg` (32 / 40 / 48px) · `Icon: none | left | right` · `FullWidth: false | true`.
- **States:** default · hover · pressed · focus (offset 2px) · disabled (primary: readable disabled tokens; others opacity 0.55) · **loading** (`loading` keeps the label, disables, sets `aria-busy`, swaps the left icon for a spinner).
- **Tokens:** `--control-h-md` (sm `--control-h-sm`, lg `--control-h-lg`), `--space-4` (sm `--space-3`, lg `--space-6`), `--radius-pill`, `--text-sm` (lg `--text-md`), `--weight-medium` · primary `--color-action`, `--color-action-hover`, `--color-action-pressed`, `--color-text-on-action`; disabled `--color-action-disabled` + `--color-text-disabled` · secondary (D51, no stroke) `--color-surface-chip` + `--color-text-primary`, hover / press `--color-surface-chip-hover` · ghost transparent, hover `--color-hover` · link `--color-text-link` + underline (always) · danger `--color-surface-chip` + `--color-text-error` label (no stroke), hover `--color-error-tint`. Hover / press never apply to `disabled` or `aria-disabled`.
- **Motion:** §3.6 Buttons: colours `--duration-fast` `--ease-standard`; press `scale(.97)`. Start button and Start → connecting, §3.3 (cross-fade into the connecting pill). Send / redo appear `rise-in` `base`, §3.3.
- **Story:** `ds-button--primary`, `--secondary`, `--ghost`, `--link`, `--danger`, `--loading`, `--disabled`, `--sizes`.
- **Deviation:** the internal spinner uses a literal `900ms` (no loop token) and its own `@keyframes spin` (CONTRACT §4.1, §4.4). `danger` (red) is allowed only for irreversible deletion, never for End or Mute (CONTRACT §2.4) 🟡.

### IconButton · `ds/Button.tsx`
- **Purpose:** icon-only action: copy, close, show key, mute.
- **Anatomy:** square button · one icon · accessible name from the required `label` (also the tooltip).
- **Variants:** `Size: sm | md` (32 / 40px) · `Outlined: false | true` · `Pressed: false | true` · `Dot: false | true` (13, QA-01: an 8px unread dot in the corner, `--color-text-primary` on `--radius-pill`, `aria-hidden`; the caller puts the cue in `label`, e.g. "Show feedback (F), new feedback is ready").
- **States:** default `--color-text-secondary` · hover `--color-hover` + `--color-text-primary` · pressed = `--color-selected` + the "on" glyph from the caller (e.g. `micOff`) + `aria-pressed` · focus · disabled (opacity 0.5).
- **Tokens:** `--control-h-md` / `--control-h-sm`, `--radius-md`, `--color-text-secondary`, `--color-hover`, `--color-text-primary`, outlined (D51: no stroke) `--color-surface-chip`, hover `--color-surface-chip-hover`, pressed `--color-selected`, pressed + hover `--color-surface-chip-hover` (icon colour unchanged).
- **Motion:** §3.6: colours `fast`, press `scale(.92)` (round) / `.94`.
- **Story:** `ds-button--icon-buttons`, `ds-button--icon-button-with-dot`.
- **Gap:** 32 / 40px is below the 44px touch target on tablet (CONTRACT §5.3). The round send button of the composer (pill) is not this component (§4 G1).

### Callout · `ds/Callout.tsx`
- **Purpose:** inline notice or banner: data line, engine not running, file error, "It works". Also covers the `BrowserBanner` and `StorageNotWritable` banners of ia.md.
- **Anatomy:** icon · title · body · actions row.
- **Variants:** `Tone: info | success | warning | error` · `Live: none | status | alert` (`alert` for errors caused by an action) · `Icon: default per tone | IconName`.
- **States:** static; actions inside follow Button states.
- **Tokens:** `--space-3` / `--space-4`, `--radius-md`, `--text-sm`, `--leading-normal`, `--color-text-primary`, title `--weight-semibold` · info `--color-subtle` + icon `--color-text-secondary` · success / warning / error `--color-{tone}-tint` + icon `--color-text-{tone}`.
- **Motion:** no row in motion.md: appears without animation 🟡 (if it must enter after load, `fade-in` `base`, to confirm in the stage-11 review). Never appears while the user speaks (GR6), except errors that stop the session.
- **Story:** `ds-callout--info`, `--warning`, `--error`, `--success`.
- **Rule:** status tones only for system states (engine, files, storage, connection). Never for answers or feedback (P8).

### Card · `ds/Card.tsx`
- **Purpose:** a surface that groups content (engine card, debrief question card, weak-spot card).
- **Anatomy:** container · content.
- **Variants:** `As: div | section | article | li` · `Padding: sm | md | lg` (12 / 20 / 24px) · `Tone: raised | subtle | flat`.
- **States:** static.
- **Tokens (D51, fill not stroke):** `--color-surface-card`, `--radius-md`, `--color-text-primary`; `--space-3` / `--space-5` / `--space-6`; subtle `--color-surface-chip`; interactive hover `--color-surface-card-hover`.
- **Motion:** feedback cards `card-in` `slow` `--ease-enter`, held while the user speaks, §3.4 C7. Home build-up `rise-in` + `--duration-stagger`, §3.1.
- **Story:** `ds-card--raised`, `ds-card--subtle`, `ds-card--flat`.
- **Resolved 2026-10-20:** radius aligned to `--radius-md` (10px, DS-1); composer and panels keep `--radius-lg`.

### SelectableCard · `ds/Card.tsx`
- **Purpose:** one choice in a set: vacancy card, engine option.
- **Anatomy:** full-width `<button>` card · content (caller renders the check icon when selected).
- **Variants:** `Selected: false | true` · `Padding: sm | md | lg` · `Disabled: false | true`.
- **States:** default · hover = fill to `--color-surface-card-hover` · selected = check icon + a quiet 1px inset `--color-border-control` outline (D51: the one stroke kept, it carries state; the fill stays the card fill so fields inside keep contrast) + `aria-pressed`; selected + hover steps the fill, outline and text stay · focus (offset 2px) · disabled.
- **Tokens:** as Card + `--color-border-control` (selected outline), `--duration-fast`.
- **Motion:** fill `fast`, §3.6 list rows.
- **Story:** `ds-card--selectable`, `ds-card--radio-group`, `ds-card--radio-group-nothing-selected`, `ds-card--radio-group-narrow`, `ds-card--radio-group-very-narrow`, `ds-card--overflow`.
- **Resolved 2026-10-20 (G8):** `Role: toggle | radio`; `Check: true | false` (the card draws the check icon in the top-end corner when selected; pass `false` only when the content draws its own); disabled = colour tokens. New `SelectableCardGroup` (`label`, `hideLabel`, `columns: 1–4`, `description`): `radiogroup`, roving tabindex, columns drop to 2 under 560px and to 1 under 320px of the **group's own width** (container query).

### CopyField · `ds/CopyField.tsx`
- **Purpose:** one-line command to copy (`ollama serve`, `ollama pull …`).
- **Anatomy:** mono code (selectable, scrolls) · live "Copied" text · IconButton sm.
- **Variants:** none (props: `value`, `copyLabel`, `copiedLabel`, `label`).
- **States:** default · copied (icon `check` + "Copied" text for 2 s, `aria-live="polite"`, no toast) · clipboard denied → selects the text.
- **Tokens:** `--color-subtle`, `--color-border-subtle`, `--radius-md`, `--font-mono`, `--text-sm`, `--color-text-primary`; "Copied" `--color-text-success` (a system "it works" state).
- **Motion:** no row; icon and text swap instantly 🟡 (a `fast` cross-fade is enough if the review asks).
- **Story:** `ds-copyfield--command`.

### Dialog · `ds/Dialog.tsx`
- **Purpose:** modal decision: end round, confirm permanent delete, cloud recognition confirm, mic help, session interrupted, vacancy editor.
- **Anatomy:** native `<dialog>` · title (h2, labels the dialog) · body · actions row (right-aligned).
- **Variants:** mode by context (2026-10-20): `modal` (app: native `showModal()`) · `contained` (inside an `OverlayRoot`, review frames: plain scrim element, focus trapped in the frame) · `inline` (prop: open box in the flow, gallery). Props: `open`, `title`, `actions`, `actionsStart` (secondary action on the left), `onClose`, `inline`.
- **States:** closed · open (focus trap, Esc and inert background from the platform; Esc calls `onClose`) · narrow (`@container dialog (width < 480px)`: actions stack full width, primary on top).
- **Tokens:** `--layout-dialog` (560px), `--layout-gutter`, `--space-12`, `--color-border-subtle`, `--radius-xl`, `--color-raised`, `--color-text-primary`, `--shadow-overlay`, `::backdrop` `--color-scrim`; `--space-4` / `--space-6`; title `--text-lg`; body `--color-text-secondary`, `--text-sm`.
- **Motion:** §3.3 Dialogs: enter `translateY(10px) scale(.97)` → rest `slow` `--ease-enter`; exit `--duration-exit`; scrim fade `base`, **no blur**; exit never blocks (timeout fallback), focus returns at once (motion rule 5).
- **Story:** `ds-dialog--default`, `--inline-open`, `--with-start-action`, `--narrow`, `--in-frame`.

### OverlayRoot · `ds/OverlayRoot.tsx` (+ `ds/overlay.ts`) — built 2026-10-20 (stage 11)
- **Purpose:** where Dialog, Drawer, Menu, Toast and Tooltip render (`ds/screens/_index.md` §2.4). Inside an `<OverlayRoot>` (every review frame) overlays portal into its layer and stay inside the scaled frame; without one (the app) they portal into `document.body`, or into the open `<dialog>` around their trigger, and Dialog keeps `showModal()`.
- **Anatomy:** root (`height: 100%`) · children · layer (`position: absolute; inset: 0`, `--z-overlay`, `pointer-events: none`, container `overlay`). Each overlay opts back into pointer events.
- **API:** `OverlayRoot`, `OverlayPortal`, `useOverlayRoot()`; helpers in `overlay.ts`: `useOverlayFocus` (focus in / return, no focus steal for overlays open at first mount), `trapTab`, `place` (pure, unit-tested) + `useAnchoredPosition` (divides out the frame scale), `useOutsidePress`.
- **Story:** `ds-overlayroot--phone-frame`, `--wide-frame`.

### EmptyState · `ds/EmptyState.tsx`
- **Purpose:** nothing here yet + what to do: no rounds, filtered empty, trash empty, no vacancies.
- **Anatomy:** icon disc · title (h2 / h3) · body · actions.
- **Variants:** `Compact: false | true` · `HeadingLevel: 2 | 3` · `Icon: info | IconName`.
- **States:** static.
- **Tokens:** `--space-10` / `--space-6` (compact `--space-6` / `--space-4`), `--color-text-secondary`; disc `--control-h-lg`, `--radius-pill`, `--color-subtle`; title `--text-lg`, `--weight-semibold`, `--color-text-primary`; body `--layout-dialog`, `--text-sm`.
- **Motion:** enters with the page, `rise-in` `slow`, §3.1 route change.
- **Story:** `ds-emptystate--history`.

### Field: Input · Textarea · Select · `ds/Field.tsx`
- **Purpose:** labelled form controls: base URL, model, API key, vacancy text, job title, CV paste.
- **Anatomy:** label (+ "· optional" text) · control · hint **or** error (icon + text, `role="alert"`) · optional footer (counter). `aria-describedby` and `aria-invalid` wired.
- **Variants:** `Control: input | textarea | select` · `HideLabel: false | true` · Input `Adornment: none | node` (e.g. show-key IconButton) · Textarea `ShowCount: false | true` · Select `options[]` (with `disabled`).
- **States:** default · placeholder · focus (ring, offset 0, the one allowed exception: the field fill is raised/canvas) · error (border `--color-text-error` + message) · disabled (opacity 0.6) · read-only (browser default).
- **Tokens:** label `--text-sm`, `--weight-medium`, `--color-text-primary`; optional `--color-text-tertiary`; hint `--color-text-secondary`; error `--color-text-error`; control `--control-h-md`, `--space-2` / `--space-3`, `--radius-md`, fill `--color-surface-field` (D51: no stroke; hover `--color-surface-chip-hover`; invalid keeps the `--color-text-error` stroke), `--text-md`, `--leading-normal`, placeholder `--color-text-tertiary`; textarea min `--control-h-lg × 2.5`; chevron `--color-text-secondary`; counter `--color-text-tertiary`.
- **Motion:** §3.6 Composer / input focus: border colour `fast`; the ring is the blue 2px ring, no glow.
- **Story:** `ds-field--text-input`, `--with-error`, `--secret-input`, `--text-area`, `--select-box`.

### Icons · `ds/icons.tsx`
- **Purpose:** the only icon set: line icons on a 24 grid, 1.75 stroke, `currentColor`.
- **Anatomy:** `<svg>` · path set by `name`.
- **Variants:** `Size: sm | md | lg` (16 / 20 / 24px) · `Name:` 53 names (`sidebar` (D57 sidebar toggle), `menu`, `more`, `search`, **v2 `panel`** (feedback panel toggle, 2026-10-20), `mic`, `micOff`, `keyboard`, `send`, `redo`, `stop`, `play`, `check`, `x`, `copy`, `refresh`, `chevronDown|Right|Left`, `arrowRight`, `external`, `settings`, `history`, `practice`, `sun`, `moon`, `monitor`, `trash`, `edit`, `content`, `language`, `delivery`, `alert`, `info`, `sparkle`, `user`, `briefcase`, `upload`, `link`, `file`, `clock`, `plus`, `download`, `lock`, `hand`, `chat`, `cpu`, `globe`, `terminal`, `key`, `folder`, `eye`, **V2.1 `arrowDown`** ("Jump to latest", D49)) · `Label: none (decorative, aria-hidden) | text (role="img")`.
- **States:** inherits colour from the parent.
- **Tokens:** `--icon-sm|md|lg`; colour only via `currentColor`.
- **Motion:** chevron `rotate(180deg)` `base`, §3.2 P5; menu check fade `fast`.
- **Story:** `ds-icons--all`.

### Kbd · `ds/Kbd.tsx`
- **Purpose:** a key in shortcut hints (`Space`, `M`, `R`, `Enter`, `T`).
- **Anatomy:** `<kbd>` keycap.
- **Variants:** none.
- **States:** static.
- **Tokens:** `--color-border-subtle` + `--border-width-strong` bottom, `--radius-sm`, `--color-raised`, `--color-text-secondary`, `--font-sans`, `--text-sm`, `--leading-normal`.
- **Motion:** none.
- **Story:** `ds-icons--keys` (no own story; add `DS/Kbd` at stage 11).

### Presence · `ds/Presence.tsx` (+ `ds/presenceModel.ts`) — built 2026-10-20 (stage 11 v2.1, D49)
- **Purpose:** Mike's presence in the Session: a glow along the top edge of the stage that exists only while someone talks. Decorative (`aria-hidden`); the state is always text (StatusPill above the island).
- **Anatomy:** a box that fills its parent (the Session gives full stage width × `--presence-reach`; the box bottom is the first text line) · two half-resolution canvases of the same glow: a soft field (opacity .6) and a copy shown only through the owner's dot tile (`mask-image: assets/presence-dots.webp`, seamless 645 × 430, used at 2×, cut by `app/web/scripts/presence-tile.mjs`).
- **Variants:** `State: idle | listening | thinking | speaking` · `level` (static 0..1) or `getLevel` (read per frame; wins) · `reducedMotion` (override; otherwise the OS setting).
- **States:** speaking (D51) = a steady deep tongue in the centre (gently breathing, about twice as deep as the sides) over five phase-offset lobes across the width (centre, both sides, two between), all rising with Mike's level (no source → a speech-like envelope) · listening = the same lobes, calmer, following the user's mic smoothed τ 450ms · thinking = one broad crest sweeping side to side (ping-pong, `--duration-presence-sweep` per pass) · waiting (your turn, D50) = the same lobes at ~35% strength, low and very slow (breathing ×0.35), no reaction to sound · idle = **no glow**, fades out over `--duration-slow`. No permanent line. States cross-fade (τ 300ms). Reduced motion = one still frame per state (thinking: crest held at the left).
- **Text safety:** column heights stay below the box bottom at any level (tested at 220 / 170px, D51); the glow fades to `--presence-mask-stop` (12%) over `--presence-fade` (64px) above it; text primary / secondary keep ≥ 4.5:1 over the worst remaining glow, light (normal) and dark (`mix-blend-mode: screen`), tested from `tokens.css`.
- **Tokens:** `--color-presence-deep|strong|core|soft` (blue.700 → .400, drifting slowly across the width), `--presence-reach`, `--presence-reach-sm` (phone), `--presence-fade`, `--presence-mask-stop`, `--duration-presence-sweep`, `--ease-presence`, `--duration-slow`; dark detection from `--color-canvas`.
- **Cost:** columns 6px (4px under 560px) drawn with one unit gradient, colour by `source-in`, mask by `destination-out`, half resolution; the loop runs only while on screen (IntersectionObserver), the tab is visible and something is left to draw (sleeps at idle). `data-frame-ms` = rolling 60-frame cost. 🟡 Headless software rendering measured ≈1.0ms at 1440 and ≈0.3ms at 375; the 0.5ms target at 1440 still needs a GPU-browser check.
- **Motion:** `docs/motion.md` rows "Presence fade in / out", "Presence speaking / listening reaction", "Presence thinking sweep", "Presence reduced motion".
- **Story:** `ds-presence--speaking`, `--speaking-no-level`, `--listening`, `--thinking`, `--waiting`, `--idle`, `--speaking-static-level`, `--listening-quiet`, `--reduced-speaking`, `--reduced-listening`, `--reduced-thinking`, `--phone`, `--state-driver`.

### ~~Orb · `ds/Orb.tsx`~~ — retired 2026-10-20 (D49)
Replaced by **Presence** (above): the owner chose the edge glow (A6) over a disc, without the permanent top line, with the dot pattern under the glow and the blue palette. `Orb.tsx`, `Orb.module.css`, `Orb.stories.tsx`, the `orb-in` keyframe, `--duration-orb` and the `--color-orb-*` roles are gone. The reducer selector `selectOrb` and the i18n keys `session.orb.*` keep their names (state machine and copy, not the visual).

### Panel · `ds/Panel.tsx`
- **Purpose:** titled side region: the session feedback panel, settings blocks.
- **Anatomy:** `<section>` / `<aside>` · header (h2 title + actions) · scrolling body · optional footer.
- **Variants:** `As: section | aside` · `Footer: none | node` · `Actions: none | node`.
- **States:** static; body scrolls (`min-height: 0`).
- **Tokens:** `--color-surface-card` (D51: no outer stroke; header / footer keep a hairline divider), `--radius-lg`; header `--space-4` / `--space-5`; title `--text-md`, `--weight-semibold`; body `--space-4` / `--space-5`; footer `--space-3` / `--space-5`.
- **Motion:** §3.3 Feedback panel opens: `translateX(32px)` → 0 `slower`, opacity delayed 120ms; ≤ 860px from below. Side sheets, §3.3 D12.
- **Story:** `ds-panel--default`.

### Segmented · `ds/Segmented.tsx`
- **Purpose:** pick one of 2–4 options: answer mode (voice / keyboard), theme, vacancy source, mode switch.
- **Anatomy:** label (visible or hidden) · `radiogroup` pill track · option pills (icon + label).
- **Variants:** `FullWidth: false | true` · `HideLabel: false | true` · option `Icon: none | IconName`, `Disabled`.
- **States:** default `--color-text-secondary` · hover text to primary · selected = raised thumb + `aria-checked` · focus (roving tabindex; arrows move **and** select) · disabled option (opacity 0.5).
- **Tokens (D51, no stroke):** track `--color-surface-chip`, `--radius-pill`, `--space-1`; option `--control-h-sm`, `--space-3`, `--radius-pill`, `--text-sm`, `--weight-medium`; selected thumb `--color-surface-chip-selected` + `--color-text-on-checked` (hover does not change it); legend `--text-sm`, `--weight-medium`.
- **Motion:** §3.2 Segmented: a **sliding pill thumb** moves under the selected option (`transform` `base` `--ease-standard`), label colour `fast`. Mode switch content swap, §3.1 (`soft-out` `exit`, `rise-in` `base`).
- **Story:** `ds-segmented--default`, `ds-segmented--theme-picker`.
- **D82, one row always:** the track never wraps (`flex-wrap: nowrap`), labels ellipsis. In a SettingRow narrower than 30rem a radiogroup takes the full width, segments share it equally and drop their icons, so two segments always sit on one row (owner: «сверху он же компьютер и снизу в браузере… что за бред»). Labels stay short ("Computer" / "Browser"); the row description explains.
- **Status:** the sliding thumb is being added by the motion work now; today the selected background cross-fades.

### Spinner · `ds/Spinner.tsx`
- **Purpose:** small inline "working" mark. **Limited** (motion.md §3.5): only inside small buttons or a one-line status; content areas use Skeleton.
- **Anatomy:** ring · visible label **or** visually hidden `srLabel` · `role="status"`.
- **Variants:** `Size: sm | md | lg` · `Label: visible | srLabel`.
- **States:** spinning · reduced motion: static ring with a distinct quarter.
- **Tokens:** `--icon-sm|md|lg`, `--border-width-strong`, `--color-border-subtle`, `currentColor`; row `--color-text-secondary`, `--text-sm`, `--space-2`.
- **Motion:** §3.5 Spinner "Keep, limit".
- **Story:** `ds-spinner--with-label`, `ds-spinner--sizes`.
- **Deviation:** literal `0.9s` loop and own `@keyframes spin` (no loop token for the spinner) 🟡.

### Tabs + TabPanel · `ds/Tabs.tsx`
- **Purpose:** switch views in place: Interview / English practice on Home, feedback layers, settings sections.
- **Anatomy:** `tablist` (bottom hairline) · tabs (icon + label + optional hint on inactive tabs) · `tabpanel`.
- **Variants:** item `Icon: none | IconName` · item `Hint: none | text` (hidden when the `page` container is < 560px, 2026-10-20).
- **States:** default `--color-text-secondary` · hover text to primary · selected = 2px underline `--color-border-selected` + text primary + `aria-selected` · focus (roving; arrows, Home, End; automatic activation).
- **Tokens:** list `--color-border-subtle`, `--space-1`; tab `--control-h-md`, `--space-4`, `--text-sm`, `--weight-medium`, `--border-width-strong`, `--color-border-selected`; hint `--color-text-tertiary`.
- **Motion:** §3.2 Tabs: the selected indicator slides between tabs (`transform` `base`); tab counter pending / new item, §3.2 P3b / P3c.
- **Story:** `ds-tabs--default`, `--narrow-page`.

### Toggle · `ds/Toggle.tsx`
- **Purpose:** on / off setting: answer suggester, Mike speaks, telemetry opt-in.
- **Anatomy:** label + optional description · `role="switch"` track with thumb.
- **Variants:** `HideLabel: false | true` · `Description: none | text`.
- **States:** off (thumb `--color-text-secondary`) · on (`--color-checked` fill, thumb `--color-text-on-checked`, `aria-checked`) · focus (offset 2px, mandatory when on) · disabled (opacity 0.5).
- **Tokens:** `--toggle-w`, `--toggle-h`, `--radius-pill`, `--color-border-control`, `--color-subtle`, `--color-text-secondary`, `--color-checked`, `--color-text-on-checked`, `--duration-fast`, `--ease-standard`; label `--text-md`, `--weight-medium`; description `--text-sm`, `--color-text-secondary`.
- **Motion:** §3.2 Toggle: track fill `base`, knob slide `base` + 40ms, `--ease-standard` (code uses `fast` today; being aligned by the motion work).
- **Story:** `ds-toggle--off`, `ds-toggle--on`, `ds-toggle--disabled`.

### Skeleton · `ds/Skeleton.tsx` — **in progress** (not in `app/web/src/ds` yet, 2026-10-20)
- **Purpose:** ghost loading for content areas: History list, Debrief until the report loads, feedback panel while coaching is pending, vacancy / briefing preparation, Settings engine list while checking, Home weak-spots card (motion.md §3.5).
- **Anatomy:** container (`aria-busy="true"`, visually hidden "Loading…") · grey bars; `card` adds a title bar; `row` adds a leading icon circle.
- **Variants:** `Variant: lines | card | row` · `Lines: n` (default 3; widths like v1: 32 / 88 / 58%, 100 / 86 / 62%).
- **States:** animating · reduced motion: flat grey bars, no sweep.
- **Tokens:** base `--color-subtle`, highlight `--color-selected`, `--radius-sm`, `--duration-loop-skeleton` (`ease-in-out`), bar stagger 120ms 🟡 (no token: `--duration-stagger` is 80ms), bar height 10px 🟡 (off the space scale: use `calc(var(--space-2) + var(--space-1) / 2)` or add a size token).
- **Motion:** §3.5 Skeleton: sweep keyframe `skeleton` from `global.css`, bars staggered; never runs while the user speaks.
- **Story:** `DS/Skeleton` → expected ids `ds-skeleton--lines`, `--card`, `--row` (to confirm when the story lands).

---

## 2. App patterns (compositions in `app/web/src/components/`)

Patterns are not DS components: they compose DS components for one product job, are reused across screens, and must not be copied into screens.

### AppShell (+ EngineStatusBadge) · `components/AppShell.tsx`
- **Purpose:** global frame outside the Session: left rail (240px) with brand, Practice / History / Settings, "Recent" (3 sessions + All history), engine status block, storage line; skip link; `<main id="main">` (the scroll container and the `page` container).
- **Rebuilt 2026-10-20 (stage 11):** `AppShellView` (pure, every state by props: `current`, `currentSessionId`, `recent: loading | error | ready`, `engine`, `drawerOpen`) + live `AppShell` (store, `api.sessions()`, scroll reset per page, `ToastProvider`). Root = container `shell`: ≥ 1024 full rail · 640–1023 top bar (menu, app name, engine name + badge) + rail in Drawer G5 `left` · < 640 top bar, badge only. No vh: heights from `#root` / the frame.
- **Built from:** Icon, IconButton, Badge (`EngineBadge` pure / `EngineStatusBadge` live: `neutral` checking · `success` Ready · `warning` Not ready), NavRow G17, ListRow G16 `compact`, Skeleton, Drawer G5, ToastProvider G3; `RouterLink` adapter for DS rows.
- **States:** nav row default `--color-text-secondary` 400 · hover `--color-hover` · current = `--color-selected` + `--color-text-primary` + weight 500 + `aria-current="page"` · engine checking / ready / not ready · Recent loading (Skeleton) / empty ("Your sessions will appear here.") / error (hidden) · a debrief listed in Recent: its row is current, no nav row.
- **Tokens:** `--layout-rail`, `--color-sidebar`, `--color-canvas`, `--color-border-subtle`, `--space-*`, brand mark `--color-action` + `--color-text-on-action`, status block `--color-subtle`, `--radius-md`, `--z-sticky`, skip link `--z-toast` + `--color-action`.
- **Motion:** §3.1 sidebar collapse / drawer (transform, scrim fade, no blur); route change: the rail does not move; brand mark hover `rotate(-8deg) scale(1.04)` `slow`, §3.6 B8.
- **Story:** `patterns-appshell--desktop`, `--desktop-start`, `--tablet`, `--mobile`, `--mobile-drawer-open`, `--recent-loading`, `--recent-empty`, `--debrief-current` (MemoryRouter + scaled frame + OverlayRoot).
- **D51·6 (2026-10-20), sidebar like Gemini (R4):** rail = brand · nav **New practice** (`edit`) / **History** · **Recent** = the chats (NavRow without icon, title + time/date in `end`, up to 12 🟡, the only part that scrolls; "Interview practice · " prefix dropped, `components/railItems.ts`) · bottom: **AI engine · Not ready** row (only when not ready → `/settings/engine`) + **account row** (`user` icon disc, "You", "Saved on this computer", gear → `/settings`, current on Settings). Settings left the top nav; "All history", the engine card and the storage link are gone (engine Ready/name lives in Settings → AI engine). Rail rows are pills (`--radius-pill`); rail vs content by fill only (no `border-right`, no top-bar `border-bottom`). Top bar < 1024: the Not ready badge only when the engine is down. Stories + `--engine-not-ready`, `--engine-not-ready-tablet`, `--settings-current`.
- **D52·1 (2026-10-20), the chat list is the history:** the **History** nav row is gone (rail and drawer): top = brand + **New practice**. **Recent** lists **all** sessions newest first (no 12 cap, no "Show more": local data, tens to a few hundred rows; enter motion only on the first 12), scrolls inside the rail; English sessions carry a quiet **EN** before the time; empty: "Your practice sessions will appear here." No Today/Yesterday grouping (the time/date at the end does it). `/history` stays by link (Debrief back link, filters); **Trash** moved to **Settings → Privacy and data** (link with count → `/history/trash`). `railSessions(sessions, untitled)` has no `max`.
- **D57 (2026-10-21), sidebar like Claude (claude.ai), supersedes D51·6 / D52·1 layout:** top row = app mark + name, right the toggle `IconButton` `sidebar` ("Close sidebar" / "Open sidebar") · **New practice** = a round filled plus (`--color-action` + `--color-text-on-action`, `--radius-pill`) + label, the first row · **Recents** (quiet label) = the chats: one line each, ellipsis, **no dates or times**, a quiet **EN** after the title for English; selected = `--color-selected` + weight 500 + `aria-current`, hover `--color-hover`; on hover / focus (always on touch) a trailing **"…"** `IconButton` opens a `Menu` with the actions the app already has: **Open**, **Move to Trash** (same soft delete + Undo toast as History; no Rename: the server has no rename route 🟡). Rows are `--radius-md`, no strokes. Bottom: **AI engine · Not ready** row (only when not ready) + the **account row**, one button (avatar disc, "You", "Saved on this computer") that opens a `Menu` upward: header with the name, **Settings**, **Appearance** (→ `/settings/appearance`), **Privacy and data**. No Log out (local app). **Collapsed** (≥ 1024 only, `ic.railCollapsed`, `--layout-rail-collapsed`): the toggle, the round plus, a warning icon (only when not ready) and the avatar, each with a `Tooltip` (`disabled` while the account menu is open); the column width animates `--duration-slow` `--ease-standard` (the one place layout animates on purpose: the content reflows), instant under reduced motion. < 1024: top bar + Drawer, always expanded, its toggle closes the drawer. `AppShellView` adds `collapsed`, `onCollapsedChange`, `initialMenu: "account" | "row"`, `onTrashSession`. Stories `--expanded`, `--collapsed`, `--account-menu-open`, `--account-menu-open-collapsed`, `--row-menu-open`, `--mobile-drawer-account-menu`, `--loading`, `--engine-not-ready`, `--engine-not-ready-collapsed`, `--empty`; review screen "Sidebar". New: icon `sidebar`, `Tooltip` prop `disabled`.
- **D80 (2026-10-21), sidebar:** under New practice an **Archive** row (icon `archive`); History is gone, Recents = every chat not archived. Row "…" menu: **Rename** (InlineRename in the row), **Download as Markdown**, **Archive**, separator, **Delete** → `Dialog` "Delete this chat?" with Cancel + `Button variant="danger"`, then Trash + Undo toast. Account row: avatar with the name's initial, the name from Settings → General (or "You"), the engine in use under it; no theme in its menu. **Folding moves nothing:** `--layout-rail-collapsed` 52px = rail padding + one `--rail-slot` (36px: plus circle + `--space-1` each side) + padding; rows keep their left padding and height in both states, only labels go; collapsed, the account hover shows on the avatar disc. `Button` `danger` = solid `--color-danger` fill + `--color-text-on-danger` (owner: deletion is red). `AppShellView` replaces `onTrashSession` with `actions: SessionActions` and adds `userName`.
- **Gap:** ia.md's **64px icon rail at 1024 / 768** is not built: top bar + drawer below 1024 instead (home.md [DS-4] default). The Session focus mode (rail hidden) lives in `screens/Session`.

### Page + Section · `components/Page.tsx`
- **Purpose:** page frame: h1, sub line, header actions, `narrow` width; `Section` = h2 block with an optional action.
- **Variants:** `Narrow: false | true` (`--layout-narrow` 720 vs `--layout-content` 960) · `Layout: page | start` (2026-10-20; start = centred header + narrow column, Home). Container `page` (the `<main>`): wide ≥ 840 padding `--space-12` / `--space-10` / `--space-16` · medium 560–839 sides `--space-8` · narrow < 560 `--space-6` / `--layout-gutter` / `--space-12`, gap `--space-8`, h1 `--text-2xl` (else `--text-3xl`, `--tracking-tight`).
- **Tokens:** `--layout-content`, `--layout-narrow`, `--space-12` / `--space-10` / `--space-16` / `--space-8`, sub `--color-text-secondary`; section title `--text-sm`, `--weight-semibold`, `--color-text-secondary` (sentence case); < 768px `--layout-gutter`.
- **Motion:** §3.1 route change: outgoing `exit`, incoming `rise-in` `slow` `--ease-enter`.
- **Story:** inside `patterns-appshell--desktop` (page) and `--desktop-start` (start).

### Feedback (ThreadFeedback, SummaryRow, AnswerText) · `components/Feedback.tsx`
- **Purpose:** feedback for one question thread (content / language / delivery in the configured order, GR8), flag actions, stronger answer. Live in the Session and in the Debrief.
- **Built from:** Badge (layer tones; `tinted` in the debrief only), Button (`link` sm show answer, `sm` / `ghost` flag actions, `secondary` sm + `sparkle` stronger answer), Callout `info` (feedback unavailable), Spinner (stronger answer loading → Skeleton when it lands), Icon.
- **States:** pending per layer · ready · nothing to fix · unavailable · flags: active / dismissed with Undo · checks (dashed border) confirm / dismiss · stronger answer idle / loading / ready / error · live vs debrief (grammar level only live).
- **Tokens:** blocks `--color-border-subtle` + left rule `--color-layer-session-rule` (monochrome in the Session), titles `--color-layer-session-text`; items `--color-subtle`; check items dashed `--color-border-control`; **fix fragment `--color-mark-fix` + `--weight-semibold`**; "heard as" dotted underline `--color-mark-heard`; rewrite `--leading-relaxed`; `--radius-md`, `--radius-sm`; all text ≥ `--text-sm`.
- **Motion:** §3.4 C7 / C8 `card-in` `slow`, held until the user stops talking (rule 3); tab counters §3.2.
- **Story:** none (add one with both layer orders and both modes at stage 11, GR8).
- **Rule:** never red / green, never status tones for answers (P8).

### EnginePanel (EngineSettings, EngineHead, EngineStatus, EngineTest) · `components/EnginePanel.tsx` + `components/engine/*`
- **Purpose:** pick, fix and test the engine. **D78: one view, no sub-screens** (D54's choose → connect flow and `EngineChoose` / `EngineConnect` are gone, D81). Settings → AI engine and Setup step 1 (after "Change", or when no engine is Ready) render the same `EngineSettings`: the engine in use on top with its setup in place, the other engines under it, each set up in its own row ("Set up" / "Use"). `EnginePanel({ initialPick })` is a thin wrapper.
- **EngineHead** (D81): one row — icon tile · name · model line · `EngineStatus` · an optional action. Used by the "In use" block and by Setup step 1 when the engine is Ready (one row + "Change", nothing to decide).
- **Connect** (D83, `bodies.tsx` `useConnect`): Ollama (not found / not running) and Claude Code (not found) lead with a primary **Connect** → `POST /api/engines/{id}/connect` (finds the installed program outside PATH, starts Ollama); Download / Install is the secondary button; a failed Connect swaps the text for the next step (`role="status"`). Stories `screens-setup--engine-no-ollama(-mobile)`, `--engine-not-running`, `--engine-no-claude(-mobile)`.
- **Disconnect** (D84, `bodies.tsx` `DisconnectButton` / `DisconnectedBody`): ghost "Disconnect" — Setup: under a Ready pick («Connected.»); Settings: in the In-use row (`EngineHead action`) and an opened Ready engine. Status `disconnected` → quiet "Disconnected" word, `info` Callout "Mike won't use {name} until you connect it again." + Connect. Radio mark check `strokeWidth 3` (was 1.75, too thin). Stories `screens-setup--engine-disconnected(-mobile)`, `patterns-enginepanel--settings-disconnected`.
- **Progress** (D85, `ds/Progress.tsx`): a thin bar for a long job — `value` 0–1 or indeterminate (a sweeping segment; still under reduced motion). `role="progressbar"`, `label`, `valueText`; the numbers are the caller's. Track `--color-border-subtle`, fill `--color-action`.
- **OllamaDownload** (D85, `components/engine/OllamaDownload.tsx`): Ollama running without a model — "Download {model}" (recommended by RAM) + "Smaller one · 2.5 GB", progress with Cancel, "Continue {model}" after a cancel, the error text as is; Terminal command under "Use Terminal instead". Polls `/api/engines/ollama/pull`; review/stories set the state via `OllamaPullPreview`.
- **CliBody** (D85, D86, `components/engine/bodies.tsx` → `ClaudeBody`, `CodexBody`): one connection view for the engines that run a CLI the user signed in to — not found (install command + Connect), not signed in (sign-in command), signed in but unchecked (Connect = one real request), the CLI's own error in red, Ready. Copy in `engines.claude.*` / `engines.codex.*`.
- **EngineChoice** (D82, `components/engine/EngineChoice.tsx`): Setup step 1 is a choice, nothing picked on the first run (owner: «нужно давать выбор людям»). `radiogroup` of the four engines inside one flush SettingGroup: logo · name · Recommended · line · status, the radio mark on the **right** (`--color-checked` fill). Picking an engine that isn't Ready opens its `EngineBody` + `Facts` under the row (Ollama not installed → "Download Ollama"); rechecks every 5 s while not Ready. Continue switches to the picked engine once Ready. Stories `screens-setup--engine-first(-mobile)`, `--engine-picked`, `--engine-no-ollama(-mobile)`, `--engine-not-running`.
- **Built from:** SettingGroup / SettingRow, Badge, Button / IconButton, Disclosure (`plain`), Callout, CopyField, Chip, Input, Select, Skeleton. Split files: `engine/{EngineSettings,EngineTest,EngineStatus,bodies,meta,fixtures}`; `bodies.tsx` holds the per-engine forms.
- **States:** loading (Skeleton row) · server unreachable (error Callout + Try again) · per engine: ready · not configured · not installed · not running · no model · key rejected / unreachable (status badge + hint) · switching (button loading) · switch failed (error Callout) · test idle / running / ok / failed. Refresh polling every 5 s while the engine being looked at (B: the picked one; C: the one in use) is not ready.
- **Tokens:** option rows `--color-surface-card` (selected: the quiet 1px inset `--color-border-control`, D51), radio mark `--icon-lg`, icon tile `--control-h-md` + `--radius-md` + `--color-surface-chip`, name `--text-md` `--weight-medium`, line `--text-sm` `--color-text-secondary`, heading `--text-xl` `--weight-semibold` (Settings; Setup uses the page h1).
- **Motion:** none new (Disclosure rise, Callouts static). Focus moves to the new heading when the step changes (not on first render).

### ProfileEditor · `components/ProfileEditor.tsx` (D81)
- **Purpose:** the "about you" files and note — one editor for Settings → General (CV) and Setup step 3. Up to `PROFILE_MAX_FILES` (10) files, each a FileRow with Replace and a bin; a multi FileDrop (compact once there are files, D80); the free-text note under a plain Disclosure with Save.
- **Built from:** FileRow, FileDrop, Callout `error`, Disclosure (`plain`), Textarea, Button. Props: `id` (anchor for search).
- **States:** loading · empty · files · uploading · upload failed (Callout) · note open / saving.
- **Logos (D56):** `engine/EngineLogo.tsx` — real marks in the icon box (`--control-h-md`, mark `--icon-md`): Ollama and OpenAI (OpenAI-compatible) as a CSS mask in `--color-text-primary`, Claude and Gemini in their own colours (`<img>`). SVGs in `engine/logos/` (@lobehub/icons-static-svg 1.90.0, MIT).
- **Story:** `Patterns/EnginePanel` — A: ChooseNoneReady, ChooseOllamaReady, ChooseSettings · B: ConnectOllama{Ready,NotRunning,NotInstalled,NoModel}, ConnectOpenAi{NeedsSetup,Ready}, ConnectClaude{Found,NotFound}, ConnectGemini{NeedsKey,Ready} · C: SummaryOllama, SummaryNotReady, SummaryGemini. Fixture without a server: `engine/fixtures.tsx` (`EngineFixture` over `AppStoreProvider`, fetch stub for the model list and the test call). Review screen "AI engine" (`screens/engine/review.tsx`).
- **Deviation:** none left; the old "Use" button per card (setup.md §4 G8 asked for a radio card) is replaced by the radio rows of A.

### VacancyEditor · `components/VacancyEditor.tsx`
- **Purpose:** add a job posting: paste / link / file + optional job title.
- **Built from:** Dialog, Segmented (source), Textarea (min 80 chars, error when too short), Input (url / file / title), Callout `error` (`live="alert"`), Button (`ghost` Cancel, `primary` Save with `loading`).
- **States:** empty · too short (error after first save attempt) · saving · link / file error · success (closes, caller selects the card). Edit mode and Delete (ia.md) are not built yet.
- **Tokens:** `--space-4`, `--color-text-primary`, `--text-sm`.
- **Motion:** Dialog §3.3; source swap `soft-out` / `rise-in` §3.1; Save → 3-dot pill §3.5 L5 (Button `loading` today).
- **Story:** none.
- **Gap:** file source is a native file input; ia.md asks for a drop zone (§4 G9).

---

## 3. Token coverage check (for reviewers)
- Every colour above is a semantic role from `ds/foundation.md`; no primitive appears (enforced by `check-tokens.mjs`).
- Smallest text in every component is `--text-sm` (14px, D46); `--text-xs` no longer exists.
- Blue (the Gemini-like scale, D48; blue-teal removed) appears only in Presence (`--color-presence-*`), the live mic indicator (`--color-mic-live`), the global focus ring (`--color-focus`) and the debrief content tint (`--color-layer-content-tint` = blue.50 / blue.950).

## 4. Gaps: in the ia.md / wireframes / motion.md inventory, not in the DS — to build at stage 11

Build order follows the screens of stage 11 (Session and Home first). Before building, check §1 for a variant that would do (CONTRACT §6.1).

| # | Component | Needed by | Notes |
|---|---|---|---|
| G1 | **Composer** | Home, Session (P3) | **Built 2026-10-20 (stage 11)** · `ds/Composer.tsx`: `Composer` (`attachment`, `toolbarStart`, `toolbarEnd`, `send {variant: action \| quiet, hidden, disabled, title, busy}` (D52: `title` = tooltip other than the label, `busy` = spinner; a new `send.icon` fades in — the Home Gemini layout's mic → arrow; at < 420px a lone send stays on the toolbar line), `submitOnEnter`, `minRows`/`maxRows`, `hint`, `error`, `busy`, **v2 `surface: own | none`** — `none` = no own border / shadow / radius, lives inside the Session island in text mode) + `ComposerAttachment`. Stories `ds-composer--home-with-attachment`, `--home-empty`, `--home-pasted`, `--home-preparing`, `--loading`, `--error`, `--disabled`, `--session-typing`, `--overflow`, `--narrow`, **v2** `--surface-none`, `--home-start-v-2`, **D52** `--start-action-mic`, `--start-action-keyboard`, `--start-action-busy`, `--start-action-disabled`. Was: Rounded input (`--radius-lg`) with mic, "Type instead", round send button (pill, `--color-action`), model chip inside. Screen-local `.composer` in `screens/Session` today |
| G2 | **Stepper** (step header) | Setup | `1 Engine · 2 Test · 3 About you · 4 First round`, list with `aria-current="step"`, not clickable forward; 1024 / 768 collapses to `Step 2 of 4 · Test`. Screen-local `.steps` today |
| G3 | **Toast** | Global (motion T1) | **Built 2026-10-20 (stage 11)** · `ds/Toast.tsx`: `Toast` (`tone: neutral | error`, `action`, `onDismiss`, `inline`) + `ToastProvider` (`paused` queues while the user speaks, `max` 3) + `useToast().show/dismiss`; polite live region always mounted, errors `role=alert` and stay. Stories `ds-toast--neutral`, `--message-only`, `--error-tone`, `--interactive`. Was: Solid `--color-raised` + `--shadow-overlay`, no blur; auto-hide 5 s, errors stay; never while the user speaks (GR6) |
| G4 | **Menu / popover** | Debrief `⋯` (Delete, Export), engine menu, vacancy picker | **Built 2026-10-20 (stage 11)** · `ds/Menu.tsx` `Kind: menu | listbox`: menu button pattern (arrows, Home/End, typeahead, Esc/Tab), radio items (`checked` → `menuitemradio`), separators; **v2 (2026-10-20):** `header` slot (static context above the items: Session More menu title + round · strictness), checkbox items (`checkbox: true` → `menuitemcheckbox` + `aria-checked`, the menu stays open on toggle), `shortcut` hint (Kbd at the end + `aria-keyshortcuts`); listbox = selection popover (`aria-activedescendant`, `Search` combobox, `footer`, `matchWidth`); anchored + flipped; full-width sheet when the overlay layer is < 640; `inline` open state. Stories `ds-menu--action-menu`, `--action-menu-open`, `--radio-items`, `--radio-items-open`, `--listbox-picker`, `--listbox-with-search`, `--listbox-open`, `--narrow-sheet`, **v2** `--header-checkbox-shortcut`, `--header-checkbox-shortcut-open`. Was: `menu-in` / `soft-out` (motion T2, P12); keyboard menu pattern |
| G5 | **Drawer / side sheet** | Session feedback at 768 (right drawer 400px), transcript, mobile settings | **Built 2026-10-20 (stage 11)** · `ds/Drawer.tsx` `Side: left | right | bottom` (left = AppShell rail, sidebar surface; right `--layout-panel`; bottom sheet, top radius xl), `title` + close, `footer`, `duration: slow | slower`, `inline`. Modal: focus in + trap, Esc / scrim close, focus returns. Stories `ds-drawer--left-rail`, `--right-panel`, `--bottom-sheet`, `--interactive-left`, `--interactive-right`, `--interactive-bottom`. Was: motion D12; scrim plain fade |
| G6 | **Tooltip** | 64px icon rail labels, truncated company names | **Built 2026-10-20 (stage 11)** · `ds/Tooltip.tsx` (`onlyWhenTruncated` via `data-truncate`, `placement`, `block`, `open` + `inline` for review); hover delay `--duration-slow`, none on focus, Esc hides, hoverable (WCAG 1.4.13); inverted surface `--color-action` / `--color-text-on-action`. Stories `ds-tooltip--open`, `--only-when-truncated`, `--on-icon-button`. Was: Replaces `title` attributes; keyboard and hover |
| G7 | **Checkbox** (+ checkbox chip) | SetupProfile (untick stories), briefing | `--color-checked` fill, check `scale(.6 → 1)` (motion P8) |
| G8 | **Radio card / radio group** | Engine card (setup.md), level selector A2–C1 with descriptions, round type, strictness | **Built 2026-10-20 (stage 11)** · SelectableCard / Chip `Role: radio` + `SelectableCardGroup` / `ChipGroup` (see §1). Was: Extend SelectableCard with `Role: radio` + `radiogroup`, or use Segmented for short options |
| G9 | **File drop zone** | SetupProfile CV, VacancyEditor file tab | **Built 2026-10-20 (stage 11)** · `ds/FileDrop.tsx` (`State: empty \| reading \| chosen \| error`). Stories `ds-filedrop--empty`, `--reading`, `--chosen`, `--error`, `--disabled`, `--overflow`. Was: Drag and drop + browse, file type and size hint, privacy line above it (GR7) |
| G10 | **Mic button + live level** | Session dock, SetupTest meter | **Built 2026-10-20 (stage 11)** · `ds/MicButton.tsx`: thin 2px `--color-mic-live` ring (opacity + scale follow `--mic`), static `level` prop. Stories `ds-micbutton--fake-level`, `--live-speaking`, `--live-quiet`, `--live-loud`, `--idle`, `--muted`, `--disabled`. Was: Blue `--color-mic-live` disc behind the icon driven by `--mic` (motion D8); muted = grey + slash, never red. Screen-local `.meter` in Setup |
| G11 | **Status pill** | Session meta (Listening / Thinking / Speaking) | **Built 2026-10-20 (stage 11)** · `ds/StatusPill.tsx` (9 states; blue dot only with `live` + listening / your-turn). Stories `ds-statuspill--*` (each state, `--listening-mic-live`, `--overflow`, `--all-states`). Was: Dot blue only while the mic is live, grey otherwise; thinking `pulse-dot` (motion P6 / P7) |
| G12 | **Dots loader + connecting pill** | Start → connecting, Save, Thinking | **Built 2026-10-20 (stage 11)** · `ds/Dots.tsx` `Variant: dots \| pill`, `shimmer`, `fullWidth`. Stories `ds-dots--default`, `--with-label`, `--connecting-pill`, `--connecting-pill-shimmer`, `--connecting-pill-full-width`, `--pill-overflow`, `--quiet`. Was: 3 dots 6px, `--duration-loop-dots`, grey (motion C4, L5) |
| G13 | **Text shimmer** | "One moment…", "Thinking", "Preparing feedback…" | **Built 2026-10-20 (stage 11)** · `ds/TextShimmer.tsx` (`active`, `status`, `size`). Stories `ds-textshimmer--active`, `--still`, `--medium`, `--overflow`. Was: Grey gradient clipped to text, `--duration-loop-shimmer` (motion L4) |
| G14 | **Session top bar** | Session | **Retired in v2 (D47c, 2026-10-20):** replaced by the Island (G21); the context moved to the More menu header, the timer and `n of 5` to the island's status group. Was: Context (vacancy · round · strictness), `Question n of 5`, mode switch, timer (`tabular-nums`, static, always visible: GR6), `End` (outline, monochrome) |
| G15 | **Captions** (Mike's subtitles, user's caption pill) | Session | Streamed suffix blur → clear (motion C1–C3); user pill `--color-subtle` → `--color-selected` while listening |
| G16 | **List row** (+ inline rename) | History, Trash, sidebar-like lists | **Built 2026-10-20 (stage 11)** · `ds/ListRow.tsx` `Density: default | compact` + `ListRows`: lead disc, title (ellipsis + Tooltip; 2 lines when `page` < 560), meta, result, `actions` on hover / focus-within (always on touch) → `compactActions` (⋯ menu) when `page` < 560; stretched link; `rename` → `ds/InlineRename.tsx` (`Size: md | lg`, counter, Enter / Esc, empty error); `enterIndex` (row-in, 40ms stagger), `leaving` (row-out). Stories `ds-listrow--default`, `--renaming`, `--narrow`, `--overflow`, `--entering`, `--compact`, `--compact-tooltip`; `ds-inlinerename--medium`, `--large`, `--empty-error`. Was: Title, track, round, date, duration, verdict word; rename in place (max 80); delete / restore; enter and delete motion N10 |
| G17 | **Nav row** | AppShell rail, Settings section nav | **Built 2026-10-20 (stage 11)** · `ds/NavRow.tsx` (`href`, `label`, `icon`, `current` → `aria-current="page"`, `end`, `linkAs` router adapter); 44px on touch. Used by AppShell; Settings still has its own `.navLink` (screen file, migrate at 12c). Stories `ds-navrow--default`, `--section-nav`. Was: Same row in two places today (`AppShell .navLink`, `Settings .navLink`): extract one component |
| G18 | **Weak-spot strip** (pattern) | Home "What to work on", Debrief | **Built 2026-10-20 (stage 11)** · `ds/WeakSpotStrip.tsx` (`Context: home \| debrief`; home = monochrome rows + Show all + footer, debrief = layer-tint cards, 3 → 1 columns by container width). Stories `ds-weakspotstrip--home`, `--home-expanded`, `--home-loading`, `--home-empty`, `--home-narrow`, `--debrief-content-first`, `--debrief-delivery-first`, `--debrief-loading`, `--debrief-empty`, `--debrief-narrow`. Was: Badge + Chip (Focus chips with counts) + Card; `+ N more … Show all` |
| G19 | **Disclosure** | Debrief question cards, "Show full answer" | **Built 2026-10-20 (stage 11)** · `ds/Disclosure.tsx` (`Surface: card \| plain`, `open`/`defaultOpen`, `Chevron: end \| none`, `headingLevel`, `as: div \| li \| section`, `leading`, `meta`). Header = one `<button aria-expanded aria-controls>`, 44px+; region opens `rise-in base`, closes `soft-out`, unmounted when closed. Stories `ds-disclosure--card-closed`, `--card-open`, `--plain`, `--plain-open`, `--no-chevron`, `--disabled`, `--overflow`, `--list`. |
| G20 | **InlineMark** | Debrief answers and corrections, Home example, Session feedback | **Built 2026-10-20 (stage 11)** · `ds/InlineMark.tsx` `Kind: fix \| heard \| unsure`: fix = `--color-mark-fix` fill + semibold (never red / green); heard = `--color-mark-heard` dotted underline, no strikethrough; unsure = dashed underline + optional hint; `srLabel` prefix. Stories `ds-inlinemark--fix`, `--heard`, `--unsure`, `--fix-pair`, `--overflow`. |
| G21 | **Island** | Session (v2, D47c) | **Built 2026-10-20 (stage 11 v2)** · `ds/Island.tsx` `Shape: pill \| box` · `Layout: inline \| stacked`: one card surface (`--color-surface-card`, D51: no stroke, no shadow; radius pill / lg / xl when stacked) holding `groups` (status · voice · tools · exit, each `role=group` with a name) separated by hairline dividers (`--control-h-sm` high); `lead` = the box's top row (Composer `surface="none"`); `stacked` puts each group in `row` 1 or 2 (phones); `grow` takes the free space; `morph` plays the pill → box grow (motion 3.7 "Island text-mode morph"). Fixed set of controls: disabled, never hidden (the screen decides). Positioning and D5 `dock-in` belong to the screen. Stories `ds-island--voice`, `--thinking`, `--text-mode`, `--stacked`. |
| G22 | **ChatMessage + ChatLog** | Home setup chat (v2, D47a) | **Built 2026-10-20 (stage 11 v2)** · `ds/ChatMessage.tsx` `Speaker: mike \| user` · `State: final \| pending \| error`: Mike = plain text (`--text-md`, `--leading-relaxed`), no bubble, `name` on the first message of a turn; user = end-aligned `--color-subtle` bubble `--radius-lg`, no border, max 75% (88% when the log is < 560); D51 Gemini style: `name` = quiet `--text-sm` secondary, turns separated by `--space-8` only (no lines); slots `attachment`, `actions` (quick replies), children; pending = TextShimmer line (real work only); error = alert icon, no status colour; `animate` = `rise-in slow` (motion 3.7 "Setup message"). `ChatLog` = `role="log"` `aria-live="polite"` + container `chat`. Stories `ds-chatmessage--conversation`, `--user-with-attachment`, `--error`, `--narrow`. **V2.1 (D49, Session transcript):** `State` adds `interim` (the answer being recorded: no stroke, the `--color-subtle` fill at 65% + secondary words, no motion); `ChatLog` adds `size: md \| lg` (lg = `--text-lg`, falls back to md in a `chat` container < 479px) and `live` (false = no `aria-live`; the Session is heard through TTS). Story `--session-transcript`. |

Covered by existing components (no new component): `BrowserBanner`, `StorageNotWritable`, engine-down banner → Callout with actions · `MicHelpDialog`, `CloudRecognitionConfirm`, `SessionInterrupted`, `ConfirmPermanentDelete` → Dialog · progress lines ("Opening the page…") → Spinner / text shimmer · vacancy card → SelectableCard (+ delete IconButton) as a Home pattern.

### D82 (2026-10-21) · mobile and small-component fixes
- **Menu:** the check of a radio item / listbox option sits on the **right**, after the text and shortcut (owner: «должно это находиться справа»); checkbox items keep the box on the left.
- **Scrollbars (`ds/global.css`):** thin, thumb `--color-border-control`, track and corner transparent; WebKit fallback with a 3px transparent border — no white track on hover.
- **Settings < 640px (like Claude on a phone):** two levels instead of a clipped tab row — the list of sections (full-width rows, chevrons, search on top) → a section with «‹ All settings». Search hides the list and shows results. `/settings` opens on the list on a phone, `/settings/<section>` opens the section. Stories `screens-settings--phone-list`, `--phone`, `--phone-search`.
- **Setup:** step chips padding `--space-1 --space-3 --space-1 --space-1` (the number sits close to the edge); the sample button is a labelled "Listen"; during the voice check the Session's Presence glow runs along the top edge of the whole screen (listening = your mic, thinking = sweep, speaking = Mike's reply or the sample).
