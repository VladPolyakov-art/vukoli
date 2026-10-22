/* State blocks of the Debrief that are not the data itself: loading, preparing, not found, error, and the banners
 * (storage not writable, example, partial). Each state is reachable by props (DebriefView). */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Callout, EmptyState, Skeleton, TextShimmer } from "../../../ds";
import { t } from "../../../i18n";
import s from "./states.module.css";

export function LoadingBody({ preparing }: { preparing?: boolean }) {
  return (
    <div className={s.loading} aria-busy="true" data-review-id="Debrief/Loading">
      {preparing ? <TextShimmer as="p" status size="md">{t("debrief.pending")}</TextShimmer> : null}
      <Skeleton lines={2} label={t("debrief.loading")} />
      <Skeleton lines={2} label={t("debrief.loading")} />
      <div className={s.cards}>
        <Skeleton variant="card" lines={3} label={t("debrief.loading")} />
        <Skeleton variant="card" lines={3} label={t("debrief.loading")} />
        <Skeleton variant="card" lines={3} label={t("debrief.loading")} />
      </div>
      <Skeleton variant="row" rows={5} label={t("debrief.loading")} />
    </div>
  );
}

export function NotFoundBody({ onHistory, onHome }: { onHistory?: () => void; onHome?: () => void }) {
  return (
    <div data-review-id="Debrief/NotFound">
      <EmptyState
        icon="history"
        title={t("debrief.gone.title")}
        actions={
          <>
            {onHistory ? <Button variant="primary" data-track="debrief-gone-archive" onClick={onHistory}>{t("debrief.gone.openHistory")}</Button>
              : <Link to="/archive" className={s.primaryLink} data-track="debrief-gone-archive">{t("debrief.gone.openHistory")}</Link>}
            {onHome ? <Button variant="secondary" data-track="debrief-gone-home" onClick={onHome}>{t("debrief.gone.goHome")}</Button> : null}
          </>
        }
      >
        {t("debrief.gone.body")}
      </EmptyState>
    </div>
  );
}

export function ErrorBody({ onRetry, detail }: { onRetry?: () => void; detail?: ReactNode }) {
  return (
    <div data-review-id="Debrief/Error">
      <Callout
        tone="error"
        live="alert"
        title={t("debrief.error.title")}
        actions={
          <>
            <Button size="sm" variant="secondary" icon="refresh" data-track="debrief-retry" onClick={onRetry}>{t("common.tryAgain")}</Button>
            <Link to="/archive" className={s.inlineLink} data-track="debrief-error-archive">{t("debrief.gone.openHistory")}</Link>
          </>
        }
      >
        {detail ?? t("debrief.error.body")}
      </Callout>
    </div>
  );
}

export function StorageBanner({ onDownload }: { onDownload?: () => void }) {
  return (
    <div data-review-id="Debrief/StorageBanner" data-review-section="Debrief · Storage not writable" data-comment-target="">
      <Callout
        tone="warning"
        live="alert"
        title={t("debrief.storage.title")}
        actions={
          <>
            <Button variant="primary" size="sm" icon="download" data-track="debrief-storage-download" onClick={onDownload}>{t("debrief.storage.download")}</Button>
            <Link to="/settings/storage" className={s.inlineLink} data-track="debrief-storage-fix">{t("debrief.storage.fix")}</Link>
          </>
        }
      >
        {t("debrief.storage.body")}
      </Callout>
    </div>
  );
}

export function ExampleBanner({ onStart }: { onStart?: () => void }) {
  return (
    <div data-review-id="Debrief/ExampleBanner" data-review-section="Debrief · Example banner" data-comment-target="">
      <Callout
        tone="info"
        live="status"
        title={t("debrief.example.title")}
        actions={<Button variant="primary" size="sm" data-track="debrief-example-start" onClick={onStart}>{t("debrief.example.start")}</Button>}
      >
        {t("debrief.example.body")}
      </Callout>
    </div>
  );
}

export function PartialBanner({ answered, total }: { answered: number; total: number }) {
  return (
    <div data-review-id="Debrief/PartialBanner" data-review-section="Debrief · Partial session" data-comment-target="">
      <Callout tone="info" live="status" title={t("debrief.partial.title")}>
        {t("debrief.partial.body", { answered, total })}
      </Callout>
    </div>
  );
}
