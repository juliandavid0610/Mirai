'use client';

import { memo } from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';
import { parseDirectives } from '@/lib/ai/directives';
import { EMOTION_LABELS } from '@/types/emotion';
import type { MiraiUIMessage } from '@/types/chat';
import type { Persona } from '@/types/persona';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils/cn';
import { MessageContent } from './message-content';

export interface MessageBubbleProps {
  message: MiraiUIMessage;
  persona: Persona;
  isLast: boolean;
  streaming: boolean;
  onReplay: (message: MiraiUIMessage) => void;
  onRegenerate: () => void;
}

/**
 * One turn of the conversation.
 *
 * Memoised on the message's rendered text: during a stream React re-renders
 * this list on every chunk, and without the guard every historical bubble in a
 * long conversation re-renders dozens of times a second — which is enough to
 * visibly cost the avatar frames on a mid-range laptop.
 */
export const MessageBubble = memo(
  function MessageBubble({
    message,
    persona,
    isLast,
    streaming,
    onReplay,
    onRegenerate,
  }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const raw = message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text)
      .join('');

    // Directives are stripped for display; they are instructions to the face,
    // not part of what the character said.
    const { text, dominant, cues } = parseDirectives(raw);
    const rehearsal = message.metadata?.rehearsal;

    if (!text && !streaming) return null;

    return (
      <article
        className={cn(
          'group animate-rise flex gap-3',
          isUser ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        {!isUser && (
          <span
            aria-hidden
            className={cn(
              'mt-1 grid size-8 shrink-0 place-items-center rounded-full text-sm',
              'border border-[hsl(var(--emotion)/0.35)] bg-[hsl(var(--emotion)/0.14)]',
              'text-[hsl(var(--emotion))]',
            )}
          >
            {persona.glyph}
          </span>
        )}

        <div className={cn('min-w-0 max-w-[85%]', isUser && 'items-end')}>
          <div
            className={cn(
              'rounded-2xl px-4 py-3',
              isUser
                ? 'rounded-br-md bg-[hsl(var(--emotion)/0.16)] text-ink-50'
                : 'rounded-bl-md border border-ink-800/70 bg-ink-900/60 text-ink-100',
            )}
          >
            <MessageContent text={text} />

            {streaming && !text && (
              <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-[hsl(var(--emotion))]"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </span>
            )}
          </div>

          <div
            className={cn(
              'mt-1.5 flex items-center gap-2 px-1',
              isUser ? 'justify-end' : 'justify-start',
            )}
          >
            {!isUser && cues.length > 0 && (
              <span className="text-[10px] tracking-wide text-ink-600">
                {EMOTION_LABELS[dominant]}
              </span>
            )}

            {rehearsal && (
              <span className="text-[10px] tracking-wide text-amber-300/70">
                Rehearsal Mode
              </span>
            )}

            {!isUser && !streaming && (
              <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <IconButton
                  label="Speak this reply"
                  size="sm"
                  onClick={() => onReplay(message)}
                >
                  <Volume2 className="size-3.5" />
                </IconButton>
                {isLast && (
                  <IconButton
                    label="Regenerate reply"
                    size="sm"
                    onClick={onRegenerate}
                  >
                    <RefreshCw className="size-3.5" />
                  </IconButton>
                )}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.streaming === next.streaming &&
    prev.isLast === next.isLast &&
    prev.persona.id === next.persona.id,
);
