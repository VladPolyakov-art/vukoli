/* Story-only helper: a fake voice level 0..1 that sounds like speech (syllables + pauses), read per frame by
 * Presence / MicButton through `getLevel`. Deterministic (no Math.random) so review screenshots are stable. */
export function fakeVoiceLevel(timeMs: number): number {
  const t = timeMs / 1000;
  const syllable = Math.abs(Math.sin(t * 9.1)) * 0.6 + Math.abs(Math.sin(t * 3.7)) * 0.4;
  const phrase = Math.sin(t * 0.9) > -0.35 ? 1 : 0.08; // short pauses between phrases
  return Math.min(1, Math.max(0, syllable * phrase));
}

export const getFakeLevel = () => fakeVoiceLevel(performance.now());
