/* A sentence made of plain text and marked fragments (G20 InlineMark): "Heard as", "Say", the answer text, the stronger answer. */
import { InlineMark } from "../../../ds";
import { t } from "../../../i18n";
import type { Segments } from "../types";

export function Marked({ parts, quoted }: { parts: Segments; quoted?: boolean }) {
  return (
    <>
      {quoted ? "“" : null}
      {parts.map((p, i) => {
        if (typeof p === "string") return p;
        return p.kind === "unsure" ? (
          <InlineMark key={i} kind="unsure" srLabel={t("feedback.language.mayBeMisheard")}>{p.text}</InlineMark>
        ) : (
          <InlineMark key={i} kind={p.kind}>{p.text}</InlineMark>
        );
      })}
      {quoted ? "”" : null}
    </>
  );
}

/** Plain text of segments (the editor starts from what was heard). */
export function plain(parts: Segments): string {
  return parts.map((p) => (typeof p === "string" ? p : p.text)).join("");
}
