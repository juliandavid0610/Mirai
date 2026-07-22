import { describe, expect, it } from 'vitest';
import { parseBlocks } from '@/components/chat/message-content';

describe('parseBlocks', () => {
  it('returns a single text block for plain prose', () => {
    const blocks = parseBlocks('Just a sentence.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: 'text', content: 'Just a sentence.' });
  });

  it('splits a fenced code block out of surrounding text', () => {
    const blocks = parseBlocks('Before\n```ts\nconst x = 1;\n```\nAfter');
    expect(blocks.map((block) => block.kind)).toEqual(['text', 'code', 'text']);
    expect(blocks[1]).toMatchObject({
      kind: 'code',
      language: 'ts',
      content: 'const x = 1;',
    });
  });

  it('defaults the language when the fence has none', () => {
    const blocks = parseBlocks('```\nplain\n```');
    expect(blocks[0]).toMatchObject({ language: 'text', content: 'plain' });
  });

  /**
   * Mid-stream the closing fence has not arrived yet. Waiting for it would
   * make code appear to hang, so an unterminated fence renders as it arrives.
   */
  it('renders an unterminated fence as code', () => {
    const blocks = parseBlocks('```python\nprint("partial"');
    expect(blocks[0]).toMatchObject({
      kind: 'code',
      language: 'python',
      content: 'print("partial"',
    });
  });

  it('handles several code blocks in one message', () => {
    const blocks = parseBlocks('```a\n1\n```\ntext\n```b\n2\n```');
    expect(blocks.filter((block) => block.kind === 'code')).toHaveLength(2);
  });

  it('always returns at least one block', () => {
    expect(parseBlocks('')).toHaveLength(1);
    expect(parseBlocks('   ')).toHaveLength(1);
  });

  it('keeps a hyphenated language tag intact', () => {
    expect(parseBlocks('```objective-c\nx\n```')[0]).toMatchObject({
      language: 'objective-c',
    });
  });
});
