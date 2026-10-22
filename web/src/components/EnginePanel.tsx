/* AI engine: Settings → AI engine is one view without steps (D78, EngineSettings): the engine in use on top, the
 * others under it, each set up in place. Setup step 1 (D81) shows the engine in use as one row and opens the same
 * view on "Change" or while it isn't ready. Status comes from GET /api/engines; every not-ready state has a concrete
 * way forward (link, command to copy, form). */
import type { EngineId } from "../lib/types";
import { EngineSettings } from "./engine/EngineSettings";

export { EngineStatus } from "./engine/EngineStatus";
export { EngineTest } from "./engine/EngineTest";

export interface EnginePanelProps {
  /** Review and stories: open with that engine's setup expanded. */
  initialPick?: EngineId;
}

export function EnginePanel({ initialPick }: EnginePanelProps) {
  return <EngineSettings initialOpen={initialPick} />;
}
