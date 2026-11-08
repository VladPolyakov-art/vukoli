/* Entry of the Negotiate debrief for screens/Debrief.tsx: loads the card texts (`GET /api/tough-talk/content`) and renders the page. */
import type { NegotiateDebrief as Debrief } from "../../../lib/types";
import type { ToughTalkDebriefProps } from "../types";
import { NegotiateDebrief } from "./NegotiateDebrief";
import { useTalkContent } from "./useTalkContent";

export function NegotiateDebriefPage(props: ToughTalkDebriefProps<Debrief>) {
  return <NegotiateDebrief {...props} content={useTalkContent()} />;
}
