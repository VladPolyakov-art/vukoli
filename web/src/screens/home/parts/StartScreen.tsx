/* Start screen (home.md v2 §3, D47a/b): a text greeting (no orb), one composer, up to three suggestions
 * (the footer line is pinned to the bottom of <main> by HomeView).
 * Calm like a chat start page: nothing else on screen. The composer carries the practice type (mode chip with a
 * radio menu) and a "+" for a job file. The composer carries the fast path like the Gemini input (D52, chosen in D53):
 * "+" then the mode chip on the left, a round unlabelled mic on the right (= Start now, D51 item 1; a keyboard icon when
 * answers are typed). Text or a file turns the mic into the Send arrow (motion D6), and Send opens the setup chat.
 * Under the composer: the suggestions only. */
import type { KeyboardEvent, Ref } from "react";
import type { ComposerSend } from "../../../ds";
import { Button, Chip, ChipGroup, Composer, ComposerAttachment, Icon, IconButton, Menu, Skeleton } from "../../../ds";
import { t } from "../../../i18n";
import type { HomeViewProps, Track } from "../types";
import { TextLink } from "./TextLink";
import s from "./parts.module.css";

export function Footer({ track }: { track: Track }) {
  return (
    <p className={s.footer} data-review-id="Home/Footer">
      {track === "english" ? t("english.free") : t("home.disclaimer")} <TextLink to="/settings/about#free" track="home-free-link">{t("home.free")}</TextLink>
    </p>
  );
}

function ModeMenu({ track, open, onChange }: { track: Track; open?: boolean; onChange?: (track: Track) => void }) {
  const label = track === "english" ? t("chat.start.mode.english") : t("chat.start.mode.interview");
  return (
    <Menu
      label={t("chat.start.mode.menu")}
      defaultOpen={open}
      items={[
        { id: "interview", track: "mode-interview", label: t("chat.start.mode.interview"), description: t("chat.start.mode.interviewDesc"), icon: "briefcase", checked: track === "interview", onSelect: () => onChange?.("interview") },
        { id: "english", track: "mode-english", label: t("chat.start.mode.english"), description: t("chat.start.mode.englishDesc"), icon: "chat", checked: track === "english", onSelect: () => onChange?.("english") },
      ]}
      trigger={(p) => (
        <Button {...p} variant="secondary" size="sm" icon={track === "english" ? "chat" : "briefcase"} iconRight="chevronDown" data-track="mode-menu" aria-label={t("chat.start.mode.aria", { mode: label })}>
          {label}
        </Button>
      )}
    />
  );
}

/** Longer chip labels ("Kestrel Payments Internati… again") are clamped by CSS; the full text goes to `title`. */
const CHIP_CLAMP = 28;

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
  const modeMenu = <ModeMenu track={track} open={props.initialOverlay === "mode"} onChange={props.onModeChange} />;

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
          toolbarStart={<>{addFile}{modeMenu}</>}
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
          <ChipGroup label={t("chat.start.suggestions")} hideLabel align="center">
            {suggestions.map((x) => (
              <Chip key={x.id} icon={x.icon} data-track={`suggestion-${x.id}`} title={x.label.length > CHIP_CLAMP ? x.label : undefined} disabled={props.loading} onClick={() => props.onSuggestion?.(x.id)}>
                <span className={s.chipLabel}>{x.label}</span>
              </Chip>
            ))}
          </ChipGroup>
        ) : null}
      </div>
    </div>
  );
}
