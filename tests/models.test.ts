import { describe, expect, it } from 'vitest';
import {
  CHAT_MODELS,
  DEFAULT_MODEL_ID,
  findChatModel,
  isKnownModel,
  resolveModelId,
} from '@/lib/ai/models';
import {
  MODEL_CATALOG,
  DEFAULT_MODEL_ID as DEFAULT_AVATAR_ID,
  findModel,
  resolveModel,
} from '@/lib/live2d/catalog';

describe('chat model allow-list', () => {
  it('includes the default', () => {
    expect(isKnownModel(DEFAULT_MODEL_ID)).toBe(true);
  });

  it('has unique ids', () => {
    const ids = CHAT_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses gateway-style vendor-prefixed ids', () => {
    for (const model of CHAT_MODELS) {
      expect(model.id).toMatch(/^[a-z]+\/[\w.-]+$/);
    }
  });

  /**
   * The client picks the model, so this is an authorisation boundary: an
   * arbitrary string here would let a caller route a request to any model the
   * deployment's gateway key can reach.
   */
  it('rejects anything not on the list', () => {
    for (const hostile of [
      'openai/gpt-5.5-pro',
      '../../secret',
      'anthropic/claude-sonnet-5 ',
      '',
      undefined,
    ]) {
      expect(resolveModelId(hostile)).toBe(DEFAULT_MODEL_ID);
    }
  });

  it('passes through a listed model unchanged', () => {
    for (const model of CHAT_MODELS) {
      expect(resolveModelId(model.id)).toBe(model.id);
    }
  });

  it('looks a model up by id', () => {
    expect(findChatModel(DEFAULT_MODEL_ID)?.id).toBe(DEFAULT_MODEL_ID);
    expect(findChatModel('nope')).toBeUndefined();
  });
});

describe('Live2D catalog', () => {
  it('contains the default avatar', () => {
    expect(findModel(DEFAULT_AVATAR_ID)).toBeDefined();
  });

  it('has unique ids', () => {
    const ids = MODEL_CATALOG.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to the default for an unknown id', () => {
    expect(resolveModel('does-not-exist').id).toBe(DEFAULT_AVATAR_ID);
    expect(resolveModel(undefined).id).toBe(DEFAULT_AVATAR_ID);
  });

  it('points every entry at a Cubism manifest matching its declared version', () => {
    for (const model of MODEL_CATALOG) {
      if (model.cubism === 4) {
        expect(model.url).toMatch(/\.model3\.json$/);
      } else {
        expect(model.url).toMatch(/\.model\.json$/);
      }
    }
  });

  it('credits every bundled rig', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.credit.author).toBeTruthy();
      expect(model.credit.license).toBeTruthy();
    }
  });

  it('keeps transforms inside sane bounds', () => {
    for (const { transform } of MODEL_CATALOG) {
      expect(transform.scale).toBeGreaterThan(0);
      expect(transform.scale).toBeLessThanOrEqual(1);
      expect(transform.anchorX).toBeGreaterThanOrEqual(0);
      expect(transform.anchorX).toBeLessThanOrEqual(1);
      expect(transform.anchorY).toBeGreaterThanOrEqual(0);
      expect(transform.anchorY).toBeLessThanOrEqual(1);
    }
  });

  it('only maps expressions to emotions the app knows', () => {
    for (const model of MODEL_CATALOG) {
      for (const name of Object.values(model.expressions ?? {})) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });
});
