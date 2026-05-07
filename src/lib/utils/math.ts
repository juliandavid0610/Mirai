/** Numeric helpers used by the animation and audio code. */

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

export function inverseLerp(from: number, to: number, value: number): number {
  if (from === to) return 0;
  return clamp01((value - from) / (to - from));
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * A plain `lerp(current, target, 0.2)` per frame produces different damping on
 * a 60 Hz and a 144 Hz display. Folding the delta time into the exponent keeps
 * the *time* to converge constant regardless of frame rate, which matters for
 * lip sync: on a high-refresh monitor the naive version snaps the jaw open so
 * fast it reads as a flicker.
 *
 * @param smoothing fraction of the remaining distance left after 1 second
 */
export function damp(
  current: number,
  target: number,
  smoothing: number,
  deltaSeconds: number,
): number {
  if (deltaSeconds <= 0) return current;
  const factor = 1 - Math.pow(clamp01(smoothing), deltaSeconds);
  return current + (target - current) * factor;
}

/** Root mean square of a signal buffer, the loudness measure used for lip sync. */
export function rms(buffer: ArrayLike<number>): number {
  const length = buffer.length;
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const sample = buffer[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / length);
}

/**
 * Deterministic pseudo-random generator.
 *
 * Idle motion needs randomness that can be replayed — otherwise a visual
 * regression test can never reproduce a frame. `mulberry32` is 4 lines, fast,
 * and has a long enough period for animation jitter.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
