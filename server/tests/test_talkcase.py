"""D118: prepared case, repeat detection, objection cards, the steps strip and the debrief homework."""
import copy

from fastapi.testclient import TestClient

from server import bargain as B, storage, talk, talkcase as T, ws
from server.config import load_settings
from server.main import create_app

OFFER = dict(scenario="offer", role="Designer", target=60000, job_low=50000, job_high=62000, currency="USD", has_real_offer=False)
RAISE = dict(scenario="raise", role="Designer", current_pay=60000, ask=72000, review_month=6, currency="USD", has_real_offer=False)
PREP = {"course": True, "results": ["Cut onboarding drop-off by a third", "Led the pricing page redesign that lifted trial signups"],
        "reason": "Market range", "fallbacks": ["step_up", "sign_on", "bogus"]}

# The owner's lines from the 08.11 check (s-20261108-200130), same reason again and again.
OWNER = ["I'm looking for range starting at $60,000. That's my target based on the work and experience. I both saw two similar roles.",
         "I'm looking at 60 000 dollars that's my target based on the work and experience I have done.",
         "Here's a budget concern, a little launch that the team now builds on, so I'm still asking for $60,000.",
         "oh thanks i'm thinking about it i'm still aiming for 60 000 dollars based on the work i have done and the budget we're building on",
         "okay i'm thinking about that for a second and i'm still aiming for sixty thousand dollars based on the work i have done"]


def state(form=OFFER, prep=None, style="friendly", seed=3):
    return B.new_state(dict(form, seed=seed, prep=T.parse_prep(prep) if prep else None), style)


def test_parse_prep_keeps_good_parts_and_drops_bad_ones():
    p = T.parse_prep({**PREP, "results": ["  a  ", "", 5, "b", "c", "d"], "reason": "x" * 500})
    assert p["results"] == ["a", "b", "c"] and len(p["reason"]) == 200
    assert p["fallbacks"] == ["step_up", "sign_on"] and p["course"] is True
    assert T.parse_prep("nope") is None
    opts = ws.parse_start({"mode": "negotiate", "input": "text", "negotiate": {"role": "PM", "target": 90000, "prep": PREP}}, load_settings())
    assert opts["negotiate"]["prep"]["results"][0].startswith("Cut onboarding")


def test_the_same_reason_again_is_a_repeat_and_mike_notices_it_once():
    st = state()
    replies = [B.step(st, line) for line in OWNER]
    assert st["repeats"] >= 2
    noticed = [r for r in replies if r.objection and r.objection.get("id") == "RP1"]
    assert len(noticed) == 1
    assert any(o["id"] == "RP1" for o in st["objections_used"])
    assert st["repeat_quote"]


def test_a_new_fact_is_not_a_repeat():
    st = state()
    B.step(st, OWNER[0])
    assert not T.track(st, "Fair point. Last year I cut onboarding drop-off by a third, so 60,000 still feels right.")
    assert not T.track(st, "Because I mentor two juniors and run the design reviews, I think 60,000 is fair.")


def test_repeating_does_not_buy_concessions():
    a, b = state(seed=5), state(seed=5)
    for line in OWNER:
        B.step(a, line)
    news = [OWNER[0], "Fair point. Last year I cut onboarding drop-off by a third, so I'm at 60,000.",
            "I also led the pricing page redesign that lifted trial signups by 20%, which is why I'm at 60,000.",
            "Because I mentor two juniors and run design reviews, 60,000 matches the scope.",
            "Based on three job posts for this role, the market range tops out at 62,000, so 60,000 is fair."]
    for line in news:
        B.step(b, line)
    assert (a["offer"] or 0) <= (b["offer"] or 0)


def test_objection_gets_its_own_card_and_repeats_move_to_a_trade():
    st = state()
    st["offer"] = 55000
    st["pending_obj"] = {"id": "OF6", "line": "That would put you above people already on the team."}
    ranked = B.hint_ranking(st, [])
    assert ranked[:2] == ["X2", "O1"]
    st["repeats"] = 2
    assert B.pick_hint(st, []) == "N9"


def test_x_cards_are_filled_from_the_case():
    st = state(prep=PREP)
    st["user_anchor"] = 60000
    assert "Cut onboarding drop-off by a third" in B.card_example("X3", st)
    assert "cut onboarding drop-off" in B.card_example("X2", st).lower()
    assert "60,000" in B.card_example("X4", st)
    B.step(st, "I cut onboarding drop-off by a third, so I'm looking for 60,000.")
    assert st["case_used"] == [0]
    assert "pricing page" in B.card_example("X3", st)


def test_hint_context_lists_unused_results_and_the_repeat():
    st = state(prep=PREP)
    B.step(st, "I cut onboarding drop-off by a third, so I'm looking for 60,000.")
    ctx = T.hint_context(st)
    assert "RESULTS NOT SAID YET: Led the pricing page" in ctx and "RESULTS ALREADY SAID: Cut onboarding" in ctx
    assert "a step-up after probation" in ctx
    bare = state()
    for line in OWNER[:2]:
        B.step(bare, line)
    assert "not prepared" in T.hint_context(bare) and "THEY KEEP REPEATING" in T.hint_context(bare)


def test_talk_step_only_with_the_course_and_it_moves_forward():
    assert T.talk_step(state()) is None
    st = state(prep=PREP)
    assert T.talk_step(st) == 1
    B.step(st, "I cut onboarding drop-off by a third, so I'm looking for 60,000.")
    assert T.talk_step(st) in (2, 3)
    st2 = copy.deepcopy(st)
    st2["final"] = True
    assert T.talk_step(st2) == 4
    st2["outcome"] = "accepted"
    assert T.talk_step(st2) == 5


def test_homework_names_what_to_prepare():
    st = state()
    for line in OWNER:
        B.step(st, line)
    hw = B.debrief(st)["homework"]
    ids = [h["id"] for h in hw]
    assert ids[0] == "results" and "repeated" in ids and ids[-1] == "prep_skipped" and len(hw) <= 5
    rep = next(h for h in hw if h["id"] == "repeated")
    assert rep["quote"] and "times" in rep["text"]
    d = B.debrief(st)
    assert d["repeats"]["count"] >= 3 and d["case"] is None
    r = state(RAISE, prep=PREP)
    B.step(r, "Since my last raise I cut support tickets by a third, so I'm asking for 72,000.")
    rids = [h["id"] for h in B.debrief(r)["homework"]]
    assert "raise_criteria" in rids and "prep_skipped" not in rids and "results" not in rids


def test_course_is_public_content():
    c = talk.public_content()["course"]
    assert len(c["offer"]) == 5 and len(c["raise"]) == 5
    assert all({"title", "rule", "example"} <= set(s) for s in c["offer"] + c["raise"])


def test_last_case_api_returns_the_newest_case_of_the_scenario():
    old = {"id": "s-20261101-100000-aaaaaa", "mode": "negotiate", "started_at": "2026-11-01T10:00:00", "negotiation": {"scenario": "offer", "case": {"results": ["old"]}}}
    new = {"id": "s-20261108-100000-bbbbbb", "mode": "negotiate", "started_at": "2026-11-08T10:00:00", "negotiation": {"scenario": "offer", "case": {"results": ["new"]}}}
    other = {"id": "s-20261109-100000-cccccc", "mode": "negotiate", "started_at": "2026-11-09T10:00:00", "negotiation": {"scenario": "raise", "case": {"results": ["r"]}}}
    for rec in (old, new, other):
        storage.save_record("sessions", rec)
    with TestClient(create_app()) as c:
        assert c.get("/api/talk/last-case?scenario=offer").json()["case"]["results"] == ["new"]
        assert c.get("/api/talk/last-case?scenario=screening").json() == {"case": None}
        assert c.get("/api/talk/last-case?scenario=nope").status_code == 422
