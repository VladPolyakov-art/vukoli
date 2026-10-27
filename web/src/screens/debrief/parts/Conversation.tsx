/* The whole talk as a chat, the default view of a saved session: it spans the main area like a chat app, Mike on the
 * left as plain text, the user on the right in a bubble, like the Session transcript; "Question N" starts each question,
 * a quiet "Follow-up" label sits on Mike's follow-ups. Lines keep a readable length (the message boxes are capped,
 * not the chat). The breakdown of an answer lives in the Debrief view. */
import { ChatLog, ChatMessage } from "../../../ds";
import { t } from "../../../i18n";
import type { ConversationTurn, QuestionModel } from "../types";
import { plain } from "./Marked";
import s from "./conversation.module.css";

/** Fixtures carry no transcript: rebuild the talk from the questions (question → answer → follow-up → its answer). */
export function conversationFromQuestions(questions: QuestionModel[]): ConversationTurn[] {
  return questions.flatMap((q): ConversationTurn[] => [
    { id: `q${q.n}`, speaker: "mike", text: q.question, q: q.n, opens: true },
    { id: `a${q.n}`, speaker: "user", text: plain(q.answer), q: q.n },
    ...(q.followUp ? [{ id: `f${q.n}`, speaker: "mike" as const, text: q.followUp, q: q.n, followUp: true }] : []),
    ...(q.followUpAnswer ? [{ id: `fa${q.n}`, speaker: "user" as const, text: q.followUpAnswer, q: q.n }] : []),
  ]);
}

export interface ConversationProps {
  turns: ConversationTurn[];
}

export function Conversation({ turns }: ConversationProps) {
  return (
    <ChatLog label={t("debrief.convo.label")} live={false} className={s.log}>
      {turns.map((turn) => {
        const q = turn.q;
        const name = t("session.captions.speaker", { name: turn.speaker === "mike" ? t("chat.setup.mike") : t("debrief.convo.you") });
        return (
          <div key={turn.id} className={s.turn} data-question={turn.opens ? q : undefined}>
            {turn.opens && q ? <h3 className={s.question}>{t("debrief.q.number", { n: q })}</h3> : null}
            <ChatMessage
              speaker={turn.speaker}
              reviewId={`Debrief/Conversation/${turn.speaker}`}
              attachment={turn.followUp ? <span className={s.followUp}>{t("session.followUp")}</span> : undefined}
              className={turn.speaker === "user" ? s.msgUser : s.msgMike}
            >
              <p><span className="visually-hidden">{name} </span>{turn.text}</p>
            </ChatMessage>
          </div>
        );
      })}
    </ChatLog>
  );
}
