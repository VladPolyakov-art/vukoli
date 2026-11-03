import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SessionAskDialogView } from "./SessionAskDialog";
import { FALLBACK_ISSUES_URL, EMPTY_DRAFT, SupportDialogView, type SupportDialogViewProps } from "./SupportDialog";
import type { SupportDraft } from "../lib/feedback";

/* US-60 (F66, D102): the two feedback dialogs. "Send feedback" (account menu, Settings → About) and "How did it go?"
 * (after End on the 1st session and then the 6th, 11th…). Open and static, in the flow; states by props. Copy is from
 * i18n/en.json (support.*). The only place anything leaves the computer is the Send button, and the preview line under
 * "Attach…" is exactly the line that is added. */
const meta: Meta = { title: "Patterns/Feedback" };
export default meta;

const APP_LINE = "Vukoli 0.2.3 · macOS 15.3 · Ollama · qwen3:4b";
const TYPED: SupportDraft = { kind: "problem", message: "The mic icon stays red after I stop talking.", email: "", attach: true };

function Support(props: Partial<SupportDialogViewProps>) {
  const [draft, setDraft] = useState<SupportDraft>(props.draft ?? EMPTY_DRAFT);
  return (
    <SupportDialogView
      inline open service="ready" appLine={APP_LINE} issuesUrl={FALLBACK_ISSUES_URL} status="idle"
      onSend={() => {}} onCopy={() => {}} onClose={() => {}}
      {...props} draft={draft} onDraft={(patch) => setDraft((d) => ({ ...d, ...patch }))}
    />
  );
}

/** Empty form: type (Idea selected), message required, email optional, "Attach…" ticked with the exact line shown. Send is off until there is text. */
export const SupportEmpty: StoryObj = { render: () => <Support /> };

/** Filled in. The preview under the checkbox is what the server adds; nothing else leaves the computer. */
export const SupportFilled: StoryObj = { render: () => <Support draft={{ ...TYPED, email: "alex@example.com" }} /> };

/** "Attach…" unticked: the line says nothing is attached. */
export const SupportNoMetadata: StoryObj = { render: () => <Support draft={{ ...TYPED, attach: false }} /> };

/** A bad email address: the field says so and Send stays off. */
export const SupportBadEmail: StoryObj = { render: () => <Support draft={{ ...TYPED, email: "alex@" }} /> };

/** Sending: the form is disabled, Send shows a spinner. */
export const SupportSending: StoryObj = { render: () => <Support draft={TYPED} status="sending" /> };

/** Sent: a quiet confirmation and Close. */
export const SupportSent: StoryObj = { render: () => <Support draft={TYPED} status="sent" /> };

/** The service did not take it (AC5): the text stays, Try again and Copy text. */
export const SupportError: StoryObj = { render: () => <Support draft={TYPED} status="error" errorCode="service_error" /> };

/** No connection: same, with its own reason. */
export const SupportNetworkError: StoryObj = { render: () => <Support draft={TYPED} status="error" errorCode="network" /> };

/** This copy has no feedback address (AC6): Copy text and a link to GitHub issues instead of Send. */
export const SupportNotConfigured: StoryObj = { render: () => <Support draft={TYPED} service="off" /> };

/** Checking whether the copy can send (a moment while the dialog opens). */
export const SupportChecking: StoryObj = { render: () => <Support service="loading" /> };

function Ask({ initial = null, ...props }: { initial?: number | null; status?: "idle" | "sending" | "sent" | "error"; errorCode?: string; note?: string }) {
  const [rating, setRating] = useState<number | null>(initial);
  const [note, setNote] = useState(props.note ?? "");
  return (
    <SessionAskDialogView
      inline open rating={rating} note={note} onRating={setRating} onNote={setNote} status={props.status ?? "idle"}
      errorCode={props.errorCode} onSend={() => {}} onClose={() => {}} onDontAsk={() => {}}
    />
  );
}

/** After End, before the debrief: nothing chosen yet, Send is off. "Not now" and "Don't ask again" are always there. */
export const AskEmpty: StoryObj = { render: () => <Ask /> };

/** One click on a step and Send turns on; the note is optional. */
export const AskRated: StoryObj = { render: () => <Ask initial={4} /> };

/** With a note. */
export const AskWithNote: StoryObj = { render: () => <Ask initial={2} note="The follow-up question repeated my last answer." /> };

export const AskSending: StoryObj = { render: () => <Ask initial={4} status="sending" /> };

export const AskSent: StoryObj = { render: () => <Ask initial={4} status="sent" /> };

/** Not sent: the answer stays, Try again. */
export const AskError: StoryObj = { render: () => <Ask initial={4} status="error" errorCode="network" /> };
