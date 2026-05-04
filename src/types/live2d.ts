import type { Emotion } from './emotion';

/** Cubism runtime generation. Cubism 2 uses `.model.json`, Cubism 4 `.model3.json`. */
export type CubismVersion = 2 | 4;

/** A model the user can switch to at runtime. */
export interface ModelDescriptor {
  id: string;
  name: string;
  /** Short line shown in the model picker. */
  tagline: string;
  /** URL of the `.model3.json` / `.model.json` entry file. */
  url: string;
  cubism: CubismVersion;
  /** Attribution required by the asset's licence. */
  credit: {
    author: string;
    license: string;
    url: string;
  };
  /** Per-model tuning so every rig sits nicely in frame. */
  transform: ModelTransform;
  /**
   * Optional overrides when a rig does not follow the standard parameter
   * naming, or exposes expressions/motions under non-obvious names.
   */
  parameters?: Partial<ParameterMap>;
  expressions?: Partial<Record<Emotion, string>>;
  motions?: Partial<Record<Emotion, MotionRef>>;
}

export interface ModelTransform {
  /** Fraction of the stage height the model should occupy (0…1). */
  scale: number;
  /** Horizontal anchor, 0 = left edge, 0.5 = centred, 1 = right edge. */
  anchorX: number;
  /** Vertical anchor, 0 = top, 1 = bottom. */
  anchorY: number;
  /** Extra pixel nudge applied after anchoring. */
  offsetX: number;
  offsetY: number;
}

export interface MotionRef {
  group: string;
  index?: number;
}

/**
 * Cubism parameter ids differ between runtime versions and between authors.
 * Everything the engine drives goes through this map so the rest of the code
 * never hardcodes a raw parameter string.
 */
export interface ParameterMap {
  mouthOpen: string;
  mouthForm: string;
  eyeLOpen: string;
  eyeROpen: string;
  eyeSmileL: string;
  eyeSmileR: string;
  browLY: string;
  browRY: string;
  browLForm: string;
  browRForm: string;
  angleX: string;
  angleY: string;
  angleZ: string;
  bodyAngleX: string;
  breath: string;
}

export const CUBISM4_PARAMETERS: ParameterMap = {
  mouthOpen: 'ParamMouthOpenY',
  mouthForm: 'ParamMouthForm',
  eyeLOpen: 'ParamEyeLOpen',
  eyeROpen: 'ParamEyeROpen',
  eyeSmileL: 'ParamEyeLSmile',
  eyeSmileR: 'ParamEyeRSmile',
  browLY: 'ParamBrowLY',
  browRY: 'ParamBrowRY',
  browLForm: 'ParamBrowLForm',
  browRForm: 'ParamBrowRForm',
  angleX: 'ParamAngleX',
  angleY: 'ParamAngleY',
  angleZ: 'ParamAngleZ',
  bodyAngleX: 'ParamBodyAngleX',
  breath: 'ParamBreath',
};

export const CUBISM2_PARAMETERS: ParameterMap = {
  mouthOpen: 'PARAM_MOUTH_OPEN_Y',
  mouthForm: 'PARAM_MOUTH_FORM',
  eyeLOpen: 'PARAM_EYE_L_OPEN',
  eyeROpen: 'PARAM_EYE_R_OPEN',
  eyeSmileL: 'PARAM_EYE_L_SMILE',
  eyeSmileR: 'PARAM_EYE_R_SMILE',
  browLY: 'PARAM_BROW_L_Y',
  browRY: 'PARAM_BROW_R_Y',
  browLForm: 'PARAM_BROW_L_FORM',
  browRForm: 'PARAM_BROW_R_FORM',
  angleX: 'PARAM_ANGLE_X',
  angleY: 'PARAM_ANGLE_Y',
  angleZ: 'PARAM_ANGLE_Z',
  bodyAngleX: 'PARAM_BODY_ANGLE_X',
  breath: 'PARAM_BREATH',
};

export function parametersFor(cubism: CubismVersion): ParameterMap {
  return cubism === 2 ? CUBISM2_PARAMETERS : CUBISM4_PARAMETERS;
}

export type StageStatus =
  | 'idle'
  | 'loading-runtime'
  | 'loading-model'
  | 'ready'
  | 'error';
