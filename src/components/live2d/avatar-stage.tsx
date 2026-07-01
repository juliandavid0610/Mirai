'use client';

import { useCallback, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { EMOTION_LABELS } from '@/types/emotion';
import { resolveModel } from '@/lib/live2d/catalog';
import { useSettings } from '@/lib/store/settings-store';
import { useStage } from '@/lib/store/stage-store';
import { useLive2DStage } from '@/hooks/use-live2d-stage';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { DebugOverlay } from './debug-overlay';
import { StageStatusOverlay } from './stage-status';

/**
 * The character's stage: a WebGL canvas plus everything layered over it.
 *
 * The canvas itself is deliberately plain. All of the atmosphere — the floor
 * glow, the emotion halo, the status chips — is DOM sitting on top, which
 * keeps it styleable with the rest of the design system and keeps the GPU
 * budget for the rig.
 */
export function AvatarStage({ className }: { className?: string }) {
  const { canvasRef, containerRef } = useLive2DStage();

  const status = useStage((state) => state.status);
  const error = useStage((state) => state.error);
  const emotion = useStage((state) => state.emotion);
  const speaking = useStage((state) => state.speaking);
  const listening = useStage((state) => state.listening);

  const avatarId = useSettings((state) => state.avatarId);
  const setSetting = useSettings((state) => state.set);
  const showDebug = useSettings((state) => state.showDebugOverlay);

  const descriptor = resolveModel(avatarId);
  const [retryToken, setRetryToken] = useState(0);

  /**
   * Retry is implemented by bouncing the avatar id through the store, which
   * re-keys the whole component and tears the failed stage down cleanly. Far
   * more reliable than trying to resurrect a half-initialised WebGL context.
   */
  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
    setSetting('avatarId', avatarId);
  }, [avatarId, setSetting]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative isolate flex min-h-0 items-end justify-center overflow-hidden',
        className,
      )}
    >
      {/* Floor glow — grounds the character so she is standing in the scene
          rather than floating in front of it. */}
      <div
        aria-hidden
        className={cn(
          'absolute bottom-0 left-1/2 h-40 w-[70%] -translate-x-1/2 rounded-[100%] blur-3xl',
          'transition-opacity duration-700',
          speaking ? 'opacity-70' : 'opacity-40',
        )}
        style={{
          background:
            'radial-gradient(ellipse at center, hsl(var(--emotion) / 0.45), transparent 70%)',
        }}
      />

      <canvas
        key={`${avatarId}:${retryToken}`}
        ref={canvasRef}
        className="relative z-10 size-full touch-none"
        // The rig is decorative; its state is announced by the status chips
        // and the transcript, so a screen reader gains nothing from the canvas.
        aria-hidden
      />

      <StageStatusOverlay status={status} error={error} onRetry={retry} />
      {showDebug && <DebugOverlay />}

      {/* Status chips, bottom-centre. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-wrap items-center justify-center gap-2 px-4">
        {status === 'ready' && (
          <Badge tone="emotion">{EMOTION_LABELS[emotion]}</Badge>
        )}

        {speaking && (
          <Badge tone="emotion" icon={<Volume2 className="size-3" />}>
            Speaking
          </Badge>
        )}

        {listening && (
          <Badge tone="warn" icon={<Mic className="size-3 animate-pulse" />}>
            Listening
          </Badge>
        )}
      </div>

      {/* Attribution. The sample rigs are licensed, not public domain, and the
          licence requires the credit to be visible. */}
      {status === 'ready' && (
        <a
          href={descriptor.credit.url || '#'}
          target="_blank"
          rel="noreferrer noopener"
          className="absolute right-3 bottom-3 z-20 text-[10px] text-ink-600 transition-colors hover:text-ink-400"
        >
          {descriptor.name} © {descriptor.credit.author}
        </a>
      )}
    </div>
  );
}
