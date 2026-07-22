import { describe, expect, it } from 'vitest';
import { BUILT_IN_PERSONAS, resolvePersona } from '@/lib/ai/personas';
import { buildMemoryDigest, buildSystemPrompt } from '@/lib/ai/prompt';
import { personaSchema } from '@/lib/ai/schema';
import { EMOTIONS } from '@/types/emotion';

const persona = BUILT_IN_PERSONAS[0]!;

describe('buildSystemPrompt', () => {
  it('leads with the character brief', () => {
    const prompt = buildSystemPrompt({ persona });
    expect(prompt.indexOf('# Who you are')).toBe(0);
  });

  /**
   * Layout is load-bearing: the mechanical protocol has to sit last, closest
   * to the generation, or models quietly stop emitting markers as the
   * conversation gets long.
   */
  it('puts the emotion protocol after the character', () => {
    const prompt = buildSystemPrompt({ persona });
    expect(prompt.indexOf('# Showing emotion')).toBeGreaterThan(
      prompt.indexOf('# Who you are'),
    );
  });

  it('lists every valid emotion', () => {
    const prompt = buildSystemPrompt({ persona });
    for (const emotion of EMOTIONS) {
      expect(prompt).toContain(emotion);
    }
  });

  it('includes a worked example of the marker syntax', () => {
    expect(buildSystemPrompt({ persona })).toMatch(/\[\[\w+:?[\d.]*\]\]/);
  });

  it('injects memory when there is some', () => {
    const prompt = buildSystemPrompt({
      persona,
      memory: ['Prefers TypeScript', 'Lives in Berlin'],
    });
    expect(prompt).toContain('Prefers TypeScript');
    expect(prompt).toContain('Lives in Berlin');
  });

  it('omits the memory section entirely when there is none', () => {
    expect(buildSystemPrompt({ persona })).not.toContain('What you remember');
  });

  it('caps how much memory can reach the prompt', () => {
    const facts = Array.from({ length: 100 }, (_, i) => `fact number ${i}`);
    const prompt = buildSystemPrompt({ persona, memory: facts });
    expect(prompt).toContain('fact number 0');
    expect(prompt).not.toContain('fact number 99');
  });

  it('includes the local time when given', () => {
    expect(buildSystemPrompt({ persona, localTime: '09:41' })).toContain('09:41');
  });

  it('varies the marker guidance with expressiveness', () => {
    const shy = buildSystemPrompt({
      persona: { ...persona, expressiveness: 0.2 },
    });
    const loud = buildSystemPrompt({
      persona: { ...persona, expressiveness: 1 },
    });
    expect(shy).not.toBe(loud);
    expect(shy).toContain('sparingly');
  });
});

describe('buildMemoryDigest', () => {
  it('returns null for an empty list', () => {
    expect(buildMemoryDigest([])).toBeNull();
  });

  it('joins facts into one line', () => {
    expect(buildMemoryDigest(['a', 'b'])).toBe('Earlier in this conversation: a; b.');
  });
});

describe('built-in personas', () => {
  it('all validate against the wire schema', () => {
    for (const p of BUILT_IN_PERSONAS) {
      expect(personaSchema.safeParse(p).success).toBe(true);
    }
  });

  it('have unique ids', () => {
    const ids = BUILT_IN_PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keep expressiveness and temperature in range', () => {
    for (const p of BUILT_IN_PERSONAS) {
      expect(p.expressiveness).toBeGreaterThanOrEqual(0);
      expect(p.expressiveness).toBeLessThanOrEqual(1);
      expect(p.temperature).toBeGreaterThan(0);
      expect(p.temperature).toBeLessThanOrEqual(2);
    }
  });

  it('resolve an unknown id to the default', () => {
    expect(resolvePersona('nope').id).toBe('mirai');
    expect(resolvePersona(undefined).id).toBe('mirai');
  });
});

describe('personaSchema', () => {
  it('rejects an oversized brief', () => {
    const result = personaSchema.safeParse({
      ...persona,
      brief: 'x'.repeat(5000),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range temperature', () => {
    expect(
      personaSchema.safeParse({ ...persona, temperature: 9 }).success,
    ).toBe(false);
  });

  it('caps the number of style rules', () => {
    const result = personaSchema.safeParse({
      ...persona,
      style: Array.from({ length: 50 }, () => 'rule'),
    });
    expect(result.success).toBe(false);
  });
});
