/* Per-browser conveniences in localStorage (never state that must persist: that lives in the server's settings).
 * Every access is wrapped: storage can throw in private windows or when site data is blocked. */

export type ThemePref = "system" | "light" | "dark";
export type InputPref = "voice" | "text";
export type SttPref = "server" | "browser";
/** Seconds of quiet before a voice answer is sent. 0 = manual (press Send). */
export type PausePref = 0 | 2 | 3 | 5;

const KEYS = {
  theme: "ic.theme",
  setupDone: "ic.setupDone",
  input: "ic.input",
  sttPref: "ic.stt",
  pause: "ic.pauseSec",
  speak: "ic.speak",
  roundType: "ic.roundType",
  vacancy: "ic.vacancyId",
  railCollapsed: "ic.railCollapsed",
  installDismissed: "ic.installDismissed",
  setupStep: "ic.setupStep",
  tacticsHidden: "ic.tacticsHidden",
} as const;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** The tough-talk practices that show tactic cards before the call (tough-talk.md §3). */
export type TacticsMode = "tough" | "negotiate";

export const prefs = {
  /** "Hide tactics" on the plan card = "don't show again for this mode"; Settings → Practice turns them back on. */
  tacticsHidden(mode: TacticsMode): boolean {
    return (read(KEYS.tacticsHidden) ?? "").split(",").includes(mode);
  },
  setTacticsHidden(mode: TacticsMode, hidden: boolean) {
    const rest = (read(KEYS.tacticsHidden) ?? "").split(",").filter((m) => m && m !== mode);
    write(KEYS.tacticsHidden, (hidden ? [...rest, mode] : rest).join(",") || null);
  },
  /** "Install Vukoli as an app" card on Home: the user said no thanks. */
  installDismissed(): boolean {
    return read(KEYS.installDismissed) === "1";
  },
  setInstallDismissed(v: boolean) {
    write(KEYS.installDismissed, v ? "1" : null);
  },
  /** D57: the sidebar is collapsed to the icon rail (≥ 1024). */
  railCollapsed(): boolean {
    return read(KEYS.railCollapsed) === "1";
  },
  setRailCollapsed(v: boolean) {
    write(KEYS.railCollapsed, v ? "1" : null);
  },
  theme(): ThemePref {
    const v = read(KEYS.theme);
    return v === "light" || v === "dark" ? v : "system";
  },
  setTheme(v: ThemePref) {
    write(KEYS.theme, v === "system" ? null : v);
  },
  setupDone(): boolean {
    return read(KEYS.setupDone) === "1";
  },
  setSetupDone(v: boolean) {
    write(KEYS.setupDone, v ? "1" : null);
    if (v) write(KEYS.setupStep, null);        // the wizard's progress has served its purpose
  },
  /** Where the setup wizard is, as JSON (screens/setup/progress.ts owns the shape): any window opened later resumes there. */
  setupStep(): string | null {
    return read(KEYS.setupStep);
  },
  setSetupStep(v: string | null) {
    write(KEYS.setupStep, v);
  },
  input(): InputPref {
    return read(KEYS.input) === "text" ? "text" : "voice";
  },
  setInput(v: InputPref) {
    write(KEYS.input, v);
  },
  stt(): SttPref {
    return read(KEYS.sttPref) === "browser" ? "browser" : "server";
  },
  setStt(v: SttPref) {
    write(KEYS.sttPref, v);
  },
  pause(): PausePref {
    const n = Number(read(KEYS.pause));
    return n === 0 && read(KEYS.pause) !== null ? 0 : n === 2 || n === 5 ? n : 3;
  },
  setPause(v: PausePref) {
    write(KEYS.pause, String(v));
  },
  speak(): boolean {
    return read(KEYS.speak) !== "0";
  },
  setSpeak(v: boolean) {
    write(KEYS.speak, v ? "1" : "0");
  },
  roundType(): "hr" | "behavioural" | "mix" {
    const v = read(KEYS.roundType);
    return v === "hr" || v === "behavioural" ? v : "mix";
  },
  setRoundType(v: "hr" | "behavioural" | "mix") {
    write(KEYS.roundType, v);
  },
  vacancy(): string {
    return read(KEYS.vacancy) ?? "";
  },
  setVacancy(v: string) {
    write(KEYS.vacancy, v || null);
  },
};
