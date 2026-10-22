# Vukoli: web client

React 19 + Vite 7 + TypeScript (strict) + Storybook 9. It talks to the backend in `../server` over REST (`/api`)
and one WebSocket per session (`/ws/session`, protocol in `../server/PROTOCOL.md`).

## Run

```bash
npm install

# backend first (scratch data folder for development, not your real one)
cd ../server && IC_DATA_DIR=/tmp/ic-devdata .venv/bin/python -m server   # http://127.0.0.1:8000

npm run dev              # http://localhost:5173, proxies /api and /ws to 127.0.0.1:8000
npm run storybook        # http://localhost:6006, the design-system components
```

Production-like: `npm run build`, then restart the backend. It serves `dist/` at `/` only if `dist/` existed when
it started.

| Script | What it does |
|---|---|
| `dev` | Vite dev server on 5173 with the API/WS proxy |
| `build` | type-check + production build into `dist/` |
| `typecheck` | `tsc -b --noEmit` |
| `lint` | ESLint (no warnings allowed) + `scripts/check-tokens.mjs` (no colour literals outside `src/ds/tokens.css`) |
| `test` | Vitest: PCM framing, VAD, session reducer |
| `storybook` / `build-storybook` | component catalogue |
| `e2e` | headless Playwright run of the built app on :8000, screenshots into `.screens/` |

`npm run e2e` uses `playwright-core` with the Chromium in `~/Library/Caches/ms-playwright` (no browser download).
It needs Ollama ready and starts from an empty browser profile, so it walks through the setup wizard. Each run
saves one short session in the backend's data folder.

## Layout

```
src/
  ds/          design system: tokens.css (PROVISIONAL), global.css, icons, Button, Card, Tabs, Field, Toggle,
               Segmented, Badge/Chip, Callout, Orb, Spinner, Panel, EmptyState, Dialog, CopyField, Kbd (+ stories)
  components/  AppShell, Page/Section, EnginePanel (wizard step + Settings page), VacancyEditor, Feedback
  screens/     Setup, Home, Session, Debrief, History (+ Trash), Settings, NotFound, ServerUnavailable
  session/     reducer.ts (all WS messages → state, thread grouping), useSession.ts (socket + audio), startConfig.ts
  audio/       capture.ts (AudioWorklet 16 kHz PCM, VAD, echo guard), playback.ts (24 kHz), vad.ts, framing.ts,
               browserStt.ts (opt-in Web Speech)
  lib/         api.ts, types.ts, store.tsx (settings + engines), prefs.ts (localStorage), theme.ts, hooks.ts, format.ts
  i18n/        en.json: every UI string; t(), tp() for plurals, tMaybe()
public/pcm-worklet.js   the capture worklet
```

## Rules the code follows

- Styles use tokens only. `src/ds/tokens.css` is provisional (moodboard "Calm studio"). When the stage-10 tokens
  are approved, `execution/tokens_build.py` replaces that one file and no component changes.
- Every string comes from `src/i18n/en.json`. Text from the model, the server and the user is rendered as plain
  text. `dangerouslySetInnerHTML` and `innerHTML` are banned by ESLint.
- Theme follows the system by default. A manual choice (Settings → Appearance) sets `data-theme` on `<html>`.
- Calm session: blue only for Mike live and the primary action. The orb breathes only while Mike speaks, and not
  at all under `prefers-reduced-motion`. Nothing new appears in the feedback panel while the user is recording.
- Owner rules:
  - The app opens on Practice → Interview.
  - There is one feedback panel per question thread.
  - The elapsed timer is static.
  - Unconfirmed "may be misheard" language flags are never counted.
  - The "B1 grammar" level label appears only in the live panel.
  - The answer suggester sits behind a Settings toggle.

## Preferences kept in the browser (`localStorage`, per browser)

- Theme.
- The setup-done flag.
- Answer mode: voice or keyboard.
- Speech recognition: local or browser.
- The pause before a voice answer is sent: 2, 3 or 5 s, or manual.
- Whether Mike speaks aloud.
- The last round type and the last vacancy.

Everything else lives in the backend's `settings.json`.
