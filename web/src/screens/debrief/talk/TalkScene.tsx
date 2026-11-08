/* A Tough talk debrief inside the full shell (MemoryRouter + AppShellView), all from props; shared by the stories and the review page. */
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppShellView } from "../../../components/AppShell";
import type { NegotiateDebrief as Neg, SessionRecord, ToughDebrief as Tough } from "../../../lib/types";
import { SHELL_ENGINE, SHELL_RECENT } from "../frames";
import type { DebriefViewMode } from "../types";
import { CONTENT } from "./fixtures";
import { NegotiateDebrief } from "./NegotiateDebrief";
import { ToughDebrief } from "./ToughDebrief";

export function Scene({ record, view: first = "debrief", q: firstQ, storageError }: { record: SessionRecord; view?: DebriefViewMode; q?: number; storageError?: boolean }) {
  const [view, setView] = useState<DebriefViewMode>(first);
  const [q, setQ] = useState<number | undefined>(firstQ);
  const common = {
    record, layerOrder: "content-first" as const, view, onViewChange: setView, question: q, onQuestionChange: setQ, storageError,
    onRename: async () => true, onDownload: () => {}, onArchive: () => {}, onTrash: () => {}, onPractise: () => {}, content: CONTENT,
  };
  return (
    <MemoryRouter initialEntries={[`/sessions/${record.id}`]}>
      <AppShellView current={null} currentSessionId={record.id} recent={SHELL_RECENT} engine={SHELL_ENGINE}>
        {record.mode === "negotiate"
          ? <NegotiateDebrief {...common} debrief={record.debrief as Neg | null} />
          : <ToughDebrief {...common} debrief={record.debrief as Tough | null} />}
      </AppShellView>
    </MemoryRouter>
  );
}
