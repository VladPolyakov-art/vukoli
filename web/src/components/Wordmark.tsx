/* D68: the product's wordmark — the name "Vukoli" set lowercase in the UI font, no symbol (a plain word, no mark,
 * a simple placeholder until a real logo). The favicon is its first letter (public/favicon.svg); LogoMark is the same
 * letter in the UI (D78: the collapsed sidebar's toggle). */
import { t } from "../i18n";
import s from "./Wordmark.module.css";

export function Wordmark({ className }: { className?: string }) {
  return <span className={`${s.wordmark} ${className ?? ""}`}>{t("app.name")}</span>;
}

/** The app mark: the name's first letter, inverted, in a round badge. Decorative (the button around it has the name). */
export function LogoMark({ className }: { className?: string }) {
  return <span className={`${s.mark} ${className ?? ""}`} aria-hidden="true">{t("app.name").slice(0, 1).toLowerCase()}</span>;
}
