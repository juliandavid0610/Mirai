'use client';

import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional right-aligned hint, e.g. a vendor name. */
  meta?: string;
}

export interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  hint?: string;
  onChange: (value: string) => void;
}

/**
 * A native `<select>` dressed up.
 *
 * A custom listbox would let the options carry richer markup, but the native
 * control gets mobile's system picker, type-ahead, and correct behaviour
 * inside a scrolling drawer for free. The trade is worth it.
 */
export function Select({
  label,
  value,
  options,
  disabled,
  hint,
  onChange,
}: SelectProps) {
  const id = useId();

  return (
    <div className={cn('space-y-2', disabled && 'opacity-45')}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-200">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'w-full appearance-none rounded-xl border border-ink-700/70 bg-ink-900/80',
            'py-2.5 pr-10 pl-3.5 text-sm text-ink-100 outline-none',
            'transition-colors hover:border-ink-600',
            'focus:border-[hsl(var(--emotion)/0.6)]',
          )}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-ink-900 text-ink-100"
            >
              {option.meta ? `${option.label} — ${option.meta}` : option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400"
        />
      </div>

      {hint && <p className="text-xs leading-relaxed text-ink-600">{hint}</p>}
    </div>
  );
}
