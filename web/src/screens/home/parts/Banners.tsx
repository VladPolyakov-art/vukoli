/* Engine / browser / storage banners (home.md §4). Each leaves with a soft-out and enters with a fade (docs/motion.md 3.7). */
import { useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Callout, CopyField, IconButton, usePresence } from "../../../ds";
import { t } from "../../../i18n";
import { iconPlace } from "../../../lib/installApp";
import type { EngineBannerModel } from "../types";
import { TextLink } from "./TextLink";
import s from "./parts.module.css";

/** Keeps the last content while the exit plays (the model goes null the moment the check passes). */
function Presence({ show, children }: { show: boolean; children: ReactNode }) {
  const { mounted, leaving } = usePresence(show);
  const last = useRef<ReactNode>(children);
  if (show) last.current = children;
  if (!mounted) return null;
  return <div className={leaving ? "motion-soft-out" : "motion-fade"}>{show ? children : last.current}</div>;
}

export interface BannersProps {
  engine?: EngineBannerModel | null;
  browser?: boolean;
  storage?: boolean;
  install?: boolean;
  onRetryEngine?: () => void;
  onUseTextMode?: () => void;
  onDismissBrowser?: () => void;
  onInstall?: () => void;
  onDismissInstall?: () => void;
}

export function Banners({ engine, browser, storage, install, onRetryEngine, onUseTextMode, onDismissBrowser, onInstall, onDismissInstall }: BannersProps) {
  const navigate = useNavigate();
  return (
    <div className={s.banners} data-review-id="Home/Banners">
      <Presence show={Boolean(engine)}>
        <div data-review-id="Home/EngineBanner" data-review-section="Home · Engine banner" data-comment-target>
          <Callout
            tone="warning"
            live="status"
            title={t("home.engineBanner.title")}
            actions={(
              <span className={s.bannerActions}>
                <Button variant="secondary" size="sm" icon="refresh" data-track="banner-engine-retry" onClick={onRetryEngine}>{t("home.engine.tryNow")}</Button>
                <TextLink to="/settings/engine" track="banner-engine-settings">{t("home.engineBanner.settings")}</TextLink>
              </span>
            )}
          >
            <div className={s.bannerBody}>
              <p>{engine?.body}</p>
              {engine?.command ? <CopyField value={engine.command} label={t("common.command")} copyLabel={t("common.copyCommand")} copiedLabel={t("common.copied")} /> : null}
              <p className={s.bannerNote}>{t("home.engine.recheck")}</p>
            </div>
          </Callout>
        </div>
      </Presence>
      <Presence show={Boolean(browser)}>
        <div data-review-id="Home/BrowserBanner" data-review-section="Home · Browser banner" data-comment-target>
          <Callout
            tone="warning"
            live="status"
            actions={(
              <span className={s.bannerActions}>
                <Button variant="secondary" size="sm" icon="keyboard" data-track="banner-use-text" onClick={onUseTextMode}>{t("home.browser.useText")}</Button>
                <IconButton icon="x" size="sm" label={t("home.browser.dismiss")} data-track="banner-browser-dismiss" onClick={onDismissBrowser} />
              </span>
            )}
          >
            {t("home.browser.body")}
          </Callout>
        </div>
      </Presence>
      <Presence show={Boolean(storage)}>
        <div data-review-id="Home/StorageBanner" data-review-section="Home · Storage banner" data-comment-target>
          <Callout
            tone="error"
            live="alert"
            actions={<Button variant="secondary" size="sm" data-track="banner-storage-open" onClick={() => navigate("/settings/storage")}>{t("home.storage.open")}</Button>}
          >
            {t("home.storage.body")}
          </Callout>
        </div>
      </Presence>
      <Presence show={Boolean(install)}>
        <div data-review-id="Home/InstallCard" data-review-section="Home · Install card" data-comment-target>
          <Callout
            icon="monitor"
            actions={(
              <span className={s.bannerActions}>
                <Button variant="secondary" size="sm" icon="download" data-track="banner-install" onClick={onInstall}>{t("install.action")}</Button>
                <IconButton icon="x" size="sm" label={t("install.dismiss")} data-track="banner-install-dismiss" onClick={onDismissInstall} />
              </span>
            )}
          >
            {t("install.body", { where: t(iconPlace(navigator.userAgent) === "dock" ? "install.dock" : "install.taskbar") })}
          </Callout>
        </div>
      </Presence>
    </div>
  );
}
