'use client';

import { MODEL_CATALOG } from '@/lib/live2d/catalog';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils/cn';

/**
 * Live2D rig selection.
 *
 * Switching rebuilds the stage from scratch — new WebGL context, new textures
 * — so this is a deliberate, one-click action rather than something bound to a
 * hover or an arrow key.
 */
export function AvatarPicker() {
  const avatarId = useSettings((state) => state.avatarId);
  const setSetting = useSettings((state) => state.set);

  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Character model">
      {MODEL_CATALOG.map((model) => {
        const selected = model.id === avatarId;
        return (
          <button
            key={model.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setSetting('avatarId', model.id)}
            className={cn(
              'rounded-xl border p-3 text-left transition-colors',
              selected
                ? 'border-[hsl(var(--emotion)/0.5)] bg-[hsl(var(--emotion)/0.12)]'
                : 'border-ink-800/80 bg-ink-900/40 hover:border-ink-700',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink-50">
                {model.name}
              </span>
              <span className="font-mono text-[10px] text-ink-600">
                Cubism {model.cubism}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-600">
              {model.tagline}
            </span>
          </button>
        );
      })}

      <p className="px-1 text-[11px] leading-relaxed text-ink-600">
        Drop your own rig into <code className="font-mono">public/models/</code>{' '}
        and register it in{' '}
        <code className="font-mono">src/lib/live2d/catalog.ts</code>. See{' '}
        <code className="font-mono">docs/LIVE2D.md</code>.
      </p>
    </div>
  );
}
