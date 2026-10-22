"""Feedback rules: the model extracts, code decides; quotes must be real; misheard words are not counted."""
from __future__ import annotations

from server import feedback
from server.stt import Transcript, Word

ANSWER = "Last year we has redesigned the onboarding in Figma and I led the research with 12 users."


async def test_language_rejects_invented_quotes_and_known_terms(fake_llm):
    llm = fake_llm({"p2b": {"items": [
        {"original": "I has done", "better": ["I have done"], "reason": "tense", "level": "B1", "class": "N"},
        {"original": "we has redesigned", "better": ["we redesigned"], "reason": "Past tense here.", "level": "B1",
         "class": "N"},
        {"original": "in Figma", "better": ["with Figma"], "reason": "preposition", "level": "B1", "class": "C"},
        {"original": "with 12 users", "better": ["with 15 users"], "reason": "word", "level": "B1", "class": "C"},
        {"original": "the research", "better": ["the research"], "reason": "same", "level": "B1", "class": "C"},
    ]}})
    layer = await feedback.analyze_language(llm, ANSWER, level="B1", known=["Figma"], low=[])
    originals = [f["original"] for f in layer["items"]]
    assert originals == ["we has redesigned"]          # invented, known-term, number-changing, no-op dropped
    assert layer["status"] == "fix" and layer["items"][0]["tag"] == "tense"
    assert layer["items"][0]["status"] == "active" and layer["severity"] == 2


async def test_possibly_misheard_flag_is_unconfirmed_and_not_counted(fake_llm):
    llm = fake_llm({"p2b": {"items": [
        {"original": "we has redesigned", "better": ["we redesigned"], "reason": "Past tense.", "level": "B1",
         "class": "N"}]}})
    low = [Word("has", 1.0, 1.2, 0.31)]
    layer = await feedback.analyze_language(llm, ANSWER, level="B1", known=[], low=low)
    flag = layer["items"][0]
    assert flag["possibly_misheard"] and flag["status"] == "unconfirmed"
    assert layer["status"] == "ok" and layer["possibly_misheard"] == 1
    prompt = llm.calls[0]["messages"][1]["content"]
    assert "[?has?]" in prompt
    record = {"layers": {"language": layer}}
    assert feedback.counted_tags(record) == []
    feedback.apply_flag_action(record, flag["id"], "confirm")
    assert record["layers"]["language"]["status"] == "fix"
    assert feedback.counted_tags(record) == [("language", "tense", 2)]
    feedback.apply_flag_action(record, flag["id"], "dismiss")
    assert feedback.counted_tags(record) == []


async def test_english_track_corrections(fake_llm):
    llm = fake_llm({"p5b": {"corrections": [{"original": "we has redesigned", "better": "we redesigned",
                                             "reason": "Past simple.", "level": "B1", "class": "N"}],
                            "phrase_to_keep": {"phrase": "I led the research", "why": "clear"}}})
    layer = await feedback.analyze_language(llm, ANSWER, level="B1", known=[], low=[], english_track=True)
    assert layer["items"][0]["better"] == ["we redesigned"] and layer["phrase_to_keep"]["phrase"]


def test_content_mapping_in_code():
    base = {"situation": True, "task": True, "action": True, "result": True, "voice": "i", "result_type": "number",
            "relevant": True, "reflection": False, "evidence": "", "praise": "I led the research with 12 users"}
    ok = feedback.content_from_model(base, question="Tell me about a project.", competency="B", transcript=ANSWER,
                                     n_i=1, n_we=1)
    assert ok["status"] == "ok" and ok["praise"] and ok["fix"].startswith("Nothing to fix here.")
    we = feedback.content_from_model({**base, "voice": "we"}, question="q", competency="B", transcript=ANSWER,
                                     n_i=0, n_we=2)
    assert we["tag"] == "we_not_i" and we["severity"] == 3
    no_result = feedback.content_from_model({**base, "result": False, "result_type": "none",
                                             "evidence": "made up text"}, question="q", competency="B",
                                            transcript=ANSWER, n_i=1, n_we=0)
    assert no_result["tag"] == "no_result" and no_result["evidence"] == ""   # invented evidence dropped
    hypothetical = feedback.content_from_model({**base, "action": False, "result": False, "result_type": "none"},
                                               question="What would you do?", competency="H", transcript=ANSWER,
                                               n_i=0, n_we=0)
    assert hypothetical["status"] == "ok"


def test_hints():
    h = feedback.hints("I led the work and we shipped it. It grew 20 percent.")
    assert h["n_i"] >= 1 and h["n_we"] >= 1 and h["has_number"] == "true" and h["n_words"] == 12


def test_delivery_metrics_voice_and_text():
    words = [Word(w, i * 0.5, i * 0.5 + 0.3, 0.9) for i, w in enumerate(("um so I " * 30).split())]
    text = " ".join(w.w for w in words)
    layer = feedback.delivery_layer(text, Transcript(text=text, words=words))
    assert layer["metrics"]["mode"] == "voice" and layer["metrics"]["wpm"] > 0
    assert layer["metrics"]["fillers_per_100w"] > 4 and layer["status"] == "fix"
    text_layer = feedback.delivery_layer("Short typed answer here.", None)
    assert text_layer["metrics"]["mode"] == "text" and "pace" in text_layer["metrics"]["not_available"]


def test_json_field_streamer_reads_action_then_say():
    s = feedback.JsonFieldStreamer()
    raw = '{"gap": "result", "action": "follow_up", "say": "What was the result\\u003f Tell me \\"more\\"."}'
    out = "".join(s.feed(raw[i:i + 5]) for i in range(0, len(raw), 5))
    assert s.action == "follow_up" and s.say_done
    assert out == 'What was the result? Tell me "more".'


def test_praise_sanitizing_and_trim():
    assert feedback.sanitize_sentence("Great answer!", first=True) == "Okay."
    assert feedback.sanitize_sentence("Great answer!", first=False) == ""
    assert "great" not in feedback.sanitize_sentence("Great, and what was your part?", first=True).lower()
    long = "word " * 40 + "and what did you do?"
    assert feedback.trim_words(long) .endswith("?")


async def test_stronger_version_rejects_invented_numbers(fake_llm):
    import pytest
    from server.engines.base import EngineError
    llm = fake_llm({"p2c": {"rewrite": "I led research with 40 users.", "placeholders": []}})
    with pytest.raises(EngineError):
        await feedback.stronger_version(llm, question="q", missing=["no_result"], transcript=ANSWER)
    llm = fake_llm({"p2c": {"rewrite": "I led the research with 12 users and [result].", "placeholders": ["[result]"]}})
    data = await feedback.stronger_version(llm, question="q", missing=["no_result"], transcript=ANSWER)
    assert data["placeholders"] == ["[result]"]


async def test_debrief_short_session_and_fallback(fake_llm):
    rec = {"competency": "B", "layers": {"content": {"severity": 3, "tag": "no_result"}, "language": {"items": []}}}
    short = await feedback.debrief(None, [rec], layer_order="content-first")
    assert short["too_short"]
    llm = fake_llm({"p3": {"verdict": "Great job overall.", "weak_spots": [
        {"layer": "content", "tag": "no_result", "text": "Finish with a result.", "evidence": ["q1"]},
        {"layer": "delivery", "tag": "invented_tag", "text": "x", "evidence": []}], "strength": "", "next_step": "x"}})
    result = await feedback.debrief(llm, [rec, rec, rec], layer_order="content-first", past="none")
    assert [s["tag"] for s in result["weak_spots"]] == ["no_result"]
    assert "great" not in result["verdict"].lower()


def test_delivery_is_mode_aware_and_only_about_length():
    """A 41-word typed answer is fine; a short one gets a length tip, never content advice."""
    typed = " ".join(["word"] * 41)
    assert feedback.delivery_layer(typed, None)["status"] == "ok"
    short = feedback.delivery_layer(" ".join(["word"] * 15), None)
    assert short["tag"] == "too_short" and short["severity"] == 2
    assert "words" in short["fix"] and not any(w in short["fix"].lower() for w in ("did", "step", "result", "action"))
    assert feedback.delivery_layer("I I I I did it it it, then then then we shipped.", None)["tag"] != "restarts"
    words = [Word(w, i * 0.4, i * 0.4 + 0.3, 0.9) for i, w in enumerate(("I led the work " * 10).split())]
    spoken = feedback.delivery_layer(" ".join(w.w for w in words), Transcript(text="x", words=words))
    assert spoken["tag"] == "too_short" and "minutes" in spoken["fix"]                 # 16 s spoken
    for tip in feedback.DELIVERY_TIP.values():
        assert not any(w in tip.lower() for w in ("step by step", "what happened", "the result"))
