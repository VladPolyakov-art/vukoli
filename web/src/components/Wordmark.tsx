/* Final logo (23.10.2026, source docs/brand/logo; replaces the D68 text-only placeholder). Wordmark is the lockup: the
 * gradient mark + the name "vukoli" as real text (i18n, selectable, follows the theme via text-primary). LogoMark is the
 * mark alone (D78: the collapsed sidebar's toggle). The colours live inside the .svg files (the check-tokens lint forbids
 * colour literals in TS/CSS). vukoli-mark-tight.svg is the mark cropped to its visible 104x90, so both are sized exactly;
 * LogoMark is the same size as the lockup's mark, so collapsing the sidebar does not change the logo. */
import { t } from "../i18n";
import markTight from "./brand/vukoli-mark-tight.svg";
import s from "./Wordmark.module.css";

/** The lockup: mark + word. The mark is decorative (the word carries the name); it scales with the font size. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`${s.wordmark} ${className ?? ""}`}>
      <img className={s.lockupMark} src={markTight} alt="" aria-hidden="true" draggable={false} />
      <span className={s.word}>{t("app.name")}</span>
    </span>
  );
}

/** The app mark alone, gradient, no badge. Decorative (the button around it has the name). */
export function LogoMark({ className }: { className?: string }) {
  return <img className={`${s.mark} ${className ?? ""}`} src={markTight} alt="" aria-hidden="true" draggable={false} />;
}
