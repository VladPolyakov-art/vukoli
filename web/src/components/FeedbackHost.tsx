/* US-60: the two feedback dialogs, mounted once in the shell (AppShell). Which one is open is lib/feedbackUi. */
import { useRef, useSyncExternalStore } from "react";
import { feedbackUi } from "../lib/feedbackUi";
import { SessionAskDialog } from "./SessionAskDialog";
import { SupportDialog } from "./SupportDialog";

export function FeedbackHost() {
  const current = useSyncExternalStore(feedbackUi.subscribe, feedbackUi.get);
  // The ask keeps its session id while it fades out.
  const sessionId = useRef("");
  if (current?.kind === "session") sessionId.current = current.sessionId;
  return (
    <>
      <SupportDialog open={current?.kind === "support"} onClose={feedbackUi.close} />
      <SessionAskDialog open={current?.kind === "session"} sessionId={sessionId.current} onClose={feedbackUi.close} />
    </>
  );
}
