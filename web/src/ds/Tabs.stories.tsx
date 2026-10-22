import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { TabPanel, Tabs } from "./Tabs";

const meta: Meta = { title: "DS/Tabs" };
export default meta;

function Demo() {
  const [tab, setTab] = useState<"interview" | "english">("interview");
  return (
    <div>
      <Tabs
        idBase="demo"
        label="Track"
        value={tab}
        onChange={setTab}
        items={[
          { id: "interview", label: "Interview", icon: "briefcase" },
          { id: "english", label: "English practice", icon: "chat", hint: "Just talk at your level" },
        ]}
      />
      <TabPanel idBase="demo" id={tab}>
        <p style={{ padding: "var(--space-4) 0" }}>{tab === "interview" ? "Interview panel" : "English panel"}</p>
      </TabPanel>
    </div>
  );
}
export const Default: StoryObj = { render: () => <Demo /> };

/** Narrow page column (< 560, container `page`): the hints hide, labels stay. */
export const NarrowPage: StoryObj = {
  render: () => (
    <div style={{ width: 343, maxWidth: "100%", containerType: "inline-size", containerName: "page" }}>
      <Demo />
    </div>
  ),
};
