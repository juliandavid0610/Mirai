'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — these buttons never have a visible text label. */
  label: string;
  children: ReactNode;
  active?: boolean;
  size?: 'sm' | 'md';
  tone?: 'default' | 'accent' | 'danger';
}

const TONES = {
  default: 'text-ink-400 hover:text-ink-50',
  accent: 'text-[hsl(var(--emotion))] hover:brightness-125',
  danger: 'text-red-300 hover:text-red-200',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className, label, children, active, size = 'md', tone = 'default', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        // `aria-label` plus `title` so the control is both screen-reader
        // legible and discoverable on hover.
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-xl',
          'transition-colors duration-150 active:scale-95',
          'disabled:pointer-events-none disabled:opacity-35',
          size === 'sm' ? 'size-8' : 'size-10',
          active
            ? 'bg-[hsl(var(--emotion)/0.18)] text-[hsl(var(--emotion))]'
            : cn('hover:bg-white/8', TONES[tone]),
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
