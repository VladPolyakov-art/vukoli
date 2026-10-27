"""What the debrief page shows on top of the saved debrief (feedback_rubric.md §9, US-20 AC6-AC9).

Nothing here is written by the model and nothing here is saved. The scorecard, the verdict step (D99), the "How it lands" line and the plan
are built in code, at read time, from the feedback layers of each answer. So they follow dismissed corrections, words
the recogniser may have misheard, "Edit what I said" and sessions saved before these fields existed. Every place that
sends a debrief to a client (and the Markdown export) calls `enrich_debrief`; the saved session never holds
`ENRICHED_KEYS` (`storage.save_session` removes them if they are ever present).
"""
from __future__ import annotations

from . import feedback
from .feedback import CONTENT_FIX, counted_tags, hints, is_quote, norm

# Keys this module adds. `scorecard` is on the debrief, `said`/`said_kind`/`said_from`/`lands_as` on each weak spot.
ENRICHED_KEYS = ("scorecard", "plan", "step")
ENRICHED_SPOT_KEYS = ("said", "said_kind", "said_from", "lands_as")

ROWS = ("structure", "own_part", "result", "relevance", "reflection", "language", "delivery")
CONTENT_ROWS = ROWS[:4]            # structure, own_part, result, relevance: the rows that can make a verdict "Not ready yet"
STEP_NAMES = ("Not ready yet", "Getting there", "Ready")
ROW_LABELS = {"structure": "Structure (STAR)", "own_part": "Your part", "result": "Result",
              "relevance": "On the question", "reflection": "Lessons learned", "language": "English",
              "delivery": "Delivery"}

# §9.2: the interviewer's likely reading, by tag.
LANDS_AS = {
    "no_result": "The interviewer can't tell if your work changed anything, so the story ends without a point.",
    "vague_result": "\"It went well\" sounds like a guess; the interviewer will ask for a number or will assume none.",
    "no_star_action": "It's clear what happened, but not what you did, so your skills stay invisible.",
    "we_not_i": "All \"we\" makes it hard to see your part; the interviewer may credit the team, not you.",
    "we_mixed": "Your part is there but blurred; one clear \"I decided\" would make it yours.",
    "off_topic": "The interviewer waits for the answer to their question and may stop listening to the story.",
    "no_reflection": "Without a lesson the story sounds rehearsed; interviewers look for what you would change.",
    "meaning_error": "The listener may understand something different from what you meant.",
    "tense": "Tense slips make it unclear whether this happened before or is still true.",
    "collocation": "The meaning is clear, but the wording sounds unusual and pulls attention from the content.",
    "preposition": "Small but repeated, it makes fluent answers sound less polished.",
    "article": "Rarely changes the meaning; it matters only because it repeats.",
    "word_choice": "A less exact word makes the point weaker than your experience.",
    "pace_fast": "Fast speech makes the listener work hard, and key facts get lost.",
    "pace_slow": "A slow pace can read as unsure, even when the content is good.",
    "too_long": "Long answers make the interviewer cut in or lose the main point.",
    "too_short": "Short answers read as little experience or little interest.",
    "filler_high": "Many \"um\"s read as unsure, even when the content is strong.",
    "long_pauses": "Long silences read as being stuck, though a short pause reads as thinking.",
    "restarts": "Restarted sentences make the answer sound unprepared.",
}

# §9.3: one exercise for the next practice, by tag.
LANGUAGE_PLAN = "Drill the phrases from this session's corrections out loud, three times each."
HABIT_PLAN = "Record one answer and replay it, listening only for this habit."
PLAN_STEPS = {
    "no_result": "Before your next session, write one number for each of your 3 main stories.",
    "vague_result": "Before your next session, write one number for each of your 3 main stories.",
    "no_star_action": "Retell one story using only sentences that start with \"I\".",
    "we_not_i": "For each story, name the one decision that was yours.",
    "we_mixed": "For each story, name the one decision that was yours.",
    "off_topic": "Practise opening with a one-sentence answer, then the story.",
    "no_reflection": "Add a last sentence to each story: what you would do differently.",
    **{tag: LANGUAGE_PLAN for tag in ("meaning_error", "tense", "collocation", "preposition", "article",
                                      "word_choice")},
    **{tag: HABIT_PLAN for tag in ("pace_fast", "pace_slow", "filler_high", "long_pauses", "restarts")},
    "too_long": "Time one answer: aim for one to two minutes.",
    "too_short": "Time one answer: aim for one to two minutes.",
}


# ---------- Scorecard ----------

def scored_records(feedback_records: list[dict]) -> list[dict]:
    """The records the debrief counts, in the order its "q<n>" ids use: the same filter as `feedback.debrief`."""
    return [f for f in feedback_records or []
            if (f.get("layers") or {}).get("content") or (f.get("layers") or {}).get("language")]


def _real(layer: dict | None) -> bool:
    """A layer that holds a judgement (not missing, not "unavailable")."""
    return bool(layer) and layer.get("status") != "unavailable" and "severity" in layer


def _sev_points(severity: int) -> int:
    return 2 if severity <= 1 else 1 if severity == 2 else 0


def round_score(points: int, answers: int) -> int:
    """1 + 4 * points / (2 * answers), rounded half up (not banker's rounding). Integer maths, no float surprises."""
    return (3 * answers + 4 * points) // (2 * answers)


def _content_points(record: dict, layer: dict) -> dict[str, int | None]:
    """Points (0-2) of one main answer on the five content rows; None where the row does not apply to it.
    A dismissed content layer takes no points away (US-22). With `checks` the raw answers of the model are used,
    otherwise the tags (`missing`, `tips`) of the layer; "situation missing" is known only from `checks`."""
    competency = record.get("competency") or ""
    hypothetical = competency == "H"
    checks = layer.get("checks") if isinstance(layer.get("checks"), dict) else None
    dismissed = bool(layer.get("dismissed"))
    missing = set(layer.get("missing") or [])
    if layer.get("tag") and layer.get("severity", 0) >= 2:
        missing.add(layer["tag"])
    invites = bool(checks["invites_reflection"]) if checks and "invites_reflection" in checks else (
        competency == "F" or "differently" in str(record.get("question") or "").lower())
    out: dict[str, int | None] = {k: None for k in ROWS[:5]}

    if checks is not None:
        no_action = not checks.get("action")
        no_result = not checks.get("result") or checks.get("result_type") == "none"
        vague = checks.get("result_type") == "vague" and not no_result
        voice = checks.get("voice")
        off_topic = checks.get("relevant") is False
        no_reflection = not checks.get("reflection")
        no_situation = not checks.get("situation")
    else:
        no_action, no_result = "no_star_action" in missing, "no_result" in missing
        vague = "vague_result" in missing
        voice = "we" if "we_not_i" in missing else "mixed" if CONTENT_FIX["we_mixed"] in (layer.get("tips") or []) else "i"
        off_topic = "off_topic" in missing
        no_reflection = "no_reflection" in missing
        no_situation = False

    if not hypothetical:
        out["structure"] = 2 if dismissed else 0 if no_action or no_result else 1 if no_situation else 2
        if dismissed or voice not in ("we", "mixed"):
            out["own_part"] = 2
        elif voice == "mixed":
            out["own_part"] = 1
        else:
            # "we" with no individual action at all is S3, otherwise S2 (content_from_model)
            if layer.get("tag") == "we_not_i" and layer.get("severity"):
                severity = layer["severity"]
            else:
                severity = 3 if hints(str(record.get("answer") or ""))["n_i"] == 0 else 2
            out["own_part"] = _sev_points(severity)
        out["result"] = 2 if dismissed else 0 if no_result else 1 if vague else 2
    out["relevance"] = 0 if off_topic and not dismissed else 2
    if invites:
        out["reflection"] = 0 if no_reflection and not dismissed else 2
    return out


def _language_points(layer: dict | None) -> int | None:
    if not layer or layer.get("status") == "unavailable":
        return None
    if "items" in layer:
        counted = [f.get("severity", 0) for f in layer.get("items") or [] if f.get("status") in ("active", "confirmed")]
        return _sev_points(max(counted, default=0))
    return _sev_points(layer.get("severity", 0)) if "severity" in layer else None


def _delivery_points(layer: dict | None) -> int | None:
    """Every answer with a counted delivery layer, typed ones too (§9.1): a typed answer's layer holds only the
    length judgement, which is exactly what it is scored on."""
    if not _real(layer):
        return None
    return 2 if layer.get("dismissed") else _sev_points(layer.get("severity", 0))


def build_scorecard(feedback_records: list[dict]) -> dict:
    points: dict[str, list[tuple[str, int]]] = {k: [] for k in ROWS}
    for i, record in enumerate(scored_records(feedback_records), 1):
        qid, layers = f"q{i}", record.get("layers") or {}
        content = layers.get("content")
        if record.get("answer_kind") == "main" and _real(content):
            for row, value in _content_points(record, content).items():
                if value is not None:
                    points[row].append((qid, value))
        if (value := _language_points(layers.get("language"))) is not None:
            points["language"].append((qid, value))
        if (value := _delivery_points(layers.get("delivery"))) is not None:
            points["delivery"].append((qid, value))
    rows = []
    for key in ROWS:
        items = points[key]
        score = round_score(sum(p for _q, p in items), len(items)) if items else None
        lost = [q for q, p in items if p < 2] if score != 5 else []
        rows.append({"key": key, "score": score, "answers": len(items), "lost": lost})
    return {"rows": rows}


def verdict_step(scorecard: dict | None) -> dict | None:
    """The step of the verdict scale, computed from the scorecard the user sees (rubric §9.4, D99). Shown rows are those
    with a score. Not ready yet (0): a content row (structure, own_part, result, relevance) scores 1 or 2. Ready (2):
    every shown row scores 4 or more. Getting there (1): everything else, so reflection, language and delivery never
    cause "Not ready yet" but any of them below 4 holds the step at "Getting there". No shown row: no step.
    `gap` = the rows between the user and the next step (lowest score first, ties in scorecard order): the content rows
    at 1-2 for step 0 (`target` 3), every shown row at 1-3 for step 1 (`target` 4), none for step 2 (`target` None)."""
    shown = [(i, r["key"], r["score"]) for i, r in enumerate((scorecard or {}).get("rows") or [])
             if isinstance(r.get("score"), int)]
    if not shown:
        return None
    if any(key in CONTENT_ROWS and score <= 2 for _i, key, score in shown):
        value, limit, target = 0, 2, 3
    elif all(score >= 4 for _i, _key, score in shown):
        return {"value": 2, "gap": [], "target": None}
    else:
        value, limit, target = 1, 3, 4
    gap = sorted((x for x in shown if x[2] <= limit and (value == 1 or x[1] in CONTENT_ROWS)),
                 key=lambda x: (x[2], x[0]))
    return {"value": value, "gap": [key for _i, key, _s in gap], "target": target}


# ---------- Weak spots: what you said, how it lands ----------

def _minutes(seconds: float) -> str:
    total = round(seconds)
    return f"{total // 60} min {total % 60} s" if total >= 60 else f"{total} s"


def _number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def _metric_phrase(tag: str, metrics: dict) -> str:
    """A number from the delivery metrics that shows the habit, or "" when it was not measured."""
    wpm, seconds = metrics.get("wpm"), metrics.get("seconds")
    if tag in ("pace_fast", "pace_slow") and wpm is not None:
        return f"{_number(wpm)} words per minute"
    if tag == "filler_high" and metrics.get("fillers_per_100w") is not None:
        return f"{_number(metrics['fillers_per_100w'])} fillers per 100 words"
    if tag == "long_pauses" and metrics.get("long_pauses"):
        n = metrics["long_pauses"]
        return f"{n} long pause{'s' if n != 1 else ''}"
    if tag in ("too_long", "too_short"):
        if metrics.get("mode") == "voice" and seconds:
            return _minutes(float(seconds))
        if metrics.get("words"):
            return f"{metrics['words']} words"
    if tag == "restarts" and metrics.get("restarts"):
        return f"{metrics['restarts']} repeated words"
    return ""


def _said(record: dict, layer: str, tag: str) -> tuple[str, str] | None:
    """(text, kind) shown as "What you said" for one answer, or None when nothing can be verified."""
    if (layer, tag) not in {(la, ta) for la, ta, _s in counted_tags(record)}:
        return None                                    # dismissed, edited away, or not misheard-confirmed
    layers = record.get("layers") or {}
    answer = str(record.get("answer") or "")
    if layer == "content":
        quote = norm(str((layers.get("content") or {}).get("evidence") or ""))
        return (quote, "quote") if quote and is_quote(quote, answer) else None
    if layer == "language":
        for flag in (layers.get("language") or {}).get("items") or []:
            if (flag.get("tag") == tag and flag.get("status") in ("active", "confirmed")
                    and flag.get("severity", 0) >= 2 and is_quote(str(flag.get("original") or ""), answer)):
                return norm(flag["original"]), "quote"
        return None
    if layer == "delivery":
        phrase = _metric_phrase(tag, (layers.get("delivery") or {}).get("metrics") or {})
        return (phrase, "metric") if phrase else None
    return None


def _enrich_spot(spot: dict, records: list[dict]) -> dict:
    out = {k: v for k, v in spot.items() if k not in ENRICHED_SPOT_KEYS}
    if isinstance(spot.get("evidence"), list):
        out["evidence"] = list(dict.fromkeys(spot["evidence"]))   # one id per question, in order
    for qid in dict.fromkeys(spot.get("evidence") or []):
        digits = str(qid)[1:]
        if not (str(qid).startswith("q") and digits.isdigit() and 1 <= int(digits) <= len(records)):
            continue
        found = _said(records[int(digits) - 1], str(spot.get("layer")), str(spot.get("tag")))
        if found:
            out.update({"said": found[0], "said_kind": found[1], "said_from": str(qid)})
            break
    if spot.get("tag") in LANDS_AS:
        out["lands_as"] = LANDS_AS[spot["tag"]]
    # Template debriefs saved before LANGUAGE_FIX said "Work on article." for language spots: show the real fix instead.
    tag = str(spot.get("tag") or "")
    if spot.get("layer") == "language" and tag in feedback.LANGUAGE_FIX and \
            norm(str(spot.get("text") or "")) == f"Work on {tag.replace('_', ' ')}.":
        out["text"] = feedback.LANGUAGE_FIX[tag]
    return out


def build_plan(spots: list[dict]) -> list[dict]:
    steps = []
    for spot in spots[:3]:
        text = PLAN_STEPS.get(spot.get("tag"))
        if text:
            steps.append({"layer": spot.get("layer"), "tag": spot.get("tag"), "text": text, "drill": not steps})
    return steps


def enrich_debrief(debrief: dict | None, feedback_records: list[dict], mode: str) -> dict | None:
    """A copy of the debrief with the scorecard, the verdict step, "what you said / how it lands" on each weak spot and the plan.
    Interview mode only; no debrief or a too-short one is returned as it is. The saved debrief is never changed."""
    if not debrief or debrief.get("too_short") or mode != "interview":
        return debrief
    records = scored_records(feedback_records)
    spots = [_enrich_spot(s, records) for s in debrief.get("weak_spots") or [] if isinstance(s, dict)]
    out = {k: v for k, v in debrief.items() if k not in ENRICHED_KEYS}
    out["weak_spots"] = spots
    out["scorecard"] = build_scorecard(feedback_records)
    out["plan"] = build_plan(spots)
    if (step := verdict_step(out["scorecard"])) is not None:
        out["step"] = step                                  # D99: from the scorecard just built, so it follows the same edits
    return out


def strip_enriched(debrief: dict | None) -> dict | None:
    """The debrief as it is saved: without anything `enrich_debrief` adds. Returns the same object when clean."""
    if not debrief:
        return debrief
    spots = debrief.get("weak_spots")
    dirty = any(k in debrief for k in ENRICHED_KEYS) or any(
        isinstance(s, dict) and any(k in s for k in ENRICHED_SPOT_KEYS) for s in spots or [])
    if not dirty:
        return debrief
    out = {k: v for k, v in debrief.items() if k not in ENRICHED_KEYS}
    if isinstance(spots, list):
        out["weak_spots"] = [{k: v for k, v in s.items() if k not in ENRICHED_SPOT_KEYS} if isinstance(s, dict) else s
                             for s in spots]
    return out


# ---------- Markdown ----------

def _cell(text: object) -> str:
    return str(text or "").replace("|", "\\|").replace("\n", " ").strip()


def markdown_sections(debrief: dict) -> dict[str, list[str]]:
    """Lines for the export, in the order of the page: `weak_spots` (three lines each), `plan` (numbered), then
    `scorecard` (a small table of the rows that have a score, then "Not asked this time: ..." for the others; no
    section when no row has a score)."""
    out: dict[str, list[str]] = {}
    spots = []
    for spot in debrief.get("weak_spots") or []:
        mark = "\"" if spot.get("said_kind") == "quote" else ""
        lead = "Measured" if spot.get("said_kind") == "metric" else "What you said"
        spots.append(f"- **{_cell(spot.get('layer'))}**: {_cell(str(spot.get('tag') or '').replace('_', ' '))}")
        if spot.get("said"):
            spots.append(f"  - {lead}: {mark}{_cell(spot['said'])}{mark}")
        if spot.get("lands_as"):
            spots.append(f"  - How it lands: {_cell(spot['lands_as'])}")
        spots.append(f"  - How to fix: {_cell(spot.get('text'))}")
    if spots:
        out["weak_spots"] = spots
    plan = [f"{n}. {_cell(step['text'])}" for n, step in enumerate(debrief.get("plan") or [], 1)]
    if plan:
        out["plan"] = plan
    card = (debrief.get("scorecard") or {}).get("rows") or []
    scored = [row for row in card if row.get("score") is not None]
    if scored:
        lines = ["| Criterion | Score |", "| --- | --- |"]
        lines += [f"| {ROW_LABELS.get(row['key'], row['key'])} | {row['score']}/5 |" for row in scored]
        lines += ["", "Practice scores from this app's rubric, not a prediction of a hiring decision."]
        skipped = [ROW_LABELS.get(row["key"], row["key"]) for row in card if row.get("score") is None]
        if skipped:
            lines += ["", f"Not asked this time: {', '.join(skipped)}"]
        out["scorecard"] = lines
    return out
