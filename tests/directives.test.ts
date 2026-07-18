import { describe, expect, it } from 'vitest';
import {
  cueAt,
  parseDirectives,
  stripDirectives,
} from '@/lib/ai/directives';

describe('parseDirectives', () => {
  it('removes a directive and reports the cue', () => {
    const result = parseDirectives('[[joy]] Nice work.');
    expect(result.text).toBe('Nice work.');
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0]?.emotion).toBe('joy');
    expect(result.cues[0]?.intensity).toBeCloseTo(0.85);
    expect(result.dominant).toBe('joy');
  });

  it('reads an explicit intensity', () => {
    const { cues } = parseDirectives('[[angry:0.4]] Hmm.');
    expect(cues[0]?.intensity).toBeCloseTo(0.4);
  });

  it('clamps an out-of-range intensity', () => {
    const { cues } = parseDirectives('[[joy:9]] Wow.');
    expect(cues[0]?.intensity).toBe(1);
  });

  it('records the offset into the cleaned text, not the raw text', () => {
    const { cues, text } = parseDirectives('Hello there. [[sad:0.5]] Oh.');
    expect(text).toBe('Hello there. Oh.');
    // The cue must point at "Oh.", which is offset 13 once the tag is gone.
    expect(cues[0]?.offset).toBe(13);
    expect(text.slice(cues[0]?.offset ?? 0)).toBe('Oh.');
  });

  it('handles several cues and reports the last as dominant', () => {
    const { cues, dominant } = parseDirectives(
      '[[thinking]] One. [[surprised]] Two. [[joy]] Three.',
    );
    expect(cues.map((cue) => cue.emotion)).toEqual([
      'thinking',
      'surprised',
      'joy',
    ]);
    expect(dominant).toBe('joy');
  });

  it('drops an unknown emotion but still removes the tag', () => {
    const { text, cues } = parseDirectives('[[curious]] What is that?');
    expect(text).toBe('What is that?');
    expect(cues).toHaveLength(0);
  });

  it('is case insensitive', () => {
    expect(parseDirectives('[[JOY]] hi').cues[0]?.emotion).toBe('joy');
  });

  it('returns the default emotion when there are no cues', () => {
    const result = parseDirectives('Just text.');
    expect(result.dominant).toBe('neutral');
    expect(result.text).toBe('Just text.');
  });

  it('handles empty input', () => {
    const result = parseDirectives('');
    expect(result).toEqual({
      text: '',
      cues: [],
      dominant: 'neutral',
      pendingTail: false,
    });
  });
});

describe('parseDirectives — partial streaming input', () => {
  it('withholds an incomplete trailing tag', () => {
    const result = parseDirectives('All good. [[jo');
    expect(result.text).toBe('All good.');
    expect(result.pendingTail).toBe(true);
  });

  it('withholds an incomplete tag that has a partial intensity', () => {
    const result = parseDirectives('Sure. [[excited:0.');
    expect(result.text).toBe('Sure.');
    expect(result.pendingTail).toBe(true);
  });

  it('withholds a bare opening bracket pair', () => {
    expect(parseDirectives('Hmm [[').pendingTail).toBe(true);
  });

  /**
   * The whole reason the pending-tail logic exists: feeding a reply in one
   * character at a time must never surface a partial tag to the reader.
   */
  it('never leaks a tag fragment while streaming character by character', () => {
    const full = 'Okay. [[surprised:0.9]] That is unusual.';
    for (let i = 1; i <= full.length; i += 1) {
      const { text } = parseDirectives(full.slice(0, i));
      expect(text).not.toMatch(/\[\[/);
      expect(text).not.toMatch(/\]\]/);
    }
  });

  it('converges on the complete parse once the tag closes', () => {
    const full = 'Okay. [[surprised:0.9]] That is unusual.';
    expect(parseDirectives(full).text).toBe('Okay. That is unusual.');
    expect(parseDirectives(full).pendingTail).toBe(false);
  });

  it('leaves brackets alone when they are clearly prose', () => {
    const input = 'In TypeScript, [[1,2],[3,4]] is a nested array literal.';
    const { text, pendingTail } = parseDirectives(input);
    expect(pendingTail).toBe(false);
    expect(text).toContain('[[1,2],[3,4]]');
  });

  it('does not treat a distant opening bracket as pending', () => {
    // More than MAX_PARTIAL characters of text after "[[" means it cannot
    // still be an unfinished directive.
    const input = `[[${'x'.repeat(60)}`;
    expect(parseDirectives(input).pendingTail).toBe(false);
  });
});

describe('cueAt', () => {
  const { cues } = parseDirectives(
    '[[neutral]]Start. [[joy]]Middle. [[sad]]End.',
  );

  it('returns nothing before the first cue is revealed', () => {
    expect(cueAt([], 10)).toBeNull();
  });

  it('returns the cue active at a given reveal position', () => {
    expect(cueAt(cues, 0)?.emotion).toBe('neutral');
    expect(cueAt(cues, 8)?.emotion).toBe('joy');
    expect(cueAt(cues, 99)?.emotion).toBe('sad');
  });

  it('never runs ahead of the revealed text', () => {
    const firstJoyOffset = cues[1]?.offset ?? 0;
    expect(cueAt(cues, firstJoyOffset - 1)?.emotion).toBe('neutral');
    expect(cueAt(cues, firstJoyOffset)?.emotion).toBe('joy');
  });
});

describe('parseDirectives — code is never touched', () => {
  /**
   * Regression: the assistant explaining its own protocol writes `[[joy]]` in
   * backticks. Stripping that produced the baffling output "inline `` markers".
   */
  it('leaves a directive inside an inline code span alone', () => {
    const { text, cues } = parseDirectives(
      'The model emits `[[joy]]` markers inline.',
    );
    expect(text).toBe('The model emits `[[joy]]` markers inline.');
    expect(cues).toHaveLength(0);
  });

  it('leaves directives inside a fenced block alone', () => {
    const input = '```\n[[excited:0.9]] hello\n```';
    expect(parseDirectives(input).text).toBe(input);
    expect(parseDirectives(input).cues).toHaveLength(0);
  });

  it('still strips directives outside the code', () => {
    const { text, cues } = parseDirectives(
      '[[joy]] Write `[[sad]]` to look sad.',
    );
    expect(text).toBe('Write `[[sad]]` to look sad.');
    expect(cues.map((cue) => cue.emotion)).toEqual(['joy']);
  });

  it('preserves indentation inside a fenced block', () => {
    const input = 'Try this:\n\n```ts\nif (x) {\n    doThing();\n}\n```';
    expect(parseDirectives(input).text).toContain('    doThing();');
  });

  it('does not glue prose onto an adjacent code span', () => {
    expect(parseDirectives('use `x` here').text).toBe('use `x` here');
  });

  it('handles an unterminated fence mid-stream', () => {
    const input = 'Here:\n```ts\nconst a = 1;';
    expect(parseDirectives(input).text).toBe(input);
  });
});

describe('stripDirectives', () => {
  it('removes every directive', () => {
    expect(stripDirectives('[[joy]]a [[sad:0.2]]b')).toBe('a b');
  });

  it('collapses the whitespace a removed tag leaves behind', () => {
    expect(stripDirectives('Hello   [[joy]]   there')).toBe('Hello there');
  });

  it('preserves paragraph breaks', () => {
    expect(stripDirectives('One.\n\n[[joy]]Two.')).toBe('One.\n\nTwo.');
  });
});
