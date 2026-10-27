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

export const prefs = {
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
