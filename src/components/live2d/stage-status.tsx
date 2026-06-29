'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { StageStatus } from '@/types/live2d';
import { Button } from '@/components/ui/button';

const MESSAGES: Record<StageStatus, string> = {
  idle: 'Preparing the stage…',
  'loading-runtime': 'Loading the Cubism runtime…',
  'loading-model': 'Loading the character…',
  ready: '',
  error: '',
};

export interface StageStatusOverlayProps {
  status: StageStatus;
  error: string | null;
  onRetry: () => void;
}

/**
 * Covers the stage while the rig loads, and explains itself when it fails.
 *
 * Model loading pulls several megabytes of textures from a CDN, so a blank
 * area for three seconds is the normal case, not the exception. The failure
 * state names the two things that actually go wrong in practice — an offline
 * CDN or a blocked third-party script — because "failed to load model" sends
 * people straight to the issue tracker.
 */
export function StageStatusOverlay({
  status,
  error,
  onRetry,
}: StageStatusOverlayProps) {
  if (status === 'ready') return null;

  if (status === 'error') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
        <div className="glass-strong rounded-panel max-w-sm p-6 text-center">
          <AlertTriangle className="mx-auto size-7 text-amber-300" />
          <h3 className="mt-3 text-sm font-semibold text-ink-50">
            The character could not load
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-400">
            {error ?? 'Something went wrong while loading the model.'}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-600">
            The Cubism runtime and the sample rigs are fetched from a CDN. A
            content blocker or an offline network will both land here.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <span
          className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ boxShadow: '0 0 0 2px hsl(var(--emotion) / 0.5)' }}
        />
        <Loader2 className="size-7 animate-spin text-[hsl(var(--emotion))]" />
      </div>
      <p className="text-xs tracking-wide text-ink-400">{MESSAGES[status]}</p>
    </div>
  );
}
