import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Swap } from "./ds";
import { t } from "./i18n";
import { AppShell } from "./components/AppShell";
import { api } from "./lib/api";
import { useDocumentTitle } from "./lib/documentTitle";
import { prefs } from "./lib/prefs";
import { UT_PENDING, useUtScreen, utScreenForPath } from "./lib/utScreen";
import { AppProvider } from "./lib/store";
import { DebriefScreen } from "./screens/Debrief";
import { ArchiveScreen, TrashScreen } from "./screens/History";
import { HomeScreen } from "./screens/Home";
import { NotFound } from "./screens/NotFound";
import { ServerUnavailable } from "./screens/ServerUnavailable";
import { SessionScreen } from "./screens/Session";
import { useSettingsRoute } from "./screens/Settings";
import { SetupWizard } from "./screens/Setup";
import s from "./App.module.css";

type Health = "checking" | "ok" | "down";

export function App() {
  const [health, setHealth] = useState<Health>("checking");
  const check = useCallback(async () => {
    setHealth("checking");
    try {
      await api.health();
      setHealth("ok");
    } catch {
      setHealth("down");
    }
  }, []);
  useEffect(() => { void check(); }, [check]);
  // User-test tracker (13b): the server check is not a screen yet.
  useUtScreen(health === "checking" ? UT_PENDING : null);

  if (health === "checking") {
    return <div className={s.center} aria-busy="true"><p className="shimmer-text" role="status">{t("common.loading")}</p></div>;
  }
  if (health === "down") return <ServerUnavailable onRetry={() => void check()} />;
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}

/** QA-11: a screen's tab title, written once when its route mounts. */
function TabTitle({ page, children }: { page?: string; children: React.ReactNode }) {
  useDocumentTitle(page);
  return <>{children}</>;
}

function FirstRunGate({ children, off }: { children: React.ReactNode; off?: boolean }) {
  const location = useLocation();
  if (!off && !prefs.setupDone() && location.pathname === "/") return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

/** Route change (docs/motion.md 3.1, New): the outgoing page fades out (`exit`), the incoming page content rises in
 * (`slow`, `--ease-enter`). The rail stays put: AppShell is shared by every shell route, only <main>'s content swaps.
 * Query changes (Home track) are not page changes. Focus left inside the old page moves to <main>.
 * Settings (D76) is a popup over the page you came from (Home on a direct visit), so it never swaps the page. */
function ShellRoutes() {
  const settings = useSettingsRoute();
  const location = settings.pageLocation;
  // The Settings popup names the tab while it is open; closing puts the page's title back.
  useDocumentTitle(settings.open ? t("settings.title") : null, true);
  // User-test screen name (13b): Home names itself; Settings is a popup, so the page's name comes back when it closes.
  useUtScreen(settings.open ? "/settings" : utScreenForPath(location.pathname), settings.open);
  return (
    <AppShell>
      <Swap
        swapKey={location.pathname}
        enterClass="motion-page-in"
        exitClass="motion-fade-out"
        className={s.routeSwap}
        focusTarget={() => document.getElementById("main")}
      >
        <Routes location={location}>
          <Route path="/" element={<TabTitle><FirstRunGate off={settings.open}><HomeScreen /></FirstRunGate></TabTitle>} />
          <Route path="/archive" element={<TabTitle page={t("history.title")}><ArchiveScreen /></TabTitle>} />
          <Route path="/archive/trash" element={<TabTitle page={t("history.trashTitle")}><TrashScreen /></TabTitle>} />
          {/* D80: History became Archive; old links still land. */}
          <Route path="/history" element={<Navigate to="/archive" replace />} />
          <Route path="/history/trash" element={<Navigate to="/archive/trash" replace />} />
          <Route path="/sessions/:id" element={<DebriefScreen />} />
          <Route path="*" element={<TabTitle page={t("notFound.tabTitle")}><NotFound /></TabTitle>} />
        </Routes>
      </Swap>
      {settings.dialog}
    </AppShell>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupWizard />} />
      <Route path="/session" element={<SessionScreen />} />
      <Route path="*" element={<ShellRoutes />} />
    </Routes>
  );
}
