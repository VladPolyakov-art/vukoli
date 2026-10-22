## What and why

<!-- What does this change, and why? Link the issue if there is one. -->

## How it was checked

<!-- Commands you ran, manual checks, and for prompt changes: which model and how you evaluated the new wording. -->

## Checklist

- [ ] **No personal data**: no real CVs, names, contact details, job postings tied to a real person, recordings,
      `.env`, app-data files or screenshots of real sessions. Fixtures and examples are fictional.
- [ ] Server: `python -m pytest -q server/tests` and `python server/scripts/pii_scan.py` pass.
- [ ] Web (if touched): `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` pass in `web/`.
- [ ] Tests added or updated for behaviour changes.
- [ ] Docs updated if behaviour, setup or the WebSocket protocol changed (`README.md`, `server/PROTOCOL.md`).
