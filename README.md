<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/vukoli-lockup-dark.svg">
    <img src=".github/assets/vukoli-lockup.svg" alt="Vukoli" height="56">
  </picture>
</h1>

Practise job interviews out loud with **Mike**, an AI recruiter, on your own computer. Free and open source.

Interviews are hard to rehearse. You can't memorise every answer, a mentor costs money, and a chatbot playing a
recruiter loses the context after a few questions. Vukoli gives you a recruiter who remembers the whole call.

## What you can practise

- **Job interviews.** HR, behavioural or mixed rounds. Paste a job posting and add your CV, and Mike asks questions
  for that role, follows up when an answer is vague, and moves on like a real interviewer.
- **Tough questions.** Five themes: money, leaving and gaps, weak spots, fit, English at work (plus personal
  questions, if you choose them). Mike pushes back on purpose.
- **Salary talks.** A screening call, an offer call, internship to full-time, a counteroffer, or asking your lead
  for a raise. Mike bargains: he raises objections, makes small concessions and holds a budget you can't see.
  Before the call you can take a 3-minute course and write down your case (results with numbers, why this number,
  what else you'd accept).
- **English conversation.** Talk about anything at your level and get your mistakes corrected after the call.

**Hints during the call.** Stuck? Press H. You get a tactic card, and its example line is written from what you
have already said, not generic advice.

**Feedback after the call.** Every answer gets feedback on content, English and delivery. Salary talks show how
the offer moved, which objections you answered, and what to prepare before the real talk.

## How it runs

- Locally. With Ollama, nothing leaves your computer.
- Bring your own AI: Ollama, any OpenAI-compatible server (LM Studio, llama.cpp, Jan, OpenRouter, OpenAI and
  others), your Claude Code, Codex or Antigravity CLI, or Gemini Live with your own Google AI Studio key.
  You can pick a different engine for the feedback after the call.
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

It installs its own private Python, then asks before each big or lasting step, with the size of each download:

1. **Speech models** (Kokoro voice, Whisper recognition, about 1 GB). Without them you type your answers.
2. **Ollama** (the free local AI engine), if it isn't installed yet. Say no to connect Claude Code, Codex or an
   API key in the app instead.
3. **Start Ollama when you log in**, so the app is ready right away. Turn it off any time.

The AI model itself is picked and downloaded in the app (first-run setup, or Settings > AI engine), with progress
and the size shown. Models you already have in Ollama are listed there, so nothing is downloaded twice.

Then it opens the app on its first-run setup. At the end it lists everything it created on your computer and how
to remove it. If a step fails, run the same command again: finished steps are skipped. Use `--yes` to accept all
defaults without questions (macOS: `... | bash -s -- --yes`; Windows: set `$env:VUKOLI_YES=1` before the command).

- **Where it goes.** macOS: `~/.vukoli` (app, Python, logs) and `~/Applications/Vukoli.app`. Windows: `%LOCALAPPDATA%\Vukoli`,
  with a Vukoli shortcut in the Start menu and on the Desktop. Your sessions and settings are kept in your
  user data folder, not in the install folder.
- **Start it later.** macOS: open Vukoli from Launchpad or your Applications folder (in your home folder).
  Windows: Start menu, Vukoli. To stop it on macOS: `~/.vukoli/bin/vukoli stop`.
- **Uninstall.** macOS: `bash ~/.vukoli/app/install/install.sh --uninstall` (add `--purge` to also delete your sessions
  and settings). Windows: Settings > Apps > Vukoli > Uninstall, or `& ([scriptblock]::Create((irm https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.ps1))) -Uninstall`
  (add `-Purge`). Ollama and its models are never removed; to remove a model run `ollama rm <model>`. To remove Ollama,
  quit it and delete the app, then delete the `.ollama` folder in your home folder.
- **Ollama starts with your computer** only if you say yes. Turn it off on macOS: System Settings > General > Login Items
  (under "Allow in the Background"), or run `~/.vukoli/bin/vukoli autostart off`.
  Windows: Settings > Apps > Startup > Ollama.
- **No Ollama?** Choose "another engine" when asked. The first-run setup then lists every way to connect an AI engine.

macOS options (after `bash -s --`): `--yes`, `--from <vukoli.zip>` (install from a local file), `--no-ollama`,
`--no-models`, `--no-launch`, `--prefix <folder>`. The Windows script has the same options as parameters
(`-Yes`, `-From`, `-NoOllama`, `-NoModels`, `-NoLaunch`, `-Prefix`).

Vukoli opens as its own window when Chrome, Edge, Chromium or Brave is installed (macOS) or Edge or Chrome (Windows),
in your normal browser profile, so the microphone permission is remembered. Without them it opens a tab in your
default browser. To always get a browser tab, set `VUKOLI_APP_WINDOW=0` (or start the launcher with `--browser` / `-Browser`).

Chrome and Edge also offer to install Vukoli as an app (a card on Home, or Settings > General > Install Vukoli as an app),
which gives it its own Dock / taskbar icon. If the app is closed, clicking that icon shows "Start Vukoli".

## Free

Everything is free, with no account and no key. Set up a local engine once, or connect one you already have.

**Practice only.** This app is for rehearsal, never for help during a real interview.

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
    server/            FastAPI app: engines/, session.py (Mike), feedback.py, ws.py, api.py, storage.py,
                       bargain.py (salary talks), tough.py (tough questions), hintgen.py (hint lines)
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
