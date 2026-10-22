/* Microphone level for the live mic indicator: RMS of a PCM frame (0..~0.3 for speech) → 0..1.
 * The square root lifts quiet speech so the disc answers a normal voice, not only shouting.
 * Same gain as the setup wizard's level meter (rms × 6 = full scale). */
export const LEVEL_GAIN = 6;

export function micLevel(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(1, Math.sqrt(rms * LEVEL_GAIN));
}
