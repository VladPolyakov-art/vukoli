/* VacancyEditor states (home.md §4 `VacancyEditor/*`) as seeds for the editor harness. */
import type { VacancyEditorViewProps } from "../../components/VacancyEditor";
import { PASTED_TEXT } from "./fixtures";

export type EditorSeed = Partial<VacancyEditorViewProps>;

const FILLED = { text: PASTED_TEXT, company: "Kestrel Pay", role: "Senior Product Designer", extracted: true };
const URL = "https://kestrelpay.example/careers/senior-product-designer";
const FILE = { name: "kestrel-pay-senior-pd.pdf", size: "184 KB" };

export const EDITOR_SEEDS = {
  PasteEmpty: { source: "paste" },
  PasteFilled: { source: "paste", ...FILLED },
  TooShort: {
    source: "paste",
    text: "Senior Product Designer at Kestrel Pay. Six years of experience.",
    company: "Kestrel Pay",
    role: "Senior Product Designer",
    extracted: true,
  },
  FileEmpty: { source: "file", fileState: "empty" },
  FileChosen: { source: "file", file: FILE, fileState: "chosen", company: "Kestrel Pay", role: "Senior Product Designer" },
  FileReading: { source: "file", file: FILE, fileState: "reading" },
  FileError: { source: "file", fileState: "error" },
  LinkEmpty: { source: "link", link: "idle" },
  LinkFetching: { source: "link", url: URL, link: "fetching" },
  LinkFetched: {
    source: "link",
    url: URL,
    link: "fetched",
    linkPreview: "Senior Product Designer · Kestrel Pay. Own the end-to-end checkout experience for small merchants on web and mobile. You will lead research, shape the design system and work with two engineering squads.",
    company: "Kestrel Pay",
    role: "Senior Product Designer",
    extracted: true,
  },
  LinkError: { source: "link", url: URL, link: "error" },
  Saving: { source: "paste", ...FILLED, saving: true },
  Edit: { mode: "edit", source: "paste", text: PASTED_TEXT, company: "Kestrel Pay", role: "Senior Product Designer" },
} satisfies Record<string, EditorSeed>;

export type EditorSeedId = keyof typeof EDITOR_SEEDS;
