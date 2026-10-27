import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "./Panel";
import { Button, IconButton } from "./Button";
import { t } from "../i18n";

/* The Session feedback panel (screens/session/SessionView.tsx): the title "Feedback", a × IconButton "Hide feedback" in
 * `actions` (the panel is toggled from the island, not tied to a question number) and, when the round has a next step,
 * the "Next question" button in `footer`. */
const meta: Meta<typeof Panel> = { title: "DS/Panel", component: Panel };
export default meta;

const close = <IconButton icon="x" size="sm" label={t("session.island.feedbackHide")} />;
const body = <p>Content, language and delivery notes appear here after each answer.</p>;

export const Default: StoryObj<typeof Panel> = {
  render: () => (
    <div style={{ width: "var(--layout-panel)", height: "20rem", display: "flex" }}>
      <Panel title={t("feedback.panel")} labelId="p1" as="aside" actions={close}
        footer={<Button variant="secondary" fullWidth iconRight="arrowRight">{t("session.panel.nextQuestion")}</Button>}>
        {body}
      </Panel>
    </div>
  ),
};

/** No footer: the English practice variant and the states before feedback exists have no next step. */
export const NoFooter: StoryObj<typeof Panel> = {
  render: () => (
    <div style={{ width: "var(--layout-panel)", height: "20rem", display: "flex" }}>
      <Panel title={t("feedback.panel")} labelId="p2" as="aside" actions={close}>
        {body}
      </Panel>
    </div>
  ),
};
