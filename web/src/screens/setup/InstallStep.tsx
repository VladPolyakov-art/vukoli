/* Setup → Install (D104): put Vukoli in the Dock / on the taskbar. Shown first, only when the browser can install it
 * (the launcher opens Vukoli in a plain Chrome window until it is installed, so the Dock shows Chrome's icon).
 * "Install Vukoli" opens the browser's own dialog. Accepted: the browser opens the installed app in a new window; this
 * window waits for it to say hello and closes itself (setup/installHandoff.ts), the new window resumes setup at the
 * engine from the stored progress. If no window answers, or this one cannot close, setup goes on right here and one
 * toast says where to open Vukoli next time. Cancelled or unavailable: on to the engine. Skip: on to the engine. */
import { useRef, useState } from "react";
import { Button, useToast } from "../../ds";
import { t } from "../../i18n";
import { iconPlace, useInstallOffer } from "../../lib/installApp";
import { windowLink } from "../../lib/windowLink";
import { handOffToInstalledApp } from "./installHandoff";
import { saveStep } from "./progress";
import { StepHead, type HeadingRef } from "./SetupFrame";
import s from "./Setup.module.css";

/** idle → installing (the browser's dialog is open, then waiting for the installed app's window). */
export type InstallPhase = "idle" | "installing";

export interface InstallStepProps {
  headingRef?: HeadingRef;
  onNext: () => void;
  /** Review and stories: show this state. */
  initialPhase?: InstallPhase;
  /** Review and stories: which icon place the copy names. */
  place?: "dock" | "taskbar";
}

export function InstallStep({ headingRef, onNext, initialPhase = "idle", place }: InstallStepProps) {
  const { install } = useInstallOffer();
  const toast = useToast();
  const [phase, setPhase] = useState<InstallPhase>(initialPhase);
  const where = place ?? iconPlace(typeof navigator === "undefined" ? "" : navigator.userAgent);
  const running = useRef(false);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setPhase("installing");
    const since = Date.now();
    // Every way out of this step leads to the engine, so the new window (which may load before the browser's answer
    // reaches this one) can already resume there.
    saveStep("engine", true);
    const outcome = await install();
    if (outcome !== "accepted") { onNext(); return; }
    await handOffToInstalledApp({ link: windowLink(), since });
    // Still here: no new window said hello, or this one would not close. Carry on in this window.
    toast.show({ message: t("setup.install.stay", { from: t(where === "dock" ? "setup.install.fromDock" : "setup.install.fromTaskbar") }) });
    onNext();
  };

  return (
    <>
      <StepHead
        headingRef={headingRef}
        title={t("setup.install.title", { where: t(where === "dock" ? "setup.install.whereDock" : "setup.install.whereTaskbar") })}
        sub={t("setup.install.body", { from: t(where === "dock" ? "setup.install.fromDock" : "setup.install.fromTaskbar") })}
      />
      <div className={s.installActions}>
        <Button variant="primary" icon="download" data-track="setup-install" loading={phase === "installing"} onClick={() => void run()}>{t("setup.install.action")}</Button>
        <Button variant="secondary" data-track="setup-install-skip" disabled={phase === "installing"} onClick={onNext}>{t("setup.install.skip")}</Button>
      </div>
    </>
  );
}
