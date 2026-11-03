import type { ReactNode } from "react";
import s from "./Kbd.module.css";

export interface KbdProps {
  children: ReactNode;
  /** `default`: a keycap. `ghost` (D105 follow-up): a quiet pill with a hairline outline and no fill, for a hint that only shows on hover (the sidebar's Search row). */
  variant?: "default" | "ghost";
}

export function Kbd({ children, variant = "default" }: KbdProps) {
  return <kbd className={`${s.kbd} ${variant === "ghost" ? s.ghost : ""}`}>{children}</kbd>;
}
