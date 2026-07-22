import { beforeEach, describe, expect, it } from 'vitest';
import { useMemory } from '@/lib/store/memory-store';
import { usePersonas } from '@/lib/store/persona-store';
import { useSettings } from '@/lib/store/settings-store';
import { BUILT_IN_PERSONAS } from '@/lib/ai/personas';

beforeEach(() => {
  usePersonas.setState({ custom: [] });
  useMemory.setState({ facts: [] });
  useSettings.getState().reset();
});

describe('persona store', () => {
  it('creates a persona with a unique id', () => {
    const store = usePersonas.getState();
    const a = store.create({ ...BUILT_IN_PERSONAS[0]!, name: 'Test' });
    const b = usePersonas.getState().create({
      ...BUILT_IN_PERSONAS[0]!,
      name: 'Test',
    });
    expect(a.id).not.toBe(b.id);
    expect(a.builtIn).toBe(false);
  });

  it('includes built-ins in all()', () => {
    usePersonas.getState().create({ ...BUILT_IN_PERSONAS[0]!, name: 'Extra' });
    expect(usePersonas.getState().all()).toHaveLength(
      BUILT_IN_PERSONAS.length + 1,
    );
  });

  /**
   * Regression guard. `all()` is a derived value and must never be used as a
   * zustand selector: it allocates a new array per call, `Object.is` therefore
   * always reports a change, and the subscribing component re-renders until
   * React throws "Maximum update depth exceeded".
   */
  it('all() returns a fresh array each call — never select it directly', () => {
    const store = usePersonas.getState();
    expect(store.all()).not.toBe(store.all());
    // Whereas the stored slice is referentially stable, which is what
    // components subscribe to instead.
    expect(usePersonas.getState().custom).toBe(usePersonas.getState().custom);
  });

  it('updates and removes a persona', () => {
    const created = usePersonas
      .getState()
      .create({ ...BUILT_IN_PERSONAS[0]!, name: 'Temp' });

    usePersonas.getState().update(created.id, { name: 'Renamed' });
    expect(usePersonas.getState().byId(created.id)?.name).toBe('Renamed');

    usePersonas.getState().remove(created.id);
    expect(usePersonas.getState().byId(created.id)).toBeUndefined();
  });

  it('duplicates a built-in as an editable copy', () => {
    const copy = usePersonas.getState().duplicate(BUILT_IN_PERSONAS[0]!);
    expect(copy.builtIn).toBe(false);
    expect(copy.name).toContain('copy');
  });
});

describe('memory store', () => {
  it('stores a trimmed fact', () => {
    useMemory.getState().remember('  likes TypeScript  ');
    expect(useMemory.getState().facts).toEqual(['likes TypeScript']);
  });

  it('ignores empty input', () => {
    useMemory.getState().remember('   ');
    expect(useMemory.getState().facts).toHaveLength(0);
  });

  it('de-duplicates case-insensitively', () => {
    useMemory.getState().remember('Likes TypeScript');
    useMemory.getState().remember('likes typescript');
    expect(useMemory.getState().facts).toHaveLength(1);
  });

  it('caps the list, dropping the oldest', () => {
    for (let i = 0; i < 60; i += 1) useMemory.getState().remember(`fact ${i}`);
    const { facts } = useMemory.getState();
    expect(facts).toHaveLength(40);
    expect(facts[0]).toBe('fact 20');
    expect(facts.at(-1)).toBe('fact 59');
  });

  it('forgets by index and clears', () => {
    useMemory.getState().remember('a');
    useMemory.getState().remember('b');
    useMemory.getState().forget(0);
    expect(useMemory.getState().facts).toEqual(['b']);
    useMemory.getState().clear();
    expect(useMemory.getState().facts).toEqual([]);
  });
});

describe('settings store', () => {
  it('sets a single key', () => {
    useSettings.getState().set('expressiveness', 0.4);
    expect(useSettings.getState().expressiveness).toBe(0.4);
  });

  it('restores defaults on reset', () => {
    useSettings.getState().set('voiceEnabled', false);
    useSettings.getState().reset();
    expect(useSettings.getState().voiceEnabled).toBe(true);
  });

  it('keeps action identities stable so selectors do not thrash', () => {
    const first = useSettings.getState().set;
    useSettings.getState().set('idleMotion', 0.5);
    expect(useSettings.getState().set).toBe(first);
  });
});
