/* The shell both tough-talk debriefs share (ds/screens/tough-talk.md §5-§6): storage banner, header with rename and menu,
 * the "Debrief | Conversation" switch, "Practise again", the error notice, then either the frames (`children`) or the
 * whole talk as a chat. Frames are D109 islands with titles; the chat is the interview debrief's `Conversation`. */
import { useRef, useState, type ReactNode } from "react";
import { Button, Callout, Segmented, Tooltip } from "../../../ds";
import { pageStyles } from "../../../components/Page";
import { t } from "../../../i18n";
import { Conversation } from "../parts/Conversation";
import { Header } from "../parts/Header";
import { StorageBanner } from "../parts/States";
import type { ConversationTurn, DebriefViewMode, MetaItem, ToughTalkDebriefProps } from "../types";
import s from "./talk.module.css";

export interface TalkPageProps extends Pick<
  ToughTalkDebriefProps,
  "view" | "onViewChange" | "buildUp" | "storageError" | "notice" | "onRename" | "onDownload" | "onArchive" | "onTrash" | "onPractise"
> {
  variant: "tough" | "negotiate";
  title: string;
  meta: MetaItem[];
  turns: ConversationTurn[];
  /** The frames of the Debrief view. Absent (nothing to show): the conversation only, with no switch. */
  children?: ReactNode;
}

export function TalkPage(p: TalkPageProps) {
  const [renaming, setRenaming] = useState(false);
  const [override, setOverride] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const hasDebrief = Boolean(p.children);
  const view: DebriefViewMode = hasDebrief ? p.view : "conversation";
  const hint = p.variant === "negotiate" ? t("debrief.talk.practiseHintNegotiate") : t("debrief.talk.practiseHintTough");
  const setView = (next: DebriefViewMode) => {
    p.onViewChange(next);
    window.requestAnimationFrame(() => root.current?.closest("main")?.scrollTo({ top: 0 }));
  };
  const practise = (
    <Tooltip content={hint} placement="bottom-start">
      <Button variant="secondary" icon="refresh" data-track="practise-again" aria-description={hint} onClick={p.onPractise}>
        {t("debrief.talk.practiseAgain")}
      </Button>
    </Tooltip>
  );
  return (
    <div
      ref={root}
      className={`${pageStyles.page} ${s.page} ${s.fluid} ${p.buildUp ? "motion-stagger" : ""}`}
      data-review-id={`Debrief/${p.variant === "tough" ? "Tough" : "Negotiate"}`}
      data-variant={p.variant}
    >
      {p.storageError ? <StorageBanner onDownload={p.onDownload} /> : null}
      <Header
        title={override ?? p.title}
        meta={p.storageError ? p.meta.map((m) => (m.href ? { icon: "alert" as const, text: t("debrief.notSaved"), tone: "warning" as const } : m)) : p.meta}
        renaming={renaming}
        focusRename
        onRenameStart={p.onRename ? () => setRenaming(true) : undefined}
        onRenameSave={(next) => {
          setOverride(next);
          setRenaming(false);
          void p.onRename?.(next).then((ok) => { if (!ok) setOverride(null); });
        }}
        onRenameCancel={() => setRenaming(false)}
        onDownload={p.onDownload}
        onArchive={p.onArchive}
        onTrash={p.onTrash}
        toolbar={(
          <>
            {hasDebrief ? (
              <Segmented
                label={t("debrief.view.label")}
                hideLabel
                options={[
                  { value: "debrief", label: t("debrief.view.debrief") },
                  { value: "conversation", label: t("debrief.view.conversation") },
                ] satisfies { value: DebriefViewMode; label: string }[]}
                value={view}
                onChange={setView}
                track="debrief-view"
              />
            ) : null}
            {practise}
          </>
        )}
      />
      {p.notice ? <Callout tone="error" live="alert">{p.notice}</Callout> : null}
      {view === "debrief" ? (
        <div className={s.stack} data-review-id="Debrief/DebriefView">{p.children}</div>
      ) : (
        <section className={s.chat} aria-labelledby="talk-convo" data-review-id="Debrief/Conversation">
          <h2 id="talk-convo" className="visually-hidden">{t("debrief.convo.title")}</h2>
          <Conversation turns={p.turns} />
        </section>
      )}
    </div>
  );
}
