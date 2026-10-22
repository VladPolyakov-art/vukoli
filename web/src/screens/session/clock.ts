/* The island timer (session.md §V2.1, D37): static text, ticks once a second, never pulses or recolours.
 * "07:12" under an hour (minutes padded), "1:02:14" from an hour on (S13 overflow). */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}
