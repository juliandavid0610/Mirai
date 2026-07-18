import { describe, expect, it } from 'vitest';
import { EMOTIONS } from '@/types/emotion';
import {
  EMOTION_POSES,
  POSE_SLOTS,
  blendModeFor,
  blendPoses,
  restValue,
  scalePose,
} from '@/lib/live2d/expression-map';

describe('EMOTION_POSES', () => {
  it('defines a pose for every emotion', () => {
    for (const emotion of EMOTIONS) {
      expect(EMOTION_POSES[emotion]).toBeDefined();
    }
  });

  it('keeps eye-open multipliers non-negative', () => {
    // Eye-open is a multiply slot; a negative value would invert the eyelid.
    for (const pose of Object.values(EMOTION_POSES)) {
      for (const slot of ['eyeLOpen', 'eyeROpen'] as const) {
        const value = pose[slot];
        if (value !== undefined) expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps form parameters inside the Cubism -1…1 convention', () => {
    const formSlots = [
      'mouthForm',
      'browLForm',
      'browRForm',
      'browLY',
      'browRY',
    ] as const;
    for (const pose of Object.values(EMOTION_POSES)) {
      for (const slot of formSlots) {
        const value = pose[slot];
        if (value === undefined) continue;
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every emotion something visibly different from neutral', () => {
    const neutral = JSON.stringify(EMOTION_POSES.neutral);
    for (const emotion of EMOTIONS) {
      if (emotion === 'neutral') continue;
      expect(JSON.stringify(EMOTION_POSES[emotion])).not.toBe(neutral);
    }
  });
});

describe('POSE_SLOTS', () => {
  it('has no duplicates', () => {
    expect(new Set(POSE_SLOTS).size).toBe(POSE_SLOTS.length);
  });

  it('covers every slot used by any pose', () => {
    for (const pose of Object.values(EMOTION_POSES)) {
      for (const slot of Object.keys(pose)) {
        expect(POSE_SLOTS).toContain(slot);
      }
    }
  });
});

describe('blendModeFor / restValue', () => {
  it('adds head and body angles so tracking survives', () => {
    for (const slot of ['angleX', 'angleY', 'angleZ', 'bodyAngleX'] as const) {
      expect(blendModeFor(slot)).toBe('add');
      expect(restValue(slot)).toBe(0);
    }
  });

  it('multiplies eye-open so auto-blink survives', () => {
    for (const slot of ['eyeLOpen', 'eyeROpen'] as const) {
      expect(blendModeFor(slot)).toBe('multiply');
      // 1 is the identity for multiplication — a rest value of 0 here would
      // hold the eyes shut whenever no emotion is active.
      expect(restValue(slot)).toBe(1);
    }
  });

  it('sets everything else', () => {
    expect(blendModeFor('mouthForm')).toBe('set');
    expect(restValue('mouthForm')).toBe(0);
  });
});

describe('blendPoses', () => {
  it('returns the source at t=0 and the target at t=1', () => {
    const from = EMOTION_POSES.sad;
    const to = EMOTION_POSES.joy;

    const atZero = blendPoses(from, to, 0);
    const atOne = blendPoses(from, to, 1);

    expect(atZero.mouthForm).toBeCloseTo(from.mouthForm ?? 0);
    expect(atOne.mouthForm).toBeCloseTo(to.mouthForm ?? 0);
  });

  it('blends a slot missing on one side against its rest value', () => {
    const blended = blendPoses({}, { mouthOpen: 1 }, 0.5);
    expect(blended.mouthOpen).toBeCloseTo(0.5);
  });

  it('omits slots that are at rest on both sides', () => {
    expect(blendPoses({}, {}, 0.5)).toEqual({});
  });
});

describe('scalePose', () => {
  it('collapses to rest at amount 0', () => {
    const scaled = scalePose(EMOTION_POSES.angry, 0);
    expect(scaled.mouthForm).toBe(0);
    expect(scaled.eyeLOpen).toBe(1);
  });

  it('is the identity at amount 1', () => {
    const scaled = scalePose(EMOTION_POSES.angry, 1);
    expect(scaled.mouthForm).toBeCloseTo(EMOTION_POSES.angry.mouthForm ?? 0);
  });

  it('scales toward rest, not toward zero', () => {
    // eyeLOpen rests at 1, so half of a 1.1 target is 1.05 — not 0.55.
    const scaled = scalePose({ eyeLOpen: 1.1 }, 0.5);
    expect(scaled.eyeLOpen).toBeCloseTo(1.05);
  });
});
