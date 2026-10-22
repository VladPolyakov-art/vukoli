import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { EngineFixture, makeEngines } from "../components/engine/fixtures";
import { OverlayRoot } from "../ds";
import { SettingsScreen, type SectionId } from "./Settings";

/* D76: Settings as a popup with search; every setting is a row (text left, control right). D78: titled groups, General
 * (CV file + theme), AI engine in one view. Fictional data (a made-up CV), no server. */
const meta: Meta = { title: "Screens/Settings", parameters: { layout: "fullscreen" } };
export default meta;

function Scene({ section, query, list, width = 1440, height = 900 }: { section: SectionId; query?: string; list?: boolean; width?: number; height?: number }) {
  return (
    <EngineFixture engines={makeEngines()}>
      <MemoryRouter initialEntries={[`/settings/${section}`]}>
        <div style={{ width, maxWidth: "100%", height, position: "relative", background: "var(--color-canvas)" }}>
          <OverlayRoot><SettingsScreen initialQuery={query} startOnList={list} /></OverlayRoot>
        </div>
      </MemoryRouter>
    </EngineFixture>
  );
}

export const General: StoryObj = { render: () => <Scene section="general" /> };
export const Engine: StoryObj = { render: () => <Scene section="engine" /> };
export const Voice: StoryObj = { render: () => <Scene section="voice" /> };
export const Practice: StoryObj = { render: () => <Scene section="practice" /> };
export const Privacy: StoryObj = { render: () => <Scene section="privacy" /> };
export const About: StoryObj = { render: () => <Scene section="about" /> };
export const Search: StoryObj = { render: () => <Scene section="engine" query="voice" /> };
export const SearchEmpty: StoryObj = { render: () => <Scene section="engine" query="billing" /> };
export const Phone: StoryObj = { render: () => <Scene section="voice" width={375} height={812} /> };
/** D82, like Claude: on a phone Settings opens on the list of sections; a tap opens one under "‹ All settings". */
export const PhoneList: StoryObj = { render: () => <Scene section="general" list width={375} height={812} /> };
export const PhoneSearch: StoryObj = { render: () => <Scene section="general" list query="voice" width={375} height={812} /> };
