'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * A labelled toggle.
 *
 * The whole row is the hit target — a 16px knob is a miserable thing to aim at
 * on a phone — and the semantics come from a real `role="switch"` button so
 * assistive tech announces state changes properly.
 */
export function Switch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: SwitchProps) {
  const id = useId();

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl p-2 text-left',
        'transition-colors hover:bg-white/4 disabled:pointer-events-none disabled:opacity-45',
      )}
    >
      <span
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-[hsl(var(--emotion))]' : 'bg-ink-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm',
            'transition-transform duration-200 ease-out',
            checked && 'translate-x-4',
          )}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
