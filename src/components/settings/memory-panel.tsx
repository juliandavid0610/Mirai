'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useMemory } from '@/lib/store/memory-store';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

/**
 * Long-term memory, edited by hand.
 *
 * Deliberately manual. Automatic memory extraction sounds better and is worse:
 * it silently accumulates wrong facts, and the user cannot see what the
 * character "knows" about them. Here the list *is* the memory — what you see
 * is exactly what gets sent.
 */
export function MemoryPanel() {
  const facts = useMemory((state) => state.facts);
  const remember = useMemory((state) => state.remember);
  const forget = useMemory((state) => state.forget);
  const clear = useMemory((state) => state.clear);

  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    remember(value);
    setDraft('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder="I prefer TypeScript over Python"
          maxLength={400}
          className="flex-1 rounded-xl border border-ink-700/70 bg-ink-900/80 px-3 py-2 text-sm text-ink-50 outline-none transition-colors placeholder:text-ink-600 focus:border-[hsl(var(--emotion)/0.6)]"
        />
        <IconButton label="Add fact" disabled={!draft.trim()} onClick={add}>
          <Plus className="size-4" />
        </IconButton>
      </div>

      {facts.length === 0 ? (
        <p className="px-1 text-xs leading-relaxed text-ink-600">
          Nothing remembered yet. Anything added here is sent with every message
          and stays on this device — there is no server-side profile.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {facts.map((fact, index) => (
              <li
                key={`${index}-${fact.slice(0, 12)}`}
                className="group flex items-start gap-2 rounded-lg bg-ink-900/50 py-1.5 pr-1.5 pl-3"
              >
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-ink-200">
                  {fact}
                </span>
                <IconButton
                  label="Forget this"
                  size="sm"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  onClick={() => forget(index)}
                >
                  <X className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>

          <Button variant="danger" size="sm" onClick={clear}>
            Forget everything
          </Button>
        </>
      )}
    </div>
  );
}
