/* Pure PCM helpers shared by capture and playback (tested in framing.test.ts).
 * Wire format (PROTOCOL.md): client -> server 16 kHz mono PCM16 LE, <= 65,536 bytes, even length;
 * server -> client 24 kHz mono PCM16 LE. */

export const IN_RATE = 16000;
export const OUT_RATE = 24000;
export const MAX_FRAME_BYTES = 65536;
/** Above this many unsent bytes the socket cannot keep up (prototype rule): end the session safely. */
export const MAX_BUFFERED_BYTES = 262144;

/** PCM16 -> float [-1, 1). Accepts an ArrayBuffer; an odd trailing byte is ignored. */
export function pcm16ToFloat32(buffer: ArrayBuffer): Float32Array<ArrayBuffer> {
  const samples = new Int16Array(buffer, 0, Math.floor(buffer.byteLength / 2));
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = (samples[i] ?? 0) / 32768;
  return out;
}

/** float -> PCM16 with clipping (asymmetric scale, same as the worklet). */
export function float32ToPcm16(input: Float32Array): Int16Array<ArrayBuffer> {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = Math.round(s * (s < 0 ? 32768 : 32767));
  }
  return out;
}

/** Root-mean-square level of a PCM16 frame, 0..1. */
export function rmsPcm16(samples: Int16Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] ?? 0) / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/** Split PCM bytes into frames the server accepts: each <= max bytes and of even length. */
export function chunkPcm(buffer: ArrayBuffer, max = MAX_FRAME_BYTES): ArrayBuffer[] {
  const evenMax = max - (max % 2);
  const usable = buffer.byteLength - (buffer.byteLength % 2);
  const out: ArrayBuffer[] = [];
  for (let offset = 0; offset < usable; offset += evenMax) {
    out.push(buffer.slice(offset, Math.min(usable, offset + evenMax)));
  }
  return out;
}

export function durationSeconds(byteLength: number, rate: number): number {
  return byteLength / 2 / rate;
}
