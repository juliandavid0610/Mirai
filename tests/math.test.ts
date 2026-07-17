import { describe, expect, it } from 'vitest';
import {
  clamp,
  clamp01,
  damp,
  inverseLerp,
  lerp,
  mulberry32,
  remap,
  rms,
} from '@/lib/utils/math';

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('resolves NaN to the minimum rather than propagating it', () => {
    // A NaN reaching a Cubism parameter corrupts the rig for the rest of the
    // session, so every numeric path has to terminate it.
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('lerp / inverseLerp / remap', () => {
  it('interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, -1)).toBe(0);
    expect(lerp(0, 10, 2)).toBe(10);
  });

  it('inverts', () => {
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerp(5, 5, 5)).toBe(0);
  });

  it('remaps between ranges', () => {
    expect(remap(0.5, 0, 1, 0, 100)).toBe(50);
    expect(remap(2, 0, 1, 0, 100)).toBe(100);
  });
});

describe('damp', () => {
  it('moves toward the target', () => {
    expect(damp(0, 1, 0.01, 1 / 60)).toBeGreaterThan(0);
    expect(damp(0, 1, 0.01, 1 / 60)).toBeLessThan(1);
  });

  it('does not move when no time has passed', () => {
    expect(damp(0.3, 1, 0.01, 0)).toBe(0.3);
    expect(damp(0.3, 1, 0.01, -1)).toBe(0.3);
  });

  /**
   * The reason `damp` exists instead of a plain per-frame lerp: convergence
   * has to depend on elapsed *time*, not on how many frames the display
   * happened to render.
   */
  it('converges by the same amount at 60Hz and 144Hz', () => {
    const smoothing = 0.01;
    const seconds = 0.25;

    let at60 = 0;
    for (let i = 0; i < 60 * seconds; i += 1) {
      at60 = damp(at60, 1, smoothing, 1 / 60);
    }

    let at144 = 0;
    for (let i = 0; i < 144 * seconds; i += 1) {
      at144 = damp(at144, 1, smoothing, 1 / 144);
    }

    expect(Math.abs(at60 - at144)).toBeLessThan(0.01);
  });
});

describe('rms', () => {
  it('is zero for silence and for an empty buffer', () => {
    expect(rms(new Float32Array(64))).toBe(0);
    expect(rms(new Float32Array(0))).toBe(0);
  });

  it('is one for a full-scale constant signal', () => {
    expect(rms(new Float32Array(16).fill(1))).toBeCloseTo(1);
    expect(rms(new Float32Array(16).fill(-1))).toBeCloseTo(1);
  });

  it('matches the known RMS of a sine wave', () => {
    const samples = new Float32Array(1024);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.sin((i / samples.length) * Math.PI * 2 * 8);
    }
    // RMS of a unit sine is 1/sqrt(2).
    expect(rms(samples)).toBeCloseTo(Math.SQRT1_2, 2);
  });
});

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays within 0…1', () => {
    const random = mulberry32(7);
    for (let i = 0; i < 500; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
