# Contributing to Vukoli

Thanks for your interest. Bug reports, ideas and pull requests are welcome.

> **Contributor License Agreement.** Before a pull request can be merged, contributors will be asked to sign a
> CLA. The agreement is still being prepared. Until it is published, you can open issues and pull requests, but
> they will not be merged yet.

## No personal data

Vukoli handles CVs, job postings and voice recordings, so this rule is strict:

- Never commit real CVs, real names, contact details, job postings tied to a real person, or audio recordings.
- Test fixtures, examples and screenshots use **fictional** people and companies only. For e-mail addresses
  use `example.com`.
- Never commit `.env`, your app-data folder (sessions, `settings.json`, `telemetry.jsonl`), model files
  (`*.onnx`, `voices-*.bin`) or e2e screenshots (`web/.screens/`). `.gitignore` covers these; please don't
  force-add them.
- The app ships in English. Keep code, copy and docs in English.

CI enforces part of this: `server/scripts/pii_scan.py` fails on Cyrillic text and on e-mail addresses outside
example domains, and [gitleaks](https://github.com/gitleaks/gitleaks) fails on committed secrets.

## Development setup

Requirements: Python 3.11+, Node.js LTS, and [Ollama](https://ollama.com/download) for the default local engine.

Backend:

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # optional: data folder, Kokoro model folder, Ollama URL

ollama pull qwen3:4b-instruct   # default model for voice sessions
.venv/bin/python -m server      # http://127.0.0.1:8000  (API docs at /api/docs)
```

For development, point the backend at a scratch data folder so you don't mix test sessions with your own:
`IC_DATA_DIR=/tmp/ic-devdata .venv/bin/python -m server`.

Speech output needs the Kokoro model files; see the README for where to put them. Without them the app works
with typed answers.

Web app:

```bash
cd web
npm install
npm run dev                     # http://localhost:5173, proxies /api and /ws to the backend on :8000
npm run storybook               # design-system components on :6006
```

More detail: `README.md`, `web/README.md`, and `server/PROTOCOL.md` for the session WebSocket protocol.

## Running the checks

CI (`.github/workflows/ci.yml`) runs the commands below on every push to `main` and every pull request.
Run them locally before you open a pull request. Paths are relative to the repository root.

Backend (no network, no microphone, no real keys):

```bash
server/.venv/bin/python -m pytest -q server/tests
server/.venv/bin/python server/scripts/pii_scan.py
```

Web:

```bash
cd web
npm ci
npm run typecheck
npm run lint                    # ESLint with no warnings + no colour literals outside src/ds/tokens.css
npm run test
npm run build
```

`npm run e2e` drives the built app end to end. It needs a running backend and Ollama, so it is not part of CI.

## Pull requests

- Keep each pull request focused on one change and describe what changed and why.
- Add or update tests for behaviour changes.
- Interface changes should use the design-system components and tokens in `web/src/ds/`.
- Prompt changes for the interviewer can break small local models in surprising ways. Describe how you checked
  the new wording.
- Fill in the pull request checklist, including the personal-data box.

## License

Vukoli is licensed under AGPL-3.0-or-later (see `LICENSE`).
