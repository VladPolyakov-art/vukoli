"""13, F-13-6 and F-13-16: the verdict's "thing to fix" sentence. "The one thing" only with exactly one weak spot;
the advice text goes after the colon in lower case with no second colon."""
from __future__ import annotations

from server import feedback


def spot(layer: str, tag: str, text: str) -> dict:
    return {"layer": layer, "tag": tag, "text": text, "evidence": ["q1"]}


NO_RESULT = spot("content", "no_result", feedback.CONTENT_FIX["no_result"])
PREP = spot("language", "preposition", "Work on preposition.")
PACE = spot("delivery", "filler_high", feedback.DELIVERY_TIP["filler_high"])


def test_one_weak_spot_is_the_one_thing_to_fix():
    assert feedback.main_fix_sentence([PREP]) == "The one thing to fix: work on preposition."


def test_two_or_more_weak_spots_are_the_main_thing_to_fix():
    assert feedback.main_fix_sentence([NO_RESULT, PREP]).startswith("The main thing to fix: ")
    assert feedback.main_fix_sentence([NO_RESULT, PREP, PACE]).startswith("The main thing to fix: ")


def test_no_weak_spot_says_nothing_repeated_stood_out():
    assert feedback.main_fix_sentence([]) == "No repeated problem stood out."


def test_the_advice_has_no_second_colon_and_no_capital_after_the_colon():
    line = feedback.main_fix_sentence([NO_RESULT, PREP])
    assert line == "The main thing to fix: finish with what happened, one result, ideally a number."
    assert line.count(":") == 1


def test_advice_inline_keeps_i_and_acronyms_capitalised():
    assert feedback.advice_inline("Switch 'we' to 'I' for the steps you did.") == "switch 'we' to 'I' for the steps you did"
    assert feedback.advice_inline("I need a result.") == "I need a result"
    assert feedback.advice_inline("STAR needs a result: add one.") == "STAR needs a result, add one"
    assert feedback.advice_inline("") == ""


def test_the_template_debrief_follows_the_count_of_weak_spots():
    def record(rid: str, content: str = "", delivery: str = "") -> dict:
        layers: dict = {"language": {"items": []}}
        if content:
            layers["content"] = {"severity": 3, "tag": content}
        if delivery:
            layers["delivery"] = {"severity": 3, "tag": delivery}
        return {"id": rid, "layers": layers}

    one = feedback.fallback_debrief([record("a", "no_result"), record("b", "no_result"), record("c")], "content-first")
    assert len(one["weak_spots"]) == 1
    assert "The one thing to fix: finish with what happened, one result, ideally a number." in one["verdict"]
    two = feedback.fallback_debrief([record("a", "no_result", "filler_high"), record("b", "no_result"), record("c")], "content-first")
    assert len(two["weak_spots"]) == 2
    assert "The main thing to fix: " in two["verdict"] and "The one thing" not in two["verdict"]


def test_a_rewritten_sentence_after_a_recheck_reads_naturally():
    """The recheck replaces the sentence that named a gone spot with the refreshed advice (QA-07 + F-13-16)."""
    gone = spot("language", "preposition", "Work on preposition.")
    out = feedback.follow_weak_spots("Your answers were clear. The main thing to fix: preposition.", [gone],
                                     feedback.main_fix_sentence([NO_RESULT, PACE]))
    assert out == ("Your answers were clear. The main thing to fix: finish with what happened, "
                   "one result, ideally a number.")
    assert out.count(":") == 1
