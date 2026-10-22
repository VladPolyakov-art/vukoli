# DS Contract: Interview Coach (working name)

**Source of the DS:** own, built from scratch (directive 10, branch B), direction A "Quiet chat, one live thing" (D46), moodboard P1–P8 (D45).
**Figma:** none. Design is done in code; Figma only at the owner's request, as a secondary output.  ·  **Date:** 2026-10-20  ·  **Icons:** own line set `app/web/src/ds/icons.tsx` (24 grid, 1.75 stroke, `currentColor`).
**Tokens:** `tokens/tokens.json` → `python3 execution/tokens_build.py` → `ds/foundation.md`, `ds/tokens.css` → copied to `app/web/src/ds/tokens.css`.
**Components:** React DS in `app/web/src/ds/` (exported from `index.ts`) + Storybook `DS/*`; index in `ds/components.md`. **Motion:** `docs/motion.md`. **Decisions:** `docs/design-system.md`, `docs/brand-direction.md`.

## Main rule
Any interface task (a screen, a state, a component, a layout or copy change that touches the UI) goes **only through this DS**: components from `ds/components.md`, tokens from `ds/foundation.md`, motion from `docs/motion.md`. A value that bypasses a token is a bug, in code and in review artifacts alike. `npm run lint` red = the task is not done.

## 1. Build from the DS
1. **Components only from the catalogue.** Import from `app/web/src/ds` (or a pattern from `app/web/src/components`). Do not rebuild something that exists, and do not copy a pattern into a screen.
2. **Colours: semantic roles only** (`--color-canvas`, `--color-sidebar`, `--color-raised`, `--color-text-*`, `--color-border-*`, `--color-action*`, `--color-checked`, `--color-selected`, …). Never primitives (`--color-gray-*`, `--color-blue-*`, `--color-blueteal-*`, `--color-red|amber|green-*`, `--color-alpha-*`, `--elevation-*`), never hex / `rgb()` / `hsl()` literals. Enforced by `scripts/check-tokens.mjs`; every `var(--…)` must exist (`scripts/check-vars.mjs`).
3. **Everything else from the scales:** `--space-*`, `--radius-*`, `--text-*`, `--weight-*`, `--leading-*`, `--tracking-*`, `--control-h-*`, `--icon-*`, `--layout-*`, `--duration-*`, `--ease-*`, `--z-*`, `--shadow-*`. No off-scale values; `calc()` only over tokens.
4. **Both themes, always** (GR13). Light and dark switch through tokens only; no theme branches inside components. Every story is checked in both.

## 2. Visual rules of direction A
1. **Monochrome; blue only for three things:** the orb (`--color-orb-core`, `--color-orb-edge`), the live mic indicator (`--color-mic-live`), the focus ring (`--color-focus`). No blue links, buttons, tabs, chips, dots, borders or badges. Links are `--color-text-link` and **always underlined**.
2. **One primary per view** (`Button variant="primary"` → `--color-action`). **Selection never uses action tokens:** a selected chip, toggle or checkbox uses `--color-checked` + `--color-text-on-checked`; a selected card, engine or tab uses `--color-border-selected`; a selected row uses `--color-selected`.
3. **Hover vs selected is a pair.** Their greys are 1.07:1 apart, so every selected state carries a **non-colour cue + an aria state** (weight 500 + `aria-current`; inverted fill + `aria-pressed`; 2px border + check icon + `aria-pressed`/`aria-checked`; 2px underline + `aria-selected`; raised thumb + `aria-checked`). Table: `ds/components.md` §0.
4. **Status colours only for system states:** engine down, file or storage errors, connection lost, "It works". Never for answers, corrections, scores, verdicts, End or Mute. `Button variant="danger"` (red fill, white label; D80) only on the button that confirms a deletion — Delete permanently, Delete profile, and since D80 also Delete chat (owner: «действие удаления должно быть красным»), even though a chat goes to Trash first. The menu item that opens the question stays neutral.
5. **A fix, not an error (P8).** A correction is marked inside the user's own sentence with `--color-mark-fix` + `--weight-semibold`, "heard as" with the grey dotted underline `--color-mark-heard`, one correction per card, with its reason, dismissible. Never red or green, never a red strikethrough.
6. **Layer tints only in the debrief** (`Badge tinted`, `--color-layer-*-tint`). In the Session, layers are monochrome: label + icon + `--color-layer-session-text` / `--color-layer-session-rule`.
7. **Shapes:** pill (`--radius-pill`) for buttons, the send button, chips, segmented controls, badges, toggles, the orb · `--radius-lg` (16px) composer and panels · `--radius-md` (10px) cards, rows, fields, callouts · `--radius-xl` (24px) dialogs · `--radius-sm` (6px) small marks and skeleton bars. No other radii.
8. **Type:** Manrope (`--font-sans`) only; mono (`--font-mono`) only for commands to copy. **Minimum 14px** (`--text-sm`, D46): no smaller `font-size`, no `em` / `%` / `smaller` shrinking. Maximum `--text-3xl` (34px). Weights 400 / 500 / 600 only. **Sentence case everywhere:** no `text-transform: uppercase`, no letter-spaced caps labels. Headings ≥ 22px use `--tracking-tight`; the timer uses `font-variant-numeric: tabular-nums`.
9. **Nothing extra (P4):** no glow, no gradient (except the orb's own two stops), no glass or `backdrop-filter`, no texture, no mascots, no marketing inside the app. Elevation only through `--shadow-raised` / `--shadow-overlay`.
10. **Icons only from `<Icon>`.** A new icon is added to `icons.tsx` in the same style. Decorative by default; an icon that carries meaning gets `label` or visible text next to it.

## 3. States and behaviour
1. **Every screen and component defines** default, empty, loading, error, success (GR4), plus hover, focus-visible, pressed, selected (if selectable) and disabled. Every error says what happened and the next action, in plain words.
2. **Focus ring:** 2px `--color-focus`, **2px offset** (`--focus-ring-width`, `--focus-ring-offset`, global `:focus-visible`). Never remove an outline without a replacement; never offset 0 on a filled control (flush against black / white it is 2.93:1 / 2.57:1, a fail). The only exception: text fields (Input, Textarea, Select), whose fill is never action or checked. Script-focused headings (`tabindex="-1"`) show no ring.
3. **Disabled stays readable:** a disabled primary uses `--color-action-disabled` + `--color-text-disabled` (4.67:1) and has its reason in visible text nearby.
4. **Loading:** Skeleton for content areas; the 3-dot pill (or `Button loading`) for a button that is working; Spinner only inside small buttons or a one-line status; text shimmer for "preparing…" lines. Loading containers set `aria-busy` and a visually hidden "Loading…".
5. **Nothing while the user speaks (GR6, motion rule 3):** no toast, counter, new card, loop or shimmer. Only the mic indicator follows the voice, and the user's own caption updates in place. Feedback waits until the user stops. The timer stays visible and static.
6. **The orb's state is always text** (`role="status"`, polite). Colour never tells Mike's states apart (P6).

## 4. Motion
1. **Durations and curves only from tokens** (`--duration-fast|base|slow|slower|exit|stagger|loop-*|orb`, `--ease-standard|enter|exit|orb`). Hard ease-out, no springs, no overshoot. Distances from the space scale or the numbers in `docs/motion.md`.
2. **Animate `transform` and `opacity` only** where possible; never width, height or `grid-template-columns`.
3. **Exits are faster than entrances and never block:** an element is removed after `--duration-exit` even if `animationend` never fires, and focus returns at once.
4. **Motion never adds colour, glow or blur** (motion rules 1–2). Shared keyframes (`rise-in`, `fade-in`, `soft-out`, `card-in`, `skeleton`, `shimmer-text`, `dots`) live once in `global.css`; components do not redefine them.
5. **A new animation is a row in `docs/motion.md` first** (Take / Adapt / New + spec), then code.
6. **Reduced motion is total:** under `prefers-reduced-motion: reduce` every `--duration-*` (including `slower`, `exit`, `stagger`, the loops and `orb`) and every delay is 0, loops stop on a static frame, `scroll-behavior` is `auto`, the scrim appears without a fade; the mic level stays, without transition. It lives in `global.css` (the token script does not generate it). Check each new animation with reduced motion emulated.

## 5. Accessibility
1. **WCAG 2.2 AA in both themes** (GR10): text 4.5:1, large text and non-text UI 3:1. A new text / surface pair gets a `pb.contrast` entry in `tokens.json` and passes `tokens_build.py`; a new border or non-text element is computed by hand and added to `docs/design-system.md` §4.
2. **Keyboard:** everything reachable and operable; Tabs and Segmented move with arrow keys; dialogs use native `<dialog>` (Esc, focus trap, focus returns); session shortcuts (`Space`, `M`, `R`, `Enter`, `T`) are shown in a help line with `Kbd`.
3. **Touch targets ≥ 44 × 44px on touch screens** (tablet 1024 / 768, `@media (pointer: coarse)`): 32 / 40px controls (`--control-h-sm|md`, IconButton, Chip, Segmented) extend their hit area with padding or a `::before`, without changing the visual size.
4. **Names and state:** IconButton always has `label`; state is never colour alone (text, icon or aria next to it); `lang="en"`, all strings from the locale file (GR3).

## 6. Changing the DS
1. **Need a component:** (1) search `ds/components.md` and `ds/index.ts` for a duplicate or a variant that would do, and extend that first; 3+ similar blocks on screens = a component; (2) write its row in `ds/components.md` (purpose, anatomy, variants `Property: a | b`, states, tokens, motion row, story id); (3) code `app/web/src/ds/<Name>.tsx` + `.module.css`, export from `index.ts`; (4) story `DS/<Name>` with every variant and state; (5) `npm run lint`, `npm run typecheck`, `npm run build-storybook` green; (6) review (§7). Start with 2–3 variants, not more.
2. **Need a token:** add it to `tokens/tokens.json` as a semantic **alias** of a primitive (no primitive → add the primitive first), with `pb.contrast` for every text / fg role in light and dark → `python3 execution/tokens_build.py` until green → copy `ds/tokens.css` to `app/web/src/ds/tokens.css`, keeping its header comment → `npm run lint`. Never edit `ds/foundation.md`, `ds/tokens.css` or the app's `tokens.css` by hand.
3. **Changing or removing an existing token value is a rebrand:** only with the owner's approval, logged in `docs/scope/owner_decisions.md`, then `docs/design-system.md` updated.
4. **A pattern** (DS components composed for one product job, used on 2+ screens) lives in `app/web/src/components/` and is listed in `ds/components.md` §2.

## 7. Review and sync
1. **Every UI change goes through the stage-11 review artifact** (a comment per element, `directives/_artifacts.md` → "Ревью-артефакт дизайна"); comments are closed before the gate. From stage 13, design QA checks against this contract.
2. **Code, Storybook and the md index never diverge:** a decision changed in review is written into `tokens.json` / `ds/components.md` / `docs/motion.md` the same day.
3. **No second DS** in the project (no UI library theme, no screen-level "mini DS"). Figma, if requested, mirrors the code; it is never the source.

## Exception
Only on the owner's explicit command «здесь без ДС, ad-hoc»: a separate story or route marked "ad hoc, not part of the product".
