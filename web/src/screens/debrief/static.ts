/* Handlers for the static states (stories, review frames): every action is offered, none does anything outside the
 * view's own local state. The live container passes the real ones; a missing handler hides its control. */
import type { DebriefActions } from "./types";

const noop = () => {};

export const STATIC_ACTIONS: Required<DebriefActions> = {
  onRename: noop,
  onRerun: noop,
  onDownload: noop,
  onExport: noop,
  onArchive: noop,
  onTrash: noop,
  onDrill: noop,
  onPractise: noop,
  onStartFirst: noop,
  onRetry: noop,
  onDismiss: noop,
  onRestore: noop,
  onRecheck: noop,
  onStronger: noop,
};
