"""Test-only routes for the end-to-end suite (app/web/e2e). Registered by main.create_app() only when IC_E2E=1;
without the flag these paths do not exist (404) and `config.e2e_enabled()` is False.

  POST /api/_e2e/reset            wipe the data folder (settings, profile, jobs, sessions, trash) and reset the scripted engine
  GET  /api/_e2e/engine           the scripted engine's state (status, kinds that fail, delay, calls per kind)
  POST /api/_e2e/engine           steer it: {"status": "ready|not_running|no_model|not_installed", "fail": ["p2b", ...], "delay_ms": 0}
  POST /api/_e2e/storage          {"writable": false}: GET /api/health reports storage_ok=false until reset (US-23 AC4)
  POST /api/_e2e/seed             {"fixture": "returning"}: a returning user with a CV, a job and three past sessions
"""
from __future__ import annotations

import datetime
import secrets
import shutil
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from . import config, content, feedback, planner, storage
from .engines import scripted

router = APIRouter(prefix="/api/_e2e")


def wipe() -> None:
    config.E2E_STORAGE_BLOCKED = False
    root = config.data_dir()
    for child in list(root.iterdir()):
        if child.is_dir():
            shutil.rmtree(child, ignore_errors=True)
        else:
            child.unlink(missing_ok=True)
    config.ensure_meta()


@router.post("/reset")
async def reset() -> dict:
    wipe()
    scripted.reset()
    return {"ok": True}


class EngineBody(BaseModel):
    status: Optional[str] = None
    fail: Optional[list[str]] = None
    delay_ms: Optional[int] = None


@router.get("/engine")
async def get_engine() -> dict:
    return scripted.snapshot()


@router.post("/engine")
async def set_engine(body: EngineBody) -> dict:
    return scripted.configure(body.status, body.fail, body.delay_ms)


class StorageBody(BaseModel):
    writable: bool = True


@router.post("/storage")
async def set_storage(body: StorageBody) -> dict:
    config.E2E_STORAGE_BLOCKED = not body.writable
    return {"ok": True, "writable": body.writable}


# ---------- seeded history ----------

CV = ("Alex Morgan, product manager at Kestrel Pay.\n"
      "Led the checkout team of six people and owned the payments roadmap.\n"
      "Redesigned onboarding and ran weekly experiments with design and engineering.\n")
JOB = ("Product Manager at Kestrel Pay\n"
       "Kestrel Pay is a payments company for small shops. You will own the checkout experience, work with "
       "engineering and design, and use data to decide what to build next. You will talk to merchants every week "
       "and write clear product briefs for the team.")

# Fictional answers. No numbers (so the scripted interviewer and content layer find a missing result), and each is
# long enough that the length of the answer is not itself a problem.
ANSWERS = [
    "I lead the checkout team and I own the roadmap for payments. Last year I rebuilt the onboarding flow with a "
    "designer and two engineers. I wrote the brief, I ran the weekly review and I decided what to cut when we were late.",
    "When two engineers disagreed about the release plan I set up a short call, I wrote down both options with the "
    "risks and I asked the team lead to decide by Friday. I am working on this team since five years and I like it.",
    "I noticed merchants dropped out at the payment step, so I interviewed several of them, I found a confusing label "
    "and I changed it with the designer. The drop-out became smaller and I kept watching it every week after that.",
]


async def build_session(title: str, vacancy: dict | None, answers: list[str], started: datetime.datetime,
                        *, seed: int) -> dict:
    """A saved interview made by the real feedback pipeline (scripted engine), so every field has its real shape."""
    llm = scripted.ScriptedEngine()
    plan = planner.plan_questions("mix", len(answers), seed=seed)
    transcript: list[dict] = [{"role": "model", "kind": "question", "question_id": plan[0].id,
                               "text": content.copy("interview_opening", name="", count=len(plan), question=plan[0].text)}]
    records: list[dict] = []
    for n, (question, answer) in enumerate(zip(plan, answers)):
        transcript.append({"role": "user", "text": answer, "question_id": question.id, "kind": "main"})
        record = {"id": "fb-" + secrets.token_hex(4), "turn_id": None, "question": question.text,
                  "question_id": question.id, "competency": question.competency, "answer_kind": "main",
                  "answer": answer, "source": "text", "created_at": started.isoformat(timespec="seconds"),
                  "layers": {}, "complete": False, "heard_as_words": []}
        record["layers"]["delivery"] = feedback.delivery_layer(answer, None, main_answer=True)
        record["layers"]["language"] = await feedback.analyze_language(llm, answer, level="B1", known=[], low=[])
        record["layers"]["content"] = await feedback.analyze_content(
            llm, question=question.text, competency=question.competency, transcript=answer, low=[])
        record["cascade"] = feedback.cascade_note(record["layers"])
        record["complete"] = True
        records.append(record)
        nxt = plan[n + 1].text if n + 1 < len(plan) else content.copy("interview_closing")
        transcript.append({"role": "model", "kind": "question" if n + 1 < len(plan) else "closing",
                           "question_id": plan[n + 1].id if n + 1 < len(plan) else "", "text": "Okay. " + nxt})
    debrief = await feedback.debrief(llm, records, layer_order="content-first")
    session = {"id": storage.new_id("s-"), "mode": "interview", "round_type": "mix", "engine": "ollama",
               "model": scripted.MODEL, "level": "B1", "strictness": 2, "input": "text",
               "vacancy_id": (vacancy or {}).get("id", ""), "vacancy_title": (vacancy or {}).get("title", ""),
               "started_at": started.isoformat(timespec="seconds"),
               "ended_at": (started + datetime.timedelta(minutes=9)).isoformat(timespec="seconds"), "duration_s": 540,
               "app_version": "e2e", "questions": [q.public() for q in plan], "title": title,
               "transcript": transcript, "feedback": records, "debrief": debrief,
               "stats": {"answers": len(answers), "turns": len(transcript)}}
    return storage.save_session(session)


class SeedBody(BaseModel):
    fixture: str = "returning"


@router.post("/seed")
async def seed(body: SeedBody) -> dict:
    """A returning user: a CV, one job and three past interviews (yesterday, a week ago, two weeks ago)."""
    storage.save_profile(CV, "pasted")
    vacancy = storage.save_record("vacancies", {"id": storage.new_id("v-"), "title": "Kestrel Pay · Product Manager",
                                                "text": JOB, "source": "pasted", "created_at": storage.now_iso(),
                                                "questions": []})
    other = storage.save_record("vacancies", {"id": storage.new_id("v-"), "title": "Northwind Logistics · Product Owner",
                                              "text": JOB.replace("Kestrel Pay", "Northwind Logistics"),
                                              "source": "pasted", "created_at": storage.now_iso(), "questions": []})
    now = datetime.datetime.now().astimezone()
    sessions = [
        await build_session("Interview practice · Kestrel Pay · Product Manager", vacancy, ANSWERS,
                            now - datetime.timedelta(days=1), seed=1),
        await build_session("Interview practice · Northwind Logistics · Product Owner", other, ANSWERS,
                            now - datetime.timedelta(days=8), seed=2),
        await build_session("Interview practice", None, ANSWERS, now - datetime.timedelta(days=15), seed=3),
    ]
    return {"ok": True, "vacancies": [vacancy["id"], other["id"]],
            "sessions": [{"id": s["id"], "title": s["title"], "weak_spots": [w["tag"] for w in s["debrief"]["weak_spots"]]}
                         for s in sessions]}
