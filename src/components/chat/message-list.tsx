'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { MiraiUIMessage } from '@/types/chat';
import type { Persona } from '@/types/persona';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils/cn';
import { MessageBubble } from './message-bubble';
import { EmptyState } from './empty-state';

export interface MessageListProps {
  messages: MiraiUIMessage[];
  persona: Persona;
  streaming: boolean;
  onReplay: (message: MiraiUIMessage) => void;
  onRegenerate: () => void;
  onSuggestion: (text: string) => void;
}

/** Distance from the bottom, in pixels, still counted as "at the bottom". */
const STICK_THRESHOLD = 96;

/**
 * The scrolling transcript.
 *
 * Auto-scroll is conditional on the user already being at the bottom.
 * Unconditional `scrollIntoView` on every chunk is the single most irritating
 * bug in streaming chat UIs: you scroll up to re-read something and the next
 * token yanks you back down.
 */
export function MessageList({
  messages,
  persona,
  streaming,
  onReplay,
  onRegenerate,
  onSuggestion,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const onScroll = () => {
      const distance =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      setStuck(distance < STICK_THRESHOLD);
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!stuck) return;
    const element = scrollRef.current;
    if (!element) return;
    // `auto` rather than `smooth`: during a stream this fires many times a
    // second, and queued smooth scrolls fight each other into a judder.
    element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
  }, [messages, stuck]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
    setStuck(true);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="scroll-subtle h-full space-y-5 overflow-y-auto px-5 py-5"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.length === 0 ? (
          <EmptyState persona={persona} onSuggestion={onSuggestion} />
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              persona={persona}
              isLast={index === messages.length - 1}
              streaming={streaming && index === messages.length - 1}
              onReplay={onReplay}
              onRegenerate={onRegenerate}
            />
          ))
        )}
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-3 flex justify-center',
          'transition-opacity duration-200',
          stuck ? 'opacity-0' : 'opacity-100',
        )}
      >
        <IconButton
          label="Jump to latest"
          onClick={scrollToBottom}
          className={cn(
            'glass-strong pointer-events-auto shadow-lg shadow-black/40',
            stuck && 'pointer-events-none',
          )}
        >
          <ArrowDown className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
