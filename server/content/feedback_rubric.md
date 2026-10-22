# Feedback rubric: content, language, delivery

> Content kit · 2026-10-20 · Serves F24 (layered panel), F25 (layer order), F26 (say-it-like-this), F27 (heard as…), F29 (delivery metrics), F30 (debrief), F32 (mistake memory), F39 (English track).
> Rules from the PRD that this rubric must respect: GR6 (nothing while speaking), GR9 (STT errors never count), principle 3 (one fix per layer, with a reason, reversible), US-15 AC3 (a layer with nothing to fix says so; no invented fixes), US-17 AC3 (no "correcting" of correct text).
> 🟡 = assumption, thresholds to be tuned at stage 12 with real recordings.

## 0. Principles

1. **Honest, not harsh.** A weak answer is called weak, in neutral words, with the reason. Never "Great answer!" for a weak one. Praise only what is true and specific ("You gave a number: 61% to 78%").
2. **One fix per layer.** The panel shows at most one fix per layer, the one with the highest severity. Language may show up to three phrasings (see §3.3), but they all serve one fix.
3. **A layer with nothing to fix says so** in one line ("Nothing to fix here"). Never invent a flaw to fill the slot.
4. **Layers cascade.** Freezing often starts as a content gap (no ready follow-up), then a missing word, then silence (int N1, X1). The content layer therefore carries the "cause" label: if the delivery problem is a long pause before a follow-up and the content has a gap, the cause is shown as content.
5. **Practice only (D7).** The feedback never helps in a live interview. Copy says "for your practice".
6. **Order is configurable (D4).** The rubric defines three independent layer objects. The app orders them by the config value `content-first` or `delivery-first`. The rubric text never assumes an order.
7. **Domain terms are not errors.** Tool names, product names, framework words, company names and acronyms are never corrected (see §3.5).
8. **Layers are measured on the transcript, never on audio emotion.** No emotion or voiceprint inference (Won't, CA §14).

## 1. Severity levels (all layers)

| Level | Name | Meaning | Shown in panel |
|---|---|---|---|
| S0 | None | Nothing to fix | One line: "Nothing to fix here." |
| S1 | Polish | Optional improvement; an interviewer would not notice | Hidden by default; appears only if the layer has no S2/S3 and the user opens "more" |
| S2 | Improve | An interviewer would likely notice; weakens the answer | The one fix of the layer |
| S3 | Critical | Answer fails its job: missing result or "own part", a meaning-changing error, an unclear message | The one fix of the layer, marked as priority; goes into the debrief weak spots |

Selection rule: pick the highest severity in the layer; if tied, pick the one that is earlier in the answer. Only S2 and S3 enter mistake memory (F32), and only if the user did not dismiss them (GR9).

## 2. Content layer

Judges what the answer says, not how it sounds. Needs the question, the transcript, and (when available) the user's CV facts.

### 2.1 Checks

| Check | Question to ask of the transcript | Pass | Fail |
|---|---|---|---|
| C1 STAR completeness | Are there: **S**ituation (where/when, in one or two sentences), **T**ask (what was needed from the speaker), **A**ction (what the speaker did, step by step), **R**esult (what happened)? | S, A and R present (T may merge into S) | Missing A or R = S3; missing S only = S2 |
| C2 "I" vs "we" | Who does the actions? Count first-person singular action verbs ("I designed", "I decided") against plural ("we built", "the team did") and passive ("it was decided") | At least half the action sentences have "I" | Almost all "we"/passive = S3; mixed but key decision is "we" = S2 |
| C3 Result with a number | Is there a result that is a number, a before/after, or a clear concrete change? | Number or concrete observable change | "It went well", "everyone was happy" = S2; no result at all = S3 |
| C4 Relevance | Does the answer address the question asked, and the competency? | Answers the question in the first 2 sentences | Tells a different story = S3; drifts or background-heavy (more than half is setup) = S2 |
| C5 Reflection | If the question invites it (failure, learning, "differently"): is there a learning or change in behaviour? | One concrete lesson | Generic ("I learned communication is important") = S1/S2 |
| C6 Specificity | Concrete names, dates, tools, numbers instead of slogans | At least 2 concrete details | Only slogans = S2 |

Rules:
- NDA or anonymised numbers ("double-digit growth", "a large fintech") count as valid results. Never ask for a real client name. 🟡
- If the answer is a hypothetical question (competency H), skip C2 and C3; check instead: first concrete step, a clarifying question, one risk named. Ask whether it happened for real.
- The "one fix" is the **lowest-numbered failed check with the highest severity**, written as an instruction, e.g. "Add what happened in the end, with a number."
- The "stronger version" (rewrite, toggle in panel): same facts as the user said, tighter structure, **no invented facts or numbers**. If a result is missing, the rewrite contains a visible placeholder like `[add your result]` rather than a made-up one.

### 2.2 Examples (question: "Tell me about a time you pushed back on a stakeholder's request." — fictional)

**Weak (S3, no own part, no result):**
> "Yes, so, we had a project and the marketing team wanted to change the homepage a lot. We discussed and we decided to do a smaller change. It was a good decision for everyone."

Why: all "we"; no action by the speaker; "good decision for everyone" is not a result.
Fix shown: "Say what *you* did in the conversation, and end with a result you can count."
Interviewer follow-up: `YP` "What exactly did you say to them?"

**Medium (S2, has structure, vague result):**
> "Last spring marketing asked me to put a big banner on the homepage before a launch. I showed them the click data from the last two banners, which were almost ignored, and proposed a smaller test instead. They agreed. The launch went fine."

Why: situation, own action, evidence are good; result "went fine" is vague.
Fix shown: "Replace 'went fine' with what you measured, e.g. clicks or sign-ups."

**Strong (S0 content):**
> "Last spring marketing asked for a full-width banner on the homepage a week before launch. I was worried it would push the sign-up form below the fold, so I pulled the click data from two earlier banners: under 1% clicks. I proposed a smaller banner as an A/B test and offered to build both in a day. They agreed. The small banner got 2.4% clicks and sign-ups stayed flat instead of dropping, so we kept it. I now ask for data on past banners before the first meeting."

Panel line: "Nothing to fix here. Strong: your own action, evidence, number, and a lesson."
Honest note: even strong answers can get a follow-up `CT` ("What would you have done if they refused?"), but the interviewer does not force one on a complete answer.

### 2.3 Content fix wording (templates the model may adapt)

| Failed check | Fix text (≤ 20 words) |
|---|---|
| C1 missing R | "Finish with what happened: one result, ideally a number." |
| C1 missing A | "Say what you did, step by step, not only what the situation was." |
| C2 | "Switch 'we' to 'I' for the steps you personally did." |
| C3 vague | "Replace 'it went well' with something you can count or compare." |
| C4 | "Answer the question in your first sentence, then add background." |
| C5 | "End with one thing you would do differently." |
| C6 | "Add one concrete detail: a tool, a date, or a number." |

## 3. Language layer

Judges how the English works, never what the content is. Only what an interviewer would notice or misunderstand matters. The speaker is a non-native; the goal is a clear, natural answer, not a native accent or perfect grammar.

### 3.1 What is a "meaning-changing" error

| Class | Test | Severity | Examples (said → better) |
|---|---|---|---|
| **M: meaning-changing** | A listener could understand a different thing, or cannot tell what was meant | S3 (S2 if context clarifies) | "I was responsible *to* the project" → "responsible *for*"; "We *didn't* launch it" when they meant "didn't plan to"; wrong tense that moves the time ("I lead the team" for a past role → "I led"); "actual" for "current" ("my actual job" → "my current job"); "I *control* the quality" → "I *check*/*own* the quality" |
| **N: noticeable, meaning intact** | The meaning is clear but it sounds non-professional or repeated | S2 | missing third-person -s repeated in several sentences; wrong preposition in a key phrase ("discuss about the problem" → "discuss the problem"); wrong collocation ("do a decision" → "make a decision") |
| **C: cosmetic** | A listener would not notice or does not care | S1 or ignore | single missing article ("the" / "a") in an otherwise clear sentence; plural slip; small preposition slips ("in/on") that do not hinder |

Rules:
- **Repeated beats single.** A cosmetic pattern that appears 3+ times in one answer, or in 3 sessions, is promoted one level (S1 → S2).
- **Never fix a sentence that is already acceptable.** If the original is natural enough, produce no correction. "Non-native but correct" is not an error (US-17 AC3).
- **Never rewrite meaning.** If the speaker's content is unclear, say so in the content layer, not here.
- **Articles:** report at most one article pattern per answer ("You often drop 'the' before a noun that is specific"), only when it appears 3+ times. 🟡
- Code-switching (a Russian word mid-sentence, E3): do not flag the word as an error. Offer the English equivalent only if the user asks, or as `S1` "word to learn".

### 3.2 Word choice

Flag only when the chosen word is wrong, vague, or reads as unprofessional in an interview context.

| Issue | Example | Better |
|---|---|---|
| Wrong word, close meaning | "I made a research with users" | "I ran a study with users" / "I did user research" |
| Too vague or generic | "We did many things" | "We shipped three changes: …" |
| Informal filler words that weaken | "kind of", "stuff", "things" repeated | the specific noun |
| False friend | "the *decision* of the problem" | "the *solution* to the problem" |
| Overly formal / bookish | "I shall endeavour to" | "I'll try to" |

### 3.3 "Say it like this" (F26)

For each language fix show:
1. **Original** fragment, copied exactly from the transcript (the app verifies it is a substring; otherwise the item is dropped).
2. **1–3 native-sounding phrasings** (at most 3; the first is the closest to the original meaning).
3. **One-line reason**, plain language, ≤ 15 words, no jargon ("'make a decision' is the usual pairing").
4. **Level label** (A2–C1) of the better phrasing so the user knows it is within reach.
5. **Buttons**: "This is correct" / "This is a term" / "That's not what I said" (the last leads to the STT flow).

Example:
- Original: "I did a decision to stop the feature."
- Say it like this: "I made the decision to stop the feature." · "I decided to stop the feature." · "I took the call to stop the feature." (this one: B2, informal)
- Reason: "'Make' (not 'do') is the usual verb with 'decision'."

Do not give three phrasings where one is enough. Never give a phrasing that changes the facts.

### 3.4 Language layer: what it ignores

- **Domain terms and names.** Anything that looks like a product, tool, framework, company, acronym or CamelCase: Figma, Storybook, design tokens, Kubernetes, Jira, OKR, B2B, Series B, the user's employers. Never "correct" them, never flag spelling.
- **Words from the user's personal vocabulary** (F16) and from the CV/JD text.
- **Accent or pronunciation.** The app has no pronunciation scoring in the MVP; the transcript is the only evidence.
- **Spoken-language grammar that is normal in speech:** contractions, sentence fragments, starting with "and/but", "gonna". They are fine in an interview.
- **Punctuation and capitalisation** (these come from the recogniser).
- **Repetition and false starts**: these belong to delivery.

### 3.5 Severity example set

| Said | Verdict | Output |
|---|---|---|
| "I lead the team of five designers." (said about a past job) | S3 M: tense moves time | "I led a team of five designers." Reason: "Past job, past tense." |
| "We discuss about the timeline." | S2 N | "We discussed the timeline." Reason: "No 'about' after 'discuss'." |
| "I worked on Figma and Storybook." | S0 | No correction (terms) |
| "He have a good idea." | S2 N | "He had a good idea." Reason: "Singular 'he' takes 'has', and a past story takes 'had'." |
| "I gave presentation to the board." | S1 C | Hidden by default |

## 4. Delivery layer

Judges the shape of the speaking, from numbers the app computes. The model does not guess these; it only phrases the tip. All thresholds are 🟡 and must be tuned with real recordings at stage 12; show the number and its target, not a judgement of the person.

### 4.1 Metrics (computed in code, F29)

| Metric | How | Target (🟡) | S2 if | S3 if |
|---|---|---|---|---|
| Pace (words per minute) | words ÷ speaking minutes, silence excluded | 110–160 | below 95 or above 175 | below 80 or above 195 |
| Answer length | seconds and words | 60–150 s, 150–350 words, behavioural | under 30 s or over 180 s | under 15 s or over 240 s |
| Fillers per 100 words | "um", "uh", "like" (as filler), "you know", "so" (sentence-initial, repeated), "basically", "actually", "kind of" | up to 3 | 4–7 | 8 or more |
| Long pauses (if the engine gives timestamps) | gaps of 2.5 s or more inside an answer | up to 1 | 2–3 | 4 or more |
| Response latency (before starting) | time from end of question to first word | up to 6 s: normal thinking, never penalised | not scored | not scored |
| Restarts | repeated first words ("I… I… I was…") | up to 2 | 3–5 | 6 or more |

Notes:
- Response latency is **not penalised**. Thinking is part of a good answer (E7). It only matters if it is followed by a freeze with no recovery phrase; then the tip points to the time-buying pack.
- 🟡 Recognisers may remove fillers; the panel notes "fillers may be undercounted with this engine" (F29 AC3). Never state a filler count as exact.
- In text mode: only length is shown; pace and fillers say "not available in text mode" (US-19 AC4). Typed answers run shorter than spoken ones, so text length bands are wider (🟡): S2 under 25 or over 420 words, S3 under 12 or over 560 words. Restarts are counted in voice mode only.
- Delivery tips speak only about length, pace, fillers and pauses. What to add or cut (action, result, structure) is the content layer's job (2026-10-20: a "too short" tip that said "add what you did" read as content advice).
- Count only fillers present in the recognised text. A filler line the user marks "that's not what I said" is removed from the count (GR9).
- One fix: the highest severity metric. Tip text templates:

| Metric | Tip (≤ 18 words) |
|---|---|
| Pace too fast | "Slow down at the end of each sentence; a short stop helps you and the listener." |
| Pace too slow | "Your pace was slow. Prepare the first sentence so you can start smoothly." |
| Too long | Voice: "Long answer. Aim for one to two minutes, then stop and let the interviewer ask." Text: "Long for a spoken answer. Main answers are usually 150 to 350 words." |
| Too short | Voice: "Short answer. Main answers usually take one to two minutes out loud." Text: "Short for a spoken answer. Main answers are usually 150 to 350 words." |
| Fillers | "Replace 'um' with a silent pause. Try 'let me think' once at the start." |
| Long pauses | "When you stall, use a phrase: 'The key point is…' (see Phrase packs)." |
| Restarts | "Plan your first five words: 'In my last project, I…'" |

### 4.2 Cascade note

If a delivery fix is S2/S3 and the same answer has a content gap (S2/S3), the panel shows beside the delivery fix: "Likely cause: content. Fix the content first." This follows int N1 (layers cascade) and is not a claim about the person.

## 5. STT uncertainty rules (GR9, F27, F28)

The transcript comes from a recogniser that makes mistakes, especially with accents and domain terms. The system must never present a recogniser mistake as the user's mistake.

1. **"Heard as…" on every language flag.** Show the exact fragment the recogniser produced.
2. **Suspicion test (code first, model second).** Mark an item "possibly misheard" when any of the following holds:
   - the flagged word is not in a general English word list and not in the user's vocabulary;
   - the flagged word is a near-homophone of a term in the vocabulary (e.g. "figure" ↔ "Figma", "story book" ↔ "Storybook");
   - the sentence is grammatically odd *and* semantically nonsensical (a sign of mishearing, not of a grammar error);
   - the engine reports per-word confidence below the threshold (F28, v1.1, 🟡 about 0.6; when the engine gives none, this rule is off).
3. **A "possibly misheard" item is never counted.** It is shown as: *"Heard as: 'story book'. Did you say 'Storybook'?"* with one-click answers (yes / no, correct it for me). It does not enter mistake memory, delivery counts or debrief until the user confirms it was said.
4. **Never correct a word with low confidence.** Do not output a "better" phrasing for any fragment that contains a possibly-misheard word. If the fragment is the only error in the answer, the language layer says "Nothing to fix here" plus a small note "1 word may be misheard".
5. **Do not fix what was not said.** The model must not produce a "better" phrasing whose original is not an exact substring of the transcript. The app drops such items (hallucination guard).
6. **Repeated misrecognition** of the same word in a session (3 times) suggests "a microphone or engine check" rather than blaming the user (F28 AC2).
7. **Code-switching** (E3): non-English words are left untouched, not counted as errors, and not sent to the language layer.
8. **Rejected flags** ("That's not what I said") are removed, optionally corrected by the user, and added to a session-level ignore list; the same fragment is not flagged again.
9. **Do not drop honest uncertainty to look smart.** If the model is unsure whether something is an error, it outputs no correction. For a layer with doubts, prefer S1 hidden over S2 shown.

## 6. English track variant (F39, D9)

Here the speaker practises general English, not an interview. Differences:
- Only the language layer exists; content and delivery layers are hidden (US-24 AC3).
- Corrections come **after each turn**, never during speech (GR6), with reason and level label.
- Calibrate to the selected level A2–C1: do not teach C1 phrasing to an A2 learner; the "better" phrasing is at most one level above the selected level.
- Up to 2 corrections per turn plus 1 "phrase to keep"; if the turn is fine, say so.
- Meaning-changing > noticeable > cosmetic, same as §3.1. At A2 only M and frequent N are shown.
- Recurring errors feed phrase review (US-24 AC4).

## 7. Output contract (summary)

Each answer yields three layer objects plus an optional rewrite. The JSON schemas are in `prompts_draft.md` (P2a content, P2b language; delivery is built by code from §4). Every layer object has `status` (`ok` / `fix`), `severity` (0–3), `fix`, `reason`. Layers are stored with their `layer` tag and `tag` (stable key, e.g. `no_result`, `we_not_i`, `article_the`, `filler_high`) so that mistake memory can count recurrences (F32).

Stable tags 🟡: `no_star_action`, `no_result`, `vague_result`, `we_not_i`, `off_topic`, `no_reflection`, `too_vague`, `meaning_error`, `collocation`, `tense`, `article`, `preposition`, `word_choice`, `pace_fast`, `pace_slow`, `too_long`, `too_short`, `filler_high`, `long_pauses`, `restarts`.

## 8. Test set to build later (stage 12)

Keep 20 short transcripts, each with a hand-made expected output: 5 weak, 5 medium, 5 strong, 5 with STT noise (misheard terms, code-switching, dropped fillers). Pass criteria 🟡: zero corrections on correct text; zero "better" phrasings that change facts; zero counted STT errors; the same severity ±1 on at least 80% of items. This is how the small local model is accepted or rejected for each prompt.

## Note from synthetic 09-r2 (2026-10-20) 🟡
"we → I" (`we_not_i`) can feel unfair for genuine team work. Proposed rule for stage 12: raise it only when the answer contains **no individual action at all** (`n_i == 0` and `voice == "we"`); for `mixed`, show it as a tip ("say which part was yours"), not as the main fix.
