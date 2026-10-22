/* First-run setup (D81, US-02): 1 AI engine → 2 Check (voice and a real exchange) → 3 About you, which starts the
 * first round. Sets prefs.setupDone on leaving step 3; Settings → About runs it again (AC6). */
import { useEffect, useRef, useState } from "react";
import { AboutStep } from "./setup/AboutStep";
import { CheckStep } from "./setup/CheckStep";
import { EngineStep } from "./setup/EngineStep";
import { SetupFrame } from "./setup/SetupFrame";
import { SETUP_STEPS, type SetupStep } from "./setup/types";
import { useUtScreen } from "../lib/utScreen";

export function SetupWizard() {
  const [step, setStep] = useState<SetupStep>("engine");
  const index = SETUP_STEPS.indexOf(step);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  useUtScreen(`/setup/${step}`);
  const next = () => setStep(SETUP_STEPS[Math.min(index + 1, SETUP_STEPS.length - 1)]!);
  const back = () => setStep(SETUP_STEPS[Math.max(index - 1, 0)]!);

  return (
    <SetupFrame step={step}>
      {step === "engine" ? <EngineStep headingRef={headingRef} onNext={next} /> : null}
      {step === "check" ? <CheckStep headingRef={headingRef} onNext={next} onBack={back} onEngine={() => setStep("engine")} /> : null}
      {step === "about" ? <AboutStep headingRef={headingRef} onBack={back} /> : null}
    </SetupFrame>
  );
}
