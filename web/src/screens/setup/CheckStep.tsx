/* Setup → Check (D81, US-02 AC2/AC4/AC7). Pick Mike's voice, then one real exchange: say a phrase → see what was
 * recognised → Mike answers in that voice → "It works". Telemetry is one unticked checkbox next to "It works".
 * A blocked or missing mic names the cause and the fix and offers the keyboard. */
import { useEffect, useRef, useState } from "react";
import { Button, Callout, ChatLog, ChatMessage, Checkbox, MicButton, Presence, Select, SettingGroup, SettingRow, type PresenceState } from "../../ds";
import { t } from "../../i18n";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/hooks";
import { prefs } from "../../lib/prefs";
import { useApp } from "../../lib/store";
import { StepFooter, StepHead, type HeadingRef } from "./SetupFrame";
import { useSetupSave } from "./useSetupSave";
import type { CheckState } from "./types";
import { useVoiceCheck } from "./useVoiceCheck";
import s from "./Setup.module.css";

export interface CheckStepProps {
  headingRef?: HeadingRef;
  onNext: () => void;
  onBack: () => void;
  /** "Back to AI engine" when the engine didn't answer. */
  onEngine: () => void;
  /** Review and stories: show this state of the check (a static mic level while listening). */
  initial?: CheckState;
  level?: number;
  /** Review and stories: Mike's reply is playing (the glow speaks). */
  speaking?: boolean;
  /** Review and stories: a failed save of the voice (Q8). */
  initialSaveError?: string;
}

export function CheckStep({ headingRef, onNext, onBack, onEngine, initial, level, speaking: initialSpeaking, initialSaveError }: CheckStepProps) {
  const { settings } = useApp();
  const { save, view: saveView } = useSetupSave(initialSaveError);
  const voices = useLoad(() => api.voices());
  const stt = useLoad(() => api.stt());
  const [share, setShare] = useState(false);
  const voice = settings?.voice || voices.data?.default || "";
  const ttsOk = voices.data?.tts.available !== false;
  const check = useVoiceCheck({ voice, serverStt: Boolean(stt.data?.available), initial, initialSpeaking });
  const [sampling, setSampling] = useState(false);
  const sample = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => sample.current?.pause(), []);
  const { state } = check;
  // D82: the Session's presence glow along the top — your mic while you talk, a sweep while Mike thinks, his voice
  // while the reply (or the sample) plays.
  const presence: PresenceState = state.phase === "listening" ? "listening" : state.phase === "thinking" ? "thinking"
    : check.speaking || sampling ? "speaking" : "idle";

  const playSample = () => {
    sample.current?.pause();
    const a = new Audio(api.voiceSampleUrl(voice));
    sample.current = a;
    a.onplaying = () => setSampling(true);
    a.onpause = a.onended = () => setSampling(false);
    void a.play().catch(() => setSampling(false));
  };
  const leave = (input: "voice" | "text") => {
    check.stop();
    sample.current?.pause();
    prefs.setInput(input);
    onNext();
  };
  const works = () => {
    if (share) void api.setTelemetry(true).catch(() => {});
    leave("voice");
  };
  const retry = () => void check.start();

  return (
    <>
      <div className={s.presenceBox} aria-hidden="true">
        <Presence state={presence} level={presence === "listening" ? level : undefined}
          getLevel={presence === "listening" && !initial ? check.getLevel : undefined} />
      </div>
      <StepHead headingRef={headingRef} title={t("setup.check.title")} />
      {saveView}
      <div data-review-id="Setup/Check" data-review-section="Setup · Check" data-comment-target>
        <SettingGroup title={t("setup.check.group")} hideTitle headingLevel={2}>
          {ttsOk ? (
            <SettingRow id="setup-voice" label={t("setup.check.voice")}>
              <Select track="setup-voice" label={t("setup.check.voice")} hideLabel width="content" value={voice} disabled={!voices.data}
                onChange={(v) => void save({ voice: v })}
                options={(voices.data?.voices ?? []).map((v) => ({ value: v.id, label: `${v.label} · ${v.locale}` }))} />
              <Button variant="secondary" icon="play" data-track="setup-voice-sample" onClick={playSample} disabled={!voice}>{t("setup.check.sample")}</Button>
            </SettingRow>
          ) : <Callout tone="info">{t("setup.check.voiceMissing")}</Callout>}
          <div className={s.checkArea}>
            <CheckBody state={state} level={level} getLevel={initial ? undefined : check.getLevel}
              onStart={retry} onFinish={check.finish} onReplay={check.replay} onEngine={onEngine} />
          </div>
        </SettingGroup>
      </div>
      {state.phase === "done" ? (
        <div className={s.telemetry}>
          <Checkbox data-track="setup-telemetry" label={t("setup.check.telemetry")} description={t("setup.check.telemetryHint")} checked={share} onChange={(e) => setShare(e.target.checked)} />
        </div>
      ) : null}
      <StepFooter back={<Button variant="ghost" icon="chevronLeft" data-track="setup-back" onClick={() => { check.stop(); onBack(); }}>{t("common.back")}</Button>}>
        {state.phase === "done" ? (
          <>
            <Button variant="ghost" data-track="setup-try-again" onClick={retry}>{t("setup.check.tryAgain")}</Button>
            <Button variant="primary" iconRight="arrowRight" data-track="setup-works" onClick={works}>{t("setup.check.works")}</Button>
          </>
        ) : <Button variant="secondary" icon="keyboard" data-track="setup-type-instead" onClick={() => leave("text")}>{t("setup.check.typeInstead")}</Button>}
      </StepFooter>
    </>
  );
}

interface CheckBodyProps {
  state: CheckState;
  level?: number;
  getLevel?: () => number;
  onStart: () => void;
  onFinish: () => void;
  onReplay: () => void;
  onEngine: () => void;
}

function CheckBody({ state, level, getLevel, onStart, onFinish, onReplay, onEngine }: CheckBodyProps) {
  if (state.phase === "idle" || state.phase === "listening") {
    const live = state.phase === "listening";
    return (
      <div className={s.check}>
        <MicButton data-track={live ? "setup-mic-done" : "setup-mic-start"} label={live ? t("setup.check.done") : t("setup.check.start")} muted={false} live={live}
          getLevel={live ? getLevel : undefined} level={live ? level : undefined} onClick={live ? onFinish : onStart} />
        <p className={s.checkLine} role="status">{live ? t("setup.check.listening") : t("setup.check.idle")}</p>
        {live ? <Button size="sm" variant="secondary" data-track="setup-mic-done" onClick={onFinish}>{t("setup.check.done")}</Button> : null}
      </div>
    );
  }
  if (state.phase === "error") {
    // The keyboard way out is the footer's one "I'll type instead" (F-13-10): not repeated in the callout.
    return (
      <Callout tone={state.code === "engine" || state.code === "failed" ? "error" : "warning"} live="alert"
        title={t(`setup.check.error.${state.code}.title`)}
        actions={(
          <>
            {state.code !== "no_stt" ? <Button size="sm" data-track="setup-try-again" onClick={onStart}>{t("setup.check.tryAgain")}</Button> : null}
            {state.code === "engine" ? <Button size="sm" variant="ghost" data-track="setup-back-to-engine" onClick={onEngine}>{t("setup.check.engineBack")}</Button> : null}
          </>
        )}>
        {t(`setup.check.error.${state.code}.body`, { message: state.message ?? "" })}
      </Callout>
    );
  }
  const heard = state.heard;
  return (
    <div className={s.exchange}>
      <ChatLog label={t("setup.check.group")}>
        {heard ? <ChatMessage speaker="user" animate>{heard}</ChatMessage>
          : <ChatMessage speaker="user" state="pending" pendingLabel={t("setup.check.recognising")} />}
        {state.phase === "thinking" ? (
          heard ? <ChatMessage speaker="mike" name={t("chat.setup.mike")} state="pending" pendingLabel={t("setup.check.answering")} /> : null
        ) : (
          <ChatMessage speaker="mike" name={t("chat.setup.mike")} animate
            actions={state.audio ? <Button size="sm" variant="ghost" icon="play" data-track="setup-replay" onClick={onReplay}>{t("setup.check.replay")}</Button> : undefined}>
            {state.reply}
          </ChatMessage>
        )}
      </ChatLog>
    </div>
  );
}
