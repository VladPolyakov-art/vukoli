/* Entry of the Tough debrief for screens/Debrief.tsx: loads the card texts (`GET /api/tough-talk/content`) and renders the page. */
import type { ToughDebrief as Debrief } from "../../../lib/types";
import type { ToughTalkDebriefProps } from "../types";
import { ToughDebrief } from "./ToughDebrief";
import { useTalkContent } from "./useTalkContent";

export function ToughDebriefPage(props: ToughTalkDebriefProps<Debrief>) {
  return <ToughDebrief {...props} content={useTalkContent()} />;
}
