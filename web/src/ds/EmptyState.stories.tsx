import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";
import { t } from "../i18n";

/* The empty states the app really has (screens/**): Archive empty, an empty Archive filter and an empty Trash (compact),
 * the whole-page server error (`headingLevel={1}`), the debrief that no longer exists, and an unknown page. Copy is from
 * i18n/en.json. */
const meta: Meta<typeof EmptyState> = { title: "DS/EmptyState", component: EmptyState };
export default meta;

/** Archive with no archived chats (screens/history/HistoryView.tsx): the archive icon, one primary and a link. */
export const History: StoryObj<typeof EmptyState> = {
  args: {
    icon: "archive",
    title: t("history.emptyState.title"),
    children: t("history.emptyState.body"),
    actions: (
      <>
        <Button variant="primary" icon="practice">{t("history.emptyState.start")}</Button>
        <Button variant="link">{t("history.emptyState.example")}</Button>
      </>
    ),
  },
};

/** `compact`: an Archive filter with no match (English here), with a secondary action. */
export const Compact: StoryObj<typeof EmptyState> = {
  args: {
    compact: true,
    icon: "chat",
    title: t("history.none.english.title"),
    children: t("history.none.english.body"),
    actions: <Button variant="secondary">{t("history.none.english.start")}</Button>,
  },
};

/** `compact`, title only: the empty Trash. */
export const CompactTrash: StoryObj<typeof EmptyState> = {
  args: { compact: true, icon: "trash", title: t("history.trashEmpty") },
};

/** `headingLevel={1}`: the empty state is the whole page (the server is not answering). */
export const PageLevel: StoryObj<typeof EmptyState> = {
  args: {
    icon: "alert",
    headingLevel: 1,
    title: t("server.title"),
    children: <p>{t("server.body")}</p>,
    actions: <Button variant="primary" icon="refresh">{t("server.checkAgain")}</Button>,
  },
};

/** A debrief that was deleted or whose link is wrong. */
export const SessionGone: StoryObj<typeof EmptyState> = {
  args: {
    icon: "history",
    title: t("debrief.gone.title"),
    children: t("debrief.gone.body"),
    actions: (
      <>
        <Button variant="primary">{t("debrief.gone.openHistory")}</Button>
        <Button variant="secondary">{t("debrief.gone.goHome")}</Button>
      </>
    ),
  },
};

/** An unknown address (NotFound). */
export const NotFound: StoryObj<typeof EmptyState> = {
  args: {
    icon: "alert",
    title: t("notFound.body"),
    actions: <Button variant="primary">{t("notFound.home")}</Button>,
  },
};
