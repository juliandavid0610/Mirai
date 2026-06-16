'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered to the right of the label, e.g. "85%". */
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * A styled range input.
 *
 * Built on the native `<input type="range">` rather than a custom-drawn track
 * so keyboard control, touch targets and screen-reader semantics come for
 * free. The fill is painted with a gradient whose stop is the current value —
 * no extra element, and it animates with the thumb automatically.
 */
export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  format,
  hint,
  disabled,
  onChange,
}: SliderProps) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('space-y-2', disabled && 'opacity-45')}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink-200">
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums text-ink-400">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none',
          '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
          '[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_hsl(var(--emotion)/0.28)]',
          '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100',
          'hover:[&::-webkit-slider-thumb]:scale-110',
          '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
        )}
        style={{
          background: `linear-gradient(90deg, hsl(var(--emotion)) ${percent}%, rgb(255 255 255 / 0.12) ${percent}%)`,
        }}
      />

      {hint && <p className="text-xs leading-relaxed text-ink-600">{hint}</p>}
    </div>
  );
}
