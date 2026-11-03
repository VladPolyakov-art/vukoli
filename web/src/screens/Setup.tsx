/* First-run setup (D81, US-02): 1 AI engine → 2 Check (voice and a real exchange) → 3 About you, which starts the
 * first round. Sets prefs.setupDone on leaving step 3; Settings → About runs it again (AC6).
 * D104: when the browser can install Vukoli, a step "Install" comes first (4 steps); see setup/installGate.ts.
 * The current step and the answers are kept in localStorage (setup/progress.ts): the app installed from step 0 opens in a
 * new window, which resumes right where the wizard was; so does a reload or a reopened window. */
import { useEffect, useRef, useState } from "react";
import { ToastProvider } from "../ds";
import { AboutStep } from "./setup/AboutStep";
import { CheckStep } from "./setup/CheckStep";
import { EngineStep } from "./setup/EngineStep";
import { InstallStep } from "./setup/InstallStep";
import { SetupFrame } from "./setup/SetupFrame";
import { useInstallGate } from "./setup/installGate";
import { readProgress, saveStep } from "./setup/progress";
import { setupSteps, type SetupStep } from "./setup/types";
import { UT_PENDING, useUtScreen } from "../lib/utScreen";

export function SetupWizard() {
  // Read once: what an earlier window (or this one before a reload) left behind.
  const [saved] = useState(readProgress);
  const gate = useInstallGate(undefined, saved !== null);
  const withInstall = saved ? saved.withInstall : gate === "show";
  const steps = setupSteps(withInstall);
  // Until the gate decides (at most ~1.5 s) the frame is quiet: no step yet.
  const [picked, setPicked] = useState<SetupStep | null>(saved?.step ?? null);
  const step: SetupStep | null = picked ?? (gate === "show" ? "install" : gate === "skip" ? "engine" : null);
  const index = step ? steps.indexOf(step) : -1;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  useEffect(() => { if (step && step !== "install") saveStep(step, withInstall); }, [step, withInstall]);
  useUtScreen(step ? `/setup/${step}` : UT_PENDING);
  const next = () => setPicked(steps[Math.min(index + 1, steps.length - 1)]!);
  const back = () => setPicked(steps[Math.max(index - 1, 0)]!);

  return (
    <ToastProvider>
      <SetupFrame step={step} steps={steps}>
        {step === "install" ? <InstallStep headingRef={headingRef} onNext={next} /> : null}
        {step === "engine" ? <EngineStep headingRef={headingRef} onNext={next} /> : null}
        {step === "check" ? <CheckStep headingRef={headingRef} onNext={next} onBack={back} onEngine={() => setPicked("engine")} /> : null}
        {step === "about" ? <AboutStep headingRef={headingRef} onBack={back} /> : null}
      </SetupFrame>
    </ToastProvider>
  );
}
