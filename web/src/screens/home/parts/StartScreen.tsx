/* Start screen (home.md v2 §3, D47a/b): a text greeting (no orb), one composer, up to three suggestions
 * (the footer line is pinned to the bottom of <main> by HomeView).
 * Calm like a chat start page: nothing else on screen. The composer carries a "+" for a job file (D112: no practice-type dropdown; English is the chip under the field). The composer carries the fast path like the Gemini input (D52, chosen in D53):
 * "+" then Quick start on the left, a round unlabelled mic on the right (= Start now, D51 item 1; a keyboard icon when
 * answers are typed). Text or a file turns the mic into the Send arrow (motion D6), and Send opens the setup chat.
 * Under the composer: the suggestions only. */
import type { KeyboardEvent, Ref } from "react";
import type { ComposerSend } from "../../../ds";
import { Button, Chip, ChipGroup, Composer, ComposerAttachment, Icon, IconButton, Skeleton } from "../../../ds";
import { t } from "../../../i18n";
import type { HomeViewProps, Suggestion, Track } from "../types";
import s from "./parts.module.css";

export function Footer({ track }: { track: Track }) {
  // D108: no free/Premium wording; the English track has no footer, the interview track keeps the practice-only line.
  if (track === "english") return null;
  return <p className={s.footer} data-review-id="Home/Footer">{t("home.disclaimer")}</p>;
}

/** Longer chip labels ("Kestrel Payments Internati… again") are clamped by CSS; the full text goes to `title`. */
const CHIP_CLAMP = 28;

/** One row of chips (tough-talk.md §2.1: the personal chips, then the three practice modes). */
function Chips({ label, items, loading, onSuggestion }: { label: string; items: Suggestion[] } & Pick<HomeViewProps, "loading" | "onSuggestion">) {
  if (!items.length) return null;
  return (
    <ChipGroup label={label} hideLabel align="center">
      {items.map((x) => (
        <Chip key={x.id} icon={x.icon} data-track={`suggestion-${x.id}`} title={x.label.length > CHIP_CLAMP ? x.label : undefined} disabled={loading} onClick={() => onSuggestion?.(x.id)}>
          <span className={s.chipLabel}>{x.label}</span>
        </Chip>
      ))}
    </ChipGroup>
  );
}

export interface StartScreenProps extends HomeViewProps {
  narrow: boolean;
  composerRef?: Ref<HTMLDivElement>;
}

export function StartScreen(props: StartScreenProps) {
  const { track, name, composer, suggestions, narrow, composerRef, buildUp } = props;
  const english = track === "english";
  const title = english
    ? name ? t("chat.start.englishName", { name }) : t("chat.start.english")
    : name ? t("chat.start.greetingName", { name }) : t("chat.start.greeting");
  const placeholder = english ? t("chat.start.placeholderEnglish") : narrow ? t("chat.start.placeholderNarrow") : t("chat.start.placeholder");
  const hasInput = Boolean(composer.text.trim() || composer.file);
  const quick = props.quickStart;
  const sendMessage: ComposerSend = { label: t("chat.start.send"), icon: "arrowRight", variant: "action", hidden: !hasInput, track: "composer-send", onSend: props.onSend };
  /* With nothing typed the end button is the quick start (no label; the name and tooltip say what it starts). */
  const typed = (quick?.answer ?? (props.textMode ? "text" : "voice")) === "text";
  const send: ComposerSend = quick && !hasInput
    ? {
      label: t(typed ? "chat.quick.textButton" : "chat.quick.voiceButton"),
      title: quick.detail || undefined,
      icon: typed ? "keyboard" : "mic",
      // D59: no white fill under the mic: a grey chip, so the icon reads clearly in both themes.
      variant: "quiet",
      disabled: props.loading || !props.engineReady || quick.wait,
      busy: props.starting,
      track: "quick-start",
      onSend: props.onQuickStart,
    }
    : sendMessage;
  // Empty field: Enter must not start a session (only the button does); Shift+Enter still adds a line.
  const holdEnter = quick && !hasInput
    ? (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) e.preventDefault(); }
    : undefined;
  const addFile = english ? null : <IconButton icon="plus" size="sm" outlined label={t("chat.start.addFile")} data-track="composer-add-file" onClick={props.onAddFile} />;
  const quickCall = (
    <Button variant="secondary" size="sm" icon="play" data-track="quick-call" title={t("chat.quick.callHint")}
      disabled={props.loading || !props.engineReady || props.starting} onClick={props.onQuickCall}>
      {t("chat.quick.call")}
    </Button>
  );

  return (
    <div className={`${s.start} ${buildUp ? "motion-stagger" : ""}`} data-review-id="Home/Start-screen">
      <h1 className={`${s.greeting} ${props.namePending ? s.greetingPending : ""}`} aria-hidden={props.namePending || undefined} data-review-id="Home/Greeting" data-review-section="Home · Greeting" data-comment-target>{title}</h1>
      <div ref={composerRef} className={s.composer} data-review-id="Home/Composer" data-review-section="Home · Composer" data-comment-target>
        <Composer
          label={t("chat.start.label")}
          placeholder={placeholder}
          value={composer.text}
          minRows={1}
          maxRows={8}
          submitOnEnter
          busy={props.loading}
          onChange={(e) => props.onComposerChange?.(e.target.value)}
          onFiles={english ? undefined : props.onFiles}
          attachment={composer.file ? (
            <ComposerAttachment
              icon="file"
              title={composer.file.name}
              meta={composer.file.size}
              actions={<IconButton icon="x" size="sm" label={t("chat.start.removeFile")} data-track="composer-remove-file" onClick={props.onRemoveFile} />}
            />
          ) : undefined}
          onKeyDown={holdEnter}
          toolbarStart={<>{addFile}{props.onQuickCall ? quickCall : null}</>}
          send={send}
        />
      </div>
      {composer.file ? (
        <p className={s.fileLine}><Icon name="lock" size="sm" />{t("chat.start.fileLocal")}</p>
      ) : null}
      <div className={s.suggestions} aria-busy={props.loading || undefined} data-review-id="Home/Suggestions" data-review-section="Home · Suggestions" data-comment-target>
        {props.loading && !suggestions.length ? (
          <Skeleton variant="lines" lines={1} className={s.suggestionsSkeleton} />
        ) : suggestions.length ? (
          <>
            <Chips label={t("chat.start.suggestions")} items={suggestions.filter((x) => x.group !== "practice")} loading={props.loading} onSuggestion={props.onSuggestion} />
            <Chips label={t("home.talk.groupOther")} items={suggestions.filter((x) => x.group === "practice")} loading={props.loading} onSuggestion={props.onSuggestion} />
          </>
        ) : null}
      </div>
    </div>
  );
}
