/* Line icons, 24×24 grid, 1.75 stroke, currentColor only (no colour literals). Decorative by default. */
import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "mic" | "micOff" | "keyboard" | "send" | "redo" | "stop" | "play" | "check" | "x" | "copy" | "refresh"
  | "chevronDown" | "chevronRight" | "chevronLeft" | "arrowRight" | "arrowDown" | "external" | "settings" | "history" | "practice"
  | "sun" | "moon" | "monitor" | "trash" | "edit" | "content" | "language" | "delivery" | "alert" | "info"
  | "sparkle" | "user" | "briefcase" | "upload" | "link" | "file" | "clock" | "plus" | "download" | "lock"
  | "hand" | "chat" | "cpu" | "globe" | "terminal" | "key" | "folder" | "eye"
  | "menu" | "more" | "search" | "panel" | "sidebar" | "bulb" | "help" | "target" | "archive";

const paths: Record<IconName, ReactNode> = {
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  more: (<><path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={2.75} /></>),
  /* v2: the feedback panel toggle (a window with a right-hand panel). */
  panel: (<><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M14.5 4.5v15" /></>),
  /* D57: the sidebar toggle (a window with a left-hand panel), like claude.ai. */
  sidebar: (<><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M9.5 4.5v15" /></>),
  /* D62: the sample-answer toggle (US-58) and the session help (shortcuts + mic help). */
  bulb: (<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.9.8-.9 1.4v.3M12 16.6h.01" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  micOff: (<><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18" /></>),
  keyboard: (<><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6.5 10h1M10.5 10h1M14.5 10h1M17.5 10h.01M7 14h10" /></>),
  send: (<path d="M4 12 20 4l-6 16-3-7-7-1Z" />),
  redo: (<><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></>),
  stop: (<rect x="6" y="6" width="12" height="12" rx="2" />),
  play: (<path d="M7 5v14l12-7L7 5Z" />),
  check: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  x: (<path d="M6 6l12 12M18 6 6 18" />),
  copy: (<><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>),
  refresh: (<><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" /><path d="M18.5 3v4.5H14M5.5 21v-4.5H10" /></>),
  chevronDown: (<path d="m6 9 6 6 6-6" />),
  chevronRight: (<path d="m9 6 6 6-6 6" />),
  chevronLeft: (<path d="m15 6-6 6 6 6" />),
  arrowRight: (<path d="M5 12h14M13 6l6 6-6 6" />),
  arrowDown: (<path d="M12 5v14M6 13l6 6 6-6" />),
  external: (<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>),
  history: (<><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>),
  practice: (<><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: (<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />),
  monitor: (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>),
  trash: (<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>),
  edit: (<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>),
  content: (<><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M9.5 12h5M9.5 15.5h5M13.5 3.5V8h4.5" /></>),
  language: (<><path d="M4 18 8.5 6l4.5 12M5.6 14h5.8" /><path d="M15 9.5h5.5M17.75 8v1.5c0 3-1.5 5.5-3.75 6.5M16 12.5c.8 1.6 2.2 2.9 4.5 3.5" /></>),
  delivery: (<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" />),
  alert: (<><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5h.01" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></>),
  /* D79: one four-point star (AI engine), larger and easier to see than the old star pair. */
  sparkle: (<path d="M12 3c.7 4.7 3.6 7.6 8.5 9-4.9 1.4-7.8 4.3-8.5 9-.7-4.7-3.6-7.6-8.5-9 4.9-1.4 7.8-4.3 8.5-9Z" />),
  /* D80: the Archive (a box with a lid). */
  archive: (<><rect x="3.5" y="4.5" width="17" height="4.5" rx="1" /><path d="M5 9v9.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></>),
  /* D79: Settings → Practice (aiming at a goal; the house was a leftover of the old Home tab). */
  target: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12h.01" strokeWidth={2.75} /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 20.5a8 8 0 0 1 16 0" /></>),
  briefcase: (<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18" /></>),
  upload: (<><path d="M12 15V4M7 8.5 12 4l5 4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>),
  link: (<><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>),
  file: (<><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" /><path d="M14 3.5V8h4.5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  download: (<><path d="M12 4v11M7 10.5 12 15l5-4.5" /><path d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" /></>),
  lock: (<><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>),
  hand: (<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7-2.5 0-4-1.2-5.4-3.2L3.4 14.6a1.5 1.5 0 0 1 2.3-2L8 15" />),
  chat: (<path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.5A7.5 7.5 0 1 1 20 12Z" />),
  cpu: (<><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M10 10h4v4h-4zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9S9.5 5.7 12 3Z" /></>),
  terminal: (<><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16.5 6.5l2.5 2.5M14 9l2 2" /></>),
  folder: (<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V7Z" />),
  eye: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: "sm" | "md" | "lg";
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string;
}

export function Icon({ name, size = "md", label, style, ...rest }: IconProps) {
  const dim = `var(--icon-${size})`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={dim}
      height={dim}
      style={{ width: dim, height: dim, flex: "none", ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

export const iconNames = Object.keys(paths) as IconName[];
