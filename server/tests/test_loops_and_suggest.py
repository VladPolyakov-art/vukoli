"""13b user test: Whisper loops on silence, and sample answers for imperative questions."""
from server.stt import drop_loops
from server.ws import asks_for_answer


def test_a_transcript_that_is_only_a_loop_is_no_speech():
    assert drop_loops("I have a look. " * 40) == ""
    assert drop_loops("Oh Oh Oh Oh") == ""
    assert drop_loops("Thank you. Thank you. Thank you.") == ""


def test_a_loop_inside_a_real_answer_collapses_to_one_copy():
    said = ("I led the checkout redesign and cut drop-off by twelve percent. "
            "I have a look. I have a look. I have a look.")
    assert drop_loops(said) == "I led the checkout redesign and cut drop-off by twelve percent. I have a look."


def test_normal_speech_and_short_repeats_stay():
    for said in ["I worked there for five years and we shipped on time.", "It was very very hard.",
                 "No, no, no.", "We tested, tested again and then shipped."]:
        assert drop_loops(said) == said


def test_sample_answer_follows_every_question_including_imperatives():
    assert asks_for_answer("question", "Okay. Give an example of when your work changed a measurable outcome.")
    assert asks_for_answer("follow_up", "Walk me through the numbers.")
    assert asks_for_answer(None, "What happened next?")
    assert not asks_for_answer(None, "Thanks, that's helpful.")
    assert not asks_for_answer("wait", "Take your time. Would you like me to repeat the question?")
