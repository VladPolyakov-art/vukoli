/* A SessionView with local state for the corrections, so the review page and Storybook respond to "I said it right",
 * "Yes, I said that", "No, I said…" and Undo the way the live panel does. Everything else stays static. */
import { useCallback, useState } from "react";
import type { LanguageItem } from "../../lib/types";
import type { Thread } from "../../session/reducer";
import { SessionView } from "./SessionView";
import type { SessionViewProps } from "./types";

function applyFlag(thread: Thread | null, feedbackId: string, flagId: string, action: "confirm" | "dismiss" | "restore"): Thread | null {
  if (!thread) return thread;
  const status: LanguageItem["status"] = action === "confirm" ? "confirmed" : action === "dismiss" ? "dismissed" : "active";
  return {
    ...thread,
    records: thread.records.map((r) => {
      const lang = r.layers.language;
      if (r.id !== feedbackId || !lang?.items) return r;
      return { ...r, layers: { ...r.layers, language: { ...lang, items: lang.items.map((i) => (i.id === flagId ? { ...i, status } : i)) } } };
    }),
  };
}

export function SessionPreview(props: SessionViewProps) {
  const [thread, setThread] = useState(props.data.thread);
  const onFlag = useCallback((feedbackId: string, flagId: string, action: "confirm" | "dismiss" | "restore") => {
    setThread((cur) => applyFlag(cur, feedbackId, flagId, action));
  }, []);
  return <SessionView {...props} data={{ ...props.data, thread }} handlers={{ ...props.handlers, onFlag }} />;
}
