/* The end button of a Home composer (start screen and setup chat, D90): Send with text or a file, otherwise the dictation
 * mic (stop while it listens). Where no recogniser works (`dictation.available` false) the Send arrow stays, hidden while
 * the field is empty. Shared so both composers behave the same. */
import type { ComposerSend } from "../../../ds";
import { t } from "../../../i18n";
import type { HomeViewProps } from "../types";

export function isHearing(dictation: HomeViewProps["dictation"]): boolean {
  return dictation?.state === "listening" || dictation?.state === "transcribing";
}

export function endButton(props: Pick<HomeViewProps, "dictation" | "onSend" | "onDictate">, hasInput: boolean): ComposerSend {
  const { dictation } = props;
  const hearing = isHearing(dictation);
  if ((hasInput && !hearing) || !dictation?.available) {
    return { label: t("chat.start.send"), icon: "arrowRight", variant: "action", hidden: !hasInput, track: "composer-send", onSend: props.onSend };
  }
  return {
    label: t(hearing ? "chat.dictate.stop" : "chat.dictate.start"),
    icon: hearing ? "stop" : "mic",
    variant: hearing ? "action" : "quiet",
    busy: dictation.state === "transcribing",
    track: hearing ? "composer-dictate-stop" : "composer-dictate",
    onSend: props.onDictate,
  };
}
