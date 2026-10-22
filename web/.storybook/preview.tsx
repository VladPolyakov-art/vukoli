import type { Preview } from "@storybook/react-vite";
import "../src/ds/global.css";

// Theme switcher in the toolbar: every component is reviewed in light AND dark (GR13).
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      document.documentElement.setAttribute("data-theme", context.globals.theme === "dark" ? "dark" : "light");
      return (
        <div style={{ padding: "var(--space-6)", background: "var(--color-canvas)", minHeight: "100vh" }}>
          <Story />
        </div>
      );
    },
  ],
  parameters: { layout: "fullscreen", controls: { expanded: true } },
};
export default preview;
