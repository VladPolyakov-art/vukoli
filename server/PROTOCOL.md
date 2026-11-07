# Session WebSocket protocol

Endpoint: `ws://127.0.0.1:8000/ws/session` (alias `/ws/voice`).
Source of truth: `server/ws.py` (socket loop), `server/session.py` (local interviewer), `server/feedback.py`
(feedback records). This document describes protocol version 1 (`data_version: 1`).

## Connection rules

- **Origin check.** A browser page must come from the same host as the server, or from a dev origin
  (`http://localhost:5173`, `http://127.0.0.1:5173`; override with `IC_DEV_ORIGINS`). Other origins are closed
  with code `1008` before `accept`. Clients that send no `Origin` header (CLI, tests) are allowed.
- **First message** must be `start` within 30 s, otherwise the server sends `error` `bad_start` and closes.
- **Frames.** JSON text frames for control and events. Binary frames carry audio:
  - client to server: 16 kHz mono signed 16-bit little-endian PCM, at most 65,536 bytes per frame, even length;
  - server to client: 24 kHz mono signed 16-bit little-endian PCM (Kokoro or Gemini Live), 9,600-byte frames
    (0.2 s), played in order. Audio belongs to the current Mike turn (between `turn_start` and `response_complete`).
- **Limits.** A JSON frame is at most 12,000 characters; a typed turn at most 4,000 characters; an answer is
  recorded for at most 4 minutes. A violation ends the session with `error` `session_failed` (the transcript so
  far is still saved).
- **Save on exit.** When the socket closes for any reason, the server saves the session if the user answered at
  least once, then makes the feedback and the debrief (D96, below). If the socket is still open it sends `saving`,
  `session_saved`, `feedback_progress` / `feedback` per answer, `debrief_pending` and `debrief`, then closes.
- **Feedback after the call (D96).** While a session is live the server runs nothing but Mike, speech recognition
  and speech synthesis: no feedback event and no feedback model call, and no second (word-timing) recognition pass.
  It only keeps each answer's record and, for a voice answer, its recording (at most 45 minutes of audio in memory
  for the whole session; an answer that does not fit just gets no word timings). After End the answers are worked
  through in the order they were given: word pass, delivery, language, content. The record is saved first (with
  `post_call`, below) and again after every answer, so the work is finished and saved even when the window or the
  socket is closed right after End. The working time is `60 s + 120 s per answer`, at most 1 hour; time spent
  waiting because another live call has the machine is not counted. An answer that does not get all its layers in
  time is closed with those layers `unavailable` (`code`: `timeout`). If the server itself stops, the next start
  (or the next time the session is opened) closes the unfinished answers with `code: "interrupted"` and builds the
  debrief without a model.

## Client to server

### `start` (required, first)

```json
{
  "type": "start",
  "mode": "interview",
  "round_type": "mix",
  "questions": 5,
  "strictness": 2,
  "level": "B1",
  "input": "voice",
  "vacancy_id": "v-20261020-101500-a1b2c3",
  "voice": "am_michael",
  "speak": true,
  "suggest": false,
  "topic": "",
  "engine": "ollama"
}
```

| Field | Values | Default |
|---|---|---|
| `mode` | `interview`, `english`, `quick` (see below) | `interview` |
| `round_type` | `hr`, `behavioural`, `mix` (interview only) | `mix` |
| `questions` | 1 to 10 main questions | settings `questions_per_session` |
| `strictness` | 1 gentle, 2, 3 demanding (follow-ups per question: 1, 2, 2) | settings |
| `level` | `A2`, `B1`, `B2`, `C1` (`B1+` is read as `B1`) | settings |
| `input` | `voice` (server recognises speech), `browser_stt` (client sends recognised text), `text` | `voice` |
| `vacancy_id` | id from `GET /api/vacancies`; its generated questions come first | none |
| `voice` | Kokoro voice id from `GET /api/voices` | settings, else `am_michael` |
| `speak` | `false` for text-only replies | `true` (ignored when Kokoro is not installed) |
| `suggest` | turn the answer suggester on (only if settings `answer_suggester` is true) | `false` |
| `drill` | `true` marks a weak-spot drill (interview only): the saved session is named "Drill · Company · Role" (or "Drill · General questions") | `false` |
| `focus` | with `drill`: up to 6 weak spots to work on, `[{"layer": "content", "tag": "we_not_i"}]` (layer `content`/`language`/`delivery`, tag as in the debrief). Anything else is `bad_start`. Content tags (`we_not_i`, `no_star_action`, `no_result`, `vague_result`, `too_vague`, `no_reflection`) choose the questions (competencies where the gap shows, with the matching follow-up ready, one tag after another; questions from the job join when they fit) and tell the interviewer to check that gap first (`FOCUS_GAPS` in the turn prompt; the live interviewer gets one line in its system prompt). Language and delivery tags change neither; they are only saved. Echoed in `session_started` and saved in the record (`focus`); a resumed session keeps it | none |
| `topic` | English mode: conversation topic, up to 80 characters | none |
| `engine` | override the selected engine for this session | settings `engine` |
| `resume_session_id` | continue a saved session after a dropped connection (US-13 AC5): same record, transcript and feedback kept; Mike says sorry and asks again (or replies to the last answer). `mode`, `round_type`, `level`, `strictness`, `vacancy_id` come from the record. Not for Gemini Live | none |

#### Quick start (`mode: "quick"`, D111)

One call where Mike asks first: "Do you want to practise an interview or English today?". Nothing is planned in advance by the client; `round_type`, `questions`, `strictness`, `input`, `speak`, `voice` are read as for an interview, `vacancy_id` / `level` / `topic` are optional.

1. `session_started` has `"quick": true`, `"mode": "interview"` (a placeholder) and `"questions": []`. Mike's opening is the fixed line above (no model call); it is not saved in the transcript.
2. The user's next turn (typed, browser-recognised or spoken) is the **choice**. It comes back as `turn_complete` `speaker: "user"` with `kind: "quick_choice"`; it gets no feedback record, is not in the saved transcript, and a session with nothing after it is not saved (`session_ended` `saved: false`, `reason: "no_answers"`).
3. The first words decide (`session.classify_choice`, no model): `english` / `speaking` / "free talk" / the Russian stem for "English" → English; `interview` / `job` / `behavioural` / `HR` / the Russian words for "interview" → interview; both words → whichever comes first ("English interview" is English, "interview in English" an interview). Neither → Mike asks once more ("Sorry, I didn't catch that. Interview or English?"); an unclear second answer is an interview.
4. The server sends `{"type": "mode_selected", "mode": "interview" | "english", "questions": [...], "title": "General questions"}` and then Mike's line for that practice: interview = a short intro with the first question (`kind: "question"`, the same bank / job questions as an ordinary start); English = "What would you like to talk about today?" (`kind: "turn"`). From here the session behaves exactly as an ordinary interview or English one, and its record, title, debrief and Recents row are those of the chosen mode.
5. Interview plan: `vacancy_id` from the message, else the **newest saved job that has questions**, else the general bank. (Only the job's title and questions are used; the CV is read as before by engines that take it.) English drops the plan and the job.
6. **Gemini Live** has no mode switch: its system prompt gets a quick-start instruction (ask, then run the interview or just talk), no `mode_selected` is sent and the session is saved as an interview.
7. `resume_session_id` wins over `quick` (the saved record already has its mode). A start without `mode: "quick"` is unchanged.

### Voice answer (`input: "voice"`)

```json
{"type": "activity_start", "turn_id": 3}
```
Then binary PCM frames, then:
```json
{"type": "audio_stream_end"}
```
`activity_start` only says the microphone heard something (a breath or a click counts). If Mike is speaking or
preparing his reply, the local-engine server pauses him (text and audio) and waits for the verdict on the clip.
The Interrupt button sends `"manual": true`: that is a barge-in by definition, Mike stops at once and nothing waits.

- speech: the server cancels the reply, records the cut-off line and sends `interrupted` with the turn's `turn_id`,
  then the answer goes on as usual (`user_transcript`, `turn_complete`). `interrupted` is sent for every recognised
  voice answer, also when nothing was cut off. Without a `turn_id` (typed text, redo) it settles every open turn;
- no speech (empty text, Whisper's "Thank you." on silence or noise, Mike's own echo): the server sends
  `voice_turn_dropped` with the `turn_id` and Mike's reply goes on from where it stopped. Nothing is added to the
  transcript. A `notice` `not_heard` follows only when Mike was neither speaking nor replying.

Every `activity_start` gets exactly one of the two, whatever happens (recognition missing or failing, `activity_cancel`,
the Interrupt button). Turns may overlap (a new clip while the last one is still being recognised): Mike speaks only
while no turn is open, so a verdict for an old turn never frees him while a newer one is open. Two safety nets keep
noise from silencing him for good: the server drops open turns that got no verdict 15 s after recording ended
(`FLOW_MAX_S`), and a turn whose live captions stay empty for a few seconds of audio is announced by
`{"type": "voice_turn_noise", "turn_id": 3}` (not a verdict: it stops holding Mike back, its verdict still follows).

The client holds Mike's audio per open turn from `activity_start` (it keeps what was not yet played), plays it again
when the last held turn gets `voice_turn_dropped` / `voice_turn_noise` and discards it on `interrupted`; a turn that
ended 8 s ago without a verdict stops holding on its own. Gemini Live decides on its own and sends `interrupted`
at once (no `turn_id`).
`turn_id` is a non-negative integer chosen by the client; it is echoed in `speech_preview`, `user_transcript`,
`turn_complete` and `voice_turn_dropped`.

With browser recognition the verdict is the client's: `user_turn` (text, as below) or, when it heard nothing,
`{"type": "activity_cancel", "turn_id": 3}`, which gives `voice_turn_dropped`.

### Typed or browser-recognised answer

```json
{"type": "user_turn", "text": "In my last role I led the redesign of the onboarding flow.", "turn_id": 4, "source": "browser_stt"}
```

### Other client messages

```json
{"type": "redo_answer"}
{"type": "suggest", "on": true}
{"type": "input_mode", "input": "voice"}
{"type": "request_stronger", "feedback_id": "fb-1a2b3c4d"}
{"type": "flag_action", "feedback_id": "fb-1a2b3c4d", "flag_id": "f9e8d7c6", "action": "confirm"}
{"type": "recheck", "feedback_id": "fb-1a2b3c4d", "text": "Last year we redesigned the onboarding ..."}
{"type": "recheck", "feedback_id": "fb-1a2b3c4d", "flag_id": "f9e8d7c6", "text": "we redesigned"}
{"type": "silence"}
{"type": "ping", "t": 1771234567890}
{"type": "end_session"}
```

- `redo_answer`: drop the last answer (and Mike's reply to it); Mike says "Sure, go ahead." and the same question
  is open again. The dropped answer leaves the after-call queue and its recording is released.
- `flag_action` `action`: `confirm` (I did say that: the item now counts), `dismiss` (not an error, or misheard:
  never counted, and the same phrase is not flagged again this session), `restore`.
- `recheck` ("Edit what I said", US-18 AC3; D96: during a call only for an answer of a continued session whose
  feedback is already complete, otherwise `recheck_failed` `not_found`; the debrief page uses the REST call): `text` is the whole corrected answer or, with `flag_id`, what the user
  really said instead of that correction's "Heard as" fragment (at least 5 words after the swap). Only this answer
  is checked again: language and content are asked again, delivery keeps the audio's length and pace and recounts
  the fillers, a stronger version that existed is written again. The server answers with `feedback` (the record,
  `"edited": true`) and `answer_edited`, or with `recheck_failed`; a failure changes nothing. Needs a complete
  feedback record. The history Mike answers from and the saved transcript carry the corrected text.
- `input_mode`: the user switched how they answer mid-session (`voice`, `browser_stt` or `text`). A session that
  started with `text` gets server speech recognition on `voice`; Mike's speech stays as the session started.
- `silence`: the user has been quiet for a long time; Mike says only "Take your time." (local engines).
- `end_session`: finish normally; the server saves, then makes the feedback and the debrief.

## Server to client

### Session lifecycle

```json
{"type": "session_started", "session_id": "s-20261020-101530-4f5e6d", "mode": "interview", "engine": "ollama",
 "model": "qwen3:8b", "speaks": true,
 "questions": [{"id": "A1", "competency": "A", "text": "Why are you interested in this role?",
                "follow_ups": [{"tag": "YP", "text": "..."}], "source": "bank", "anchor": ""}],
 "audio": {"sample_rate_out": 24000, "sample_rate_in": 16000},
 "stt": {"available": true, "backend": "mlx", "model": "mlx-community/whisper-large-v3-turbo"},
 "suggester_available": true, "suggest": false, "warnings": []}
{"type": "ready"}
```
`ready` comes when speech is loaded; the opening line follows at once. The model warms up in the background.

### Turns

```json
{"type": "turn_start", "speaker": "model"}
{"type": "transcript_delta", "speaker": "model", "delta": "Okay.", "full_text": "Okay."}
{"type": "turn_complete", "speaker": "model", "full_text": "Okay. What was the result of that launch?",
 "kind": "follow_up", "question_id": "B2", "thread_id": "B2"}
{"type": "response_complete"}
{"type": "interrupted", "turn_id": 3}
{"type": "voice_turn_dropped", "turn_id": 3}
{"type": "voice_turn_noise", "turn_id": 3}
```
- Mike's text arrives sentence by sentence (`delta` is one sentence, `full_text` the turn so far). With Gemini Live,
  deltas are transcription fragments and user deltas also arrive (`speaker: "user"`).
- `kind`: `question` (a main question), `follow_up`, `wait` (asks the user to go on), `repeat`, `closing`,
  `ack` (not recorded in the transcript), `turn` (English mode). `interrupted: true` marks a cut-off line.
- `thread_id` groups a main question with its follow-ups.
- The server owns the question order. If the model moves on by itself in a follow-up or `wait` turn ("Next
  question: ..."), the code stops the model's line there and asks the plan's next question verbatim in the same
  turn, so the turn ends as `kind: "question"` with the new `question_id` and `thread_id` (or `closing` after the
  last question).

User side (voice input):
```json
{"type": "speech_preview", "turn_id": 3, "text": "In my last role I led the"}
{"type": "user_transcript", "turn_id": 3, "text": "In my last role I led the redesign.", "backend": "mlx",
 "low_conf": [{"w": "redesign", "start": 2.1, "end": 2.6, "p": 0.38}]}
{"type": "turn_complete", "speaker": "user", "full_text": "In my last role I led the redesign.", "turn_id": 3}
{"type": "notice", "code": "not_heard", "message": "I didn't catch that. Please try again a little louder or closer to the microphone."}
```
`speech_preview` is display-only. `low_conf` lists words below 0.5 recogniser confidence ("possibly misheard").
Speech is recognised in two passes so Mike can answer sooner (D96): `user_transcript` has the text and an empty
`low_conf`; the word pass (word confidence and timings) is made after the call, for the feedback, so `low_conf` stays
empty during the call.

```json
{"type": "turn_metrics", "turn_id": 3, "stt_ms": 640, "path": "model", "first_text_ms": 820,
 "first_audio_ms": 1190, "total_ms": 2950, "model": "qwen3:8b"}
```
`path`: `model` (the model chose the reply) or `fixed` (code reply without a model call, for example when the
follow-ups for a question are used up). `moved_on: true` is added when the model moved on by itself and the code
asked the next question (see Turns). Times are measured from the moment the server has the user's text.

### Feedback (one record per answer of 5 words or more; sent after End, D96)

```json
{"type": "feedback_progress", "done": 2, "total": 5}
{"type": "feedback", "feedback": {
  "id": "fb-1a2b3c4d", "turn_id": 3, "question": "Tell me about a project you owned.", "question_id": "B1",
  "competency": "B", "answer_kind": "main", "answer": "Last year we has redesigned ...", "source": "voice",
  "created_at": "2026-10-20T10:16:02+02:00", "complete": true, "cascade": "",
  "heard_as_words": [{"w": "has", "start": 1.0, "end": 1.2, "p": 0.31}],
  "layers": {
    "delivery": {"layer": "delivery", "status": "ok", "severity": 0, "tag": "", "fix": "Nothing to fix here.",
                 "metrics": {"words": 62, "fillers": 1, "fillers_per_100w": 1.6, "restarts": 0, "seconds": 31.0,
                             "wpm": 120, "long_pauses": 0, "mode": "voice",
                             "fillers_note": "Fillers may be undercounted by the recogniser."}},
    "language": {"layer": "language", "status": "ok", "severity": 0, "tag": "", "fix": "Nothing to fix here.",
                 "reason": "", "possibly_misheard": 1,
                 "items": [{"id": "f9e8d7c6", "layer": "language", "tag": "tense", "original": "we has redesigned",
                            "heard_as": "we has redesigned", "better": ["we redesigned"], "reason": "Past tense here.",
                            "level": "B1", "class": "N", "severity": 2, "possibly_misheard": true,
                            "status": "unconfirmed"}]},
    "content": {"layer": "content", "status": "fix", "severity": 3, "tag": "no_result",
                "fix": "Finish with what happened: one result, ideally a number.", "evidence": "", "praise": "",
                "tips": ["Say which part was yours."], "missing": ["no_result"]}
  }}}
{"type": "feedback_unavailable", "feedback_id": "fb-1a2b3c4d", "code": "ollama_not_running",
 "message": "Feedback is not available for this answer. Your answer is still saved."}
```
- `feedback_progress` opens the after-call work (`done: 0`) and follows each finished answer (`done` of `total`).
  `feedback_pending` is gone: nothing is pending per answer during the call.
- The same record is sent several times as layers fill in: delivery first (computed in code, instant), then
  language, then content (interview only). `complete: true` marks the last one. Replace the record by `id`.
- A layer that failed is `{"layer": "content", "status": "unavailable", "code": "timeout"}`.
- Language item `status`: `active` (counts), `unconfirmed` (touches a possibly misheard word: shown as
  "Heard as ...", not counted until confirmed), `confirmed`, `dismissed`. Only `active` and `confirmed` items with
  severity 2 or 3 count in the debrief.
- In English mode the language layer may carry `"phrase_to_keep": {"phrase": "...", "why": "..."}`.
- The language layer carries `"model": "<id>"`, the model that checked it (D106). In English practice on Ollama it
  is the larger installed model of the recommended family (`qwen3:8b`) when the computer has 15.5 GB of RAM or more
  and room for both models; otherwise the session model. Absent when the engine reports no model.
- Delivery `metrics.mode` is `text` for typed answers, with `"not_available": ["pace", "fillers", "pauses"]`.
  Delivery tips only talk about length, pace, fillers and pauses. Typed answers are judged by word count
  (main answer: tip below 25 words or above 420; strong tip below 12 or above 560) with text-mode copy; restarts
  are counted for voice only.
- On engines that run one local model (Ollama, a local OpenAI-compatible server), Mike always has priority:
  suggestions (the only model work a user can ask for during a call) wait until Mike has finished replying, and a
  job that is running when the user answers again is stopped and run again afterwards. The after-call feedback of a
  session also waits while another live call is running.
- A saved session that is still being prepared carries `"post_call": {"state": "running", "stage": "feedback" |
  "debrief", "done": 2, "total": 5}` (`GET /api/sessions/{id}`). It is removed when the
  debrief is saved. While it is there, `POST /api/sessions/{id}/debrief`, `/flags/{flag_id}`, `/stronger` and
  `/recheck` answer `409` `still_preparing`; a rename or archive is allowed and kept.

```json
{"type": "flag_updated", "feedback_id": "fb-1a2b3c4d", "flag": {"id": "f9e8d7c6", "status": "confirmed", "...": "..."},
 "language": {"layer": "language", "status": "fix", "...": "..."}}
{"type": "stronger_version", "feedback_id": "fb-1a2b3c4d", "rewrite": "Last year I redesigned ... [result].",
 "placeholders": ["[result]"]}
{"type": "stronger_unavailable", "feedback_id": "fb-1a2b3c4d", "code": "invented_number", "message": "..."}
{"type": "answer_reset", "question": "Tell me about a project you owned.", "removed_feedback_ids": ["fb-1a2b3c4d"]}
{"type": "answer_edited", "feedback_id": "fb-1a2b3c4d", "turn_id": 3, "text": "Last year we redesigned ..."}
{"type": "recheck_failed", "feedback_id": "fb-1a2b3c4d", "code": "timeout", "message": "..."}
```
`recheck_failed` codes: `not_found`, `too_short`, `fragment_not_found`, `busy`, `timeout`, `internal`, or an engine code.

### Answer suggester (practice only, when enabled)

```json
{"type": "suggestion_pending", "question": "Why are you interested in this role?"}
{"type": "suggestion", "question": "Why are you interested in this role?", "story": "Onboarding redesign",
 "answer": "In my last role I ...", "points": ["own part", "result"]}
{"type": "suggestion_unavailable", "question": "...", "code": "invalid_json", "message": "Could not prepare a suggestion for this question."}
```

### End of session

```json
{"type": "saving"}
{"type": "session_saved", "session_id": "s-20261020-101530-4f5e6d"}
{"type": "feedback_progress", "done": 0, "total": 5}
{"type": "debrief_pending", "session_id": "s-20261020-101530-4f5e6d"}
{"type": "debrief", "session_id": "s-20261020-101530-4f5e6d", "debrief": {
  "verdict": "You answered clearly, but most stories stopped before the result.",
  "weak_spots": [{"layer": "content", "tag": "no_result", "text": "Finish each story with a result.", "evidence": ["q1", "q3"]}],
  "strength": "Clear structure.", "next_step": "Practise ending with a number.", "source": "model"}}
{"type": "session_ended", "saved": false, "reason": "no_answers"}
{"type": "save_error", "code": "save_failed", "message": "Could not save the session. Copy the transcript before leaving this page."}
```
- With fewer than 3 answers the debrief has `"too_short": true` and a fixed verdict.
- In interview mode (not too short) every debrief sent to a client (this message, `GET /api/sessions/{id}`,
  `POST .../debrief`, `.../flags/{flag_id}`, `.../recheck`, and the Markdown export) also carries, built in code at
  read time from the saved feedback layers and never saved (feedback_rubric.md section 9, US-20 AC6-AC9):
  - `scorecard`: `{"rows": [{"key", "score", "answers", "lost"}]}`, always 7 rows in this order: `structure`,
    `own_part`, `result`, `relevance`, `reflection`, `language`, `delivery`. `score` is 1-5, or `null` ("Not asked
    this time") when `answers` is 0; `lost` lists the `q<n>` ids (the same numbering as `evidence`) of answers that
    got less than full points, and is empty for a score of 5.
  - `step` (D99, feedback_rubric.md 9.4): `{"value": 0 | 1 | 2, "gap": ["structure", ...], "target": 3 | 4 | null}`, the step
    of the verdict scale (0 `Not ready yet`, 1 `Getting there`, 2 `Ready`), computed from `scorecard`; a row is "shown"
    when its score is not `null`. 0: a content row (`structure`, `own_part`, `result`, `relevance`) scores 1 or 2.
    2: every shown row scores 4 or more. 1: everything else. `gap` = the rows that stand between the user and the next
    step, lowest score first and ties in scorecard order: for 0 the content rows at 1-2 (`target` 3), for 1 every shown
    row at 1-3 (`target` 4), for 2 empty (`target` `null`). No `step` field when no row has a score (and the debrief is
    `too_short` or English mode: none of these fields).
  - on each weak spot: `said` + `said_kind` (`quote` | `metric`) + `said_from` (the `q<n>` it comes from) when a
    fragment or a metric could be verified, and `lands_as` for a known tag.
  - `plan`: up to 3 `{"layer", "tag", "text", "drill"}`, one per weak spot in order; `drill` is true on the first.
  The existing fields are unchanged. English mode debriefs do not have these fields.
- `source`: `model` or `template` (fallback built in code when the model is unavailable).

### Errors

```json
{"type": "error", "code": "not_running", "message": "Ollama is installed but not running.",
 "hint": "Open the Ollama app, or run: ollama serve", "retryable": true, "hint_command": "ollama serve",
 "fix_url": "https://ollama.com/download", "engine": "ollama"}
```

| Code | When |
|---|---|
| `bad_start` | first message missing or invalid (`message` names the field) |
| `not_installed`, `not_running`, `no_model`, `not_configured`, `unreachable`, `unauthorized`, `billing_required` | engine not ready at start (same codes as `GET /api/engines`) |
| `ollama_not_running`, `model_missing`, `rate_limited`, `engine_error`, `engine_timeout`, `invalid_json` | engine failed during a turn; for interview replies Mike moves on with the next question |
| `stt_unavailable`, `stt_failed` | speech recognition missing or failed for this answer |
| `reply_failed` | unexpected failure while replying |
| `flag_not_found`, `already_started` | invalid client action (session continues) |
| `connection_lost`, `session_failed` | the session ended; the transcript is saved |
| `resume_unavailable` | `resume_session_id` cannot be continued (not saved, still being saved: `retryable`, or Gemini Live); the socket closes |

`pong` answers `ping`: `{"type": "pong", "t": 1771234567890}`.

## Typical flows

**Interview, voice, local engine**

1. `start` -> `session_started` -> `ready` -> Mike's opening (fixed copy with the first question, no model call). (Quick start: the opening is "interview or English?", then `turn_complete` user `quick_choice`, `mode_selected`, and the opening of the chosen practice.)
2. `activity_start` + PCM + `audio_stream_end` -> `user_transcript` -> `turn_complete` (user). No feedback yet.
3. Mike replies: a follow-up (streamed sentence by sentence, with audio) or "Okay." plus the next question (the
   code speaks it verbatim as soon as the model chooses `next_question`) -> `turn_metrics`.
4. Steps 2-3 repeat for every question. Nothing but Mike, recognition and speech runs; the answers and their
   recordings are only kept.
5. After the last question Mike gives the closing line. `end_session` -> `saving` -> `session_saved` ->
   `feedback_progress` (0 of N) -> per answer `feedback` x3 (delivery, language, content) and `feedback_progress`
   -> `debrief_pending` -> `debrief`. The user may `flag_action` / `request_stronger` / `recheck` from the debrief
   page (REST) once `post_call` is gone.

**Gemini Live.** Same messages; Mike's voice and both transcripts come from Gemini, `speech_preview` and
`user_transcript` are not sent (user captions arrive as `transcript_delta` with `speaker: "user"`), feedback uses
the Gemini text model, and delivery metrics are text-mode (no word timings).

## REST: in-app feedback (US-60, D102)

Not part of the socket; listed here because it is the only call the server makes on its own account to a service that is
not the user's engine. It happens only when the user presses Send in "Send feedback" or "How did it go?".

| Call | Body | Answer |
|---|---|---|
| `GET /api/feedback/config` | - | `{configured, issues_url, app_line}`. `configured` is false until `IC_FEEDBACK_URL` (or `config.FEEDBACK_URL`) holds an https address (http only for localhost). `app_line` is the exact line "Attach app version..." adds. |
| `POST /api/feedback` | `{kind: "idea"\|"problem"\|"other"\|"session", message, rating?: 1..5, email?, attach_meta, session_id?}` | `{sent: true}`, or an error: `not_configured` (409), `network` / `service_error` (502), `empty_message` / `bad_email` / validation (422). Same Origin guard as the other POSTs. |
| `POST /api/feedback/session-finished` | `{session_id}` | `{count, ask, configured}`: counts a finished session that reached its debrief (once per id) and says whether the "How did it go?" dialog is due (`count` is 1, 6, 11, ... and the Settings switch is on). |

What leaves the computer is built on the server from these fields only, as JSON with `Accept: application/json` and a
10 s timeout (no redirects followed): `{kind, message, rating?, email?, app?}`. `app` is
`Vukoli <version> · <OS> · <engine name>` and is present only when `attach_meta` is true. No path, user name, key, answer,
transcript, CV or job is ever included; `session_id` is accepted but not forwarded. The settings `feedback_ask` (default
true), `sessions_finished` and `sessions_counted_last` live in `settings.json`; only `feedback_ask` is editable
(Settings, Privacy and data). Test mode (`IC_E2E=1`) replaces the service with a stand-in that remembers the payloads:
`GET` / `POST /api/_e2e/feedback`, no request ever leaves the machine.

## REST: search across practices (D105, US-61)

| Call | Answer |
|---|---|
| `GET /api/sessions/search?q=<text>&limit=20` | a JSON array (empty for a query under 2 characters), at most `limit` (1..50, default 20) results, best first |

Local only: it reads the saved sessions (`sessions/*.json`, archived ones too, not the trash); nothing is indexed on disk and
nothing leaves the computer. A session is kept in memory after its first read and read again only when its file changes.
The route is registered before `/api/sessions/{id}`, so `search` is never taken for an id.

- **Matching.** Case-insensitive, every whitespace-separated word of `q` (at most 8) must be found somewhere in the
  session, as a part of a word (AND). Searched: the title as shown, the job (`vacancy_title` and the title of its vacancy
  record), the mode (`english` / `interview`), Mike's questions and the user's answers (`transcript`, then
  `feedback[].question/answer` for text the transcript does not hold, e.g. an answer edited with "Edit what I said").
  Mike's closing line is not searched.
- **Order.** Sessions whose title / job / mode match first (more of the query's words there first), then the number of hits
  in the whole session, then the newest `started_at`.
- **Result.** `{id, title, subtitle, mode, archived, started_at, match}`. `subtitle` is "job · date" ("27 Oct 2026"; the
  job is left out when the title already says it). `match = {field, snippet, q?}`: `field` is `title`, `job`, `question` or
  `answer` (where the first hit is: a head match wins; else the line holding most of the words, the earliest on a tie);
  `snippet` is the line, or about 120 characters around the first hit cut at word edges with "…"; `q` is the number of the
  question the Debrief shows the line under (the 1-based place in the session's `questions`, else the order the questions were
  answered, the same as `threadsFromRecord`), present for `question` / `answer` hits and never for an English practice,
  which has no question tabs. The page opens `/sessions/<id>?q=<q>`.
- A session with a missing or odd field (not a dict, a non-string title, a broken file) is searched with what it has or
  skipped; it never fails the call.
