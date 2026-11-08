/* The hint card (ds/screens/tough-talk.md §4.2): a thin wrapper over TacticCard `hint` in the Suggester's place, at the
 * end of the transcript flow. It enters with `card-in` `slow` and leaves with `soft-out` `exit` (motion §3.4 C7), so the
 * last card is kept while it leaves. The text comes from the server (cards are content, not i18n). */
import { useEffect, useRef } from "react";
import { TacticCard, scrollBehavior, usePresence } from "../../../ds";
import type { SessionHint } from "../types";
import s from "./parts.module.css";

type Card = NonNullable<SessionHint["card"]>;

export function HintCard({ hint, onHide, onAnother }: { hint: SessionHint; onHide?: () => void; onAnother?: () => void }) {
  const open = hint.open && Boolean(hint.card);
  const { mounted, leaving } = usePresence(open);
  const box = useRef<HTMLDivElement>(null);
  // The card opens at the end of the flow, under the composer on a phone: bring it fully into view (scroll-margin in the CSS keeps the dock clear). The box exists only once `mounted`.
  useEffect(() => {
    if (mounted && open) box.current?.scrollIntoView({ behavior: scrollBehavior(), block: "end" });
  }, [mounted, open, hint.card?.id]);
  // Keep the last card on screen while it plays its exit.
  const last = useRef<{ card: Card; alt: SessionHint["alt"] } | null>(null);
  if (hint.card) last.current = { card: hint.card, alt: hint.alt };
  const shown = last.current;
  if (!mounted || !shown) return null;
  const { card, alt } = shown;
  return (
    <div ref={box} className={`${s.hintCard} ${leaving ? "motion-soft-out" : "motion-card"}`} data-review-id="Session/Hint" data-review-section="Session · Hint" data-comment-target>
      <TacticCard
        size="hint"
        title={card.title}
        // A tough hint shows the answer-shape line as the rule (the card's own rule is the same idea, one line).
        rule={card.shape ?? card.text}
        example={card.example}
        alt={alt ? { title: alt.title, example: alt.example } : undefined}
        onHide={onHide}
        onAnother={onAnother}
        anotherState={hint.wait === "pending" ? "pending" : hint.wait === "stalled" ? "stalled" : "idle"}
      />
    </div>
  );
}
