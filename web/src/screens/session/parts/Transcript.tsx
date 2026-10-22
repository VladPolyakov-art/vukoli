/* Running transcript (session.md V2.1, D49): the whole dialogue in the centre of the stage, newest at the bottom, in a
 * centred column. Built from ChatLog / ChatMessage (size lg): Mike = plain text, the user = a bubble.
 * - "Question N" heading before the turn that opens each question; a quiet Follow-up label on Mike's follow-ups.
 * - Mike's streamed words (text as chunks): each new chunk fades in (opacity only). New Mike turns rise in; turns
 *   present at the first render never animate. The user's own words never animate (rule 3): they update in place.
 * - The answer being recorded is the last turn: ChatMessage `interim` (65% bubble, secondary words) + interim words secondary.
 * - Mike preparing a reply: a Mike line with the 3-dot loader.
 * - Not announced (ChatLog live=false): Mike is heard through TTS, and the user is speaking. Each turn starts with a
 *   visually hidden speaker name for screen readers. */
import { useState } from "react";
import { ChatLog, ChatMessage, Dots } from "../../../ds";
import { t } from "../../../i18n";
import type { TranscriptTurn } from "../types";
import s from "./parts.module.css";

export interface TranscriptProps {
  turns: TranscriptTurn[];
  /** Accessible name of the log. */
  label: string;
  /** Mike is preparing a reply. */
  pending?: boolean;
  /** The last user turn is being recorded (listening): it gets the interim style even before interim words arrive. */
  recording?: boolean;
  /** Static line under the transcript ("What we heard…"). */
  footer?: string;
}

export function Transcript({ turns, label, pending, recording, footer }: TranscriptProps) {
  const [initial] = useState(() => new Set(turns.map((x) => x.id)));
  const lastUser = [...turns].reverse().find((x) => x.speaker === "user");
  const liveId = turns.at(-1)?.speaker === "user" && (recording || lastUser?.interim) ? lastUser?.id : undefined;
  return (
    <div className={s.transcript} data-review-id="Session/Transcript" data-review-section="Session · Transcript" data-comment-target>
      <ChatLog label={label} size="lg" live={false}>
        {turns.map((turn) => {
          const fresh = turn.speaker === "mike" && !initial.has(turn.id);
          const chunks = Array.isArray(turn.text) ? turn.text : [turn.text];
          const streamed = turn.speaker === "mike" && Array.isArray(turn.text);
          return (
            <div key={turn.id} className={`${s.turn} ${turn.id === liveId ? s.turnInterim : ""}`}>
              {turn.question ? <h2 className={s.turnQuestion}>{t("session.captions.question", { n: turn.question })}</h2> : null}
              <ChatMessage
                speaker={turn.speaker}
                state={turn.id === liveId ? "interim" : "final"}
                animate={fresh}
                reviewId={`Session/Transcript/${turn.speaker}${turn.id === liveId ? "-interim" : ""}`}
                attachment={turn.followUp ? <span className={s.followUp}>{t("session.followUp")}</span> : undefined}
              >
                <p>
                  <span className="visually-hidden">{t("session.captions.speaker", { name: turn.name })} </span>
                  {chunks.map((c, i) => (
                    <span key={i} className={streamed && i > 0 ? s.chunkIn : undefined}>{i > 0 && !/^\s/.test(c) ? " " : ""}{c}</span>
                  ))}
                  {turn.interim ? <span className={s.interimWords}>{chunks.join("") ? " " : ""}{turn.interim}</span> : null}
                </p>
              </ChatMessage>
            </div>
          );
        })}
        {pending ? (
          <ChatMessage speaker="mike" reviewId="Session/Transcript/mike-pending">
            <Dots label={t("session.captions.thinking")} />
          </ChatMessage>
        ) : null}
      </ChatLog>
      {footer ? <p className={s.transcriptFooter}>{footer}</p> : null}
    </div>
  );
}
