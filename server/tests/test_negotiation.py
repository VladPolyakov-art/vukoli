"""Tough talk: the negotiation engine in code (amount parser, classifier, styles, levers, step-up, guard, scoring, hints)."""
from __future__ import annotations

import copy

import pytest

from server import negotiation as n
from server import talk

FORM = {"role": "Designer", "job_low": 80000, "job_high": 100000, "target": 98000, "currency": "USD",
        "has_real_offer": False}


def vals(text):
    return [a.value for a in n.parse_amounts(text)]


def state(style="friendly", **over):
    return n.new_state({**FORM, **over}, style)


def run(st, *lines):
    return [n.step(st, t) for t in lines]


# ---------- amounts ----------

@pytest.mark.parametrize("text,expected", [
    ("95k", [95000]), ("95,000", [95000]), ("95.000", [95000]), ("95 000", [95000]),
    ("ninety-five thousand", [95000]), ("$95k", [95000]), ("€ 95,000", [95000]), ("95,000 EUR", [95000]),
    ("one hundred and five thousand", [105000]), ("a hundred thousand", [100000]), ("95.5k", [95500]),
    ("95 to 100k", [95000, 100000]), ("3 months", []), ("5 years", []), ("10%", []), ("20 days off", []),
    ("2 days off and 98k", [98000]), ("90 hours a week", [])])
def test_amount_parser(text, expected):
    assert vals(text) == expected


def test_parser_ignores_months_and_days_next_to_money():
    assert vals("I want 98k after 6 months and 5 days off") == [98000]


# ---------- classifier ----------

def cls(text, st=None):
    st = st or state()
    st["offer"] = st["offer"] or st["opening"]
    return n.classify(text, st)


def test_classifier_kinds():
    assert cls("I accept").kind == "accept"
    assert cls("That works for me").kind == "accept"
    assert cls("I'd like 98,000").kind == "counter" and cls("I'd like 98,000").amount == 98000
    assert cls("Can I have a sign-on bonus?").kind == "lever_ask"
    assert cls("I need a few days to think it over").kind == "ask_time"
    assert cls("Please send it in writing").kind == "ask_written"
    assert cls("No thanks, I decline").kind == "decline"
    assert cls("Let me think about that for a second").kind == "pause"
    assert cls("What is the range for this role?").kind == "ask_range"
    assert cls("I'm not sure I can accept that").kind != "accept"
    assert cls("Sounds good but I want 99k").kind == "counter"


def test_classifier_justification_and_new_reason():
    st = state()
    c = cls("I want 98,000 because I have six years of experience", st)
    assert c.justified and c.kind == "counter"
    assert not cls("I want 98,000", st).justified
    st["asks"].append({"reason_words": c.reasons})
    assert not n.classify("I want 98,000 because of my experience", {**st, "offer": 91000}).new_reason


def test_competing_offer_counts_only_with_the_flag():
    plain = cls("I have another offer, so I'd like 98k", state())
    assert plain.bluff and "competing_offer" not in plain.reasons
    real = cls("I have another offer, so I'd like 98k", state(has_real_offer=True))
    assert "competing_offer" in real.reasons and not real.bluff


def test_step_up_detection_and_flags():
    c = cls("Could we do 90k now and 98k after the 3 month probation?")
    assert c.kind == "step_up" and c.now == 90000 and c.later == 98000 and c.months == 3
    c2 = cls("90k now, 98k at the six month review, and please put it in the offer letter, I will show shipped results")
    assert c2.kind == "step_up" and c2.months == 6 and c2.writing and c2.criteria
    assert cls("98k after probation").now == 91000     # now = the current offer when only one number is said


# ---------- state building ----------

def test_opening_and_step_size():
    assert n.new_state(FORM, "friendly")["opening"] == 91000          # 80000 + .55 * 20000 = 91000
    assert n.new_state(FORM, "firm")["opening"] == 87000
    assert n.new_state(FORM, "tight")["opening"] == 82000
    small = n.new_state({**FORM, "job_low": 1000, "job_high": 2000, "target": 1800}, "friendly")
    assert small["step"] == 50 and small["opening"] % 50 == 0


def test_range_missing_builds_from_target():
    st = n.new_state({"role": "x", "target": 100000, "currency": "USD", "has_real_offer": False,
                      "job_low": None, "job_high": None}, "friendly")
    assert st["ceiling"] == 100000 and st["floor"] == 85000


# ---------- expectations phase ----------

def test_no_number_gets_pressed_once_then_offer_comes():
    st = state("firm")
    r1 = n.step(st, "I'd rather hear your range first")
    assert r1.move == "press_number" and st["offer"] is None
    r2 = n.step(st, "Still not sure")
    assert r2.move == "state_offer" and st["offer"] == st["opening"]


def test_friendly_states_offer_at_once():
    st = state("friendly")
    assert n.step(st, "What is the range?").move == "state_offer"


def test_number_below_opening_is_accepted_up_to_the_opening():
    st = state("firm")
    r = n.step(st, "I was thinking 80k")
    assert r.move == "confirm_number" and st["offer"] <= st["opening"]
    assert "named_below_opening" in st["flags"] and st["offer"] == 80000


def test_number_above_opening_gets_the_opening():
    st = state("friendly")
    r = n.step(st, "I'm looking for 98k")
    assert r.move == "state_offer" and st["offer"] == st["opening"] and st["phase"] == "bargaining"


# ---------- bargaining per style ----------

def test_accept_first_offer_sets_signal():
    st = state()
    run(st, "What is the range?")
    r = n.step(st, "Yes, I accept")
    assert r.move == "close_accepted" and st["outcome"] == "accepted" and "accepted_first_offer" in st["signals"]
    assert n.step(st, "hello again").move == "closed_again"


def test_justified_counter_moves_more_than_bare():
    a, b = state("friendly"), state("friendly")
    run(a, "98k")
    run(b, "98k")
    n.step(a, "I want 98,000 because I have six years of experience leading teams")
    n.step(b, "I want 98,000")
    assert a["offer"] > b["offer"] > a["opening"]


def test_firm_and_tight_ignore_bare_counters():
    for style in ("firm", "tight"):
        st = state(style)
        run(st, "98k")
        before = st["offer"]
        n.step(st, "I want 98,000")
        assert st["offer"] == before
        assert st["final"] or style == "firm"          # tight finalises after the first round


def test_concession_never_passes_the_ceiling_or_the_ask():
    st = state("friendly", job_high=100000, target=105000)
    run(st, "105k")
    for _ in range(6):
        n.step(st, "I need 105,000 because of my experience and my skills")
        assert st["offer"] <= st["ceiling"] == 100000


def test_round_cap_makes_final_and_levers_replace_base_moves():
    st = state("tight")
    run(st, "98k", "I'd like 98,000")                 # a bare ask: tight is final after round 1
    assert st["final"]
    before = st["offer"]
    r = n.step(st, "I'd like 99,000 because of my skills")
    assert st["offer"] == before and r.move in ("give_lever", "hold_final")


def test_levers_per_style_and_given_only_once():
    st = state("friendly")
    run(st, "98k")
    r = n.step(st, "Could I get a sign-on bonus?")
    assert r.move == "give_lever" and st["levers"]["sign_on"]["given"]
    assert st["levers"]["sign_on"]["value"] <= st["levers"]["sign_on"]["cap"]
    assert n.step(st, "And a sign-on bonus again?").move == "lever_repeat"
    firm = state("firm")
    run(firm, "98k")
    assert n.step(firm, "A sign-on bonus please").move == "lever_unavailable"       # only after final
    tight = state("tight")
    run(tight, "98k")
    assert n.step(tight, "More vacation days?").move == "lever_unavailable"
    assert n.step(tight, "What about equity?").move == "equity"


def test_equity_is_never_granted():
    for style in ("friendly", "firm", "tight"):
        st = state(style)
        run(st, "98k")
        assert n.step(st, "Can I get stock options?").move == "equity"


def test_ask_for_time_ends_the_session_and_declines_end_on_the_second():
    st = state()
    run(st, "98k")
    r = n.step(st, "Can I have a couple of days to think it over?")
    assert r.move == "grant_time" and st["outcome"] == "time" and r.closing
    st2 = state()
    run(st2, "98k")
    assert n.step(st2, "No thanks, I decline.").move == "decline_first" and st2["phase"] != "closed"
    assert n.step(st2, "No, I'll pass.").move == "close_declined" and st2["outcome"] == "declined"


def test_turn_cap_closes():
    st = state("firm")
    for _ in range(talk.data()["turn_cap"]):
        n.step(st, "Hmm, can you tell me more about the team?")
        if st["phase"] == "closed":
            break
    assert st["outcome"] == "turn_cap"


def test_ask_for_writing_with_no_offer_does_not_close():
    st = state()
    assert n.step(st, "send me the offer in writing").move != "grant_time"


# ---------- step-up (D115) ----------

def step_up_state(style):
    st = state(style)
    run(st, "98k")
    if style == "tight":
        run(st, "I'd like 98,000")                            # a bare ask: base becomes final after round 1
    return st


def test_friendly_accepts_step_up_for_three_or_six_months():
    for months, text in ((3, "after the 3 month probation"), (6, "at the six month review")):
        st = step_up_state("friendly")
        r = n.step(st, f"Could we do 91k now and 98k {text}?")
        su = st["levers"]["step_up"]
        assert r.move == "step_up_grant" and su["given"] and su["after_months"] == months and su["later_amount"] == 98000


def test_friendly_may_add_five_percent_to_now_when_justified():
    st = step_up_state("friendly")
    n.step(st, "Could we do 95k now and 98k after probation, because of my experience leading teams?")
    assert st["offer"] <= int(st["opening"] * 1.05 // st["step"] * st["step"] + st["step"])
    assert st["offer"] >= st["opening"]


def test_firm_counters_three_months_to_six():
    st = step_up_state("firm")
    r = n.step(st, "90k now and 98k after 3 months probation please")
    su = st["levers"]["step_up"]
    assert r.move == "step_up_months_counter" and su["after_months"] == 6 and su["given"]
    assert "Six months, not three" in n.scripted_line(st, r)
    st2 = step_up_state("firm")
    r2 = n.step(st2, "98k at the six month review")
    assert r2.move == "step_up_grant" and st2["levers"]["step_up"]["after_months"] == 6


def test_tight_is_not_yet_before_final_then_asks_for_criteria():
    st = state("tight")
    run(st, "98k")
    assert n.step(st, "Could we do 85k now and 98k after probation?").move == "step_up_not_yet"
    st = step_up_state("tight")
    assert st["final"]
    r = n.step(st, "Could we do 85k now and 98k after probation?")
    assert r.move == "step_up_ask_criteria" and st["levers"]["step_up"]["pending"]
    assert "What would you want to have shown by then" in n.scripted_line(st, r)
    r2 = n.step(st, "I would show a shipped product and good reviews, in writing please")
    assert r2.move == "step_up_grant" and st["levers"]["step_up"]["given"]
    assert st["levers"]["step_up"]["criteria_asked"] and st["levers"]["step_up"]["in_writing"]


def test_tight_grants_at_once_with_a_reason():
    st = step_up_state("tight")
    r = n.step(st, "Could we do 85k now and 98k after probation, because I will deliver results on the roadmap?")
    assert r.move == "step_up_grant"


def test_step_up_later_is_capped_at_the_ceiling():
    st = step_up_state("friendly")
    n.step(st, "91k now and 150k after 6 months because of my experience")
    assert st["levers"]["step_up"]["later_amount"] <= st["ceiling"]


def test_criteria_and_in_writing_detection():
    st = step_up_state("friendly")
    n.step(st, "91k now and 98k after probation")
    su = st["levers"]["step_up"]
    assert su["given"] and not su["criteria_asked"] and not su["in_writing"]
    n.step(st, "Could you put that in the offer letter? I will show shipped results by then")
    assert su["in_writing"] and su["criteria_asked"]
    assert "in_writing_asked" in st["signals"] and "criteria_named" in st["signals"]


def test_performance_bonus_lever_caps():
    for style, cap in (("friendly", 10), ("firm", 5), ("tight", 5)):
        st = state(style)
        run(st, "98k")
        if style == "firm":
            run(st, "I want 98k because of my experience", "98k because of my skills", "98k because of my record")
        if style == "tight":
            run(st, "98k please")
        r = n.step(st, "Could I get a performance bonus?")
        pb = st["levers"]["perf_bonus"]
        assert (r.move == "give_lever" and pb["given"] and pb["value"] <= cap) or r.move == "lever_unavailable"


# ---------- number guard ----------

def test_guard_accepts_allowed_numbers_and_small_units():
    assert n.guard_ok("We can do 91,000 USD a year, with a review in 6 months.", [91000, 6])
    assert n.guard_ok("Thanks, that is a fair point.", [])


def test_guard_rejects_other_amounts_and_budget_talk():
    assert not n.guard_ok("We can do 95,000 USD.", [91000])
    assert not n.guard_ok("Our budget is a bit higher.", [])
    assert not n.guard_ok("The maximum is a stretch.", [91000])
    assert not n.guard_ok("", [])
    assert not n.guard_ok("I could stretch to 94k.", [91000])


# ---------- hidden state never leaks into the model input ----------

def test_model_input_has_no_hidden_numbers():
    st = state()
    r = n.step(st, "98k")
    data = n.model_input(st, r, "98k")
    blob = str(data)
    assert str(st["ceiling"]) not in blob and str(st["floor"]) not in blob and "ceiling" not in blob and "floor" not in blob
    assert data["amount_to_say"] == "91,000 USD"


def test_scripted_lines_pass_their_own_guard():
    for style in ("friendly", "firm", "tight"):
        st = state(style)
        for text in ("98k", "I want 98,000 because of my experience", "Could I get a sign-on bonus?",
                     "91k now and 98k after probation", "What about equity?", "I'd like a few days"):
            r = n.step(st, text)
            base = n.scripted_line(st, r, base_only=True)
            assert n.guard_ok(base, n.numbers_allowed(r, st)), (style, text, base)


# ---------- scoring and debrief ----------

def test_scoring_captured_and_position():
    st = state("friendly")
    run(st, "98k", "I want 98,000 because of my experience", "I want 98,000 because of my results")
    d = n.debrief(st)
    s = d["summary"]
    expected = round(100 * (st["offer"] - st["opening"]) / (st["ceiling"] - st["opening"]))
    assert s["captured_pct"] == expected and 0 <= s["position_pct"] <= 100
    assert d["hidden_range"]["floor"] == st["floor"] and d["kind"] == "negotiate"
    assert d["shifts"] and all(x["quote"] for x in d["shifts"])


def test_deal_line_captured_now_later_and_year_one():
    st = step_up_state("friendly")
    n.step(st, "91k now and 100k after 3 months probation, in writing please")
    d = n.debrief(st)
    deal, s = d["deal"], d["summary"]
    assert deal["after_months"] == 3 and deal["in_writing"]
    assert deal["line"].startswith("Now ") and "after 3 months" in deal["line"]
    now, later = deal["now"], deal["later"]
    assert s["year_one"] == round(now * 3 / 12 + later * 9 / 12)
    assert s["captured_later_pct"] >= s["captured_now_pct"]
    assert {"step_up_asked", "in_writing_asked"} <= {x["id"] for x in d["signals"]}


def test_say_it_better_for_base_final_without_step_up_and_not_in_writing():
    st = state("tight")
    run(st, "98k", "I want 98,000", "Sounds fine, I accept")
    ids = [x["id"] for x in n.debrief(st)["say_it_better"]]
    assert "base_final_no_step_up" in ids or "bare_counter" in ids
    st2 = step_up_state("friendly")
    n.step(st2, "91k now and 98k after probation")
    assert "step_up_not_in_writing" in [x["id"] for x in n.debrief(st2)["say_it_better"]]


def test_say_it_better_quotes_are_the_users_own_words():
    st = state("friendly")
    text = "Fine, I accept"
    run(st, "98k", text)
    d = n.debrief(st)
    quotes = [x["you_said"] for x in d["say_it_better"] if x["you_said"]]
    assert quotes and all(q in " ".join(t["text"] for t in st["turns"]) for q in quotes)


def test_debrief_with_no_offer_has_no_score():
    st = state()
    d = n.debrief(st)
    assert d["no_offer"] and d["summary"]["captured_pct"] is None and "No offer" in d["verdict"]


def test_state_is_json_serialisable_and_copyable():
    import json
    st = state()
    run(st, "98k", "Could we do 91k now and 98k after probation?")
    json.dumps(st)
    assert copy.deepcopy(st) == st


# ---------- hints ----------

def test_hint_priority():
    st = state("firm")
    assert n.pick_hint(st) == "N2"
    st["hints_used"].append({"card_id": "N2", "turn": st["user_turns"]})
    assert n.pick_hint(st) == "N1"
    st = step_up_state("tight")
    assert n.pick_hint(st) == "N9"                                   # base final, gap left, no step-up
    n.step(st, "85k now and 98k after probation because I will deliver results")
    assert n.pick_hint(st) == "N10"                                  # step-up agreed, no criteria named or not in writing
    n.step(st, "I will show results, put it in the offer letter")
    assert n.pick_hint(st) not in ("N9", "N10")


def test_hint_cards_exist_in_content():
    for cid in [f"N{i}" for i in range(1, 11)] + ["T1", "T2"]:
        card = talk.card(cid)
        assert card["rule"] and card["example"]


# ---------- fixes: accepted_first_offer only for a true first-offer acceptance; held lines; below-opening amounts ----------

def test_accepted_first_offer_only_without_naming_a_number():
    st = state("friendly")
    run(st, "What is the range?", "Fine, I accept")
    assert "accepted_first_offer" in st["signals"]
    named = state("friendly")
    run(named, "98k", "Fine, I accept")                       # named a number, then took the unchanged offer
    assert "accepted_first_offer" not in named["signals"]
    assert "accepted_first_offer" not in [x["id"] for x in n.debrief(named)["say_it_better"]]
    lever = state("friendly")
    run(lever, "What is the range?", "Could I get a sign-on bonus?", "OK, I accept")
    assert "accepted_first_offer" not in lever["signals"]


def test_held_lines_and_below_opening_amounts():
    st = state("firm")
    run(st, "I was thinking 80k")
    d = n.debrief(st)
    assert d["named_below_opening"] == {"turn": 1, "your_number": 80000, "opening": st["opening"], "quote": "I was thinking 80k"}
    entry = next(x for x in d["say_it_better"] if x["id"] == "named_below_opening")
    assert entry["your_number"] == 80000 and entry["opening"] == st["opening"]
    st2 = state("firm")
    run(st2, "98k", "I want 98,000")                        # bare ask: Mike holds
    held = n.debrief(st2)["held"]
    assert held and held[0]["why"] == "no_reason" and held[0]["asked"] == 98000 and held[0]["offer"] == st2["offer"]
    assert held[0]["quote"] == "I want 98,000"
    assert n.debrief(state("firm"))["held"] == [] and n.debrief(state("firm"))["named_below_opening"] is None


# ---------- live-run fixes ----------

def test_hint_after_asking_for_the_range_is_n1_not_n2():
    st = state("firm")
    n.step(st, "Before I give a number, what range did you plan for this role?")
    assert st["last_move"] == "press_number" and n.pick_hint(st) == "N1"


def test_writing_the_agreed_step_up_down_is_not_a_counter():
    st = step_up_state("firm")
    n.step(st, "98k at the six month review")
    assert st["levers"]["step_up"]["given"]
    held_before = len([m for m in st["moves"] if m["move"] == "hold"])
    r = n.step(st, "Great. Can we put the 98,000 at six months and the goals in the offer letter?")
    su = st["levers"]["step_up"]
    assert r.move == "step_up_writing" and su["in_writing"] and su["criteria_asked"]
    assert len([m for m in st["moves"] if m["move"] == "hold"]) == held_before and st["counters"] <= 1
    assert "offer letter" in n.scripted_line(st, r)


def test_closing_line_names_the_step_up_and_levers():
    st = step_up_state("friendly")
    n.step(st, "91k now and 98k after the six month review")
    n.step(st, "Could I get a sign-on bonus?")
    n.step(st, "Can we put the goals in the offer letter?")
    r = n.step(st, "Great, I accept")
    line = n.scripted_line(st, r)
    assert "rising to 98,000 USD after 6 months tied to the goals" in line and "sign-on bonus of" in line
    assert "Welcome aboard" in line
    plain = state("friendly")
    run(plain, "What is the range?")
    assert "rising" not in n.scripted_line(plain, n.step(plain, "I accept"))


def test_card_examples_use_the_real_numbers():
    st = step_up_state("firm")
    n.step(st, "98k after 3 months probation")                    # Firm turns it into six months
    assert "98,000 at 6 months" in n.card_example("N10", st) and "three months" not in n.card_example("N10", st)
    assert f"{st['offer']:,} is the limit" in n.card_example("N9", st)
    assert "asking for 98,000" in n.card_example("N5", st)
    assert n.card_example("N10", None) == talk.card("N10")["example"]
    assert n.card_example("N10", state()) == talk.card("N10")["example"]      # no step-up yet: static


def test_every_say_it_better_entry_has_why():
    st = state("friendly")
    run(st, "I was thinking 80k", "Fine, I accept")
    entries = n.debrief(st)["say_it_better"]
    assert entries and all(e["why"] and e["try"] for e in entries)


def test_step_up_writing_line_is_scripted_with_the_step_up_numbers():
    st = step_up_state("firm")
    n.step(st, "98k at the six month review")
    r = n.step(st, "Great. Can we put the 98,000 at six months and the goals in the offer letter?")
    assert r.move in n.SCRIPTED_MOVES
    line = n.scripted_line(st, r, base_only=True)
    assert line == "Yes. I'll put 98,000 USD after 6 months and the goals in the offer letter."
    assert f"{st['offer']:,}" not in line.replace("98,000", "")
