"""Cross-session memory built only from the user's own saved sessions (no invented history)."""
from __future__ import annotations

from collections import Counter

from . import storage


def recent_sessions(limit: int = 10, exclude: str = "") -> list[dict]:
    items = [s for s in storage.list_records("sessions") if s.get("id") != exclude]
    items.sort(key=lambda s: s.get("started_at", ""), reverse=True)
    return items[:limit]


def summary(limit: int = 5, exclude: str = "") -> dict:
    sessions = [s for s in recent_sessions(limit * 3, exclude) if (s.get("debrief") or {}).get("weak_spots")][:limit]
    counts: Counter = Counter()
    layers: dict[str, str] = {}
    for s in sessions:
        for spot in s["debrief"]["weak_spots"]:
            tag = spot.get("tag")
            if tag:
                counts[tag] += 1
                layers[tag] = spot.get("layer", "")
    spots = [{"tag": tag, "layer": layers[tag], "sessions": n} for tag, n in counts.most_common(5)]
    return {"sessions_considered": len(sessions), "weak_spots": spots,
            "total_sessions": len(storage.list_records("sessions"))}


def past_weak_spots_text(exclude: str = "") -> str:
    data = summary(exclude=exclude)
    if not data["weak_spots"]:
        return "none"
    m = data["sessions_considered"]
    return "; ".join(f"{s['layer']}:{s['tag']} in {s['sessions']} of the last {m} sessions" for s in data["weak_spots"])
