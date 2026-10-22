/* Home v2 (ds/screens/home.md v2, D47a/b): a start screen that turns into a short setup chat with Mike.
 * A pure view: every state of the map is a set of props (the live container is HomeScreen.tsx, the review harness is
 * frames.tsx; both run the same script). Home owns a definite-height column inside <main> (absolute, inset 0), so the
 * setup header and the bottom composer stay put while only the chat scrolls — no sticky inside a scaled review frame.
 * - start: banners · greeting · composer · suggestions, centred a little above the middle; footer line at the bottom.
 * - setup: header row · chat (scrolls) · composer + footer at the bottom. The composer moves from the middle to the
 *   bottom by FLIP (motion "Home → setup chat"); under reduced motion it simply appears there.
 * - D89: the setup composer takes a file too (+, paste, drop): at the job question it's the job, later it's the CV.
 * - D90: the chat composer is one row, [+] [text] [mic → send], and keeps those controls while the chat runs; the mic
 *   dictates into the field. The chat scrolls under the composer (it floats on a short fade), so messages stay in view
 *   down to the composer instead of being cut off above it. */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Composer, ComposerAttachment, IconButton, type ComposerSend } from "../../ds";
import { durationMs } from "../../ds/motion";
import { t } from "../../i18n";
import { Banners } from "./parts/Banners";
import { SetupChat, SetupHeader } from "./parts/SetupChat";
import { Footer, StartScreen } from "./parts/StartScreen";
import type { HomeViewProps } from "./types";
import s from "./HomeView.module.css";

/** The `page` container is < 560 (placeholders get shorter). Measured on Home's own box (same width as <main>). */
function useNarrow(ref: RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
}

export function HomeView(props: HomeViewProps) {
  const { step, track, setup, composer, leaving, overlay } = props;
  const root = useRef<HTMLDivElement>(null);
  const startComposer = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const startTop = useRef<number | null>(null);
  const narrow = useNarrow(root);

  // "Adjusting state on a prop change": the chat is entering only when this view saw the start step first.
  const [prevStep, setPrevStep] = useState(step);
  const [entering, setEntering] = useState(false);
  if (prevStep !== step) {
    setPrevStep(step);
    setEntering(prevStep === "start" && step === "setup");
  }

  // Remember where the start composer is, for the FLIP when the chat opens.
  useLayoutEffect(() => {
    if (step === "start" && startComposer.current) startTop.current = startComposer.current.getBoundingClientRect().top;
  });

  useLayoutEffect(() => {
    if (step !== "setup" || !entering || startTop.current === null || !dock.current) return;
    const el = dock.current;
    const ms = durationMs("--duration-slower");
    const dy = startTop.current - el.getBoundingClientRect().top;
    startTop.current = null;
    if (!ms || !dy || typeof el.animate !== "function") return;
    const ease = getComputedStyle(el).getPropertyValue("--ease-standard").trim() || "ease";
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: ms, easing: ease });
  }, [step, entering]);

  // The chat leaves room under its last message for the floating composer (its height changes with the text, a file
  // card, an error). Set before the chat scrolls to its end; a chat read to the end stays at the end when it grows.
  useLayoutEffect(() => {
    const el = dock.current;
    const host = body.current;
    const box = scroller.current;
    if (!el || !host || !box) return;
    const fit = () => {
      const atEnd = box.scrollHeight - box.clientHeight - box.scrollTop < 4;
      host.style.setProperty("--dock-h", `${el.offsetHeight}px`);
      if (atEnd) box.scrollTop = box.scrollHeight;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  const banners = (
    <Banners
      engine={props.engineBanner}
      browser={props.browserBanner}
      storage={props.storageError}
      onRetryEngine={props.onRetryEngine}
      onUseTextMode={props.onUseTextMode}
      onDismissBrowser={props.onDismissBrowser}
    />
  );
  const dictation = props.dictation;
  const hearing = dictation?.state === "listening" || dictation?.state === "transcribing";
  const placeholder = dictation?.state === "listening" ? t("chat.dictate.listening")
    : dictation?.state === "transcribing" ? t("chat.dictate.working")
      : setup?.stage === "plan" ? t("chat.setup.placeholderPlan")
        : setup?.stage === "job" ? t("chat.setup.placeholderJob") : t("chat.setup.placeholderReply");
  const hasInput = Boolean(composer.text.trim() || composer.file);
  /* The end button: Send with text or a file, otherwise the mic (stop while it listens), as on the start screen. */
  const send: ComposerSend = (hasInput && !hearing) || !dictation?.available
    ? { label: t("chat.start.send"), icon: "arrowRight", variant: "action", hidden: !hasInput, track: "composer-send", onSend: props.onSend }
    : {
      label: t(hearing ? "chat.dictate.stop" : "chat.dictate.start"),
      icon: hearing ? "stop" : "mic",
      variant: hearing ? "action" : "quiet",
      busy: dictation.state === "transcribing",
      track: hearing ? "composer-dictate-stop" : "composer-dictate",
      onSend: props.onDictate,
    };
  const english = track === "english";
  const addFile = english ? null : (
    <IconButton icon="plus" size="sm" outlined label={t(setup?.stage === "job" ? "chat.setup.addJobFile" : "chat.setup.addCv")} data-track="composer-add-file" onClick={props.onAddFile} />
  );
  const rootClass = [s.home, leaving ? "motion-soft-out" : ""].filter(Boolean).join(" ");

  return (
    <div ref={root} className={rootClass} data-review-id={step === "start" ? "Home/Start" : "Home/Setup"} aria-busy={props.loading || undefined}>
      {step === "start" ? (
        <div className={s.startPage}>
          <div className={s.column}>
            {banners}
            <div className={s.startCenter}>
              <StartScreen {...props} narrow={narrow} composerRef={startComposer} />
            </div>
            <div className={s.startFooter}><Footer track={track} /></div>
          </div>
        </div>
      ) : (
        <>
          <div className={s.top}>
            <div className={s.column}><SetupHeader setup={setup} onSkip={props.onSkip} /></div>
          </div>
          <div ref={body} className={s.body}>
            <div ref={scroller} className={s.scroller}>
              <div className={`${s.column} ${s.chat}`}>
                {banners}
                <SetupChat {...props} entering={entering} scroller={scroller} />
              </div>
            </div>
            <div ref={dock} className={s.dock} data-review-id="Home/Setup/Composer" data-review-section="Home · Setup composer" data-comment-target>
              <div className={s.column}>
                <Composer
                  label={t("chat.setup.label")}
                  placeholder={placeholder}
                  value={composer.text}
                  minRows={1}
                  maxRows={6}
                  submitOnEnter={!hearing}
                  readOnly={hearing}
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
                  leading={addFile}
                  error={dictation?.error}
                  send={send}
                />
                <Footer track={track} />
              </div>
            </div>
          </div>
        </>
      )}
      {overlay}
    </div>
  );
}
