# Frontend: Vukoli (stage 12)

Status: 12a/12b were done at stage 11 (design in code), 12c needed no new screens, 12d wired the remaining designed states (ui-spec §10) and added e2e. Code: `app/` (a separate git repo, local commits only).

## Stack
| Part | Choice | Why |
|---|---|---|
| Web | React 19 + Vite 7 + TypeScript, React Router 7 | owner decision 2026-10-08: web apps → React + Vite + TS + Storybook |
| Catalogue | Storybook 9 (stays on 9, don't upgrade to 10) | 50 story files: DS components + every screen state |
| Styles | CSS modules over `src/ds/tokens.css` (from `tokens/tokens.json`), container queries | `npm run lint` runs `check-tokens` (no colour literals outside tokens) and `check-vars` (every variable defined) |
| Server | Python FastAPI (`app/server`), websockets `/ws/session`, `/ws/voice` | kept from the source product; serves the built `web/dist` |
| Tests | vitest (unit), pytest (server), Playwright (e2e, `docs/e2e.md`) | |

## Structure (`app/web/src`)
- `ds/`: 42 DS components (the name is the anchor in `ds/components.md` and in Figma), `tokens.css`, `global.css`.
- `components/`: app-level pieces (AppShell, Feedback, EnginePanel, Profile/Vacancy editors).
- `screens/`: route containers (`Home`, `Session`, `Debrief`, `History` (Archive + Trash), `Settings`, `Setup`, `NotFound`, `ServerUnavailable`) + per-screen folders with pure views, fixtures, frames (scenes), stories and `review.tsx` (the states on the review artifact).
- `session/`: live session state (`reducer.ts`, `useSession.ts`, resume, recheck); `audio/`: capture, VAD, browser STT, playback.
- `lib/`: API client (`api.ts`), types, prefs, theme, storage probe.
- `review/`: the review page (`npm run build:review` → `docs/artifacts/11-design-review.html`).
- `i18n/en.json`: all user-visible copy.

Rule: a screen = container (data, side effects) + pure view (props only). Stories and the review page render the pure view with fictional fixtures (Alex Morgan · Kestrel Pay).

## Routes
| Path | Screen |
|---|---|
| `/` | Home (setup chat on first run, plan card, weak spots, quick start) |
| `/session` | live interview / English talk (outside the shell) |
| `/sessions/:id` | Debrief |
| `/archive`, `/archive/trash` | Archive, Trash (`/history*` redirects) |
| `/setup` | setup wizard (engine → check → about you) |
| Settings | drawer over the shell (`settings.open`) |
| `*` | NotFound; server down → ServerUnavailable |

## Data
No mock layer: screens talk to the real local server (`/api/*`, see `app/server/PROTOCOL.md`). Data lives in the user's data folder (`IC_DATA_DIR`). For tests, `IC_E2E=1` swaps in a deterministic scripted engine and enables `/api/_e2e/*` (reset, engine steering, seed); without the flag they don't exist.

## What 12d wired (ui-spec §10, decision D94)
Interrupted (engine / voice) with Resume of the same saved session and continue in text · storage check (`/api/health` → `storage_ok`) in Session and Debrief · Edit what I said / recheck (live over WS, saved over REST) · Trash load error and Delete forever · Home greets by name · D80 naming in copy · Setup save errors · `beforeunload` guard · engine-specific interrupted copy · mic help opens by itself · `dvh` instead of `vh`. Status per item: `docs/ui-spec.md` §10 "Status at 12d".

## Run and check
From `app/web`:
- `npm run dev` (Vite) against a running server, or `npm run build` and the server serves `dist`.
- Server: `cd app/server && IC_DATA_DIR=<folder> .venv/bin/python -m server` (port `IC_PORT`, default 8000).
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run build-storybook`, `npm run build:review`; server `.venv/bin/python -m pytest -q`; e2e `npm run test:e2e`.
- `gate:agent` from the starter is not in this project: the app predates the starter script; the same checks are run by hand above (lint here is ESLint + `check-tokens` + `check-vars`).

## Known gaps
See `docs/e2e.md` (known gaps, fixme) and `docs/ui-spec.md` §10 (Q16 is the owner's call: technical round, Drill size, English phrases data).
