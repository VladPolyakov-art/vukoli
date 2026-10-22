/* App-wide server state: settings and engine status, loaded once and shared (the rail, Home and Settings all read it). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { EngineInfo, EnginesResponse, Settings, SettingsPatch } from "./types";

export interface AppStore {
  settings: Settings | null;
  engines: EnginesResponse | null;
  enginesLoading: boolean;
  selectedEngine: EngineInfo | null;
  refreshEngines: () => Promise<EnginesResponse | null>;
  updateSettings: (patch: SettingsPatch) => Promise<Settings>;
  reloadSettings: () => Promise<void>;
}

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [engines, setEngines] = useState<EnginesResponse | null>(null);
  const [enginesLoading, setEnginesLoading] = useState(true);
  const inflight = useRef<Promise<EnginesResponse | null> | null>(null);

  const refreshEngines = useCallback(() => {
    if (inflight.current) return inflight.current;
    setEnginesLoading(true);
    const p = api.engines()
      .then((e) => { setEngines(e); return e; })
      .catch(() => null)
      .finally(() => { setEnginesLoading(false); inflight.current = null; });
    inflight.current = p;
    return p;
  }, []);

  const reloadSettings = useCallback(async () => {
    try {
      setSettings(await api.settings());
    } catch {
      /* shown by the screens that need it */
    }
  }, []);

  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    const next = await api.saveSettings(patch);
    setSettings(next);
    if (patch.engine || patch.ollama || patch.openai_compatible || patch.gemini_live || patch.claude_cli || patch.codex_cli || patch.antigravity_cli) void refreshEngines();
    return next;
  }, [refreshEngines]);

  useEffect(() => {
    void reloadSettings();
    void refreshEngines();
    const id = window.setInterval(() => { void refreshEngines(); }, 30000);
    return () => window.clearInterval(id);
  }, [reloadSettings, refreshEngines]);

  const selectedEngine = useMemo(
    () => engines?.engines.find((e) => e.id === engines.selected) ?? null,
    [engines],
  );

  const value = useMemo<AppStore>(
    () => ({ settings, engines, enginesLoading, selectedEngine, refreshEngines, updateSettings, reloadSettings }),
    [settings, engines, enginesLoading, selectedEngine, refreshEngines, updateSettings, reloadSettings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Supplies a ready-made store value: stories and the review page (no network, no polling). */
export function AppStoreProvider({ value, children }: { value: AppStore; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
