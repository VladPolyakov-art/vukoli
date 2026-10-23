# Vukoli

Practise job interviews out loud with **Mike**, an AI interviewer, on your own computer.
Mike asks real interview questions (general ones, or questions built from your CV and a job posting), follows up
like a real interviewer, and after each answer you get short feedback on content, English and delivery.
There is also an English conversation mode.

- Runs locally. With Ollama, nothing leaves your computer.
- Bring your own AI: Ollama, any OpenAI-compatible server (LM Studio, llama.cpp, Jan, OpenRouter, OpenAI),
  your Claude Code CLI, or Gemini Live with your own Google AI Studio key.
- Voice in: local Whisper (mlx-whisper on Apple Silicon, faster-whisper elsewhere) or your browser's recogniser.
  Voice out: Kokoro (local). Without speech models the app works with typed answers.
- Your sessions are saved as JSON and Markdown in your OS app-data folder.

License: AGPL-3.0-or-later (see `LICENSE`).

## Install

One command installs everything and opens the app in its own window (Chrome or Edge app mode: no tabs, no address bar). No Node, Python or admin password needed.

**macOS** (Terminal):

```bash
curl -fsSL https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.sh | bash
```

**Windows** (PowerShell, no admin):

```powershell
irm https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.ps1 | iex
```

It installs its own private Python, offers to install Ollama (the free local AI engine), downloads the speech
models (Kokoro voice, Whisper recognition) and the AI model for your memory size, then opens the app on its
first-run setup. It shows each step and the size of each download. If a step fails, run the same command again:
finished steps are skipped. Use `--yes` to accept all defaults (macOS: `... | bash -s -- --yes`; Windows:
set `$env:VUKOLI_YES=1` before the command).

- **Where it goes.** macOS: `~/.vukoli` (app, Python, logs) and `~/Applications/Vukoli.app`. Windows: `%LOCALAPPDATA%\Vukoli`,
  with a Vukoli shortcut in the Start menu and on the Desktop. Your sessions and settings are kept in your
  user data folder, not in the install folder.
- **Start it later.** macOS: open Vukoli from Launchpad or your Applications folder (in your home folder).
  Windows: Start menu, Vukoli. To stop it on macOS: `~/.vukoli/bin/vukoli stop`.
- **Uninstall.** macOS: `bash ~/.vukoli/app/install/install.sh --uninstall` (add `--purge` to also delete your sessions
  and settings). Windows: `& ([scriptblock]::Create((irm https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.ps1))) -Uninstall`
  (add `-Purge`). Ollama and its models are never removed; to remove Ollama, quit it and delete the app, then delete
  the `.ollama` folder in your home folder.
- **Ollama starts with your computer.** If the installer installs or finds Ollama, it sets Ollama to start when you
  log in, so the app is ready right away. Turn it off on macOS: System Settings > General > Login Items
  (under "Allow in the Background"), or run `~/.vukoli/bin/vukoli autostart off`.
  Windows: Settings > Apps > Startup > Ollama.
- **No Ollama?** Say no when asked. The first-run setup then lists every way to connect an AI engine.

macOS options (after `bash -s --`): `--yes`, `--from <vukoli.zip>` (install from a local file), `--no-ollama`,
`--no-models`, `--no-launch`, `--prefix <folder>`. The Windows script has the same options as parameters
(`-Yes`, `-From`, `-NoOllama`, `-NoModels`, `-NoLaunch`, `-Prefix`).

Vukoli opens as its own window when Chrome, Edge, Chromium or Brave is installed (macOS) or Edge or Chrome (Windows),
in your normal browser profile, so the microphone permission is remembered. Without them it opens a tab in your
default browser. To always get a browser tab, set `VUKOLI_APP_WINDOW=0` (or start the launcher with `--browser` / `-Browser`).

## What's free

Everything you need to practise is free forever, with no account and no key. The free core is never a demo.

| Feature | Free forever | Premium (coming later) |
|---|---|---|
| Interview practice with Mike | ✓ | ✓ |
| English practice | ✓ | ✓ |
| Prep from your CV and the job description | ✓ | ✓ |
| Question bank | ✓ | ✓ |
| Debrief after every session | ✓ | ✓ |
| Mistake memory | ✓ | ✓ |
| Weak-spot drill | ✓ | ✓ |
| Zero setup | Set up a local engine once | ✓ |
| Best live voice | Voice on this computer | ✓ |
| Trends across sessions | — | ✓ |
| History on all your devices | This computer only | ✓ |

Premium isn't available yet and has no price. When it comes, it adds to the free core and takes nothing away.

**Practice only.** This app is for rehearsal, never for help during a real interview.

<!-- Keep this table identical to Settings → About and what's free (web/src/i18n/en.json, settings.about; US-30). -->

## Quick start (development)

Requirements: Python 3.11+, and [Ollama](https://ollama.com/download) for the default local engine.

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # optional: data folder, Kokoro model folder, Ollama URL

ollama pull qwen3:4b-instruct   # voice sessions use this model by default (fastest replies)
ollama pull qwen3:8b            # optional, 16 GB RAM or more: typed answers use it when installed
.venv/bin/python -m server      # http://127.0.0.1:8000  (API docs at /api/docs)
.venv/bin/python -m pytest      # tests (no network, no microphone)
```

Speech output needs the Kokoro files `kokoro-v1.0.onnx` and `voices-v1.0.bin`
(from https://github.com/thewh1teagle/kokoro-onnx/releases) in `<data folder>/models/kokoro/`,
or set `KOKORO_MODEL_DIR` to a folder that has them. `GET /api/tts` shows where the app looks.

The web app lives in `web` (React + Vite + TypeScript + Storybook, details in `web/README.md`):

```bash
cd web
npm install
npm run dev                     # http://localhost:5173 (proxies /api and /ws to the backend on :8000)
npm run build                   # then restart the backend: it serves web/dist at / (only if dist existed at start)
npm run typecheck && npm run lint && npm test
npm run storybook               # design-system components on :6006
npm run e2e                     # headless end-to-end run against :8000, screenshots in web/.screens/
```

First run opens a short setup: choose the AI engine (Ollama is checked live, with the exact command to fix it),
test the microphone, model and voice, optionally add your CV and the job, then start the first interview.

## Layout

```
.
  server/
    server/            FastAPI app: engines/, session.py (Mike), feedback.py, ws.py, api.py, storage.py
    content/           prompts, JSON schemas, feedback rubric, question bank, UI copy
    tests/             pytest suite
    scripts/pii_scan.py  release check for personal data (patterns kept outside the repo)
    PROTOCOL.md        session WebSocket protocol
  web/
    src/ds/            design system (tokens, components, Storybook stories)
    src/screens/       Setup, Practice, Session, Debrief, History, Settings
    src/session/       WebSocket session state and audio wiring
    src/audio/         mic capture (AudioWorklet), playback, voice-activity detection
  design/
    ds/                design-system contract (CONTRACT.md), foundation, component catalogue, screen maps
    tokens/tokens.json design tokens (W3C DTCG); web/src/ds/tokens.css is built from them
    docs/              ui-spec.md (screens and states), frontend.md (stack, routes, checks), e2e.md
```

## Design handoff (`design/`)

The redesign was built design-in-code: every screen uses DS components from `web/src/ds/` and semantic tokens only.
Before changing the UI, read `design/ds/CONTRACT.md`, `design/ds/foundation.md` and `design/ds/components.md`.
Storybook: `cd web && npm install && npm run storybook`. Checks: `npm run typecheck && npm run lint && npm test`.

## Privacy

- Settings and API keys are stored in `settings.json` in your app-data folder (file mode 0600) and are never
  returned by the API or written to logs.
- Usage telemetry is off by default. If you opt in, events (timings, engine names, error codes, never what you
  said) are written to `telemetry.jsonl` in the same folder. Nothing is uploaded.
- Markdown export to a notes folder (for example Obsidian) is off until you choose a folder.

## Before publishing

Run the personal-data check with your own denylist (kept outside the repository). CI runs only the built-in
checks (Cyrillic text, e-mail addresses), because it has no denylist:

```bash
.venv/bin/python scripts/pii_scan.py --require-denylist   # reads ~/.config/interview-coach/denylist.txt or IC_PII_PATTERNS
```
