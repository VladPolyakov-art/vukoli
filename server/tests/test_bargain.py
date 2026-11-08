"""Negotiation v2: the bargaining engine (server/bargain.py), its guard, check, debrief and v1 compatibility."""
import copy

import pytest

from server import talkcase, bargain as B, negotiation, talk

FORMS = {
    "offer": dict(scenario="offer", role="Designer", target=95000, job_low=85000, job_high=100000, currency="USD", has_real_offer=False),
    "internship": dict(scenario="internship", role="Designer", target=60000, job_low=52000, job_high=62000, currency="USD", has_real_offer=False),
    "counteroffer": dict(scenario="counteroffer", role="Designer", current_pay=70000, new_offer=85000, leave_reason="growth", currency="USD"),
    "raise": dict(scenario="raise", role="Designer", current_pay=60000, ask=72000, review_month=6, currency="USD", has_real_offer=False),
    "screening": dict(scenario="screening", role="Designer", target=95000, job_low=85000, job_high=100000, currency="USD"),
}


def run(form, style, seed, check_comes_back=True):
    """A persistent user: keeps asking for the top, answers every objection with a reason, takes the deal at the end."""
    st = B.new_state(dict(form, seed=seed), style)
    ask = form.get("ask") or form.get("new_offer") or form["target"]
    asks = (form["job_high"] - 500) if form["scenario"] in ("offer", "internship") else ask
    r, t, lines, stage = None, 0, [], 0
    while st["phase"] != "closed" and t < 20:
        t += 1
        last = r.move if r else None
        if t == 1:
            u = {"raise": f"Since last review I led the migration and shipped three launches, so I'm asking for {asks:,}.",
                 "counteroffer": f"Thanks. I have an offer for {form.get('new_offer', 0):,} but it's about growth, I don't see the path here.",
                 "internship": f"I'd like {asks:,} because I shipped the onboarding project and owned it end to end."
                 }.get(form["scenario"], f"I'm looking for {asks:,}.")
        elif st["offer"] and st["offer"] >= asks:
            u = "That works, I accept. Deal."
        elif st["final"] or last in ("say_final", "concede_final", "hold_final"):
            u = ["Could you add a sign-on bonus?", "Because I'm relocating and this covers my moving costs, that matters to me.",
                 "Okay, I accept. Deal."][min(stage, 2)]
            stage += 1
        elif last in ("object", "hold", "hold_none"):
            u = f"Because I have the experience and I led and delivered results at that scope, I'm asking for {asks:,}."
        elif last == "check":
            u = "Of course, I will wait for your answer."
        else:
            u = f"I understand, but because of my experience and results I'm asking for {asks:,}."
        r = B.step(st, u)
        line = B.scripted_line(st, r, "")
        B.said(st, r, line)
        lines.append((u, r))
        if r.check and check_comes_back:
            c = B.come_back(st)
            B.said(st, c, B.scripted_line(st, c, ""))
            lines.append(("(timer)", c))
            r = c
    return t, st, lines


@pytest.mark.parametrize("sc", ["offer", "internship", "counteroffer", "raise"])
@pytest.mark.parametrize("style", ["friendly", "firm", "tight"])
def test_pacing_objections_and_hard_rules_hold_for_a_persistent_user(sc, style):
    for seed in range(12):
        turns, st, lines = run(FORMS[sc], style, seed)
        assert turns >= 8, (sc, style, seed, turns)                       # target: 8+ user turns before the close
        assert len({o["id"] for o in st["objections_used"]}) >= 2         # at least 2 distinct objections
        finals = [i + 1 for i, (_, r) in enumerate(lines) if r.move in ("say_final", "concede_final")]
        if finals and style != "friendly":
            assert finals[0] >= st["min_final_turn"] - 1                  # (lines include timer entries)
        # base never above the reach cap or the ceiling, never going down
        path = [p["offer"] for p in st["offer_path"] if p.get("offer") is not None]
        assert path == sorted(path)
        assert max(path) <= min(st["reach_cap"], st["ceiling"]) or sc == "raise" and max(path) <= st["ceiling"]
        # an objection came before every base concession
        moves = [m for m in st["moves"] if m["move"] == "concede"]
        used_turns = {o["turn"] for o in st["objections_used"]}
        for m in moves:
            assert any(t < m["turn"] for t in used_turns) or m.get("cause") == "check"


def test_same_seed_same_conversation_and_other_seed_differs():
    a = [(u, r.move, r.amount) for u, r in run(FORMS["offer"], "firm", 5)[2]]
    b = [(u, r.move, r.amount) for u, r in run(FORMS["offer"], "firm", 5)[2]]
    assert a == b
    orders = {tuple(o["id"] for o in run(FORMS["offer"], "firm", s)[1]["objections_used"]) for s in range(8)}
    assert len(orders) > 1


def test_styles_differ_in_patience_and_objection_load():
    stats = {}
    for style in ("friendly", "firm", "tight"):
        res = [run(FORMS["offer"], style, s) for s in range(10)]
        stats[style] = (sum(t for t, _, _ in res) / 10, sum(len(st["objections_used"]) for _, st, _ in res) / 10)
    assert stats["tight"][1] > stats["friendly"][1] or stats["firm"][1] > stats["friendly"][1]
    assert B.data()["styles"]["friendly"]["manner"] != B.data()["styles"]["tight"]["manner"]


def test_first_counter_gets_an_objection_and_no_concession():
    st = B.new_state(dict(FORMS["offer"], seed=1), "firm")
    B.step(st, "I'm looking for 98k")                     # Mike asks / states the base first
    r = B.step(st, "I want 98,000 please")
    assert r.move in ("object", "hold") and st["offer"] <= st["reach_cap"]
    assert st["concessions"] == 0 and st["pending_obj"]


def test_check_burns_a_slot_and_comes_back():
    found = 0
    for seed in range(20):
        turns, st, lines = run(FORMS["offer"], "firm", seed)
        if st["check"]["used"]:
            found += 1
            assert st["check"]["pending"] is False and st["check"]["result"]["kind"] in ("base", "lever", "none")
            assert any(r.move == "check" for _, r in lines) and any(r.came_back for _, r in lines)
    assert found


def test_user_speaking_during_the_check_gets_the_come_back():
    for seed in range(20):
        st = B.new_state(dict(FORMS["offer"], seed=seed), "firm")
        r = None
        for i in range(12):
            r = B.step(st, "Because of my experience and results leading teams, I'm asking for 99,500" if i else "I'm looking for 99,500")
            if r.check:
                break
        if r and r.check:
            r2 = B.step(st, "Sure, take your time")
            assert r2.move.startswith("come_back") and r2.came_back and not st["check"]["pending"]
            return
    pytest.fail("no check in 20 seeds")


def test_guard_blocks_leaks_early_final_and_repeats():
    st = B.new_state(dict(FORMS["offer"], seed=2), "firm")
    B.step(st, "98k")
    r = B.step(st, "Because I have deep experience, 98,000")
    assert B.guard_ok(st, r, "Let me hear more about why that matters to you.")[0]
    assert B.guard_ok(st, r, "We can do 96,000 USD.")[1] == "number"
    assert B.guard_ok(st, r, "Our budget is tight.")[1] == "number" or not B.guard_ok(st, r, "Our budget is tight.")[0]
    if r.move not in B.FINAL_OK:
        assert B.guard_ok(st, r, "That's my final offer.")[1] == "final"
    assert B.guard_ok(st, r, "")[1] == "empty"
    st["recent"] = ["I hear you, but the band for this level is set."]
    assert B.guard_ok(st, r, "I hear you, but the band for this level is set.")[1] == "repeat"


def test_screening_never_makes_an_offer_and_notes_the_number():
    for style in ("friendly", "firm", "tight"):
        turns, st, lines = run(FORMS["screening"], style, 3)
        assert st["outcome"] == "noted" and st["offer"] is None and 3 <= turns <= 8
        assert all(r.amount is None for _, r in lines)


def test_screening_range_sharing_follows_the_style():
    def ask(style, times):
        st = B.new_state(dict(FORMS["screening"], seed=1), style)
        r = None
        for _ in range(times):
            r = B.step(st, "What is the range for this role?")
        return r.move
    assert ask("friendly", 1) == "share_range" and ask("firm", 1) == "deflect_range" and ask("firm", 2) == "share_range"
    assert ask("tight", 3) == "deflect_range"


def test_all_scenarios_have_scripted_lines_for_every_act_and_style():
    for sc, form in FORMS.items():
        for style in ("friendly", "firm", "tight"):
            _, st, lines = run(form, style, 4)
            for _, r in lines:
                text = B.scripted_line(st, r, "Ann")
                assert text.strip() and "{" not in text, (sc, style, r.move, text)


def test_debrief_shape_for_each_scenario():
    for sc, form in FORMS.items():
        _, st, _ = run(form, "firm", 2)
        d = B.debrief(st)
        assert d["kind"] == "negotiate" and d["version"] == 2 and d["scenario"] == sc
        for key in ("verdict", "practice_note", "objections", "levers_won", "missed_levers", "cards", "outcome_label"):
            assert key in d, (sc, key)
        res = talk.talk_result({"mode": "negotiate", "debrief": d, "negotiation": st})
        assert res["version"] == 2 and res["scenario"] == sc


def test_cards_total_is_27_and_new_cards_are_negotiate_only():
    cards = talk.public_content()["cards"]
    assert len(cards) == 27
    for cid in ("O1", "O2", "S1", "S2", "I1", "C1", "C2", "R1", "R2", "X1", "X2", "X3", "X4", "X5", "X6"):
        assert next(c for c in cards if c["id"] == cid)["modes"] == ["negotiate"]


def test_hint_picker_follows_the_moment():
    st = B.new_state(dict(FORMS["offer"], seed=1), "firm")
    B.step(st, "98k")
    B.step(st, "Because I have deep experience, 98,000")
    if st["pending_obj"]:                              # D118: the objection's own card first, O1 right after
        ranked = B.hint_ranking(st, [])
        assert ranked[0] == talkcase.objection_card(st["pending_obj"]["id"]) and "O1" in ranked[:2]
    raise_st = B.new_state(dict(FORMS["raise"], seed=1), "firm")
    assert B.pick_hint(raise_st, []) == "R1"
    assert B.pick_hint(B.new_state(dict(FORMS["screening"], seed=1), "firm"), []) in ("S1", "N2", "S2", "N1")


def test_v1_state_is_not_v2_and_keeps_the_v1_engine():
    v1 = negotiation.new_state({"role": "PM", "target": 95000, "job_low": 85000, "job_high": 100000, "currency": "USD"}, "firm", False)
    assert not B.is_v2(v1)
    reply = negotiation.step(v1, "I'd like 98k")
    assert reply.move and v1["user_turns"] == 1
    assert talk.debrief_for({"mode": "negotiate", "negotiation": v1})["kind"] == "negotiate"
    assert "version" not in talk.debrief_for({"mode": "negotiate", "negotiation": copy.deepcopy(v1)})


def test_the_title_names_the_scenario():
    assert talk.start_title("negotiate", style="tight", scenario="raise") == "Salary talk · Raise with your lead · Tight budget"
    assert talk.start_title("negotiate", role="PM", style="tight") == "Negotiation · PM · Tight budget"


# ---------- free phrasing (v2b): the raise call from the live check ----------

RAISE_LINES = [
    "Thanks for the time. I'd like to talk about my salary. This year I led the checkout redesign that lifted conversion by 12 percent, and I now mentor two juniors. I'm asking for 80,000.",
    "I understand the budget cycle, but my scope has grown since the last review. Market rate for this scope is around 80,000. What can we do now?",
    "If 80,000 is not possible now, could we do 75,000 now and 80,000 in six months if I hit the goals we agree on today?",
    "I understand this year is locked. Then can we agree in writing that at the next review I move to 80,000 if I deliver the onboarding redesign and keep mentoring?",
    "Because I led the checkout redesign and mentor two juniors, I think it is fair to agree the date and the goals today.",
    "And for now, could 71,250 come with a title change to Senior Product Designer, since I already do senior work?",
    "Thank you. Let's do that, please send me the summary in writing.",
]


def test_raise_at_a_date_with_goals_is_granted_and_acceptance_in_writing_closes_with_the_terms():
    form = dict(FORMS["raise"], current_pay=70000, ask=80000, seed=5)
    st = B.new_state(form, "firm")
    acts = []
    for u in RAISE_LINES:
        if st["phase"] == "closed":
            break
        r = B.step(st, u)
        B.said(st, r, B.scripted_line(st, r, ""))
        if r.check:
            B.come_back(st)
        acts.append(r.move)
    assert "step_up_grant" in acts and acts[-1] == "close_accepted" and "ask_date" not in acts
    su = st["levers"]["step_up"]
    assert su["given"] and su["later_amount"] == 80000 and su["criteria_asked"] and su["in_writing"]
    assert st["levers"]["title"]["given"]                      # the title that was discussed comes with "let's do that"
    line = B.scripted_line(st, r, "")
    assert "80,000" in line and "writing" in line
    d = B.debrief(st)
    assert d["outcome"] == "accepted" and not [x for x in d["say_it_better"] if x["id"] == "raise_no_date"]
    assert all(o["user_reply"] for o in d["objections"])      # every objection got the user's next line


def test_ask_for_writing_alone_is_not_a_request_for_time():
    st = B.new_state(dict(FORMS["offer"], seed=1), "friendly")
    B.step(st, "I'm looking for 99,500")
    r = B.step(st, "Could you send me the terms in writing?")
    assert r.move == "agree_written" and st["phase"] != "closed"


def test_intent_is_checked_by_code():
    text = "Could we do 75,000 now and 80,000 in six months?"
    ok = B.validate_intent({"intent": "step_up", "amounts": [75000, 80000, 99999], "months": 6, "criteria_named": False,
                            "in_writing_asked": "yes", "lever": "yacht"}, text)
    assert ok["amounts"] == [75000, 80000] and ok["lever"] is None and ok["writing"] is False and ok["months"] == 6
    assert B.validate_intent({"intent": "teleport"}, text) is None and B.validate_intent("x", text) is None


def test_the_model_intent_overrides_the_keywords():
    st = B.new_state(dict(FORMS["raise"], current_pay=70000, ask=80000, seed=5), "firm")
    B.step(st, "I led the redesign and I'm asking for 80,000")
    text = "Honestly, would 80,000 work once the next cycle comes around, assuming I hit what we set?"
    intent = B.validate_intent({"intent": "raise_at_date", "amounts": [80000], "months": None, "criteria_named": True,
                                "in_writing_asked": False, "lever": None}, text)
    cls = B.classify(st, text, intent)
    assert cls.kind == "step_up" and cls.later == 80000 and cls.criteria


@pytest.mark.parametrize("sc", list(FORMS))
def test_openings_and_closings_never_start_with_a_comma_before_a_capital(sc):
    for style in ("friendly", "firm", "tight"):
        st = B.new_state(dict(FORMS[sc], seed=1), style)
        for name in ("", "Anna"):
            line = B.opening_line(st, name)
            assert ", " not in line.split(".")[0] or name == "" and not line.startswith("Hi,"), line
            assert not line.startswith("Hi, ")


@pytest.mark.parametrize("seed", range(6))
def test_step_up_granted_with_goals_already_named_does_not_ask_for_goals_again(seed):
    """Live check 08.11: 'What goals would you want to hit by then? Yes. I'll put ... and the goals in writing.'"""
    st = B.new_state(dict(FORMS["raise"], current_pay=70000, ask=80000, seed=seed), "firm")
    lines = ["Over the last year I led the onboarding redesign and the design system work. I'd like to move my pay to 80,000.",
             RAISE_LINES[2],
             "Then can we agree in writing that at the next review I move to 80,000 if I deliver the onboarding redesign and the design system rollout?"]
    for u in lines:
        r = B.step(st, u)
        line = B.scripted_line(st, r, "")
        B.said(st, r, line)
        if r.check:
            B.come_back(st)
        if r.move in ("step_up_grant", "step_up_months_counter") and st["levers"]["step_up"]["criteria_asked"]:
            assert "?" not in line, line


def test_a_tail_does_not_repeat_in_writing():
    st = B.new_state(dict(FORMS["raise"], current_pay=70000, ask=80000, seed=2), "firm")
    for u in ["I led the onboarding redesign. I'd like to move my pay to 80,000.", RAISE_LINES[2],
              "Then can we agree in writing that at the next review I move to 80,000 if I deliver the onboarding redesign?",
              "Thank you. Let's do that, please send me the summary in writing."]:
        r = B.step(st, u)
        line = B.scripted_line(st, r, "")
        B.said(st, r, line)
        if r.check:
            B.come_back(st)
        assert line.lower().count("writing") + line.lower().count("by email") <= 1, line


def test_could_you_share_the_range_is_a_range_question_not_equity():
    """Live check 08.11: 'could you share the range' was read as an equity ask and got 'I didn't catch a figure'."""
    text = "Thanks, Mike. Before I name a number, could you share the range you have budgeted for this role?"
    st = B.new_state(dict(FORMS["offer"], seed=1), "firm")
    assert B.classify(st, text, None).kind == "ask_range"
    intent = B.validate_intent({"intent": "ask_range", "amounts": [], "months": None, "criteria_named": False,
                                "in_writing_asked": False, "lever": None}, text)
    assert B.classify(st, text, intent).kind == "ask_range"
    assert negotiation.lever_in("Do the shares vest over four years?") == "equity"
    assert negotiation.lever_in("Is there a share grant?") == "equity"


def test_a_reasoned_counter_the_model_reads_as_a_lever_stays_a_counter():
    """Live check 08.11: '...that's the scope this role describes, so 98,000 reflects it' got 'That one isn't something I can offer.'"""
    st = B.new_state(dict(FORMS["offer"], seed=1), "firm")
    B.step(st, "I'm looking for 99,000.")
    assert st["offer"] is not None
    text = "In my last role I owned the design system used by 40 engineers. That's the scope this role describes, so 98,000 reflects it."
    intent = B.validate_intent({"intent": "lever_ask", "amounts": [98000, 40], "months": None, "criteria_named": False,
                                "in_writing_asked": False, "lever": "scope"}, text)
    cls = B.classify(st, text, intent)
    assert cls.kind == "counter" and cls.amount == 98000


@pytest.mark.parametrize("seed", range(12))
def test_a_line_with_a_reason_never_gets_need_a_reason(seed):
    st = B.new_state(dict(FORMS["offer"], seed=seed), "firm")
    B.step(st, "I'm looking for 99,000.")
    for _ in range(4):
        r = B.step(st, "Because I led the checkout redesign that lifted conversion by 12 percent, I'd like 98,000.")
        B.said(st, r, B.scripted_line(st, r, ""))
        if r.check:
            B.come_back(st)
        if r.move == "object":
            assert not r.objection.get("asks_reason") and not any(w in r.objection["line"] for w in ("need a reason", "behind that number"))


def test_restating_an_agreed_step_up_reads_what_is_new():
    """Live check 08.11: 'base at 92,500 with the step-up to 98,000 is fine. Can we add the 5,000 sign-on bonus on top?'
    got 'That one is already on the table.'"""
    def agreed():
        st = B.new_state(dict(FORMS["offer"], seed=1), "friendly")
        st["offer"] = 92500
        st["levers"]["step_up"].update(given=True, later_amount=98000, after_months=6, now_amount=92500)
        return st
    st = agreed()
    c = B.classify(st, "Okay, base at 92,500 with the step-up to 98,000 after six months is fine with me. Can we add the 5,000 sign-on bonus on top?", None)
    B._restated_step_up(st, c, "Okay, base at 92,500 with the step-up to 98,000 after six months is fine with me. Can we add the 5,000 sign-on bonus on top?")
    assert c.kind == "lever_ask" and c.lever == "sign_on" and c.lever_amount == 5000
    st = agreed()
    t = "Thank you. Then I accept: 92,500 now and 98,000 after six months with the goals. Please send it in writing."
    c = B.classify(st, t, None)
    B._restated_step_up(st, c, t)
    assert c.kind == "accept"


def test_firm_talks_bonuses_once_the_step_up_settles_base_and_the_close_says_writing_once():
    st = B.new_state(dict(FORMS["offer"], seed=3), "firm")
    st["offer"] = 92500
    st["levers"]["step_up"].update(given=True, later_amount=98000, after_months=6, now_amount=92500)
    assert B.lever_state(st, "sign_on") == "ok"
    r = B.step(st, "Thank you. Then I accept, please send it in writing.")
    line = B.scripted_line(st, r, "")
    assert r.move == "close_accepted" and "whatever we settle" not in line


def test_lever_object_line_may_not_refuse_and_accepting_other_terms_drops_the_lever():
    """Live check 08.11: Mike's model line for lever_object said 'We don't offer sign-on bonuses', then the close added one."""
    st = B.new_state(dict(FORMS["offer"], seed=3), "firm")
    st["offer"] = 88750
    st["levers"]["step_up"].update(given=True, later_amount=98000, after_months=6, now_amount=88750)
    r = B.step(st, "Can we add a 5,000 sign-on bonus on top?")
    if r.move == "lever_object":
        assert not B.guard_ok(st, r, "We don’t offer sign-on bonuses for this role.")[0]
        assert B.guard_ok(st, r, "Maybe. What would the sign-on cover for you?")[0]
        r = B.step(st, "Understood. Then I accept: 88,750 now and 98,000 after six months with the goals.")
        assert r.move == "close_accepted" and not st["levers"]["sign_on"]["given"]


def test_an_agreed_step_up_shows_in_what_moved_the_offer():
    form = dict(FORMS["raise"], current_pay=70000, ask=80000, seed=5)
    st = B.new_state(form, "firm")
    for u in RAISE_LINES:
        if st["phase"] == "closed":
            break
        r = B.step(st, u)
        B.said(st, r, B.scripted_line(st, r, ""))
        if r.check:
            B.come_back(st)
    assert any(s["cause"] == "step_up" for s in B.debrief(st)["shifts"])


@pytest.mark.parametrize("style", ["friendly", "firm", "tight"])
def test_no_pause_hint_after_the_user_paused(style):
    """Owner 08.11: 'let me think about it for a second' → Mike 'take your time' → hint 'Pause before you answer'."""
    st = B.new_state(dict(FORMS["offer"], seed=2), style)
    B.step(st, "Before I give a number, what is the range did you plan for this role?")
    B.step(st, "Thank you, let me think about it for a second.")
    ranked = B.hint_ranking(st)
    assert "N4" not in ranked and ranked[0] in ("N5", "N1", "N6", "O1", "N8")


def test_a_hint_is_never_the_line_the_user_just_said():
    st = B.new_state(dict(FORMS["offer"], seed=2), "friendly")
    B.step(st, "Before I give a number, what range did you plan for this role?")
    assert all(talk.card(c)["example"] != "Before I give a number, what range did you plan for this role?" for c in B.hint_ranking(st)[:1])
