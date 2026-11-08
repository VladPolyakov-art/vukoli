/* Card texts and theme names for the tough-talk debriefs (`GET /api/tough-talk/content`). A failed or slow request is
 * not an error for the page: the debrief shows what the saved session has, and the tactic links wait for the cards. */
import { api } from "../../../lib/api";
import { useLoad } from "../../../lib/hooks";
import { indexContent, type TalkContent } from "./model";

export function useTalkContent(): TalkContent | undefined {
  const { data } = useLoad(() => api.toughTalkContent(), []);
  return data ? indexContent(data) : undefined;
}
