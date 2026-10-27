/* Nav row (G17, components.md §4): one row for the AppShell rail and the Settings section nav.
 * Icon + label link; current = `--color-selected` + weight 500 + aria-current="page" (selected and hover greys are
 * close on purpose, so the weight and the aria state carry it too — CONTRACT §2.3). Router-agnostic: pass `linkAs`
 * (e.g. a react-router Link adapter); the default is a plain <a>.
 * Loading (a chat still being saved after End): the label takes the shimmer text treatment (docs/motion.md 3.5 L4; the global
 * `.shimmer-text`, so quiet mode and reduced motion are handled in one place); the row stays a link.
 * Motion (docs/motion.md 3.6 B4): background and colour `fast`. */
import type { ComponentType, MouseEventHandler, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import s from "./NavRow.module.css";

/** The link element DS rows render. A router adapter maps `href` to its own `to`. */
export interface LinkLikeProps {
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  "aria-current"?: "page" | "true" | undefined;
  "aria-label"?: string;
  "data-review-id"?: string;
  "data-track"?: string;
}
export type LinkComponent = ComponentType<LinkLikeProps>;

export const PlainLink: LinkComponent = ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>;

export interface NavRowProps {
  href: string;
  label: string;
  icon?: IconName;
  current?: boolean;
  /** Trailing text or badge (e.g. a count). */
  end?: ReactNode;
  linkAs?: LinkComponent;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  className?: string;
  /** The row's work is still going on (e.g. a session being saved): the label shimmers. */
  loading?: boolean;
  /** User-test label (`data-track`, kebab-case, never user data: a row's label may be a session title). */
  track?: string;
}

export function NavRow({ href, label, icon, current, end, linkAs: LinkAs = PlainLink, onClick, className, track, loading }: NavRowProps) {
  return (
    <LinkAs
      href={href}
      className={`${s.row} ${className ?? ""}`}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      data-track={track}
      data-review-id={`NavRow/${current ? "current" : "default"}`}
    >
      {icon ? <Icon name={icon} /> : null}
      <span className={loading ? `${s.label} shimmer-text` : s.label} aria-busy={loading || undefined}>{label}</span>
      {end ? <span className={s.end}>{end}</span> : null}
    </LinkAs>
  );
}
