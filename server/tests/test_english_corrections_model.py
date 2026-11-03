"""D106: English practice on Ollama checks the language on a larger installed model of the recommended family, after
the call, when the machine can hold both. The conversation stays on the session model. The layer says which model
checked it."""
from __future__ import annotations

import json

import httpx

from server import engines, postcall
from server.engines import ollama
from server.engines.base import EngineError

SAID = "I am agree with you, we has redesigned the flow last year."
CORRECTION = {"corrections": [{"original": "I am agree", "better": "I agree", "reason": "No 'am' with agree.",
                               "level": "B1", "class": "N"}], "phrase_to_keep": None}


def tag(name, params, gb):
    return {"name": name, "size": int(gb * 1024 ** 3), "details": {"parameter_size": params, "family": "qwen3"}}


FULL = [tag("qwen3:4b-instruct", "4.0B", 2.5), tag("qwen3:4b", "4.0B", 2.5), tag("qwen3:8b", "8.2B", 5.2)]


def transport(models, used: list[str], *, reply=CORRECTION, tags_fail=False):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            if tags_fail:
                raise httpx.ConnectError("refused", request=request)
            return httpx.Response(200, json={"models": models})
        body = json.loads(request.content)
        used.append(body["model"])
        assert body["think"] is False
        return httpx.Response(200, text=json.dumps({"message": {"content": json.dumps(reply)}}))
    return httpx.MockTransport(handler)


def engine(models, used, *, model="qwen3:4b-instruct", ram=16, **kw):
    return ollama.OllamaEngine("http://x", model, transport=transport(models, used, **kw), ram_gb=ram)


async def test_a_bigger_installed_model_of_the_family_is_chosen():
    checker = await engine(FULL, []).bigger_sibling()
    assert checker is not None and checker.requested_model == "qwen3:8b"
    assert (await engines.language_checker(engine(FULL, []))).requested_model == "qwen3:8b"


async def test_not_chosen_when_ram_is_too_small_or_nothing_is_bigger():
    assert await engine(FULL, [], ram=8).bigger_sibling() is None                  # below the 8b line of the app
    assert await engine(FULL, [], ram=15).bigger_sibling() is None
    assert await engine(FULL[:2], []).bigger_sibling() is None                     # 8b not installed
    assert await engine(FULL, [], model="qwen3:8b").bigger_sibling() is None       # already the largest
    assert await engine([tag("qwen3:4b-instruct", "4.0B", 2.5), tag("qwen3:14b", "14.8B", 9.3)],
                        []).bigger_sibling() is None                               # both together would not fit in 16 GB


async def test_reasoning_only_and_other_family_models_are_not_chosen():
    other = [tag("qwen3:4b-instruct", "4.0B", 2.5), tag("llama3.1:8b", "8.0B", 4.9),
             tag("qwen3:8b-thinking", "8.2B", 5.2), tag("deepseek-r1:8b", "8.0B", 5.0)]
    assert await engine(other, []).bigger_sibling() is None


async def test_the_best_of_several_is_chosen():
    models = [*FULL, tag("qwen3:6b", "6.0B", 3.9)]
    assert (await engine(models, []).bigger_sibling()).requested_model == "qwen3:8b"


async def test_other_engines_and_a_silent_ollama_keep_the_session_model(fake_llm):
    assert await engines.language_checker(fake_llm()) is None
    assert await engines.language_checker(None) is None
    assert await engines.language_checker(engine(FULL, [], tags_fail=True)) is None


def context(llm, *, mode="english"):
    async def run(make):
        return await make()

    async def save(done):
        return True
    return postcall.Context(llm=llm, stt=None, run=run, emit=lambda *a, **k: None, settings={}, mode=mode,
                            level="B2", engine="ollama", known_terms=[], save=save)


def record(n=1):
    return {"id": f"fb-{n}", "turn_id": n, "question": "", "question_id": "", "competency": "", "answer_kind": "main",
            "answer": SAID, "source": "text", "complete": False, "layers": {}, "history_index": n}


async def test_after_the_call_the_corrections_come_from_the_larger_model_and_say_so():
    used: list[str] = []
    items = [(record(1), None), (record(2), None)]
    assert await postcall.run_answers(items, context(engine(FULL, used))) is True
    assert used == ["qwen3:8b", "qwen3:8b"]
    for rec, _ in items:
        language = rec["layers"]["language"]
        assert language["model"] == "qwen3:8b" and language["items"][0]["better"] == ["I agree"]


async def test_the_session_model_checks_when_the_machine_is_small():
    used: list[str] = []
    items = [(record(), None)]
    await postcall.run_answers(items, context(engine(FULL, used, ram=8)))
    assert used == ["qwen3:4b-instruct"]
    assert items[0][0]["layers"]["language"]["model"] == "qwen3:4b-instruct"


async def test_interview_mode_is_unchanged():
    used: list[str] = []
    interview_reply = {"items": [{"original": "I am agree", "better": ["I agree"], "reason": "x", "level": "B1",
                                  "class": "N"}]}
    items = [(record(), None)]
    ctx = context(engine(FULL, used, reply=interview_reply), mode="interview")
    await postcall.run_answers(items, ctx)
    assert ctx.language_llm is None and used[0] == "qwen3:4b-instruct"
    assert items[0][0]["layers"]["language"]["model"] == "qwen3:4b-instruct"


async def test_a_session_model_that_is_not_ollama_is_untouched(fake_llm):
    llm = fake_llm({"p5b": CORRECTION})
    items = [(record(), None)]
    ctx = context(llm)
    await postcall.run_answers(items, ctx)
    assert ctx.language_llm is None and items[0][0]["layers"]["language"]["model"] == "fake-model"


async def test_a_failing_lookup_does_not_stop_the_feedback(fake_llm, monkeypatch):
    async def broken(llm):
        raise EngineError("engine_error", "boom")
    monkeypatch.setattr(engines, "language_checker", broken)
    llm = fake_llm({"p5b": CORRECTION})
    items = [(record(), None)]
    assert await postcall.run_answers(items, context(llm)) is True
    assert items[0][0]["layers"]["language"]["model"] == "fake-model"


def test_the_timeout_for_one_check_is_longer_than_a_cold_load_of_the_larger_model():
    assert postcall.LLM_TIMEOUT_S >= 120 and postcall.POST_CALL_PER_ANSWER_S >= 2 * 60
