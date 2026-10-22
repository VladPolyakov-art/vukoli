/* A navigation link that looks like the DS `link` button (inline, small, with an optional trailing arrow). */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../../ds";
import s from "./parts.module.css";

export function TextLink({ to, children, iconRight, className, track }: { to: string; children: ReactNode; iconRight?: IconName; className?: string; /** User-test label (`data-track`). */ track?: string }) {
  return (
    <Link to={to} className={`${s.link} ${className ?? ""}`} data-track={track}>
      {children}
      {iconRight ? <Icon name={iconRight} size="sm" /> : null}
    </Link>
  );
}
