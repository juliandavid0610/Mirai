import type { Emotion } from '@/types/emotion';
import type { ParameterSlot } from './parameter-writer';

/**
 * A facial pose expressed in semantic parameter slots.
 *
 * Values follow the Cubism convention: most parameters run −1…1, eye-open
 * runs 0…1. Only the slots an emotion actually needs are listed; anything
 * absent is left to the motion and physics systems.
 */
export type EmotionPose = Partial<Record<ParameterSlot, number>>;

/**
 * Hand-tuned poses, used when a rig ships no expression files — and layered at
 * partial weight on top of expression files when it does, so that even a rig
 * with only eight generic expressions still reads as nine distinct emotions.
 *
 * Tuning notes that took the longest to get right:
 *  - brows do most of the work; mouth shape alone is nearly unreadable
 *  - `eyeSmile` is what separates a warm smile from a smirk
 *  - `sleepy` has to half-close the eyes or it looks identical to `sad`
 */
export const EMOTION_POSES: Record<Emotion, EmotionPose> = {
  neutral: {
    mouthForm: 0,
    browLY: 0,
    browRY: 0,
    browLForm: 0,
    browRForm: 0,
  },
  joy: {
    mouthForm: 1,
    eyeSmileL: 1,
    eyeSmileR: 1,
    browLY: 0.3,
    browRY: 0.3,
    browLForm: 0.4,
    browRForm: 0.4,
  },
  excited: {
    mouthForm: 1,
    mouthOpen: 0.35,
    eyeLOpen: 1.15,
    eyeROpen: 1.15,
    browLY: 0.8,
    browRY: 0.8,
    browLForm: 0.6,
    browRForm: 0.6,
    angleZ: 4,
  },
  shy: {
    mouthForm: 0.3,
    eyeSmileL: 0.6,
    eyeSmileR: 0.6,
    eyeLOpen: 0.55,
    eyeROpen: 0.55,
    browLY: -0.2,
    browRY: -0.2,
    browLForm: 0.3,
    browRForm: 0.3,
    angleZ: -6,
    angleY: -4,
  },
  sad: {
    mouthForm: -1,
    eyeLOpen: 0.7,
    eyeROpen: 0.7,
    browLY: -0.7,
    browRY: -0.7,
    browLForm: -0.8,
    browRForm: -0.8,
    angleY: -7,
  },
  angry: {
    mouthForm: -0.8,
    eyeLOpen: 1.1,
    eyeROpen: 1.1,
    browLY: -1,
    browRY: -1,
    browLForm: -1,
    browRForm: -1,
    bodyAngleX: 3,
  },
  surprised: {
    mouthForm: 0,
    mouthOpen: 0.7,
    eyeLOpen: 1.3,
    eyeROpen: 1.3,
    browLY: 1,
    browRY: 1,
    browLForm: 0.2,
    browRForm: 0.2,
  },
  thinking: {
    mouthForm: -0.2,
    eyeLOpen: 0.8,
    eyeROpen: 0.8,
    browLY: 0.2,
    browRY: -0.3,
    browLForm: -0.2,
    browRForm: 0.3,
    angleX: 8,
    angleZ: 7,
  },
  sleepy: {
    mouthForm: -0.1,
    eyeLOpen: 0.25,
    eyeROpen: 0.25,
    browLY: -0.4,
    browRY: -0.4,
    angleY: -6,
    angleZ: -3,
  },
};

/**
 * How a pose value combines with whatever is already in the parameter.
 *
 * This is the detail that makes emotions coexist with the rest of the rig
 * instead of stamping on it:
 *
 *  - `add` for head/body angles, so an emotional head-tilt rides *on top of*
 *    pointer tracking rather than cancelling it;
 *  - `multiply` for eye-open, so a half-lidded `sleepy` face still blinks —
 *    writing eye-open absolutely freezes the eyelids open and kills the
 *    runtime's auto-blink, which is uncanny in a way that is hard to place
 *    until you notice the character has not blinked in a minute;
 *  - `set` for everything else.
 */
export type BlendMode = 'set' | 'add' | 'multiply';

export const SLOT_BLEND: Partial<Record<ParameterSlot, BlendMode>> = {
  angleX: 'add',
  angleY: 'add',
  angleZ: 'add',
  bodyAngleX: 'add',
  eyeLOpen: 'multiply',
  eyeROpen: 'multiply',
};

export function blendModeFor(slot: ParameterSlot): BlendMode {
  return SLOT_BLEND[slot] ?? 'set';
}

/** Union of every slot any pose touches — the set that must be relaxed back. */
export const POSE_SLOTS: ParameterSlot[] = [
  ...new Set(
    Object.values(EMOTION_POSES).flatMap(
      (pose) => Object.keys(pose) as ParameterSlot[],
    ),
  ),
];

/**
 * Blends two poses. Slots present in only one side are blended against their
 * rest value (0 for forms and angles, 1 for eye-open) rather than snapping.
 */
export function blendPoses(
  from: EmotionPose,
  to: EmotionPose,
  t: number,
): EmotionPose {
  const result: EmotionPose = {};
  for (const slot of POSE_SLOTS) {
    const rest = restValue(slot);
    const a = from[slot] ?? rest;
    const b = to[slot] ?? rest;
    if (a === rest && b === rest) continue;
    result[slot] = a + (b - a) * t;
  }
  return result;
}

/** The value a slot returns to when no emotion is asking for anything. */
export function restValue(slot: ParameterSlot): number {
  switch (slot) {
    case 'eyeLOpen':
    case 'eyeROpen':
      return 1;
    default:
      return 0;
  }
}

/**
 * Scales a pose toward rest. Used for the persona `expressiveness` dial and
 * for cue intensity, so a 0.3-intensity `angry` is a frown rather than a
 * scowl.
 */
export function scalePose(pose: EmotionPose, amount: number): EmotionPose {
  const result: EmotionPose = {};
  for (const [key, value] of Object.entries(pose) as [
    ParameterSlot,
    number,
  ][]) {
    const rest = restValue(key);
    result[key] = rest + (value - rest) * amount;
  }
  return result;
}
