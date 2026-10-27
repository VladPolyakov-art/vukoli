import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button, IconButton } from "./Button";
import { Composer, ComposerAttachment, type ComposerProps, type ComposerSend } from "./Composer";
import { Menu } from "./Menu";

/** Composer (G1): one rounded input with an optional attachment card, the field, a toolbar or a leading control, and
 * the round end button. Stories show what the app really uses (code is the source, 2026-10-25): the start composer
 * (screens/home/parts/StartScreen.tsx: `+` and the mode menu, the mic quick start that morphs to Send, files by drop or
 * paste), the setup-chat composer (HomeView.tsx: leading `+`, dictation, `readOnly`, `error`) and the Session text
 * mode (`surface="none"` inside the island). The Home v1 family (File / Saved jobs / Standard toolbar, "Add this job",
 * the job card) is gone with the start screen of D47a/D52. */
const meta: Meta<typeof Composer> = { title: "DS/Composer", component: Composer, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Composer>;

type Track = "interview" | "english";

/** D89: the file card the start and setup composers show for an attached job file or CV. */
function FileCard({ name = "kestrel-pay-senior-pd.pdf", size = "184 KB" }: { name?: string; size?: string }) {
  return (
    <ComposerAttachment
      icon="file"
      title={name}
      meta={size}
      actions={<IconButton icon="x" size="sm" label="Remove file" />}
    />
  );
}

/** The practice-type menu of the start composer (radio items with a description). */
function ModeMenu({ track, open, onChange }: { track: Track; open?: boolean; onChange: (track: Track) => void }) {
  const label = track === "english" ? "English practice" : "Interview";
  return (
    <Menu
      label="Practice type"
      defaultOpen={open}
      items={[
        { id: "interview", label: "Interview", description: "Mike asks interview questions, with feedback after the call.", icon: "briefcase", checked: track === "interview", onSelect: () => onChange("interview") },
        { id: "english", label: "English practice", description: "Just talk at your level. Corrections after each of your turns.", icon: "chat", checked: track === "english", onSelect: () => onChange("english") },
      ]}
      trigger={(p) => (
        <Button {...p} variant="secondary" size="sm" icon={track === "english" ? "chat" : "briefcase"} iconRight="chevronDown" aria-label={`Practice type: ${label}`}>
          {label}
        </Button>
      )}
    />
  );
}

interface StartOptions {
  initial?: string;
  track?: Track;
  /** Typed answers: the quick start is a keyboard instead of a mic. */
  typed?: boolean;
  /** The quick start is running (the session is being created). */
  busy?: boolean;
  /** The quick start can't run now (engine not ready, still loading). */
  disabled?: boolean;
  /** A file is already attached. */
  file?: { name: string; size: string };
  menuOpen?: boolean;
  narrow?: boolean;
  /** Fold of `ComposerProps` for stories (placeholder, rows). */
  rest?: Partial<ComposerProps>;
}

/** The start composer (home.md v2 §3, D52/D59): `+` then the mode menu on the left; with nothing typed the end button is
 * the quick start (a round quiet mic, no label, its tooltip says what it starts), text or a file turns it into Send. */
function Start({ initial = "", track: first = "interview", typed, busy, disabled, file: firstFile, menuOpen, narrow, rest }: StartOptions) {
  const [v, setV] = useState(initial);
  const [track, setTrack] = useState<Track>(first);
  const [file, setFile] = useState(firstFile);
  const english = track === "english";
  const hasInput = Boolean(v.trim() || file);
  const quick: ComposerSend = {
    label: typed ? "Start now — typed practice" : "Start now — voice practice",
    title: `Kestrel Pay · Behavioural · 5 questions · ${typed ? "typing" : "voice"}`,
    icon: typed ? "keyboard" : "mic",
    variant: "quiet",
    busy,
    disabled,
  };
  const send: ComposerSend = hasInput
    ? { label: "Send", icon: "arrowRight", variant: "action", onSend: () => { setV(""); setFile(undefined); } }
    : english ? { label: "Send", icon: "arrowRight", variant: "action", hidden: true } : quick;
  return (
    <Composer
      label="Message Mike"
      placeholder={english ? "Say a topic, or pick one below" : narrow ? "Paste a job or say what you want" : "Paste a job or a link, or say what you want to practise"}
      value={v}
      minRows={1}
      maxRows={8}
      submitOnEnter
      onChange={(e) => setV(e.target.value)}
      // D89: a file dropped on the composer or pasted into it is taken here (the English start takes none).
      onFiles={english ? undefined : ([first]) => first && setFile({ name: first.name, size: `${Math.max(1, Math.round(first.size / 1024))} KB` })}
      attachment={file ? (
        <ComposerAttachment
          icon="file"
          title={file.name}
          meta={file.size}
          actions={<IconButton icon="x" size="sm" label="Remove file" onClick={() => setFile(undefined)} />}
        />
      ) : undefined}
      toolbarStart={(
        <>
          {english ? null : <IconButton icon="plus" size="sm" outlined label="Add a job file" />}
          <ModeMenu track={track} open={menuOpen} onChange={setTrack} />
        </>
      )}
      send={send}
      {...rest}
    />
  );
}

/** Start, nothing typed: the round quiet mic is the quick start (voice practice). Its tooltip names what it starts. */
export const StartActionMic: Story = { render: () => <Start /> };
/** Start, answers typed: the same quick start with a keyboard icon. */
export const StartActionKeyboard: Story = { render: () => <Start typed /> };
/** Quick start running: a spinner replaces the icon, `aria-busy`. */
export const StartActionBusy: Story = { render: () => <Start busy /> };
/** Quick start unavailable (engine not ready): the button is disabled. */
export const StartActionDisabled: Story = { render: () => <Start disabled /> };
/** Start with text: the mic has morphed into the black Send arrow (motion D6). */
export const HomeStartV2: Story = { render: () => <Start initial="I have an HR screen with Lumen tomorrow" /> };
/** Start, English practice: no `+` and no file, no quick start; Send appears with text. */
export const StartEnglish: Story = { render: () => <Start track="english" /> };
/** A job file attached by `+`, drop or paste (D89): the file card above the field, Send is shown. */
export const StartFileAttached: Story = { render: () => <Start file={{ name: "kestrel-pay-senior-pd.pdf", size: "184 KB" }} /> };
/** D89 `onFiles`: a file is over the composer, so the box shows the drop highlight. The story fires the drag-over itself. */
export const StartDropping: Story = {
  render: () => <Start />,
  play: ({ canvasElement }) => {
    // textarea > row > box: the box carries the drag handlers.
    const target = canvasElement.querySelector("textarea")?.parentElement?.parentElement;
    try {
      const data = new DataTransfer();
      data.items.add(new File(["x"], "kestrel-pay-senior-pd.pdf", { type: "application/pdf" }));
      target?.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
    } catch {
      // No DataTransfer constructor in this browser: the story shows the resting state.
    }
  },
};
/** The mode menu open: radio items with a description (Interview / English practice). */
export const StartModeMenu: Story = {
  render: () => <div style={{ paddingBottom: "13rem" }}><Start menuOpen /></div>,
};
/** Owner 2026-10-27: the field is focused and nothing changes: no ring, no fill step, no shadow (the caret alone is the focus mark). */
export const Focused: Story = {
  render: () => <div style={{ padding: "var(--space-2)" }}><Start initial="Product Manager at Kestrel Pay" /></div>,
  play: ({ canvasElement }) => { canvasElement.querySelector("textarea")?.focus(); },
};
/** Overflow: a long answer grows to 8 rows, then scrolls; a long file name clamps to 2 lines. */
export const Overflow: Story = {
  render: () => (
    <Start
      file={{ name: "kestrel-payments-international-holdings-senior-staff-product-designer-platform-experience-and-growth-europe-and-north-america.pdf", size: "184 KB" }}
      initial={Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: Own the end-to-end checkout experience for small merchants.`).join("\n")}
    />
  ),
};
/** Narrow parent (343px, the 375 frame): the shorter placeholder; the toolbar wraps if it must. */
export const Narrow: Story = { render: () => <div style={{ width: "21.4375rem" }}><Start narrow initial="Paste" /></div> };

type Dictation = "idle" | "listening" | "transcribing";

/** The setup-chat composer (HomeView.tsx, D90): the `+` leads the one-line row, the end button is the mic (dictate)
 * with an empty field, Stop while it listens (the field is `readOnly`), Send with text. */
function Setup({ initial = "", dictation = "idle", error, file }: { initial?: string; dictation?: Dictation; error?: string; file?: { name: string; size: string } }) {
  const [v, setV] = useState(initial);
  const hearing = dictation !== "idle";
  const hasInput = Boolean(v.trim() || file);
  const send: ComposerSend = hasInput && !hearing
    ? { label: "Send", icon: "arrowRight", variant: "action", onSend: () => setV("") }
    : {
        label: hearing ? "Stop and add the words" : "Dictate",
        icon: hearing ? "stop" : "mic",
        variant: hearing ? "action" : "quiet",
        busy: dictation === "transcribing",
      };
  return (
    <Composer
      label="Reply to Mike"
      placeholder={dictation === "listening" ? "Listening… press stop when you're done" : dictation === "transcribing" ? "Writing down what you said…" : "Reply to Mike"}
      value={v}
      minRows={1}
      maxRows={6}
      submitOnEnter={!hearing}
      readOnly={hearing}
      onChange={(e) => setV(e.target.value)}
      onFiles={() => {}}
      attachment={file ? <FileCard name={file.name} size={file.size} /> : undefined}
      leading={<IconButton icon="plus" size="sm" outlined label="Add your CV" />}
      error={error}
      send={send}
    />
  );
}

/** Setup chat, empty: leading `+`, the quiet mic dictates into the field. */
export const SetupChat: Story = { render: () => <Setup /> };
/** Setup chat with text: the mic has become Send. */
export const SetupChatTyped: Story = { render: () => <Setup initial="Mostly senior product roles, in payments" /> };
/** Dictating: the field is `readOnly` with the listening placeholder, the end button is Stop. */
export const SetupChatListening: Story = { render: () => <Setup dictation="listening" /> };
/** The recording is being turned into text: the end button shows a spinner. */
export const SetupChatTranscribing: Story = { render: () => <Setup dictation="transcribing" /> };
/** A CV sent in the chat (D89): the file card above the one-line row. */
export const SetupChatWithFile: Story = { render: () => <Setup file={{ name: "alex-morgan-cv.pdf", size: "96 KB" }} /> };
/** Dictation error (D90): the message sits under the composer (`role="alert"`), the box stays usable. */
export const Error: Story = { render: () => <Setup error="Didn't catch any words. Try again a little closer to the mic." /> };

function Session(props: Partial<ComposerProps>) {
  const [v, setV] = useState("");
  return (
    <Composer
      label="Your answer"
      placeholder="Type your answer"
      value={v}
      onChange={(e) => setV(e.target.value)}
      submitOnEnter
      send={{ label: "Send", icon: "send", variant: "action", disabled: v.trim() === "", onSend: () => setV("") }}
      {...props}
    />
  );
}
/** Session text mode (screens/session/parts/Island.tsx, v2 `surface: none`): no own box — the composer lives inside the
 * island's lead row; black send button, Enter sends, no hint line. */
export const SurfaceNone: Story = {
  render: () => (
    <div style={{ width: "var(--layout-narrow)", maxWidth: "100%", padding: "var(--space-3)", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--color-raised)", boxShadow: "var(--shadow-raised)" }}>
      <Session surface="none" minRows={1} maxRows={6} />
    </div>
  ),
};
