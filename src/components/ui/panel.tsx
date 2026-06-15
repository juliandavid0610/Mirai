import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface PanelProps {
  children: ReactNode;
  className?: string;
  /** `strong` is for panels that sit over the avatar and need more opacity. */
  weight?: 'default' | 'strong';
}

export function Panel({ children, className, weight = 'default' }: PanelProps) {
  return (
    <div
      className={cn(
        weight === 'strong' ? 'glass-strong' : 'glass',
        'rim-light rounded-panel shadow-2xl shadow-black/40',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({
  title,
  subtitle,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-4 border-b border-ink-800/70 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold tracking-tight text-ink-50">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-ink-600">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
