'use client';

import { Fragment, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils/cn';

/**
 * A deliberately minimal message renderer.
 *
 * Mirai's whole prompt tells the model it is *speaking*, not writing a
 * document — no headings, no bullet lists, prose plus the occasional code
 * block. Shipping a full markdown pipeline to render text that is supposed to
 * be conversational would add a large dependency to style output the app
 * actively discourages.
 *
 * So: fenced code blocks, inline code, and paragraphs. Everything else renders
 * as the literal characters the model wrote, which is what you want when
 * someone asks "what does `**` mean in Python".
 */

type Block =
  | { kind: 'text'; content: string }
  | { kind: 'code'; content: string; language: string };

const FENCE = /```([\w+-]*)\n?([\s\S]*?)(?:```|$)/g;

export function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;

  FENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, match.index);
    if (before.trim()) blocks.push({ kind: 'text', content: before });

    blocks.push({
      kind: 'code',
      language: match[1] || 'text',
      // An unterminated fence is the normal case mid-stream, so the content is
      // rendered as it arrives rather than waiting for the closing ticks.
      content: (match[2] ?? '').replace(/\n$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  const rest = raw.slice(lastIndex);
  if (rest.trim() || blocks.length === 0) {
    blocks.push({ kind: 'text', content: rest });
  }

  return blocks;
}

export function MessageContent({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) =>
        block.kind === 'code' ? (
          <CodeBlock
            key={index}
            language={block.language}
            content={block.content}
          />
        ) : (
          <Paragraphs key={index} content={block.content} />
        ),
      )}
    </div>
  );
}

function Paragraphs({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="text-[15px] leading-relaxed whitespace-pre-wrap"
        >
          {renderInline(paragraph)}
        </p>
      ))}
    </>
  );
}

/** Handles `inline code` only — everything else is left verbatim. */
function renderInline(text: string) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-[hsl(var(--emotion))]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function CodeBlock({
  language,
  content,
}: {
  language: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing useful to say about it */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink-700/60 bg-ink-950/80">
      <div className="flex items-center justify-between border-b border-ink-800/80 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-ink-600">
          {language}
        </span>
        <IconButton
          label={copied ? 'Copied' : 'Copy code'}
          size="sm"
          onClick={copy}
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-300" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </IconButton>
      </div>
      <pre
        className={cn(
          'scroll-subtle overflow-x-auto p-3',
          'font-mono text-[13px] leading-relaxed text-ink-200',
        )}
      >
        <code>{content}</code>
      </pre>
    </div>
  );
}
