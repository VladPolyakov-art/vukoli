/* Debrief header (debrief.md §3.1): H1 with rename + "more" menu, structured meta row. No back link since D80: every
 * chat is in the sidebar. Rename swaps the H1 for InlineRename (Swap, `fast`). The menu: Export to Obsidian (only when a
 * folder is set), Download as Markdown, Archive, Delete (asks first; goes to Trash). The example has no rename or menu. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Dialog, Icon, IconButton, InlineRename, Menu, Swap, Tooltip, type MenuEntry } from "../../../ds";
import { t } from "../../../i18n";
import type { MetaItem } from "../types";
import s from "./header.module.css";

export interface HeaderProps {
  title: string;
  meta: MetaItem[];
  example?: boolean;
  obsidian?: boolean;
  renaming: boolean;
  /** Focus the field when renaming starts (false for a state that starts in rename: review, stories). */
  focusRename: boolean;
  onRenameStart?: () => void;
  onRenameSave: (title: string) => void;
  onRenameCancel: () => void;
  onExport?: () => void;
  onDownload?: () => void;
  onArchive?: () => void;
  onTrash?: () => void;
}

export function Header(p: HeaderProps) {
  const [confirming, setConfirming] = useState(false);
  const items: MenuEntry[] = [
    ...(p.obsidian ? [{ id: "export", track: "debrief-menu-export", label: t("debrief.menu.export"), icon: "folder" as const, onSelect: p.onExport }] : []),
    { id: "download", track: "debrief-menu-download", label: t("debrief.menu.download"), icon: "download" as const, onSelect: p.onDownload },
    ...(p.onArchive ? [{ id: "archive", track: "debrief-menu-archive", label: t("debrief.menu.archive"), icon: "archive" as const, onSelect: p.onArchive }] : []),
    { id: "sep", separator: true as const },
    { id: "trash", track: "debrief-menu-trash", label: t("debrief.menu.trash"), icon: "trash" as const, onSelect: () => setConfirming(true) },
  ];
  const showMenu = !p.example && (p.onDownload || p.onTrash || p.onExport || p.onArchive);
  return (
    <header className={s.header} data-review-id="Debrief/Header" data-review-section="Debrief · Header" data-comment-target="">
      <Swap swapKey={p.renaming ? "rename" : "title"}>
        {p.renaming ? (
          <InlineRename size="lg" value={p.title} autoFocus={p.focusRename} onSave={p.onRenameSave} onCancel={p.onRenameCancel} />
        ) : (
          <div className={s.titleRow}>
            <Tooltip content={p.title} onlyWhenTruncated block placement="bottom-start" className={s.titleTip}>
              <h1 className={s.title} data-truncate="">{p.title}</h1>
            </Tooltip>
            {p.example ? <Badge>{t("debrief.exampleBadge")}</Badge> : null}
            {!p.example && p.onRenameStart ? (
              <IconButton icon="edit" size="sm" label={t("debrief.rename")} data-track="debrief-rename" onClick={p.onRenameStart} />
            ) : null}
            {showMenu ? (
              <Menu
                label={t("debrief.moreActions")}
                items={items}
                placement="bottom-end"
                trigger={(props) => <IconButton icon="more" size="sm" label={t("debrief.moreActions")} data-track="debrief-more" {...props} />}
              />
            ) : null}
          </div>
        )}
      </Swap>
      <ul className={s.meta} aria-label={t("debrief.meta.label")}>
        {p.meta.map((m, i) => (
          <li key={i} className={`${s.metaItem} ${m.tone === "warning" ? s.warning : ""}`}>
            <Icon name={m.icon} size="sm" />
            {m.href ? <Link to={m.href} className={s.metaLink} data-track="debrief-meta-link">{m.text}</Link> : <span>{m.text}</span>}
          </li>
        ))}
      </ul>
      <Dialog
        open={confirming}
        title={t("rail.deleteTitle")}
        onClose={() => setConfirming(false)}
        actions={(
          <>
            <Button data-track="debrief-trash-cancel" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" data-track="debrief-trash-confirm" onClick={() => { setConfirming(false); p.onTrash?.(); }}>{t("rail.deleteConfirm")}</Button>
          </>
        )}
      >
        <p>{t("rail.deleteBody", { title: p.title })}</p>
      </Dialog>
    </header>
  );
}
