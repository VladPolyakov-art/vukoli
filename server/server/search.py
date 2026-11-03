"""Search across every saved practice (D105): `GET /api/sessions/search?q=<text>&limit=20`.

Local only, nothing is indexed on disk. Each session file is read once and kept in a small in-memory cache keyed by
its path, size and modification time, so typing a query costs a scan over prepared text, not a re-read of the JSON.
A session matches when EVERY word of the query is found somewhere in it (AND), case-insensitively, as a part of a word:

  head   the title as shown, the job (the session's `vacancy_title` and the title of its vacancy record) and the mode
         ("english" / "interview": an "English practice" matches "english" even after it was renamed)
  talk   what Mike asked and what the user answered (`transcript`, then `feedback[].question/answer` for anything the
         transcript does not hold, e.g. an answer edited with "Edit what I said")

Order: sessions whose head matches come first (more of the query's words in the head, first), then the number of hits
in the whole session, then the newest. Archived sessions are searched too; the ones in the trash are not.

`match` says where the first hit is and gives a snippet of about 120 characters around it. `q` is the number of the
question the Debrief shows it under, the one in `?q=n` (`debrief_view.question_numbers` / `threadsFromRecord` in
mapRecord.ts count the same way: the place in the session's question list, else the order the questions were
answered). An English practice has no question tabs, so it has no `q`.
"""
from __future__ import annotations

import datetime
import threading
from dataclasses import dataclass, field
from pathlib import Path

from . import storage

MIN_QUERY = 2          # one character matches half of any text: the page does not even ask
MAX_WORDS = 8          # the rest of a long query is dropped
SNIPPET = 120          # characters around the first hit
DEFAULT_LIMIT = 20
MAX_LIMIT = 50


def _fold(text: str) -> str:
    """Lower-case with the SAME length as the input, so a position found in the folded text is a position in the original."""
    return "".join(c.lower() if len(c.lower()) == 1 else c for c in text)


def _flat(value: object) -> str:
    return " ".join(value.split()) if isinstance(value, str) else ""


@dataclass
class _Seg:
    field: str                      # "question" | "answer"
    text: str
    low: str
    q: int | None


@dataclass
class _Doc:
    id: str
    title: str
    mode: str
    archived: bool
    started_at: str
    vacancy_id: str
    vacancy_title: str
    segs: list[_Seg] = field(default_factory=list)


def _numbers(record: dict, english: bool):
    """question id -> the number the Debrief shows it under (None for an English practice and for an unknown id)."""
    questions = record.get("questions") if isinstance(record.get("questions"), list) else []
    ids = [str(q.get("id")) if isinstance(q, dict) else None for q in questions]
    order: list[str] = []
    for fb in record.get("feedback") if isinstance(record.get("feedback"), list) else []:
        if isinstance(fb, dict):
            key = str(fb.get("question_id") or "general")
            if key not in order:
                order.append(key)

    def number(question_id: object) -> int | None:
        if english:
            return None
        key = str(question_id or "general")
        if key in ids:
            return ids.index(key) + 1
        return order.index(key) + 1 if key in order else None
    return number


def _build(record: dict) -> _Doc | None:
    sid = record.get("id")
    if not isinstance(sid, str) or not sid:
        return None
    mode = record.get("mode") if isinstance(record.get("mode"), str) else ""
    doc = _Doc(id=sid, title=storage.display_title(_flat(record.get("title"))), mode=mode,
               archived=bool(record.get("archived")),
               started_at=record.get("started_at") if isinstance(record.get("started_at"), str) else "",
               vacancy_id=record.get("vacancy_id") if isinstance(record.get("vacancy_id"), str) else "",
               vacancy_title=_flat(record.get("vacancy_title")))
    number = _numbers(record, mode == "english")
    seen: set[tuple[str, str]] = set()

    def add(kind: str, text: object, question_id: object) -> None:
        flat = _flat(text)
        if not flat:
            return
        low = _fold(flat)
        if (kind, low) in seen:
            return
        seen.add((kind, low))
        doc.segs.append(_Seg(kind, flat, low, number(question_id)))

    last_question = ""
    for turn in record.get("transcript") if isinstance(record.get("transcript"), list) else []:
        if not isinstance(turn, dict):
            continue
        if turn.get("question_id"):
            last_question = str(turn["question_id"])
        if turn.get("role") == "model":
            if turn.get("kind") != "closing":
                add("question", turn.get("text"), turn.get("question_id") or last_question)
        elif turn.get("role") == "user":
            add("answer", turn.get("text"), turn.get("question_id") or last_question)
    for fb in record.get("feedback") if isinstance(record.get("feedback"), list) else []:
        if isinstance(fb, dict):
            add("question", fb.get("question"), fb.get("question_id"))
            add("answer", fb.get("answer"), fb.get("question_id"))
    return doc


_cache: dict[str, tuple[int, int, _Doc | None]] = {}
_cache_lock = threading.Lock()


def _docs() -> list[_Doc]:
    folder = storage._folder("sessions")
    found: list[_Doc] = []
    live: set[str] = set()
    for path in folder.glob("*.json"):
        key = str(path)
        live.add(key)
        try:
            stat = path.stat()
        except OSError:
            continue
        with _cache_lock:
            hit = _cache.get(key)
        if hit and hit[0] == stat.st_mtime_ns and hit[1] == stat.st_size:
            doc = hit[2]
        else:
            try:
                data = storage.read_json(path)
                doc = _build(data) if isinstance(data, dict) else None
            except (OSError, ValueError):
                doc = None
            with _cache_lock:
                _cache[key] = (stat.st_mtime_ns, stat.st_size, doc)
        if doc:
            found.append(doc)
    prefix = str(folder)
    with _cache_lock:                                   # forget sessions that were deleted or whose folder changed
        for key in [k for k in _cache if k.startswith(prefix) and k not in live]:
            del _cache[key]
    return found


def words(query: str) -> list[str]:
    """The words of a query: folded, no duplicates, at most MAX_WORDS."""
    out: list[str] = []
    for word in _fold(str(query or "")).split():
        if word not in out:
            out.append(word)
    return out[:MAX_WORDS]


def snippet(text: str, tokens: list[str], width: int = SNIPPET) -> str:
    """About `width` characters of `text` around the first hit of any word, cut at word edges, "…" where it was cut."""
    flat = _flat(text)
    if len(flat) <= width:
        return flat
    low = _fold(flat)
    hits = [(p, len(t)) for t in tokens for p in [low.find(t)] if p >= 0]
    pos, size = min(hits) if hits else (0, 0)
    start = max(0, pos - width // 3)
    end = min(len(flat), start + width)
    start = max(0, end - width)
    if start > 0 and flat[start - 1] != " ":
        gap = flat.find(" ", start)
        if 0 <= gap <= pos:
            start = gap + 1
    if end < len(flat) and flat[end] != " ":
        gap = flat.rfind(" ", pos + size, end)
        if gap > start:
            end = gap
    return ("…" if start > 0 else "") + flat[start:end].strip() + ("…" if end < len(flat) else "")


def _date(started_at: str) -> str:
    try:
        when = datetime.datetime.fromisoformat(started_at)
    except ValueError:
        return ""
    return f"{when.day} {when:%b %Y}"


def _subtitle(doc: _Doc, jobs: list[str]) -> str:
    """"Job · date". The job is left out when the title already says it (the usual "Company · Role" title)."""
    job = next((j for j in jobs if j and storage.job_name(j) != doc.title), "")
    return " · ".join(part for part in (storage.job_name(job) if job else "", _date(doc.started_at)) if part)


def search_sessions(query: str, limit: int = DEFAULT_LIMIT) -> list[dict]:
    tokens = words(query)
    if not tokens or len(_flat(query)) < MIN_QUERY:
        return []
    limit = max(1, min(int(limit), MAX_LIMIT))
    vacancies = {}
    for vacancy in storage.list_records("vacancies"):
        if isinstance(vacancy, dict) and isinstance(vacancy.get("id"), str):
            vacancies[vacancy["id"]] = _flat(vacancy.get("title"))
    scored = []
    for doc in _docs():
        jobs = [j for j in dict.fromkeys([doc.vacancy_title, vacancies.get(doc.vacancy_id, "")]) if j]
        mode_words = {"english": "english", "interview": "interview"}.get(doc.mode, "")
        head_title = _fold(f"{doc.title} {mode_words}")
        head_jobs = [(j, _fold(j)) for j in jobs]
        head_all = head_title + " " + " ".join(low for _, low in head_jobs)
        seg_all = [seg.low for seg in doc.segs]
        everything = head_all + "\n" + "\n".join(seg_all)
        if not all(t in everything for t in tokens):
            continue
        in_head = [t for t in tokens if t in head_all]
        hits = sum(head_all.count(t) for t in tokens) + sum(low.count(t) for low in seg_all for t in tokens)
        if in_head:
            where = next(((j, "job") for j, low in head_jobs if any(t in low for t in tokens)), None)
            if any(t in head_title for t in tokens) or not where:
                text, kind, q = doc.title, "title", None
            else:
                text, kind, q = where[0], "job", None
        else:
            best = max(enumerate(doc.segs), key=lambda pair: (sum(t in pair[1].low for t in tokens), -pair[0]))[1]
            text, kind, q = best.text, best.field, best.q
        scored.append((len(in_head), hits, doc.started_at, {
            "id": doc.id, "title": doc.title, "subtitle": _subtitle(doc, jobs), "mode": doc.mode,
            "archived": doc.archived, "started_at": doc.started_at,
            "match": {"field": kind, "snippet": snippet(text, tokens), "q": q}}))
    scored.sort(key=lambda item: item[2], reverse=True)          # newest first, then the stable sort keeps it on ties
    scored.sort(key=lambda item: (-item[0], -item[1]))
    out = []
    for _, _, _, result in scored[:limit]:
        if result["match"]["q"] is None:
            del result["match"]["q"]
        out.append(result)
    return out
