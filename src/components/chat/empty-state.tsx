'use client';

import { parseDirectives } from '@/lib/ai/directives';
import type { Persona } from '@/types/persona';
import { cn } from '@/lib/utils/cn';

const SUGGESTIONS = [
  'How does your lip sync actually work?',
  'Tell me something surprising.',
  'Help me name a side project.',
  'What can you do that a text chatbot cannot?',
];

/**
 * The opening screen.
 *
 * Shows the persona's own greeting rather than generic copy, so the first
 * thing a visitor reads is already in character — and the four prompts are
 * chosen to lead somewhere that shows off the expression pipeline rather than
 * producing a wall of text.
 */
export function EmptyState({
  persona,
  onSuggestion,
}: {
  persona: Persona;
  onSuggestion: (text: string) => void;
}) {
  const greeting = parseDirectives(persona.greeting).text;

  return (
    <div className="animate-rise flex h-full flex-col items-center justify-center gap-6 px-2 text-center">
      <div>
        <span
          aria-hidden
          className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-[hsl(var(--emotion)/0.35)] bg-[hsl(var(--emotion)/0.14)] text-xl text-[hsl(var(--emotion))]"
        >
          {persona.glyph}
        </span>
        <h2 className="text-base font-semibold text-ink-50">{persona.name}</h2>
        <p className="mt-1 text-xs text-ink-600">{persona.summary}</p>
      </div>

      <p className="max-w-sm text-[15px] leading-relaxed text-ink-200">
        {greeting}
      </p>

      <div className="grid w-full max-w-sm gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className={cn(
              'rounded-xl border border-ink-800/80 bg-ink-900/40 px-3.5 py-2.5',
              'text-left text-[13px] text-ink-200 transition-colors',
              'hover:border-[hsl(var(--emotion)/0.45)] hover:bg-[hsl(var(--emotion)/0.1)]',
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
