'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { useMicrophone } from '@/hooks/use-microphone';
import { useSettings } from '@/lib/store/settings-store';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils/cn';

export interface ComposerProps {
  busy: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
  onStop: () => void;
}

/** Cap on auto-grow height so the transcript never disappears. */
const MAX_HEIGHT = 168;

export function Composer({
  busy,
  disabled,
  placeholder = 'Say something…',
  onSend,
  onStop,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSend = useSettings((state) => state.autoSendOnVoice);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      onSend(trimmed);
      setValue('');
    },
    [busy, onSend],
  );

  const mic = useMicrophone({
    onTranscript: (text) => {
      if (autoSend) {
        submit(text);
      } else {
        // Append rather than replace: the user may have typed a prefix and
        // then switched to voice for the rest.
        setValue((current) => (current ? `${current} ${text}` : text));
        textareaRef.current?.focus();
      }
    },
  });

  // Auto-grow the textarea. Reset to `auto` first or it only ever grows.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value, mic.interim]);

  const displayValue = mic.interim ? `${value} ${mic.interim}`.trim() : value;

  return (
    <div className="border-t border-ink-800/70 px-4 py-3">
      {mic.error && (
        <p className="mb-2 px-1 text-xs text-amber-300/90">{mic.error}</p>
      )}

      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border bg-ink-900/70 p-2',
          'transition-colors duration-200',
          mic.listening
            ? 'border-[hsl(var(--emotion)/0.6)] shadow-[0_0_24px_-6px_hsl(var(--emotion)/0.5)]'
            : 'border-ink-700/70 focus-within:border-[hsl(var(--emotion)/0.5)]',
        )}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={displayValue}
          disabled={disabled}
          placeholder={mic.listening ? 'Listening…' : placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line. IME composition has to
            // be excluded or Japanese input submits on candidate selection.
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit(value);
            }
          }}
          className={cn(
            'scroll-subtle max-h-42 min-h-9 flex-1 resize-none bg-transparent',
            'px-2 py-1.5 text-[15px] leading-relaxed text-ink-50 outline-none',
            'placeholder:text-ink-600 disabled:opacity-50',
          )}
        />

        {mic.supported && (
          <IconButton
            label={mic.listening ? 'Stop listening' : 'Speak'}
            active={mic.listening}
            disabled={disabled || busy}
            onClick={mic.toggle}
          >
            <Mic className={cn('size-4', mic.listening && 'animate-pulse')} />
          </IconButton>
        )}

        {busy ? (
          <IconButton label="Stop generating" tone="danger" onClick={onStop}>
            <Square className="size-4 fill-current" />
          </IconButton>
        ) : (
          <IconButton
            label="Send message"
            disabled={disabled || !value.trim()}
            onClick={() => submit(value)}
            className={cn(
              value.trim() &&
                'bg-[hsl(var(--emotion))] text-ink-950 hover:brightness-110',
            )}
          >
            <ArrowUp className="size-4" />
          </IconButton>
        )}
      </div>

      <p className="mt-2 px-1 text-[11px] text-ink-600">
        <kbd className="font-mono">Enter</kbd> to send ·{' '}
        <kbd className="font-mono">Shift</kbd>+
        <kbd className="font-mono">Enter</kbd> for a new line
        {mic.supported && mic.mode === 'recorded' && ' · voice is transcribed server-side'}
      </p>
    </div>
  );
}
