import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'emotion' | 'warn' | 'success';
  icon?: ReactNode;
  className?: string;
}

const TONES = {
  neutral: 'border-ink-700/70 bg-ink-900/70 text-ink-200',
  emotion:
    'border-[hsl(var(--emotion)/0.35)] bg-[hsl(var(--emotion)/0.14)] text-[hsl(var(--emotion))]',
  warn: 'border-amber-500/30 bg-amber-500/12 text-amber-200',
  success: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200',
} as const;

export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[11px] leading-none font-medium tracking-wide whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
