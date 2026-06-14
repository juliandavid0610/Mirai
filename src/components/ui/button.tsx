'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // The primary action borrows the live emotion colour, so the send button
  // shifts with the character's mood.
  primary:
    'text-ink-950 shadow-lg shadow-black/30 bg-[hsl(var(--emotion))] hover:brightness-110 active:brightness-95',
  ghost:
    'text-ink-200 hover:text-ink-50 hover:bg-white/6 active:bg-white/10',
  outline:
    'text-ink-100 border border-ink-700/70 hover:border-ink-600 hover:bg-white/5',
  danger:
    'text-red-200 border border-red-500/30 hover:bg-red-500/12 hover:border-red-500/50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = 'ghost', size = 'md', icon, trailing, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex select-none items-center justify-center font-medium',
          'transition-[background-color,border-color,color,filter,transform] duration-150',
          'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
          SIZES[size],
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {icon}
        {children}
        {trailing}
      </button>
    );
  },
);
