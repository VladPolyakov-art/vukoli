import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "./Panel";
import { Badge } from "./Badge";

const meta: Meta<typeof Panel> = { title: "DS/Panel", component: Panel };
export default meta;
export const Default: StoryObj<typeof Panel> = {
  render: () => (
    <div style={{ width: "var(--layout-panel)", height: "20rem", display: "flex" }}>
      <Panel title="Feedback" labelId="p1" as="aside" actions={<Badge>Question 2</Badge>}>
        <p>Content, language and delivery notes appear here after each answer.</p>
      </Panel>
    </div>
  ),
};
