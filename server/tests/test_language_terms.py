"""D106: a known term only protects itself. The language check drops a correction when it would rewrite a product or
tool name, not when the quote merely contains a capitalised or common word. The model hears only the terms this
answer uses."""
from __future__ import annotations

from server import documents, feedback

CV = """Senior Product Designer, Native Design Lead at Kestrel Pay
Designed and built dashboards in Figma and Storybook with TypeScript, PostgreSQL and Node.js.
Led a team of 5 in the US. Built the iOS app with React Native and AWS.
Created a native design language; product design is my focus. Education: Master of Design.
EXPERIENCE
SKILLS: B2B SaaS, UX, GA4
"""


def test_known_terms_keep_names_and_drop_ordinary_words():
    terms = documents.known_terms(CV)
    assert {"Figma", "Storybook", "TypeScript", "PostgreSQL", "Node.js", "iOS", "AWS", "UX", "GA4", "B2B",
            "SaaS", "Kestrel"} <= set(terms)
    for ordinary in ("Senior", "Product", "Designer", "Native", "Design", "Lead", "Designed", "Built", "Led",
                     "Created", "Education", "Master", "EXPERIENCE", "SKILLS", "Node"):
        assert ordinary not in terms, ordinary


def test_known_terms_limit_and_empty():
    assert documents.known_terms("", None) == []
    many = " ".join(f"Tool{chr(97 + i % 26)}{chr(97 + i // 26)}Pro" for i in range(100))
    assert len(documents.known_terms(many, limit=10)) == 10


def test_terms_in_is_whole_word_and_case_sensitive():
    known = ["US", "Figma", "Node.js", "Kubernetes"]
    assert documents.terms_in("They told us about Figma and Node.js.", known) == ["Figma", "Node.js"]
    assert documents.terms_in("We work in the US now", known) == ["US"]
    assert documents.terms_in("figma and Figmatic", known) == []


def item(original, better, **extra):
    return {"original": original, "better": [better], "reason": "Past tense.", "level": "B1", "class": "N", **extra}


def validated(items, transcript, known):
    return feedback.validate_language_items(items, transcript, known, set())


def test_a_correction_with_a_capitalised_common_word_is_kept():
    said = "Design is what I did, and we has redesigned the Native flow."
    out = validated([item("we has redesigned the Native flow", "we redesigned the native flow")],
                    said, ["Native", "Design"])
    assert out == []                                      # "Native" is gone from the better version: a rewrite
    said = "I am sure that Design help us, we has redesigned the Native flow."
    out = validated([item("we has redesigned the Native flow", "we redesigned the Native flow")], said,
                    ["Native", "Design"])
    assert len(out) == 1 and out[0]["better"] == ["we redesigned the Native flow"]


def test_a_correction_that_rewrites_a_real_term_is_dropped():
    said = "We run Kubernetes on three server, and it work fine."
    assert validated([item("We run Kubernetes", "We run a kubernetes cluster")], said, ["Kubernetes"]) == []
    kept = validated([item("three server", "three servers"), item("We run Kubernetes", "We ran Kubernetes")],
                     said, ["Kubernetes"])
    assert [f["original"] for f in kept] == ["three server", "We run Kubernetes"]
    assert kept[1]["better"] == ["We ran Kubernetes"]            # the term stays: only the verb changed


def test_us_no_longer_blocks_us():
    said = "He give us a long task and we finish it in the US office."
    out = validated([item("He give us a long task", "He gave us a long task")], said, ["US", "UK"])
    assert [f["original"] for f in out] == ["He give us a long task"]
    assert validated([item("in the US office", "in the United States office")], said, ["US"]) == []


def test_ignored_fragments_still_win():
    said = "He give us a long task."
    out = feedback.validate_language_items([item("He give us a long task", "He gave us a long task")], said, [],
                                           set(), ignored=["he give us a long task"])
    assert out == []


async def test_the_prompt_lists_only_the_terms_in_the_answer(fake_llm):
    llm = fake_llm({"p5b": {"corrections": [], "phrase_to_keep": None}, "p2b": {"items": []}})
    said = "We use Figma and the US team has a problem."
    known = ["Figma", "Storybook", "US", "Kubernetes"]
    await feedback.analyze_language(llm, said, level="B2", known=known, low=[], english_track=True)
    await feedback.analyze_language(llm, said, level="B2", known=known, low=[])
    for call in llm.calls:
        assert "KNOWN_TERMS: Figma, US\n" in call["messages"][1]["content"]
    await feedback.analyze_language(llm, "I have no names here.", level="B2", known=known, low=[], english_track=True)
    assert "KNOWN_TERMS: none\n" in llm.calls[-1]["messages"][1]["content"]


async def test_the_layer_says_which_model_checked_it(fake_llm):
    llm = fake_llm({"p5b": {"corrections": [], "phrase_to_keep": None}})
    layer = await feedback.analyze_language(llm, "Hello there.", level="B2", known=[], low=[], english_track=True)
    assert layer["model"] == "fake-model"
