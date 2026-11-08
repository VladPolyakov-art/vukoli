"""Tough talk: tough questions in code (theme picking, the scripted push logic, after-call merge, debrief)."""
from __future__ import annotations

import random

import pytest

from server import talk, tough


@pytest.mark.parametrize("theme", ["money", "leaving", "weakness", "fit", "english", "personal", "mix"])
def test_every_theme_gives_five_distinct_questions(theme):
    for seed in range(20):
        ids = tough.pick_questions(theme, random.Random(seed))
        assert len(ids) == tough.TOTAL == len(set(ids))
        assert not talk.question(ids[0])["personal"]               # never opens with a personal question


def test_personal_is_never_in_mix_or_other_themes():
    for seed in range(60):
        for theme in ("mix", "money", "leaving", "weakness", "fit", "english"):
            assert not any(talk.question(i)["personal"] for i in tough.pick_questions(theme, random.Random(seed)))


def test_mix_spans_themes_and_theme_stays_in_theme():
    ids = tough.pick_questions("mix", random.Random(3))
    assert len({talk.question(i)["theme"] for i in ids}) == 5
    own = [talk.question(i)["theme"] for i in tough.pick_questions("fit", random.Random(4))]
    assert set(own) == {"fit"}


def test_content_has_the_promised_size():
    qs = talk.questions()
    assert len(qs) == 25 and {q["theme"] for q in qs} == {"money", "leaving", "weakness", "fit", "english", "personal"}
    assert all(q["card"] and q["shape"] and q["checking"] and q["trap"] for q in qs)


def ids_for(theme="leaving"):
    return tough.pick_questions(theme, random.Random(7))


def test_follow_up_then_at_most_one_pressure_then_next_question():
    st = tough.new_state("leaving", ids_for())
    q0 = tough.current(st)
    kinds = []
    for text in ["I left because my manager was impossible and I was bored", "It was a long story " + "word " * 130,
                 "ok", "fine", "done"]:
        kinds.append(tough.step(st, text)["kind"])
        if st["index"] > 0:
            break
    assert kinds.count("pressure") <= 1
    assert st["index"] == 1 and q0["id"] != tough.current(st)["id"]


def test_pressure_choice_is_by_signal():
    st = tough.new_state("fit", [i for i in tough.pick_questions("fit", random.Random(1))])
    q = tough.current(st)
    first = tough.step(st, "word " * 130)
    if first["kind"] == "follow_up":
        first = tough.step(st, "word " * 130)
    assert first["kind"] == "pressure" and first["line"] == talk.data()["tough_lines"]["pressure"]["long"]
    st2 = tough.new_state("fit", tough.pick_questions("fit", random.Random(1)))
    r = tough.step(st2, "Sorry, I am so sorry, I apologise, sorry about that")
    if r["kind"] == "follow_up":
        r = tough.step(st2, "Sorry, I am so sorry, I apologise, sorry about that")
    assert r["kind"] == "pressure" and r["line"] == talk.data()["tough_lines"]["pressure"]["apology"]


def test_personal_questions_get_a_neutral_move_on_and_no_pressing():
    st = tough.new_state("personal", ["I1", "I2", "I4", "I7", "M4"])
    r = tough.step(st, "Sorry, I plan to have kids soon, my husband and I talked about it. " + "word " * 130)
    assert r["kind"] == "move_on" and r["advance"] and st["index"] == 1
    assert talk.data()["tough_lines"]["move_on"] in r["line"]
    assert st["log"][0]["pushes"] == []


def test_repeat_request_repeats_without_advancing():
    st = tough.new_state("money", tough.pick_questions("money", random.Random(5)))
    r = tough.step(st, "Can you repeat that?")
    assert r["kind"] == "repeat" and st["index"] == 0 and tough.current(st)["text"] in r["line"]


def test_session_closes_after_five_questions_and_closing_is_stable():
    st = tough.new_state("money", tough.pick_questions("money", random.Random(5)))
    for _ in range(40):
        r = tough.step(st, "I would aim for the market rate for this role and I am flexible on the package overall.")
        if st["closed"]:
            break
    assert st["closed"] and r["kind"] == "closing"
    assert tough.step(st, "hello?")["kind"] == "closing"


def test_hint_picker():
    st = tough.new_state("personal", ["I1", "I2", "I4", "I7", "M4"])
    assert tough.pick_hint(st)["card_id"] == "T1"
    st = tough.new_state("fit", tough.pick_questions("fit", random.Random(1)))
    assert tough.pick_hint(st)["card_id"] == talk.question(st["ids"][0])["card"]
    st["stage"] = "pressed"
    assert tough.pick_hint(st)["card_id"] == "T2"


# ---------- after-call merge: a flag survives only with a verbatim quote ----------

def test_merge_check_drops_flags_whose_quote_is_not_in_the_answer():
    answer = "My boss never listened to anyone, so I left after a year."
    model = {"blames_others": {"value": True, "evidence_quote": "My boss never listened to anyone"},
             "shares_personal_info": {"value": True, "evidence_quote": "my husband is sick"},
             "argues_instead": {"value": False, "evidence_quote": ""}, "redirects_to_work": {"value": True, "evidence_quote": ""},
             "rambling": {"value": False, "evidence_quote": ""}, "no_example": {"value": False, "evidence_quote": ""},
             "calmer_answer": "I wanted more room to grow."}
    out = tough.merge_check(answer, model)
    assert set(out["signals"]) == {"blames_others"} and out["model_ok"]
    assert out["signals"]["blames_others"]["quote"] in answer
    assert out["calmer_answer"] == "I wanted more room to grow."
    assert tough.merge_check(answer, None)["signals"] == {} and not tough.merge_check(answer, None)["model_ok"]


def test_debrief_rows_counts_and_verdict():
    st = tough.new_state("leaving", ["L1", "L2", "L3", "L6", "W1"])
    st["log"][0]["answers"] = [{"role": "answer", "text": "My boss never listened to anyone, so I left."}]
    st["log"].append({"id": "L2", "answers": [{"role": "answer", "text": "I wanted a bigger challenge and shipped a launch."}],
                      "pushes": [], "skipped": False})
    st["log"].append({"id": "L3", "answers": [{"role": "answer", "text": "We had a gap while I studied design, and it led to a shipped portfolio."}],
                      "pushes": [], "skipped": False})
    st["checks"]["L1"] = tough.merge_check(st["log"][0]["answers"][0]["text"], {
        **{k: {"value": False, "evidence_quote": ""} for k in tough.CHECK_KEYS},
        "blames_others": {"value": True, "evidence_quote": "My boss never listened to anyone"}, "calmer_answer": ""})
    d = tough.debrief(st)
    assert d["kind"] == "tough" and d["summary"]["answered"] == 3 and d["summary"]["show_counts"]
    assert d["summary"]["calm"] == 2 and d["summary"]["hurt_most"]["signal"] == "blames_others"
    assert d["summary"]["hurt_most"]["quote"] in st["log"][0]["answers"][0]["text"]
    assert d["verdict"].startswith("Handled calmly 2 of 3.") and "question 1" in d["verdict"]
    assert d["questions"][0]["signals"][0]["may_be_wrong"] is True


def test_debrief_hides_counts_for_one_or_two_answers_and_personal_rows():
    st = tough.new_state("personal", ["I1", "I2", "I4", "I7", "M4"])
    tough.step(st, "I plan to have kids soon, and my husband agrees")
    d = tough.debrief(st)
    assert d["summary"]["show_counts"] is False and "of" not in d["verdict"].split(".")[0].split("Handled")[-1][:3]
    row = d["questions"][0]
    assert row["personal"] and row["lawful_note"] and "T1" in row["card_ids"]
    assert not any(s["id"] in ("rambling", "no_example", "over_apology") for s in row["signals"])


def test_blaming_outranks_personal_info_for_hurt_most():
    st = tough.new_state("leaving", ["L1", "L2", "L3", "L6", "W1"])
    a1 = "I took six months off to care for my father."
    a2 = "My manager was terrible and the company was a mess."
    st["log"][0]["answers"] = [{"role": "answer", "text": a1}]
    st["log"].append({"id": "L2", "answers": [{"role": "answer", "text": a2}], "pushes": [], "skipped": False})
    off = {k: {"value": False, "evidence_quote": ""} for k in tough.CHECK_KEYS}
    st["checks"]["L1"] = tough.merge_check(a1, {**off, "shares_personal_info": {"value": True, "evidence_quote": "care for my father"}, "calmer_answer": ""})
    st["checks"]["L2"] = tough.merge_check(a2, {**off, "blames_others": {"value": True, "evidence_quote": "My manager was terrible"}, "calmer_answer": ""})
    hm = tough.debrief(st)["summary"]["hurt_most"]
    assert hm["signal"] == "blames_others" and hm["question_no"] == 2
