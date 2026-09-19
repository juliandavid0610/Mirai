import type { ModelDescriptor } from '@/types/live2d';

/**
 * The bundled model catalog.
 *
 * Every entry is a Live2D *sample* model published under Live2D's Free
 * Material Licence, served from a CDN rather than vendored into the repo —
 * the rigs are tens of megabytes of textures and the licence does not permit
 * blanket redistribution. See docs/LIVE2D.md for how to add your own.
 *
 * The expression/motion maps below were read off each model's real manifest,
 * not guessed. Where a rig ships no expression file at all (Hiyori) the map is
 * omitted on purpose and the engine falls back to driving raw Cubism
 * parameters, which is why `expression-map.ts` has to exist at all.
 */

const SAMPLES = 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@develop/Samples/Resources';
const FIXTURES = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets';

const LIVE2D_FREE_MATERIAL = {
  author: 'Live2D Inc.',
  license: 'Live2D Free Material License',
  url: 'https://www.live2d.com/en/download/sample-data/',
} as const;

export const MODEL_CATALOG: ModelDescriptor[] = [
  {
    id: 'hiyori',
    name: 'Hiyori',
    tagline: 'Bright, cheerful, nine idle motions — and no expression files.',
    url: `${SAMPLES}/Hiyori/Hiyori.model3.json`,
    cubism: 4,
    credit: LIVE2D_FREE_MATERIAL,
    transform: { scale: 0.92, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 10 },
    // No `expressions` key, on purpose. This is the default rig *and* the one
    // with nothing to fall back on, so the hand-tuned parameter poses in
    // expression-map.ts carry all nine emotions on the front page. If that
    // path ever regresses, it is immediately obvious.
    motions: {
      neutral: { group: 'Idle' },
      excited: { group: 'TapBody', index: 0 },
    },
  },
  {
    id: 'haru',
    name: 'Haru',
    tagline: 'The classic greeter. Warm, readable, great for lip-sync demos.',
    url: `${FIXTURES}/haru/haru_greeter_t03.model3.json`,
    cubism: 4,
    credit: LIVE2D_FREE_MATERIAL,
    transform: { scale: 0.95, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 20 },
    // Haru's expressions are numbered f00..f07 with no semantic names, so the
    // mapping below is the result of stepping through each one by hand.
    expressions: {
      neutral: 'f00',
      joy: 'f01',
      excited: 'f02',
      shy: 'f03',
      sad: 'f04',
      angry: 'f05',
      surprised: 'f06',
      thinking: 'f07',
      sleepy: 'f04',
    },
    motions: {
      neutral: { group: 'Idle' },
      excited: { group: 'Tap', index: 0 },
      surprised: { group: 'Tap', index: 1 },
    },
  },
  {
    id: 'mao',
    name: 'Mao',
    tagline: 'High-detail rig with eight expressions and six tap reactions.',
    url: `${SAMPLES}/Mao/Mao.model3.json`,
    cubism: 4,
    credit: LIVE2D_FREE_MATERIAL,
    transform: { scale: 0.92, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 10 },
    expressions: {
      neutral: 'exp_01',
      joy: 'exp_02',
      excited: 'exp_03',
      shy: 'exp_04',
      sad: 'exp_05',
      angry: 'exp_06',
      surprised: 'exp_07',
      thinking: 'exp_08',
      sleepy: 'exp_05',
    },
    motions: {
      neutral: { group: 'Idle' },
      excited: { group: 'TapBody', index: 0 },
      surprised: { group: 'TapBody', index: 2 },
    },
  },
  {
    id: 'shizuku',
    name: 'Shizuku',
    tagline: 'A Cubism 2 rig, kept to prove the legacy runtime path still works.',
    url: `${FIXTURES}/shizuku/shizuku.model.json`,
    cubism: 2,
    credit: LIVE2D_FREE_MATERIAL,
    transform: { scale: 0.82, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0 },
    expressions: {
      joy: 'f01',
      shy: 'f02',
      sad: 'f03',
      angry: 'f04',
    },
    motions: {
      neutral: { group: 'idle' },
      excited: { group: 'tap_body' },
    },
  },
  {
    id: 'natori',
    name: 'Natori',
    tagline: 'Ships six semantically named expressions — Smile, Sad, Angry…',
    url: `${SAMPLES}/Natori/Natori.model3.json`,
    cubism: 4,
    credit: LIVE2D_FREE_MATERIAL,
    transform: { scale: 0.95, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 20 },
    // The rare sample whose expression files are named after the emotion they
    // depict, so this is the one entry where the map is obvious rather than
    // the result of stepping through `f00`…`f07` by hand.
    expressions: {
      neutral: 'Normal',
      joy: 'Smile',
      excited: 'Smile',
      shy: 'Blushing',
      sad: 'Sad',
      angry: 'Angry',
      surprised: 'Surprised',
      thinking: 'Normal',
      sleepy: 'Normal',
    },
    motions: {
      neutral: { group: 'Idle' },
      excited: { group: 'TapBody', index: 0 },
      surprised: { group: 'TapBody', index: 1 },
    },
  },
];

export const DEFAULT_MODEL_ID = 'hiyori';

export function findModel(id: string): ModelDescriptor | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}

export function resolveModel(id: string | undefined): ModelDescriptor {
  const model = id ? findModel(id) : undefined;
  // The catalog is never empty, but `noUncheckedIndexedAccess` wants proof.
  return model ?? findModel(DEFAULT_MODEL_ID) ?? (MODEL_CATALOG[0] as ModelDescriptor);
}

/**
 * Builds a descriptor for a model the user dropped into `public/models/`.
 * Local models get neutral defaults and no expression map, so they run purely
 * on the parameter-driven path until the user tunes them.
 */
export function localModel(
  id: string,
  name: string,
  url: string,
  cubism: 2 | 4 = 4,
): ModelDescriptor {
  return {
    id,
    name,
    tagline: 'Local model from /public/models',
    url,
    cubism,
    credit: { author: 'Local', license: 'Unknown', url: '' },
    transform: { scale: 0.42, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0 },
  };
}
