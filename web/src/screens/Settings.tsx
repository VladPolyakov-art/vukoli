/* Settings (D76: a popup like Claude's, over the page you were on): a search field and the sections on the left, the
 * section on the right. Every setting is one row — name and description left, the control right (SettingRow); rows
 * sit in titled groups, one rounded box each (SettingGroup, D78), so a section's parts are easy to tell apart.
 * Sections (D78): general (your CV: files to drop, replace or remove — several, D79 — and your own text under a
 * disclosure; the theme), AI engine (the
 * engine in use on top, the others under it, each set up in place), voice and speech, practice, privacy and data,
 * about and what's free (D58: the free-vs-premium table of US-30, practice-only statement, licence; `#free` anchor).
 * Deep links stay: /settings/<section>[#<row>] opens the popup at that row; old sections redirect (profile → general).
 * A change saves at once and says nothing (D79): the control shows the new value; only an error shows. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useNavigationType, type Location } from "react-router-dom";
import {
  Badge, Button, Callout, CopyField, Dialog, Icon, IconButton, Input, Segmented, Select, SettingGroup,
  SettingRow, Skeleton, Toggle, scrollBehavior, type IconName,
} from "../ds";
import { t, tp, type MessageKey } from "../i18n";
import { EnginePanel } from "../components/EnginePanel";
import { ProfileEditor } from "../components/ProfileEditor";
import { browserSttSupported } from "../audio/browserStt";
import { api } from "../lib/api";
import { useLoad } from "../lib/hooks";
import { iconPlace, useInstallOffer } from "../lib/installApp";
import { prefs, type PausePref } from "../lib/prefs";
import { errorMessage, useApp } from "../lib/store";
import { useTheme } from "../lib/theme";
import type { Level, SettingsPatch } from "../lib/types";
import s from "./Settings.module.css";

const SECTIONS: { id: SectionId; icon: IconName }[] = [
  { id: "general", icon: "settings" },
  { id: "engine", icon: "sparkle" },
  { id: "voice", icon: "mic" },
  { id: "practice", icon: "target" },
  { id: "privacy", icon: "lock" },
  { id: "about", icon: "info" },
];
export type SectionId = "general" | "engine" | "voice" | "practice" | "privacy" | "about";
const DEFAULT_SECTION: SectionId = "general";
/** Old section names that links still use, with the row they meant. */
const ALIASES: Record<string, { section: SectionId; hash?: string }> = {
  storage: { section: "privacy" },
  profile: { section: "general", hash: "profile-cv" },
  appearance: { section: "general", hash: "general-theme" },
};
/** How long the "Saved" toast stays (D78): long enough to read one word. */
/** The server keeps at most 60 characters of the name (D80). */
const NAME_MAX = 60;

/* ---------- search ---------- */

interface SearchItem { id: string; section: SectionId; label: MessageKey; description?: MessageKey; keywords?: string }

/** Every row a search can find. `id` is the row's anchor in its section. */
const SEARCH: SearchItem[] = [
  { id: "engine", section: "engine", label: "settings.section.engine", description: "settings.search.engine", keywords: "model ollama gemini openai claude api key local llm" },
  { id: "voice-voice", section: "voice", label: "settings.voice.voice", description: "settings.voice.title", keywords: "tts kokoro sample" },
  { id: "voice-speed", section: "voice", label: "settings.voice.speed", keywords: "rate fast slow" },
  { id: "voice-speak", section: "voice", label: "settings.voice.speak", description: "settings.voice.speakHint", keywords: "mute sound audio" },
  { id: "voice-stt", section: "voice", label: "settings.voice.sttWhere", keywords: "speech recognition stt microphone mic browser whisper" },
  { id: "voice-pause", section: "voice", label: "settings.voice.pause", description: "settings.voice.pauseHint", keywords: "silence send" },
  { id: "practice-suggester", section: "practice", label: "settings.practice.suggester", description: "settings.practice.suggesterHint", keywords: "sample answer hint" },
  { id: "practice-order", section: "practice", label: "settings.practice.layerOrder", description: "settings.practice.layerOrderHint", keywords: "feedback content delivery" },
  { id: "practice-strictness", section: "practice", label: "settings.practice.strictness", keywords: "gentle standard tough" },
  { id: "practice-questions", section: "practice", label: "settings.practice.questions", keywords: "count number length" },
  { id: "practice-level", section: "practice", label: "settings.practice.level", keywords: "english a2 b1 b2 c1" },
  { id: "general-name", section: "general", label: "settings.name.title", description: "settings.name.hint", keywords: "name call me address first name you" },
  { id: "profile-cv", section: "general", label: "settings.profile.title", description: "settings.profile.hint", keywords: "resume cv upload pdf docx file profile" },
  { id: "general-theme", section: "general", label: "theme.label", description: "settings.appearance.themeHint", keywords: "dark light mode system appearance" },
  { id: "privacy-telemetry", section: "privacy", label: "settings.privacy.telemetry", description: "settings.privacy.telemetryHint", keywords: "analytics usage statistics" },
  { id: "privacy-folder", section: "privacy", label: "settings.privacy.folder", description: "settings.privacy.folderHint", keywords: "storage files path disk" },
  { id: "privacy-obsidian", section: "privacy", label: "settings.privacy.obsidian", description: "settings.privacy.obsidianHint", keywords: "obsidian markdown export notes" },
  { id: "privacy-trash", section: "privacy", label: "settings.privacy.trash", description: "settings.privacy.trashHint", keywords: "deleted restore" },
  { id: "free", section: "about", label: "settings.about.freeTitle", description: "settings.about.freeIntro", keywords: "premium price cost" },
  { id: "about-setup", section: "about", label: "settings.about.setupRun", description: "settings.about.setupHint", keywords: "onboarding wizard start first run welcome" },
  { id: "about-licence", section: "about", label: "settings.about.licenceTitle", description: "settings.about.licence", keywords: "agpl open source license" },
];

/** Rows whose name, description, section or keywords contain every word of the query. */
export function searchSettings(query: string): SearchItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return SEARCH.filter((item) => {
    const text = [t(item.label), item.description ? t(item.description) : "", t(`settings.section.${item.section}`), item.keywords ?? ""]
      .join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/* ---------- route ---------- */

const HOME: Location = { pathname: "/", search: "", hash: "", state: null, key: "settings-home" };

/** `/settings/<section>` → the section (aliases resolved, unknown → general); null when the path is not Settings. */
/** `bare`: plain /settings (the account menu's "Settings") — on a phone it opens on the list of sections (D82). */
export function settingsSection(pathname: string): { section: SectionId; canonical: boolean; hash?: string; bare?: boolean } | null {
  const m = /^\/settings(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!m) return null;
  const raw = m[1] ?? "";
  if (SECTIONS.some((x) => x.id === raw)) return { section: raw as SectionId, canonical: true };
  const alias = ALIASES[raw];
  return { section: alias?.section ?? DEFAULT_SECTION, canonical: false, hash: alias?.hash, bare: raw === "" };
}

/** Settings open as a popup over the page you came from (D76). Returns the location the page routes should render —
 * the last page before Settings, or Home on a direct visit — and the dialog. Closing goes back in history when Settings
 * was opened from inside the app (section switches replace, so one step back is the page), otherwise to Home. */
export function useSettingsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const route = settingsSection(location.pathname);
  const open = route !== null;
  const [page, setPage] = useState<Location | null>(open ? null : location);
  const [from, setFrom] = useState<"push" | "direct" | null>(null);
  const [section, setSection] = useState<SectionId>(route?.section ?? DEFAULT_SECTION);
  if (!open && page !== location) setPage(location);
  if (!open && from !== null) setFrom(null);
  const [startOnList, setStartOnList] = useState(false);
  if (open && from === null) {
    setFrom(page && navType === "PUSH" ? "push" : "direct");
    setStartOnList(Boolean(route?.bare));
  }
  if (route && route.section !== section) setSection(route.section);

  useEffect(() => {
    if (route && !route.canonical) {
      const hash = location.hash || (route.hash ? `#${route.hash}` : "");
      navigate(`/settings/${route.section}${hash}`, { replace: true, state: location.state });
    }
  }, [route, location.hash, location.state, navigate]);

  const close = () => {
    if (from === "push") navigate(-1);
    else navigate(page ? { pathname: page.pathname, search: page.search, hash: page.hash } : "/", { replace: true });
  };
  const pageLocation = open ? page ?? HOME : location;
  return {
    open,
    pageLocation,
    dialog: <SettingsDialog open={open} section={section} onClose={close} startOnList={startOnList} />,
  };
}

interface ReviewProps {
  /** Review and stories: open with this search typed in. */
  initialQuery?: string;
  /** Review and stories: this content instead of the section's own (e.g. the engine panel at a given step). */
  content?: ReactNode;
  /** Phone (D82): open on the list of sections instead of a section. No effect on a wide popup. */
  startOnList?: boolean;
}

/** Review frames and stories: the popup at the router's current section, nothing behind it. */
export function SettingsScreen(props: ReviewProps) {
  const { pathname } = useLocation();
  return <SettingsDialog open section={settingsSection(pathname)?.section ?? DEFAULT_SECTION} onClose={() => {}} {...props} />;
}

export function SettingsDialog({ open, section, onClose, ...review }: { open: boolean; section: SectionId; onClose: () => void } & ReviewProps) {
  return (
    <Dialog open={open} size="lg" title={t("settings.title")} closeLabel={t("common.close")} onClose={onClose} closeOnBackdrop>
      <SettingsBody section={section} {...review} />
    </Dialog>
  );
}

function SettingsBody({ section, initialQuery = "", content: override, startOnList = false }: { section: SectionId } & ReviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(initialQuery);
  /* D82, like Claude on a phone: the list of sections (search on top, one row per section with a chevron), then the
   * section on its own with "‹ Settings" back to the list. A wide popup shows both side by side and ignores this. */
  const [view, setView] = useState<"list" | "section">(startOnList ? "list" : "section");
  const results = query.trim() ? searchSettings(query) : null;
  const content = useRef<HTMLDivElement>(null);

  // A row named by the hash (deep link, search result): scroll it into view and mark it. Rows of a loading section
  // appear a moment later, so look again for a short while.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id || results) return;
    let tries = 0;
    let unmark = 0;
    const find = window.setInterval(() => {
      const el = document.getElementById(id);
      if (!el && ++tries < 20) return;
      window.clearInterval(find);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      el.setAttribute("data-found", "");
      unmark = window.setTimeout(() => el.removeAttribute("data-found"), 2600);
    }, 100);
    return () => { window.clearInterval(find); window.clearTimeout(unmark); };
    // location.key: the same result picked twice marks it again.
  }, [location.key, location.hash, section, results]);

  const go = (item: SearchItem) => {
    setQuery("");
    setView("section");
    navigate(`/settings/${item.section}${item.id === item.section ? "" : `#${item.id}`}`, { replace: true });
  };

  return (
    <div className={s.layout} data-view={view} data-searching={results ? "" : undefined}>
      <div className={s.side}>
        <div className={s.search} role="search">
          <Input
            type="search"
            data-track="settings-search"
            label={t("settings.search.label")}
            hideLabel
            placeholder={t("settings.search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && results?.[0]) go(results[0]); }}
            adornment={query
              ? <IconButton icon="x" size="sm" label={t("settings.search.clear")} data-track="settings-search-clear" onClick={() => setQuery("")} />
              : <span className={s.searchIcon}><Icon name="search" size="sm" /></span>}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <nav aria-label={t("settings.sections")}>
          <ul className={s.nav}>
            {SECTIONS.map((x) => (
              <li key={x.id}>
                <Link className={s.navLink} to={`/settings/${x.id}`} data-track={`settings-nav-${x.id}`} replace onClick={() => { setQuery(""); setView("section"); }}
                  aria-current={!results && x.id === section ? "page" : undefined}>
                  <Icon name={x.icon} size="sm" />{t(`settings.section.${x.id}`)}
                  <span className={s.navChevron} aria-hidden="true"><Icon name="chevronRight" size="sm" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div key={results ? "search" : section} ref={content} className={s.content}>
        {results ? <SearchResults query={query.trim()} results={results} onPick={go} /> : (
          <>
            <button type="button" className={s.back} data-track="settings-all" onClick={() => setView("list")}>
              <Icon name="chevronLeft" size="sm" />{t("settings.allSettings")}
            </button>
            <h2 className={s.pageTitle}>{t(`settings.section.${section}`)}</h2>
            {override ?? <SectionContent id={section} />}
          </>
        )}
      </div>
    </div>
  );
}

function SearchResults({ query, results, onPick }: { query: string; results: SearchItem[]; onPick: (item: SearchItem) => void }) {
  return (
    <section aria-labelledby="settings-results" className={s.results}>
      <h2 id="settings-results" className={s.resultsTitle} role="status">
        {results.length ? tp("settings.search.results", results.length) : t("settings.search.empty", { q: query })}
      </h2>
      {results.length ? (
        <ul className={s.resultList}>
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" className={s.result} data-track="settings-search-result" onClick={() => onPick(item)}>
                <span className={s.resultLabel}>{t(item.label)}</span>
                <span className={s.resultMeta}>
                  {t(`settings.section.${item.section}`)}
                  {item.description ? ` · ${t(item.description)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SectionContent({ id }: { id: SectionId }) {
  if (id === "general") return <GeneralSection />;
  if (id === "engine") return <div id="engine"><EnginePanel /></div>;
  if (id === "voice") return <VoiceSection />;
  if (id === "practice") return <PracticeSection />;
  if (id === "privacy") return <PrivacySection />;
  return <AboutSection />;
}

/** Saves a settings patch. D79: no "Saved" message — the control already shows the new value; only an error shows,
 * as a callout where the rows are. */
function useSave() {
  const { updateSettings } = useApp();
  const [error, setError] = useState("");
  const save = async (patch: SettingsPatch) => {
    setError("");
    try {
      await updateSettings(patch);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const view = error ? <Callout tone="error" live="alert">{t("settings.saveError", { message: error })}</Callout> : null;
  return { save, view };
}

function GeneralSection() {
  const [theme, setTheme] = useTheme();
  return (
    <>
      <NameGroup />
      <CvGroup />
      <SettingGroup title={t("settings.appearance.title")} id="appearance-title">
        <SettingRow id="general-theme" label={t("theme.label")} description={t("settings.appearance.themeHint")}>
          <Segmented
            label={t("theme.label")}
            track="settings-theme"
            hideLabel
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: t("theme.system"), icon: "monitor" },
              { value: "light", label: t("theme.light"), icon: "sun" },
              { value: "dark", label: t("theme.dark"), icon: "moon" },
            ]}
          />
        </SettingRow>
      </SettingGroup>
      <InstallGroup />
    </>
  );
}

/** The browser offers to install Vukoli as an app (src/lib/installApp.ts): the group is there only while it can. */
function InstallGroup() {
  const { canInstall, install } = useInstallOffer();
  if (!canInstall) return null;
  const where = t(iconPlace(navigator.userAgent) === "dock" ? "install.dock" : "install.taskbar");
  return (
    <SettingGroup title={t("install.settingsTitle")} id="install-title">
      <SettingRow id="general-install" label={t("install.settingsLabel")} description={t("install.settingsHint", { where })}>
        <Button variant="secondary" size="sm" icon="download" data-track="settings-install" onClick={() => { void install(); }}>{t("install.action")}</Button>
      </SettingRow>
    </SettingGroup>
  );
}

/** D80: the name Mike calls you by; it also replaces "You" in the sidebar. Saved when the field loses focus or on Enter. */
function NameGroup() {
  const { settings } = useApp();
  const { save, view } = useSave();
  const [draft, setDraft] = useState<string | null>(null);
  if (!settings) return <Skeleton lines={2} />;
  const value = draft ?? settings.name;
  const commit = () => {
    if (draft === null) return;
    const next = draft.split(/\s+/).filter(Boolean).join(" ").slice(0, NAME_MAX);
    setDraft(null);
    if (next !== settings.name) void save({ name: next });
  };
  return (
    <SettingGroup title={t("settings.name.title")} id="name-title">
      <SettingRow id="general-name" label={t("settings.name.label")} description={t("settings.name.hint")}>
        <Input label={t("settings.name.label")} hideLabel data-track="settings-name" className={s.nameInput} value={value} maxLength={NAME_MAX}
          placeholder={t("settings.name.placeholder")} autoComplete="given-name" spellCheck={false}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
      </SettingRow>
      {view}
    </SettingGroup>
  );
}

/** Your CV (D78, D79): the files and the text about yourself, shared with Setup → About you (D81). */
function CvGroup() {
  return (
    <SettingGroup title={t("settings.profile.title")} id="profile-title" description={t("settings.profile.hint")}>
      <ProfileEditor id="profile-cv" />
    </SettingGroup>
  );
}

function VoiceSection() {
  const { settings } = useApp();
  const voices = useLoad(() => api.voices());
  const stt = useLoad(() => api.stt());
  const { save, view } = useSave();
  const [speak, setSpeak] = useState(prefs.speak());
  const [sttPref, setSttPref] = useState(prefs.stt());
  const [pause, setPause] = useState<PausePref>(prefs.pause());
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  if (!settings) return <Skeleton lines={4} />;
  const ttsOk = voices.data?.tts.available !== false;
  const voice = settings.voice || voices.data?.default || "";
  const play = () => {
    audio.current?.pause();
    audio.current = new Audio(api.voiceSampleUrl(voice));
    void audio.current.play().catch(() => {});
  };
  const browserOk = browserSttSupported();
  const serverOk = stt.data?.available !== false;
  // D78: one description for both choices, so switching does not move the text. Only a missing option adds a line.
  const sttHint = (
    <>
      {t("settings.voice.sttHint")}
      {!serverOk ? <span className={s.descNote}>{t("settings.voice.sttServerMissing")}</span> : null}
      {!browserOk ? <span className={s.descNote}>{t("settings.voice.sttBrowserUnsupported")}</span> : null}
    </>
  );
  return (
    <>
      <SettingGroup title={t("settings.voice.title")} id="voice-title">
        {!ttsOk ? <Callout tone="info">{t("settings.voice.unavailable")}</Callout> : null}
        <SettingRow id="voice-voice" label={t("settings.voice.voice")}>
          <Select
            track="settings-voice"
            label={t("settings.voice.voice")}
            hideLabel
            width="content"
            value={voice}
            disabled={!ttsOk || !voices.data}
            onChange={(v) => void save({ voice: v })}
            options={(voices.data?.voices ?? []).map((v) => ({ value: v.id, label: `${v.label} · ${v.locale}` }))}
          />
          <IconButton icon="play" label={t("settings.voice.sample")} data-track="settings-voice-sample" onClick={play} disabled={!ttsOk || !voice} />
        </SettingRow>
        <SettingRow id="voice-speed" label={t("settings.voice.speed")}>
          <Select
            track="settings-speed"
            label={t("settings.voice.speed")}
            hideLabel
            width="content"
            value={String(settings.kokoro_speed)}
            disabled={!ttsOk}
            onChange={(v) => void save({ kokoro_speed: Number(v) })}
            options={[0.8, 0.9, 1, 1.1, 1.2].map((n) => ({ value: String(n), label: t("settings.voice.speedValue", { n }) }))}
          />
        </SettingRow>
        <SettingRow id="voice-speak" label={t("settings.voice.speak")} description={t("settings.voice.speakHint")}>
          <Toggle label={t("settings.voice.speak")} hideLabel track="settings-speak" checked={speak}
            onChange={(v) => { setSpeak(v); prefs.setSpeak(v); }} />
        </SettingRow>
      </SettingGroup>
      {view}
      <SettingGroup title={t("settings.voice.stt")} id="stt-title">
        <SettingRow id="voice-stt" label={t("settings.voice.sttWhere")} description={sttHint}>
          <Segmented
            track="settings-stt"
            label={t("settings.voice.stt")}
            hideLabel
            value={sttPref}
            onChange={(v) => { setSttPref(v); prefs.setStt(v); }}
            options={[
              { value: "server", label: t("settings.voice.sttServer"), icon: "lock", disabled: !serverOk },
              { value: "browser", label: t("settings.voice.sttBrowser"), icon: "globe", disabled: !browserOk },
            ]}
          />
        </SettingRow>
        <SettingRow id="voice-pause" label={t("settings.voice.pause")} description={t("settings.voice.pauseHint")}>
          <Select
            track="settings-pause"
            label={t("settings.voice.pause")}
            hideLabel
            width="content"
            value={String(pause)}
            onChange={(v) => { const n = Number(v) as PausePref; setPause(n); prefs.setPause(n); }}
            options={[2, 3, 5].map((n) => ({ value: String(n), label: t("settings.voice.pauseValue", { n }) }))
              .concat([{ value: "0", label: t("settings.voice.pauseManual") }])}
          />
        </SettingRow>
      </SettingGroup>
    </>
  );
}

function PracticeSection() {
  const { settings } = useApp();
  const { save, view } = useSave();
  if (!settings) return <Skeleton lines={4} />;
  return (
    <>
      <SettingGroup title={t("settings.practice.defaults")} id="practice-title">
        <SettingRow id="practice-suggester" label={t("settings.practice.suggester")} description={t("settings.practice.suggesterHint")}>
          <Toggle label={t("settings.practice.suggester")} hideLabel track="settings-suggester"
            checked={settings.answer_suggester} onChange={(v) => void save({ answer_suggester: v })} />
        </SettingRow>
        <SettingRow id="practice-order" label={t("settings.practice.layerOrder")} description={t("settings.practice.layerOrderHint")}>
          <Segmented
            track="settings-layer-order"
            label={t("settings.practice.layerOrder")}
            hideLabel
            value={settings.layer_order}
            onChange={(v) => void save({ layer_order: v })}
            options={[
              { value: "content-first", label: t("settings.practice.contentFirst") },
              { value: "delivery-first", label: t("settings.practice.deliveryFirst") },
            ]}
          />
        </SettingRow>
        <SettingRow id="practice-strictness" label={t("settings.practice.strictness")}>
          <Segmented
            track="settings-strictness"
            label={t("settings.practice.strictness")}
            hideLabel
            value={String(settings.strictness) as "1" | "2" | "3"}
            onChange={(v) => void save({ strictness: Number(v) as 1 | 2 | 3 })}
            options={[
              { value: "1", label: t("home.round.gentle") },
              { value: "2", label: t("home.round.standard") },
              { value: "3", label: t("home.round.tough") },
            ]}
          />
        </SettingRow>
        <SettingRow id="practice-questions" label={t("settings.practice.questions")}>
          <Select track="settings-questions" label={t("settings.practice.questions")} hideLabel width="content" value={String(settings.questions_per_session)}
            onChange={(v) => void save({ questions_per_session: Number(v) })}
            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: String(n) }))} />
        </SettingRow>
        <SettingRow id="practice-level" label={t("settings.practice.level")} description={t("settings.practice.levelHint")}>
          {/* D78: a short name on the button and in the list ("B1 · Familiar topics"). */}
          <Select track="settings-level" label={t("settings.practice.level")} hideLabel width="content" value={settings.level}
            onChange={(v) => void save({ level: v as Level })}
            options={(["A2", "B1", "B2", "C1"] as const).map((l) => ({
              value: l, label: `${l} · ${t(`english.short.${l}`)}`,
            }))} />
        </SettingRow>
      </SettingGroup>
      {view}
    </>
  );
}

function PrivacySection() {
  const { settings } = useApp();
  const telemetry = useLoad(() => api.telemetry());
  const health = useLoad(() => api.health());
  const trash = useLoad(() => api.trash());
  const { save, view } = useSave();
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState("");
  const setOpt = (optIn: boolean, clear = false) => {
    setError("");
    api.setTelemetry(optIn, clear).then((info) => telemetry.setData(info)).catch((e: unknown) => setError(errorMessage(e)));
  };
  const info = telemetry.data;
  const obsidian = folder ?? settings?.obsidian_dir ?? "";
  const trashCount = trash.data?.items.length ?? 0;
  return (
    <>
      <SettingGroup title={t("settings.privacy.sharing")} id="privacy-title">
        <SettingRow id="privacy-telemetry" label={t("settings.privacy.telemetry")}
          description={(
            <>
              {info?.what || t("settings.privacy.telemetryHint")}
              {info ? (
                <span className={s.meta}>
                  {tp("settings.privacy.events", info.events)}
                  {info.events ? <Button variant="link" size="sm" data-track="settings-telemetry-clear" onClick={() => setOpt(info.opt_in, true)}>{t("settings.privacy.clear")}</Button> : null}
                </span>
              ) : null}
            </>
          )}>
          <Toggle label={t("settings.privacy.telemetry")} hideLabel track="settings-telemetry" checked={Boolean(info?.opt_in)} disabled={!info} onChange={(v) => setOpt(v)} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title={t("settings.privacy.files")} id="privacy-files-title">
        <SettingRow id="privacy-folder" layout="stack" label={t("settings.privacy.folder")} description={t("settings.privacy.folderHint")}>
          {health.data ? (
            <div data-field=""><CopyField label={t("settings.privacy.folder")} value={health.data.data_dir} copyLabel={t("common.copy")} copiedLabel={t("common.copied")} /></div>
          ) : <Skeleton lines={1} />}
        </SettingRow>
        <SettingRow id="privacy-obsidian" layout="stack" label={<>{t("settings.privacy.obsidian")}<span className={s.optional}> · {t("common.optional")}</span></>}
          description={t("settings.privacy.obsidianHint")}>
          <div className={s.inputRow}>
            <Input label={t("settings.privacy.obsidian")} hideLabel value={obsidian} onChange={(e) => setFolder(e.target.value)} spellCheck={false} />
            <Button variant="secondary" data-track="settings-obsidian-save" disabled={folder === null}
              onClick={() => void save({ obsidian_dir: obsidian.trim() }).then(() => setFolder(null))}>{t("settings.privacy.obsidianSave")}</Button>
          </div>
        </SettingRow>
        <SettingRow id="privacy-trash" label={t("settings.privacy.trash")} description={t("settings.privacy.trashHint")}>
          <Link to="/archive/trash" className={s.rowLink} data-track="settings-trash-link">
            <Icon name="trash" size="sm" />
            {trashCount ? t("history.trashCount", { n: trashCount }) : t("settings.privacy.trashOpen")}
          </Link>
        </SettingRow>
      </SettingGroup>
      {error ? <Callout tone="error" live="alert">{error}</Callout> : null}
      {view}
    </>
  );
}

/** US-30 rows in table order: free-forever features first, then what Premium adds. A text cell says what the free core
 * offers instead (D13); no cell means "not included". */
const FREE_ROWS = ["practice", "english", "prep", "bank", "debrief", "memory", "drill"] as const;
const PREMIUM_ROWS = [
  { id: "setup", free: "setup" },
  { id: "voice", free: "voice" },
  { id: "trends", free: null },
  { id: "devices", free: "devices" },
] as const;

function Included() {
  return <span className={s.yes}><Icon name="check" size="sm" /><span className="visually-hidden">{t("settings.about.included")}</span></span>;
}

function NotIncluded() {
  return <span className={s.no}><span aria-hidden="true">—</span><span className="visually-hidden">{t("settings.about.notIncluded")}</span></span>;
}

/** About and what's free (D58): reached from the account menu ("Help & what's free") and Home's "What's free" link. */
function AboutSection() {
  const navigate = useNavigate();
  return (
    <>
      <div id="free" className={s.anchor}>
        <SettingGroup title={t("settings.about.freeTitle")} id="about-free-title" description={t("settings.about.freeIntro")} flush>
          <div className={s.tableWrap}>
            <table className={s.table} data-review-id="Settings/freeTable">
              <caption className="visually-hidden">{t("settings.about.tableCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("settings.about.feature")}</th>
                  <th scope="col">{t("settings.about.free")}</th>
                  <th scope="col">
                    <span className={s.premiumHead}>{t("settings.about.premium")}<Badge tone="outline">{t("settings.about.later")}</Badge></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FREE_ROWS.map((id) => (
                  <tr key={id}>
                    <th scope="row">{t(`settings.about.row.${id}`)}</th>
                    <td><Included /></td>
                    <td><Included /></td>
                  </tr>
                ))}
                {PREMIUM_ROWS.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{t(`settings.about.row.${row.id}`)}</th>
                    <td>{row.free ? <span className={s.cellText}>{t(`settings.about.cell.${row.free}`)}</span> : <NotIncluded />}</td>
                    <td><Included /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingGroup>
        <p className={s.note}>{t("settings.about.premiumNote")}</p>
      </div>
      <SettingGroup title={t("settings.about.practiceTitle")} id="about-practice-title">
        <p className={s.lead}>{t("app.practiceOnly")}</p>
      </SettingGroup>
      <SettingGroup title={t("settings.about.setupTitle")} id="about-setup-title">
        <SettingRow id="about-setup" label={t("settings.about.setupRun")} description={t("settings.about.setupHint")}>
          <Button size="sm" variant="secondary" icon="refresh" data-track="settings-run-setup" onClick={() => navigate("/setup")}>{t("settings.about.setupRun")}</Button>
        </SettingRow>
      </SettingGroup>
      <div id="about-licence" className={s.anchor}>
        <SettingGroup title={t("settings.about.licenceTitle")} id="about-licence-title">
          <p className={s.lead}>{t("settings.about.licence")}</p>
        </SettingGroup>
      </div>
    </>
  );
}
