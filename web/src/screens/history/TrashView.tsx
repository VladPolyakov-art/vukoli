/* Trash (US-23 AC2, Q9). Pure: every state comes from props; the live container is `TrashScreen` in `screens/History.tsx`.
 * Deleted chats with Restore and Delete forever (asks first: the dialog says it cannot be undone). The motion of a
 * leaving row, the focus move and the calls belong to the caller; a failed load is an error callout with Try again. */
import { useRef, useState, type HTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { Button, Callout, Dialog, EmptyState, Skeleton } from "../../ds";
import { Page } from "../../components/Page";
import { t } from "../../i18n";
import { formatDate, formatDateTime } from "../../lib/format";
import type { TrashRowModel, TrashViewProps } from "./types";
import s from "./TrashView.module.css";

export function TrashView(props: TrashViewProps) {
  const { state, rows, notice, error, ui, rowMotion } = props;
  const [confirming, setConfirming] = useState<string | null>(ui?.confirming ?? null);
  const items = useRef(new Map<string, HTMLLIElement>());
  const target: TrashRowModel | undefined = rows.find((r) => r.id === confirming);
  const li = (id: string) => items.current.get(id) ?? null;

  let body;
  if (state === "loading") {
    body = <div aria-busy="true"><Skeleton variant="row" rows={4} label={t("common.loading")} /></div>;
  } else if (state === "error") {
    body = (
      <div data-review-id="Trash/Error" data-review-section="Trash · Error" data-comment-target="">
        <Callout
          tone="error"
          live="alert"
          title={t("history.trashError.title")}
          actions={(
            <>
              <Button variant="secondary" size="sm" icon="refresh" data-track="trash-retry" onClick={props.onRetry}>{t("history.error.retry")}</Button>
              <Link to="/settings/storage" className={s.inlineLink} data-track="trash-storage-link">{t("history.error.storage")}</Link>
            </>
          )}
        >
          {t("history.trashError.body")}
        </Callout>
      </div>
    );
  } else if (!rows.length) {
    body = <EmptyState icon="trash" title={t("history.trashEmpty")} compact />;
  } else {
    body = (
      <ul className={s.list} data-review-id="Trash/List" data-review-section="Trash · List" data-comment-target="">
        {rows.map((x, i) => {
          const motion: HTMLAttributes<HTMLLIElement> = rowMotion?.(x.id, i) ?? {};
          return (
            <li key={x.id} {...motion} className={`${s.row} ${motion.className ?? ""}`}
              ref={(el) => { if (el) items.current.set(x.id, el); else items.current.delete(x.id); }}>
              <div className={s.main}>
                <span className={s.title}>{x.title}</span>
                <span className={s.meta}>
                  <span>{formatDate(x.startedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t("history.deletedAt", { date: formatDateTime(x.deletedAt) })}</span>
                </span>
              </div>
              <div className={s.side}>
                <Button variant="secondary" size="sm" icon="redo" data-track="trash-restore" onClick={() => props.onRestore?.(x.id, li(x.id))}>{t("history.restore")}</Button>
                <Button variant="ghost" size="sm" icon="trash" aria-label={t("history.purgeRow", { title: x.title })} data-track="trash-purge" onClick={() => setConfirming(x.id)}>{t("history.purge")}</Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Page title={t("history.trashTitle")} sub={t("history.trashSub")} actions={<Link to="/archive" data-track="trash-back">{t("history.backToHistory")}</Link>}>
      {notice ? <Callout tone="success" live="status">{notice}</Callout> : null}
      {error ? <Callout tone="error" live="alert">{error}</Callout> : null}
      {body}
      <Dialog
        open={confirming !== null}
        title={t("history.purgeTitle")}
        onClose={() => setConfirming(null)}
        actions={(
          <>
            <Button data-track="trash-purge-cancel" onClick={() => setConfirming(null)}>{t("common.cancel")}</Button>
            <Button variant="danger" data-track="trash-purge-confirm" onClick={() => { const id = confirming; setConfirming(null); if (id) props.onPurge?.(id, li(id)); }}>{t("history.purge")}</Button>
          </>
        )}
      >
        <p>{t("history.purgeBody", { title: target?.title ?? "" })}</p>
      </Dialog>
    </Page>
  );
}
