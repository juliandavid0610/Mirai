'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { BUILT_IN_PERSONAS } from '@/lib/ai/personas';
import { usePersonas } from '@/lib/store/persona-store';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils/cn';

/**
 * Character selection.
 *
 * Rendered as cards rather than a dropdown because the summary line is the
 * part that actually helps someone choose — "composed and precise" tells you
 * far more than the name "Yuki" does.
 */
export function PersonaPicker() {
  /**
   * Select the stored array, then compose.
   *
   * Selecting `state.all()` instead looks tidier and is an infinite render
   * loop: it builds a new array on every call, and zustand compares selector
   * results with `Object.is`, so the store reports a change every time React
   * reads it.
   */
  const custom = usePersonas((state) => state.custom);
  const personas = useMemo(
    () => [...BUILT_IN_PERSONAS, ...custom],
    [custom],
  );

  const personaId = useSettings((state) => state.personaId);
  const setSetting = useSettings((state) => state.set);

  return (
    <div
      className="grid gap-2"
      role="radiogroup"
      aria-label="Character"
    >
      {personas.map((persona) => {
        const selected = persona.id === personaId;
        return (
          <button
            key={persona.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setSetting('personaId', persona.id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
              selected
                ? 'border-[hsl(var(--emotion)/0.5)] bg-[hsl(var(--emotion)/0.12)]'
                : 'border-ink-800/80 bg-ink-900/40 hover:border-ink-700',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-lg text-sm',
                selected
                  ? 'bg-[hsl(var(--emotion)/0.2)] text-[hsl(var(--emotion))]'
                  : 'bg-white/6 text-ink-400',
              )}
            >
              {persona.glyph}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-50">
                  {persona.name}
                </span>
                {!persona.builtIn && (
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-ink-400">
                    custom
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">
                {persona.summary}
              </span>
            </span>

            {selected && (
              <Check className="mt-1 size-4 shrink-0 text-[hsl(var(--emotion))]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
