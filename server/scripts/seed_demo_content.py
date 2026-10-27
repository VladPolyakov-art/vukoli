"""What the demo sessions say (fictional). Used by seed_demo_sessions.py; see its docstring.

The user is "Sam Rivera", a product manager (invented employer: Lumen Ledger, an invoicing start-up). The interviewer is Mike.
Every number in a scorecard comes from the server's own rules, not from this file: the answers below carry the *raw checks*
of the content layer (what the model would have answered: was there a result, was it "I" or "we"...), the language flags and the
speed of speaking; the server turns them into layers, the scorecard, the verdict step and the plan when the API reads the session.

An answer:  ans(text, c={checks}, lang=[(original, better, tag, class, reason[, status])], wpm=…, pauses=…, low=[words], edited=…)
  * `wpm` set = spoken (voice) answer; left out = typed answer.
  * `c` overrides the defaults: situation/task/action/result True, voice "i", result_type "number", relevant True, reflection True.
    Also `evidence` / `praise`: exact quotes of the answer.
  * `lang` classes: M = meaning error (severity 3), N = clear slip (2), C = small (1). Status: active | unconfirmed | confirmed | dismissed.
A turn:  {"q": question id, "answer": ans(...), "follow": (Mike's follow-up, ans(...))}  or  {"q": id, "said": [lines too short to coach]}
Weak spots are picked as (layer, tag); their evidence ("q3"...) is counted from the answers by the server's own rules.
"""
from __future__ import annotations


def ans(text: str, c: dict | None = None, lang: list | tuple = (), wpm: int | None = None, pauses: int = 0,
        low: list | tuple = (), edited: bool = False, stronger: tuple | None = None, keep: tuple | None = None) -> dict:
    return {"text": " ".join(text.split()), "c": c or {}, "lang": list(lang), "wpm": wpm, "pauses": pauses,
            "low": list(low), "edited": edited, "stronger": stronger, "keep": keep}


VACANCIES = [
    {"id": "demo-vac-brightline", "days_ago": 11, "title": "Demo · Brightline · Product Manager, Growth", "questions": [],
     "text": ("Product Manager, Growth at Brightline. Brightline helps small clinics turn walk-in enquiries into booked "
              "appointments. You will own the signup-to-first-booking funnel, run weekly experiments with design and "
              "engineering, and use data to decide what to build next. You will talk to clinic managers every week and "
              "write clear one-page briefs for the team. We look for someone who has shipped onboarding or activation "
              "improvements and can explain the trade-offs behind their decisions.")},
]

SESSIONS: list[dict] = []

# ============================================================================================ 1. READY
SESSIONS.append({
    "id": "demo-ready", "title": "Demo · Ready · Harbor & Pine · Product Manager", "days_ago": 1, "at": (19, 40),
    "round_type": "behavioural", "strictness": 2, "input": "voice", "vacancy_title": "Harbor & Pine · Product Manager",
    "requests": 14, "limit_used": 0.7,
    "questions": ["B3", "D2", "E1", "F1", "G1"],
    "turns": [
        {"q": "B3",
         "answer": ans(
             "At Lumen Ledger our invoice reminders were being ignored, with only about 41 percent of invoices paid on time. "
             "I owned the problem for two quarters. I pulled the payment data myself, and I saw that most late invoices were "
             "opened but never paid, so the friction was after the click. I proposed a one-tap pay link in the reminder email, "
             "and I worked with a designer and one engineer to ship it in five weeks. On-time payment went from 41 to 58 percent "
             "within two months, and the support tickets about late fees dropped by third.",
             c={"evidence": "On-time payment went from 41 to 58 percent within two months",
                "praise": "I proposed a one-tap pay link in the reminder email"},
             lang=[("dropped by third", "dropped by a third", "article", "N", "Use “a” before “third” here.")], wpm=138)},
        {"q": "D2",
         "answer": ans(
             "Our head of sales asked me to add a custom report for one large customer, and he wanted it in two weeks. I looked "
             "at what the request would touch and I saw that it meant pausing the bank-sync work, which was already late. So I "
             "booked thirty minutes with him, I explained him why, and I showed him the three customers who were blocked by the "
             "sync issue, against the one who wanted the report. I offered a spreadsheet export as a stopgap in the meantime. "
             "He agreed, and the large customer was fine with the export. In the end it went well and we kept the roadmap on track.",
             c={"result_type": "vague", "evidence": "In the end it went well and we kept the roadmap on track",
                "praise": "I offered a spreadsheet export as a stopgap in the meantime"},
             lang=[("I explained him why", "I explained to him why", "preposition", "N", "“Explain” takes “to” before the person.")],
             wpm=142)},
        {"q": "E1",
         "answer": ans(
             "Last spring we had to choose a card-payments provider before we could see real transaction costs. I had two quotes "
             "and no history. I decided to run a small pilot with five percent of traffic on the cheaper provider, because that "
             "let us learn the real fees in three weeks instead of guessing. I was responsible of the pilot and I wrote the "
             "decision down with the risks, and I asked finance to review it. The pilot showed that fees were 0.4 points lower "
             "than the quote, and we moved all traffic over in June.",
             c={"evidence": "The pilot showed that fees were 0.4 points lower than the quote",
                "praise": "I decided to run a small pilot with five percent of traffic on the cheaper provider"},
             lang=[("responsible of the pilot", "responsible for the pilot", "preposition", "N", "“Responsible” goes with “for”.")],
             wpm=140)},
        {"q": "F1",
         "answer": ans(
             "We built a dashboard for accountants that almost nobody opened. I led it, and I assumed accountants wanted more "
             "charts because three customers asked for them. After launch only six percent of accounts used it in the first "
             "month. I ran eight interviews and learned that they wanted a clean list to send to their clients, not charts. I cut "
             "the charts, rebuilt the page as a printable summary, and usage rose to twenty-nine percent. What I would do "
             "differently is talk to ten customers before writing any brief, not three.",
             c={"evidence": "usage rose to twenty-nine percent",
                "praise": "What I would do differently is talk to ten customers before writing any brief, not three"},
             wpm=178)},
        {"q": "G1",
         "answer": ans(
             "When our onboarding drop-off kept rising, nobody owned it, so I asked the engineering and design leads for one hour "
             "each week. I set up a shared board, I wrote the weekly goal, and I ran a fifteen-minute review every Thursday. Over a "
             "quarter we fixed eleven small issues and the signup completion rate improved. Everyone on the team felt it was "
             "working better.",
             c={"result_type": "vague", "evidence": "the signup completion rate improved"},
             lang=[("ran a fifteen-minute review", "held a fifteen-minute review", "collocation", "C", "“Hold” is the usual verb for a meeting.")],
             wpm=136),
         "follow": ("Who resisted, and how did you handle it?",
                    ans("The engineering lead resisted at first because he did not want another meeting. I offered to cut the review to "
                        "ten minutes and to send the board by email on weeks when nothing changed, and he joined from the third week.",
                        wpm=134))},
    ],
    "debrief": {
        "verdict": "Clear stories where you name your own decisions and back them with numbers; two answers end without a firm result.",
        "strength": "You say what you decided and why, and you give figures.",
        "next_step": "Give the two softer endings a number, then try a harder round.",
        "spots": [("content", "vague_result"), ("language", "preposition"), ("delivery", "pace_fast")]},
})

# ============================================================================================ 2. GETTING THERE
SESSIONS.append({
    "id": "demo-getting-there", "title": "Demo · Getting there · Quillwork · Product Owner", "days_ago": 2, "at": (8, 15),
    "round_type": "mix", "strictness": 2, "input": "voice", "vacancy_title": "Quillwork · Product Owner",
    "requests": 12, "limit_used": 0.5,
    "questions": ["A2", "B5", "C1", "D1", "F2"],
    "turns": [
        {"q": "A2",
         "answer": ans(
             "So, um, I've been following Quillwork for about a year, mostly because of how you handle document collaboration. "
             "And, you know, I applied because the product owner role here owns the whole editor experience, which is basically "
             "something I haven't had in my current job. Um, I am working at Lumen Ledger since four years, and I think I can bring "
             "my experience from invoicing, where I, um, increased adoption of a new feature, like, quite a lot. It's actually "
             "kind of the same problem, you know, just a different product.",
             c={"situation": False, "result_type": "vague", "evidence": "I, um, increased adoption of a new feature, like, quite a lot"},
             lang=[("I am working at Lumen Ledger since four years", "I have worked at Lumen Ledger for four years", "tense", "N",
                    "Use the present perfect with “for” and a length of time.")], wpm=152)},
        {"q": "B5",
         "answer": ans(
             "Last November we promised a customer a bank-sync integration by the end of the month. Two weeks before, the bank "
             "changed their API. I told to the team lead right away, and then we split the work: I handled the customer "
             "communication and the scope, and the engineers worked on the new API. We cut the reconciliation view from the first "
             "release and shipped the core sync on the thirtieth. The customer accepted the smaller release and renewed their "
             "contract in January.",
             c={"voice": "mixed", "result_type": "outcome", "evidence": "renewed their contract in January"},
             lang=[("I told to the team lead", "I told the team lead", "preposition", "N", "“Tell” is followed directly by the person.")],
             wpm=134)},
        {"q": "C1",
         "answer": ans(
             "We worked a lot with design team on the new onboarding. We had weekly syncs and we shared the Figma files. The designers "
             "made a few flows, and we gave feedback, and the engineers built them. It was a very collaborative process and we all "
             "learned a lot from each other.",
             c={"task": False, "action": False, "result": False, "result_type": "none", "voice": "we",
                "evidence": "It was a very collaborative process and we all learned a lot from each other"},
             lang=[("with design team", "with the design team", "article", "N", "Add “the” before “design team”.")],
             wpm=124, pauses=2,
             stronger=("I ran a weekly sync with the designers and the engineers on the new onboarding. I reviewed each flow in "
                       "Figma and wrote down what I needed changed. As a result, [your number] fewer onboarding questions reached "
                       "support.", ["[your number]"]))},
        {"q": "D1",
         "answer": ans(
             "I disagreed with one of our engineers about whether to build the reminder schedule ourselves or use a library. He "
             "wanted to build it. I thought a library would save two sprints, so I made a one-page comparison with the cost of both "
             "and I asked him to challenge it. He found one real problem: the library couldn't handle our time-zone rules. So we "
             "built the core ourselves and used the library only for the calendar part. It cost us one sprint more than I had "
             "hoped, but we avoided a bug that would have hit some of our accounts.",
             c={"voice": "mixed", "result_type": "vague", "evidence": "we avoided a bug that would have hit some of our accounts"},
             wpm=140)},
        {"q": "F2",
         "answer": ans(
             "In March I scheduled a pricing change email for the wrong segment, and about three hundred customers got a message "
             "that did not apply to them. I noticed it myself within an hour, I sent short correction, and I told my manager. "
             "Basically, nobody cancelled because of it.",
             c={"situation": False, "reflection": False, "result_type": "outcome", "evidence": "nobody cancelled because of it"},
             lang=[("I sent short correction", "I sent a short correction", "article", "N", "Add “a” before “short correction”.")],
             wpm=140,
             stronger=("I scheduled a pricing email for the wrong segment and about three hundred customers got a message that did "
                       "not apply to them. I noticed within an hour, sent a correction and told my manager. Now I "
                       "[add a second check before sending].", ["[add a second check before sending]"])),
         "follow": ("What would you do differently if it happened again?",
                    ans("I would ask a colleague to check the segment before I press send, and I would send a test email to myself "
                        "first. Since then I have done both every time.", wpm=127))},
    ],
    "debrief": {
        "verdict": "The structure is mostly there, but two stories stay on “we” or end without a result, and the mistake story has no lesson.",
        "strength": "Your disagreement story names the problem, your action and what it cost.",
        "next_step": "Retell the design-team story: what you did, and what changed because of it.",
        "spots": [("content", "no_star_action"), ("language", "article"), ("delivery", "filler_high")]},
})

# ============================================================================================ 3. NOT READY YET
SESSIONS.append({
    "id": "demo-not-ready", "title": "Demo · Not ready yet · General questions", "days_ago": 3, "at": (21, 5),
    "round_type": "hr", "strictness": 3, "input": "voice", "requests": 11, "limit_used": 0.4,
    "questions": ["A1", "B1", "C5", "D3", "E2"],
    "turns": [
        {"q": "A1",
         "answer": ans(
             "Um, so I started in customer support, you know, and then basically I moved into operations, and then I was kind of "
             "doing product things, like, for a while. We had a team and we did a lot of projects. Now I want a new step, because I "
             "am working in the same company since many years and, um, it is time to change. This role looks interesting and, "
             "basically, I like products.",
             c={"task": False, "result": False, "result_type": "none", "voice": "mixed",
                "evidence": "We had a team and we did a lot of projects"},
             lang=[("I am working in the same company since many years", "I have worked in the same company for many years", "tense", "N",
                    "Use the present perfect with “for” and a length of time.")], wpm=168)},
        {"q": "B1",
         "answer": ans(
             "I am most proud of our migration project. It was a very big project and many people were involved. We migrated the old "
             "system to the new one and it took a long time, but finally we did it. Everybody was happy about it.",
             c={"action": False, "result_type": "vague", "voice": "we",
                "evidence": "It was a very big project and many people were involved"},
             lang=[("a very big project", "a large project", "word_choice", "N", "“Big” sounds casual; “large” or “major” is more exact.")],
             wpm=110, pauses=3)},
        {"q": "C5",
         "answer": ans(
             "My team was not working well because the manager changed. The new manager did not communicate. People were unhappy "
             "and some left. I tried to talk to him one time, but he said he was busy. So, you know, I just continued with my tasks.",
             c={"result": False, "result_type": "none", "evidence": "I just continued with my tasks"}, wpm=120)},
        {"q": "D3",
         "answer": ans(
             "The toughest feedback was that I am too direct. My lead said that people feel pressure, and I was very sensible about "
             "it, because I only say the truth. I think it was not fair, but I accepted. Since then I try to be softer in meetings, "
             "I think.",
             c={"result_type": "vague", "evidence": "Since then I try to be softer in meetings, I think"},
             lang=[("I was very sensible about it", "I was very sensitive about it", "meaning_error", "M",
                    "“Sensible” means reasonable. You mean “sensitive”.")], wpm=120)},
        {"q": "E2",
         "answer": ans(
             "I think the most important thing is communication. In my last job we had a lot of meetings and I think meetings are "
             "good for the team. I always say that a good team is a team that talks. Also I like to use Slack.",
             c={"relevant": False, "action": False, "result": False, "result_type": "none",
                "evidence": "I always say that a good team is a team that talks"}, wpm=82)},
    ],
    "debrief": {
        "verdict": "The answers describe what happened around you, not what you did, and most of them end without a result.",
        "strength": "You gave a clear reason for wanting a change.",
        "next_step": "Pick one story and retell it in three parts: what you did, the number that changed, what you learned.",
        "spots": [("content", "no_result"), ("language", "meaning_error"), ("delivery", "filler_high")]},
})

# ============================================================================================ 4. TWELVE QUESTIONS
SESSIONS.append({
    "id": "demo-twelve-questions", "title": "Demo · 12 questions · General questions", "days_ago": 4, "at": (13, 20),
    "round_type": "mix", "strictness": 2, "input": "text", "requests": 38, "limit_used": 2.1,
    "questions": ["A4", "B2", "B4", "C2", "C3", "D4", "D5", "E3", "E5", "F3", "G2", "G5"],
    "turns": [
        {"q": "A4",
         "answer": ans(
             "The work that gives me the most energy is the first month of a new problem, when I talk to customers and nothing is "
             "decided yet. Last year I spent three weeks calling small accountants about late payments, and I came out with a "
             "shortlist of five ideas that the team still uses. What drains me is status reporting that nobody reads, so I now keep "
             "one weekly note instead of three meetings.",
             c={"result_type": "outcome", "evidence": "a shortlist of five ideas that the team still uses"})},
        {"q": "B2",
         "answer": ans(
             "Nobody asked me to look at refunds, but I noticed that one in six support chats was about them. I took the last "
             "quarter's chats, tagged four hundred of them by hand, and found that half came from a single confusing email. I "
             "rewrote the email with the copywriter, and refund chats fell by 35 percent in the next month.",
             c={"evidence": "refund chats fell by 35 percent in the next month"})},
        {"q": "B4",
         "answer": ans(
             "When I took over the billing settings page it had forty open bugs and no owner. I closed the duplicates, grouped the "
             "rest into five themes and fixed the two that blocked customers from paying. The page became much more stable and the "
             "team stopped dreading it.",
             c={"result_type": "vague", "evidence": "The page became much more stable and the team stopped dreading it"})},
        {"q": "C2",
         "answer": ans(
             "Our finance director asked why a payment could be marked paid and still not appear in the bank. I drew two boxes, "
             "one for our system and one for the bank, and an arrow between them that takes a day. I told her that we write 'paid' "
             "when the customer pays, not when the bank confirms. She asked for a second status in the report, and we added it in "
             "the next release.",
             c={"evidence": "She asked for a second status in the report, and we added it in the next release"})},
        {"q": "C3",
         "answer": ans(
             "I needed the data team to give me a weekly export, but they had their own priorities. I asked their lead for fifteen "
             "minutes, explained what I wanted it for, and offered to write the query myself if they reviewed it. He agreed to review "
             "it, and I wrote it.",
             c={"result": False, "result_type": "none", "evidence": "He agreed to review it, and I wrote it"})},
        {"q": "D4",
         "answer": ans(
             "A designer I worked with kept presenting five options when we needed one. I told him in a one-to-one that the "
             "options made decisions slower, and I suggested that he bring one recommendation with the reason. We tried it for a "
             "month. We now decide in one meeting instead of two, and he said he felt more heard.",
             c={"voice": "mixed", "evidence": "We now decide in one meeting instead of two"})},
        {"q": "D5",
         "answer": ans(
             "I was sure that customers wanted a mobile app, until I looked at the usage data: ninety-one percent of sessions were "
             "on a laptop. I told the team I was wrong and I moved the app to later. We improved the laptop experience first, and "
             "average session length went up by a minute.",
             c={"evidence": "ninety-one percent of sessions were on a laptop"})},
        {"q": "E3",
         "answer": ans(
             "Before a big customer demo we had two days left and a choice: ship the new chart or fix the loading time. I chose to "
             "fix the loading time, because a slow demo would hurt more than a missing chart. I told the sales team on the same "
             "day. The demo went smoothly and the customer signed.",
             c={"result_type": "vague", "evidence": "The demo went smoothly and the customer signed"})},
        {"q": "E5",
         "answer": ans(
             "Halfway through a project the legal team said we could not store the full card number. I stopped the work for one "
             "afternoon, wrote down what changed, and asked the engineers what the smallest change was. We stored only the last "
             "four digits and moved the launch by one week.",
             c={"evidence": "We stored only the last four digits and moved the launch by one week"},
             lang=[("stopped the work for one afternoon", "paused the work for an afternoon", "word_choice", "C", "“Paused” is more natural here.")])},
        {"q": "F3",
         "answer": ans(
             "Recently I learned to write the problem statement before I open a design tool. I started doing it in September. My "
             "briefs are now one page long and the designers ask fewer questions before they start.",
             c={"reflection": False, "result_type": "outcome", "evidence": "My briefs are now one page long"})},
        {"q": "G2",
         "answer": ans(
             "When Daniel joined as an associate PM, he did not know how to write a decision memo. I shared three of my old memos, "
             "I sat with him for his first one, and I asked him to present it to the team himself. After four months he wrote the "
             "memo for the pricing change alone, and the director approved it without edits.",
             c={"evidence": "After four months he wrote the memo for the pricing change alone"})},
        {"q": "G5",
         "answer": ans(
             "I had to tell the team that we were pausing the reporting project for the rest of the year. I called a short meeting, "
             "told them the reason, and answered questions. A few people were disappointed. I think it was the right way to do it.",
             c={"result": False, "result_type": "none", "evidence": "A few people were disappointed"},
             lang=[("a short meeting", "a quick meeting", "word_choice", "C", "Both work; “quick” is more usual.")]),
         "follow": ("What did you decide not to say, and why?",
                    ans("I did not say that the decision had surprised me too, because I thought it would make the team worry more. "
                        "I said what we knew and what we did not know yet."))},
    ],
    "debrief": {
        "verdict": "Solid across twelve questions; the one gap is that the lesson-learned answer stops before the lesson.",
        "strength": "Most answers say what you did and what changed, with a figure.",
        "next_step": "End every story with one sentence about what you would do differently.",
        "spots": [("content", "no_result")]},
})

# ============================================================================================ 5. VERY LONG ANSWERS
LONG_FIRST = (
    "So, the piece of work I am most proud of is the rebuild of our appointment scheduling for the clinics, and I want to give you "
    "the full picture because the context matters. Two years ago, when I joined Tessellate Health as a product lead, the scheduling "
    "tool was a legacy system that every clinic used slightly differently. Some clinics booked in fifteen-minute slots, some in "
    "thirty, and a few used paper calendars next to the system because they did not trust it. The front desk staff told me during "
    "my first month that double bookings happened almost every week, and that they spent roughly an hour a day calling patients to "
    "fix them. I started by shadowing three clinics for a day each. I sat at the front desk, I watched how people booked, and I "
    "wrote down every workaround I saw. I counted eleven different workarounds, and four of them were there because the system "
    "could not handle two doctors sharing one room. That was the first big finding, and it changed how I framed the project. It was "
    "not a scheduling problem, it was a resource problem: rooms, doctors and equipment all had to fit together. "
    "Then I wrote a proposal for the leadership team. I argued that we should not patch the old system, because every patch would "
    "make the next one harder, and I asked for a team of five for nine months. This was not easy. The chief financial officer asked "
    "me to show the return, so I built a simple model with the cost of double bookings, the cost of no-shows and the staff time. "
    "The model said we would recover the investment in about fourteen months, and he approved it with one condition: that we would "
    "migrate the clinics in waves and stop if the first wave failed. "
    "The first wave was four clinics, and I chose them on purpose. I picked two that liked us and two that were skeptical, because I "
    "wanted to learn from the people who would complain. I ran a weekly call with the clinic managers, and I kept a public list of "
    "every complaint with its status. In the first month we got ninety-three complaints. Most were small, like button labels and the "
    "order of fields, but eleven were serious, and three of them would have stopped us from continuing. One of them was that the new "
    "system showed times in the wrong timezone for the clinics near the border. I found out about it on a Friday evening from a "
    "clinic manager who called my personal phone, and I decided to stop the migration for the weekend, to call the other three "
    "clinics, and to ship the fix on Monday morning with an engineer on call. That weekend was tiring, but I think it is the moment "
    "where the clinics started to trust us. "
    "After the first wave we moved the remaining clinics, twenty-six in total, in six more waves over seven months. I trained the "
    "front desk staff myself for the first ten, and then I trained two clinic champions who trained the others. We measured three "
    "things: double bookings, no-shows and the time staff spent on the phone. Double bookings went from about eleven per week across "
    "all clinics to fewer than one. No-shows fell from fourteen percent to nine percent, mostly because of the reminder messages that "
    "the old system could not send. And the daily phone time dropped from an hour to about ten minutes per clinic. "
    "What makes me proud is not only the numbers. It is that two clinics that had threatened to leave us renewed for three years, and "
    "one of the managers wrote to our CEO to say it was the first software change that made her team's life easier. I also learned "
    "how to run a migration with a lot of people who are afraid of change, which I have used in every project since.")

LONG_LINK = (
    "https://docs.tessellate-health.example.com/product/launch-plans/2026/q3/reporting-module/"
    "staged-rollout-decision-record-final-v7-reviewed-by-engineering-and-support-and-sales-and-legal"
    "?utm_source=interview-practice&utm_medium=pasted-link&utm_campaign=speed-vs-quality-example-answer-do-not-share")

SESSIONS.append({
    "id": "demo-long-answers", "title": "Demo · Long answers · Tessellate Health · Product Lead", "days_ago": 5, "at": (10, 30),
    "round_type": "behavioural", "strictness": 2, "input": "voice", "vacancy_title": "Tessellate Health · Product Lead",
    "requests": 17, "limit_used": 0.9,
    "questions": ["B1", "E3", "D2", "G4", "H1"],
    "turns": [
        {"q": "B1",
         "answer": ans(LONG_FIRST, c={"evidence": "Double bookings went from about eleven per week across all clinics to fewer than one",
                                      "praise": "I picked two that liked us and two that were skeptical"}, wpm=128)},
        {"q": "E3",
         "answer": ans(
             "We had a launch date tied to a conference, and two weeks before it our new reporting module was still slow with big "
             "accounts. The choice was to ship on the date with a known performance problem, or to move the date and miss the "
             "conference. I decided to ship on the date, but only to accounts under five thousand rows, and to hold the large ones "
             "back until we fixed the query. I wrote the plan in a short document and shared it with sales, support and the two "
             "engineers, so that nobody would be surprised. The document is here if you want to see it: " + LONG_LINK + " "
             "Sales was unhappy because three of their biggest prospects were in the held-back group. I called each of those "
             "prospects myself and offered them an early access date and a call with the engineers. Two of them accepted and one "
             "went with a competitor. The large accounts got the module five weeks later, after the engineers rewrote the query, "
             "and the module has had no performance incidents since. If I did it again I would tell sales about the hold-back "
             "earlier, because they heard about it from the document and not from me. I would also add one more check: a load test "
             "on a copy of the biggest account's data, two weeks before the date, not one week.",
             c={"evidence": "the module has had no performance incidents since"})},
        {"q": "D2",
         "answer": ans(
             "A regional director asked me to add a field to the intake form so that clinics could record patients' insurance "
             "numbers. I thought it was risky because the form was already long and completion was falling. I asked him what "
             "problem he was trying to solve, and he said claims were being rejected for missing insurance data. So I proposed that "
             "we collect the number later, at check-in, when the patient has their card in hand. I tested it in two clinics for a "
             "month. Claim rejections fell from nineteen to six percent, and intake completion stayed the same. He accepted that, "
             "and the field was never added to the form.",
             c={"evidence": "Claim rejections fell from nineteen to six percent"}, wpm=140, pauses=4)},
        {"q": "G4",
         "answer": ans(
             "Our team wanted to build a custom messaging feature. I showed that two existing tools covered ninety percent of the "
             "need, and I proposed that we integrate instead of build. It took two meetings and a one-page comparison. We integrated "
             "in six weeks instead of building for five months, and the team spent the saved time on the scheduling fixes.",
             c={"evidence": "We integrated in six weeks instead of building for five months"}, wpm=145)},
        {"q": "H1",
         "answer": ans(
             "In the second week I would not change anything yet. I would write down what I see, ask the owner why it exists, and "
             "measure how often it fails. If it clearly costs time, I would propose a small change and test it with the owner's "
             "agreement, because a process is usually there for a reason that I might not know yet.",
             c={"voice": "i", "result": False, "result_type": "none"}, wpm=72),
         "follow": ("What if the person who owns that process is a senior colleague who likes it?",
                    ans("Then I would start by asking what it protects. If it protects something real, I would keep it and fix the "
                        "part around it. If not, I would show the owner the numbers first, in private, before I mention it to anyone "
                        "else.", wpm=130))},
    ],
    "debrief": {
        "verdict": "Strong stories with real numbers, but the longest answer ran over four minutes and the point arrived late.",
        "strength": "Your stories show decisions you made yourself and what they changed.",
        "next_step": "Time one answer and stop after two minutes: context in one sentence, then what you did.",
        "spots": [("delivery", "too_long")]},
})

# ============================================================================================ 6. MISHEARD WORDS
SESSIONS.append({
    "id": "demo-misheard", "title": "Demo · Misheard words · General questions", "days_ago": 6, "at": (18, 45),
    "round_type": "behavioural", "strictness": 2, "input": "voice", "requests": 13, "limit_used": 0.6,
    "questions": ["B2", "C2", "E4", "D4", "G2"],
    "turns": [
        {"q": "B2",
         "answer": ans(
             "I noticed that our support team was answering the same twenty questions every day, so I started a small help center. "
             "I used Notion to write the first fifteen articles, and I asked support to review them. I tracked the results in "
             "mixed panel. After two months, tickets about those topics dropped by about a quarter, and the support lead asked me "
             "to extend it.",
             c={"evidence": "tickets about those topics dropped by about a quarter"},
             lang=[("mixed panel", "Mixpanel", "word_choice", "N", "This may be a product name the app misheard.", "unconfirmed")],
             low=["mixed", "panel"], wpm=138)},
        {"q": "C2",
         "answer": ans(
             "Our chief of staff needed to understand why the data pipeline was failing every night. I drew a simple picture with "
             "three boxes, a post office, a sorting room and a truck, and I explained that the sorting room was too small for the "
             "volume of mail. She nodded and said that now she understood. I also gave her a one-page summary with the cost: about "
             "four hundred dollars a month.",
             c={"result": False, "result_type": "none", "evidence": "She nodded and said that now she understood"},
             lang=[("a post office", "the post office", "article", "N", "Add “the”: it is one specific post office in your picture.", "dismissed")],
             wpm=134)},
        {"q": "E4",
         "answer": ans(
             "Our designer and our engineer disagreed about whether to remove the second confirmation screen. I pulled the funnel "
             "data, and I saw that only two percent of people went back from that screen. I also watched five session recordings. "
             "Then I proposed to remove the screen for a two-week test. Conversion went up by three points and nobody went back to "
             "the old version.",
             c={"situation": False, "evidence": "Conversion went up by three points"}, wpm=141, edited=True)},
        {"q": "D4",
         "answer": ans(
             "A junior colleague, Priya, wrote release notes that were too technical for our customers. I asked her for a quick "
             "call and I said that I liked how complete her notes were, but customers could not use them. I showed her two examples "
             "from our best competitor, and we rewrote one together. I think it helped her a lot, and she is a good colleague now.",
             c={"situation": False, "voice": "mixed", "result_type": "vague", "evidence": "I think it helped her a lot, and she is a good colleague now"},
             lang=[("a quick call", "a short call", "word_choice", "N", "“Short call” is the usual pairing.", "dismissed"),
                   ("too technical for our customers", "too technical for our customers' needs", "word_choice", "N",
                    "The phrase may have been misheard.", "dismissed")],
             low=["Priya"], wpm=136)},
        {"q": "G2",
         "answer": ans(
             "When Daniel joined as an associate PM, he don't know how to write a decision memo. I shared three of my old memos, "
             "I sat with him for his first one, and I asked him to present it to the team himself. After four months he wrote the "
             "memo for the pricing change alone, and the director approved it without edits.",
             c={"result_type": "vague", "evidence": "the director approved it without edits"},
             lang=[("he don't know", "he didn't know", "tense", "N", "Use the past: “he didn't know”.", "confirmed"),
                   ("associate PM", "Associate PM", "word_choice", "C", "The title may have been misheard.", "unconfirmed")],
             low=["Daniel"], wpm=130)},
    ],
    "debrief": {
        "verdict": "Your first and third stories are specific; two others stop before the result. A few words were unclear and are not counted against you.",
        "strength": "The help-center and funnel stories give figures and name your own steps.",
        "next_step": "Check the words marked as misheard, then end each story with what changed.",
        "spots": [("content", "no_result"), ("language", "tense")]},
})

# ============================================================================================ 7. TOO SHORT
SESSIONS.append({
    "id": "demo-too-short", "title": "Demo · Too short · General questions", "days_ago": 7, "at": (12, 10),
    "round_type": "behavioural", "strictness": 2, "input": "voice", "requests": 6, "limit_used": 0.2,
    "questions": ["B3", "D1", "E1", "C2", "F4"],
    "turns": [
        {"q": "B3",
         "answer": ans(
             "At my last job I improved our trial-to-paid conversion. I looked at where trial users stopped, and I saw that most "
             "never connected a bank account. I added a short guided step that explained why we need it, and the conversion went "
             "from nine to thirteen percent in six weeks.",
             c={"evidence": "the conversion went from nine to thirteen percent in six weeks"}, wpm=100)},
        {"q": "D1", "said": ["Hmm, no idea, sorry.", "Let's skip it."]},
        {"q": "E1", "said": ["Pass."]},
        {"q": "C2", "said": ["I'd rather skip this."]},
        {"q": "F4",
         "answer": ans(
             "I had to learn payments compliance in a month when we started accepting cards. I read the provider's documentation, "
             "I asked our lawyer for a one-hour session, and I wrote a checklist that the team still uses. I became the person "
             "people ask about it within two months.",
             c={"evidence": "I wrote a checklist that the team still uses"}, wpm=100)},
    ],
})

# ============================================================================================ 8. ENDED EARLY
SESSIONS.append({
    "id": "demo-ended-early", "title": "Demo · Ended early · General questions", "days_ago": 8, "at": (9, 30),
    "round_type": "hr", "strictness": 1, "input": "voice", "requests": 5, "limit_used": 0.2,
    "questions": ["A1", "A3", "B1", "C4", "D3"], "closing": False,
    "turns": [
        {"q": "A1",
         "answer": ans(
             "I studied economics, and my first job was in customer support at a small software company. After a year I moved to "
             "the product team as an analyst, and I became a product manager at Lumen Ledger four years ago. This role is the natural "
             "next step because I want to own a whole product, not only one area of it.",
             c={"evidence": "I became a product manager at Lumen Ledger four years ago"}, wpm=130)},
        {"q": "A3",
         "answer": ans(
             "I would like to leave behind the slow decisions. In my current company, a small change needs four approvals, and I "
             "spent a month on a copy change last year. I am hoping to find a team where I can decide small things myself and ask "
             "for a review only on the big ones.",
             c={"result_type": "outcome", "evidence": "I spent a month on a copy change last year"}, wpm=128)},
    ],
})

# ============================================================================================ 9. ENGLISH PRACTICE
SESSIONS.append({
    "id": "demo-english", "title": "Demo · English practice", "mode": "english", "days_ago": 0, "at": (8, 50),
    "strictness": 2, "input": "voice", "requests": 9, "limit_used": 0.4,
    "turns": [
        {"answer": ans(
            "Hello Mike. Today I want to talk about my weekend. I go to the mountains with my friends and it was very beautiful.",
            lang=[("I go to the mountains", "I went to the mountains", "tense", "N", "Use the past tense for a finished trip.")],
            wpm=118, keep=("it was very beautiful", "A clear, natural way to finish the thought.")),
         "mike": "That sounds nice. Which mountains did you visit, and how did you get there?"},
        {"answer": ans(
            "We took a train until the small town and then we walked three hours. I am agree that walking is better than a car, "
            "because you can see everything.",
            lang=[("took a train until the small town", "took a train to the small town", "preposition", "N", "Use “to” for a destination."),
                  ("I am agree", "I agree", "word_choice", "N", "“Agree” is a verb, so there is no “am”.")],
            wpm=112, keep=("you can see everything", "Short and natural.")),
         "mike": "Three hours is a long walk. What did you carry with you?"},
        {"answer": ans(
            "I carried a big backpack with water, sandwiches and a warm jacket. My friend, he forgot his jacket and he was cold, so "
            "I gave him my second sweater.",
            lang=[("My friend, he forgot", "My friend forgot", "word_choice", "C", "The subject is said twice.")],
            wpm=124, keep=("so I gave him my second sweater", "A good use of “so” to give a reason and a result.")),
         "mike": "That was kind of you. What was the best moment of the trip?"},
        {"answer": ans(
            "The best moment was the sunset. I am agree with my friends that it was the most beautiful view of this year. We stayed "
            "there one hour and nobody spoke.",
            lang=[("I am agree", "I agree", "word_choice", "N", "“Agree” is a verb, so there is no “am”."),
                  ("stayed there one hour", "stayed there for one hour", "preposition", "N", "Use “for” with a length of time.")],
            wpm=108, keep=("nobody spoke", "Simple and strong.")),
         "mike": "A quiet hour after a long walk sounds perfect. How do you usually spend your weekends?"},
        {"answer": ans(
            "Usually I stay at home. I work on my English since two years and on weekends I watch films without subtitles. It is "
            "difficult but I learn a lot of new words.",
            lang=[("I work on my English since two years", "I have worked on my English for two years", "tense", "N",
                   "Use the present perfect with “for” and a length of time.")],
            wpm=88, keep=("I watch films without subtitles", "A clear description of a habit.")),
         "mike": "Which film did you watch last?"},
        {"answer": ans(
            "Last week I watched a comedy about a family who moves to a new city. I laughed a lot, but I did not understand some "
            "jokes because the actors spoke very fast.",
            wpm=122, keep=("I laughed a lot", "Natural, and the tense is right.")),
         "mike": "Fast speech is hard. What helps you understand more?"},
        {"answer": ans(
            "I try to repeat small parts of the dialogue. Also, my colleague explained me some expressions, so now I understand more.",
            lang=[("explained me", "explained to me", "preposition", "N", "“Explain” takes “to” before the person.")],
            wpm=120, keep=("I try to repeat small parts of the dialogue", "A concrete method.")),
         "mike": "That's a good habit. Is there anything you want to practise next time?"},
        {"answer": ans(
            "Yes, I want to practise phone calls with customers. My boss explained me that clear phone calls are very important for "
            "my job, and I am nervous about them.",
            lang=[("explained me", "explained to me", "preposition", "N", "“Explain” takes “to” before the person.")],
            wpm=114, keep=("I am nervous about them", "Correct and natural.")),
         "mike": "Okay. Let's do that next time. Thanks for talking with me today."},
    ],
})

# ============================================================================================ 10. VACANCY-BASED
V_QUESTIONS = {
    "V1": {"id": "V1", "competency": "B", "source": "cv_jd", "anchor": "own the signup-to-first-booking funnel",
           "text": "Brightline wants someone to own the signup-to-first-booking funnel. Tell me about a funnel you owned and what you changed in it.",
           "follow_ups": [{"tag": "WD", "text": "Which step did you change yourself, and why that one?"}]},
    "V2": {"id": "V2", "competency": "E", "source": "cv_jd", "anchor": "run weekly experiments with design and engineering",
           "text": "You would run weekly experiments with design and engineering. Describe an experiment that changed what you built next.",
           "follow_ups": [{"tag": "WD", "text": "Who decided what to ship?"}]},
    "V3": {"id": "V3", "competency": "C", "source": "cv_jd", "anchor": "talk to clinic managers every week",
           "text": "You will talk to clinic managers every week. Tell me about a time a customer conversation changed your plan.",
           "follow_ups": [{"tag": "WD", "text": "What did you decide personally?"}]},
    "V4": {"id": "V4", "competency": "D", "source": "cv_jd", "anchor": "write clear one-page briefs for the team",
           "text": "The role includes writing clear one-page briefs for the team. Tell me about a time a brief of yours was challenged.",
           "follow_ups": [{"tag": "YP", "text": "What did you change in the brief afterwards?"}]},
    "V5": {"id": "V5", "competency": "A", "source": "cv_jd", "anchor": "turn walk-in enquiries into booked appointments",
           "text": "Brightline helps small clinics turn walk-in enquiries into booked appointments. Why Brightline, and why now?",
           "follow_ups": [{"tag": "CT", "text": "What worries you about the role?"}]},
}

SESSIONS.append({
    "id": "demo-vacancy", "title": "Demo · Brightline · Product Manager, Growth", "days_ago": 10, "at": (17, 0),
    "round_type": "behavioural", "strictness": 2, "input": "voice", "vacancy_id": "demo-vac-brightline",
    "vacancy_title": "Brightline · Product Manager, Growth", "requests": 15, "limit_used": 0.8,
    "questions": [V_QUESTIONS[k] for k in ("V1", "V2", "V3", "V4", "V5")],
    "turns": [
        {"q": "V1",
         "answer": ans(
             "Last year I owned the signup-to-activation funnel at Lumen Ledger. We saw that only 34 percent of new accounts sent "
             "their first invoice in the first week. I mapped the funnel and found a big drop at the step where users had to import "
             "their client list. We decided to make the import optional and to let people send a first invoice with one client "
             "typed by hand. That change went live in March, and the first-week rate went to 47 percent.",
             c={"voice": "mixed", "evidence": "the first-week rate went to 47 percent",
                "praise": "I mapped the funnel and found a big drop at the step where users had to import their client list"},
             wpm=139)},
        {"q": "V2",
         "answer": ans(
             "We ran an experiment on the pricing page, where we tested showing the annual price first. The designer made two "
             "versions and the engineer set up the test. We ran it for three weeks with around nine thousand visitors. The "
             "annual-first version had twelve percent more trial signups, so we shipped it and then we changed the plan comparison "
             "table based on that.",
             c={"voice": "we", "evidence": "The annual-first version had twelve percent more trial signups"},
             lang=[("based on that", "based on those results", "word_choice", "C", "“That” is vague; name what the change was based on.")],
             wpm=143)},
        {"q": "V3",
         "answer": ans(
             "In my last job, in the first month on the invoicing product, we talked to twelve small accountants about reminders, "
             "and we heard that they did not care about reminders, they cared about being paid the same day. That changed our plan, "
             "so we dropped the reminders redesign and we built an instant-pay option. We launched it in June, and the customers "
             "liked it.",
             c={"voice": "we", "result_type": "vague", "evidence": "We launched it in June, and the customers liked it"},
             lang=[("we talked to twelve small accountants", "we spoke to twelve small accountants", "collocation", "C",
                    "“Speak to” is the usual pairing here.")], wpm=137),
         "follow": ("What did you decide personally?",
                    ans("I decided to drop the reminders redesign, which my director did not like at first. I showed her the interview "
                        "notes and she agreed to a two-month test.", wpm=128))},
        {"q": "V4",
         "answer": ans(
             "I wrote a one-page brief for the bank-sync project, and the engineering lead challenged the scope because it included "
             "a reconciliation view. I listened to his points, I removed the reconciliation view from version one, and I added a "
             "short section called Not now to the brief. We shipped version one in six weeks instead of ten, and reconciliation "
             "came later as version two.",
             c={"evidence": "We shipped version one in six weeks instead of ten"}, wpm=141)},
        {"q": "V5",
         "answer": ans(
             "I want to work on growth for a product with real customers every week. Brightline's focus on clinics is interesting to "
             "me because my mother runs a small physiotherapy practice, and I have seen how many calls she misses. I am looking for "
             "a team that runs experiments weekly, which is how I like to work, and I think I can start contributing in the first "
             "month.",
             c={"result_type": "outcome", "evidence": "I think I can start contributing in the first month"}, wpm=135),
         "follow": ("What worries you about the role?",
                    ans("The speed of the experiments. At Lumen Ledger a test takes a month to ship, and I worry that I will be "
                        "frustrated if Brightline is slow too. I would ask about it in my first week.", wpm=132))},
    ],
    "debrief": {
        "verdict": "A clear funnel story and a well-argued brief, but in three answers the key decision is “we”: say which call was yours.",
        "strength": "You tie each story to the job: funnel, experiments, customer calls and briefs.",
        "next_step": "Retell the pricing and customer-call stories with one sentence that starts with “I decided”.",
        "spots": [("content", "we_not_i")]},
})

# ============================================================================================ 11. DRILL
SESSIONS.append({
    "id": "demo-drill", "title": "Demo · Drill · Brightline · Product Manager, Growth", "days_ago": 9, "at": (17, 30),
    "round_type": "behavioural", "strictness": 2, "input": "voice", "vacancy_id": "demo-vac-brightline",
    "vacancy_title": "Brightline · Product Manager, Growth", "requests": 9, "limit_used": 0.5,
    "questions": [V_QUESTIONS["V2"], V_QUESTIONS["V3"], "E4"],
    "turns": [
        {"q": "V2",
         "answer": ans(
             "I ran a pricing page experiment where I tested showing the annual price first. I wrote the hypothesis, I asked the "
             "designer for two versions, and I decided the test would stop after nine thousand visitors. The annual-first version "
             "had twelve percent more trial signups, and I decided to ship it to everyone, because the cost of rolling back was one "
             "line of code.",
             c={"evidence": "The annual-first version had twelve percent more trial signups",
                "praise": "I decided the test would stop after nine thousand visitors"}, wpm=138)},
        {"q": "V3",
         "answer": ans(
             "In my first month on the invoicing product, I talked to twelve small accountants. I expected them to ask for better "
             "reminders, but nine of them said they wanted to be paid the same day. I decided to drop the reminders redesign and I "
             "wrote a one-page case for an instant-pay option. We launched it in June, and thirty-one percent of paying accounts "
             "turned it on in the first quarter.",
             c={"evidence": "thirty-one percent of paying accounts turned it on in the first quarter",
                "praise": "I decided to drop the reminders redesign"}, wpm=140)},
        {"q": "E4",
         "answer": ans(
             "Our designer and our engineer disagreed about removing the second confirmation screen. I pulled the funnel data and "
             "saw that only two percent of users went back from that screen. I proposed a two-week test without it. Conversion went "
             "up by three points, and I removed the screen for everyone.",
             c={"evidence": "Conversion went up by three points"},
             wpm=142),
         "follow": ("What was your personal call, and what did you give up?",
                    ans("My call was to ship the change without a second test. I gave up a cleaner proof, and I accepted that if "
                        "conversion dropped I would roll back within a day.", wpm=130))},
    ],
    "debrief": {
        "verdict": "Your decisions are now yours: each answer says what you decided and what changed.",
        "strength": "You name the call, the number and the cost of reversing it.",
        "next_step": "Run the drill again in a week, then try a full round.",
        "spots": []},
})

# ============================================================================================ 12. ARCHIVED
SESSIONS.append({
    "id": "demo-archived", "title": "Demo · Archived · Northwind Logistics · Product Owner", "days_ago": 9, "at": (9, 0),
    "round_type": "mix", "strictness": 2, "input": "voice", "vacancy_title": "Northwind Logistics · Product Owner",
    "requests": 8, "limit_used": 0.3, "archived": True, "closing": False,
    "questions": ["A3", "B4", "D5", "E5", "G3"],
    "turns": [
        {"q": "A3",
         "answer": ans(
             "I would like to leave behind the slow decisions. In my current company, a small change needs four approvals, and "
             "I spent a month on a copy change last year. I am hoping to find a team where I can decide small things myself and ask "
             "for a review only on the big ones.",
             c={"result_type": "vague", "evidence": "I am hoping to find a team where I can decide small things myself"}, wpm=130)},
        {"q": "B4",
         "answer": ans(
             "When I took over the carrier tracking page it had thirty open bugs and no owner. I closed the duplicates, grouped the "
             "rest into four themes, and talked to the warehouse leads about which ones hurt them most. I started with the two themes "
             "that blocked them from printing labels.",
             c={"result": False, "result_type": "none", "evidence": "I started with the two themes that blocked them from printing labels"},
             wpm=132)},
        {"q": "D5",
         "answer": ans(
             "I was sure that drivers wanted a route planner in the app, until I read the usage data: most of them used the one "
             "their dispatcher sent. I told the team I was wrong and I moved the planner to later. We improved the dispatcher view "
             "first, and late deliveries went down by six percent.",
             c={"situation": False, "evidence": "late deliveries went down by six percent"}, wpm=137)},
    ],
    "debrief": {
        "verdict": "Your examples are specific, but one story stops before the result. Three answers were enough for a first read.",
        "strength": "You changed your mind from data and said so plainly.",
        "next_step": "Finish the tracking-page story with what changed after the label fix.",
        "spots": [("content", "no_result")]},
})
