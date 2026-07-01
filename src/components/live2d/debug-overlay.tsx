'use client';

import { useStage } from '@/lib/store/stage-store';
import { EMOTION_LABELS } from '@/types/emotion';

/**
 * A live read-out of the animation pipeline.
 *
 * Mostly this exists for tuning: the mouth-open bar is the fastest way to tell
 * whether lip sync is actually following the audio or just guessing, and the
 * unsupported-parameter list is how you find out that the rig you just dropped
 * in spells its brow parameters differently.
 */
export function DebugOverlay() {
  const diagnostics = useStage((state) => state.diagnostics);
  const voiceMode = useStage((state) => state.voiceMode);
  const listening = useStage((state) => state.listening);

  if (!diagnostics) return null;

  return (
    <div className="glass-strong pointer-events-none absolute top-4 left-4 z-20 w-56 rounded-2xl p-3 font-mono text-[11px] text-ink-200">
      <Row label="model" value={diagnostics.modelId} />
      <Row label="cubism" value={String(diagnostics.cubism)} />
      <Row label="fps" value={String(diagnostics.fps)} />
      <Row
        label="emotion"
        value={`${EMOTION_LABELS[diagnostics.emotion]} ${diagnostics.intensity.toFixed(2)}`}
      />
      <Row label="voice" value={voiceMode} />
      <Row label="mic" value={listening ? 'listening' : 'idle'} />
      <Row
        label="expressions"
        value={diagnostics.hasExpressions ? 'file' : 'parameters'}
      />

      <div className="mt-2">
        <div className="mb-1 flex justify-between text-ink-600">
          <span>mouth</span>
          <span className="tabular-nums">
            {diagnostics.mouthOpen.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[hsl(var(--emotion))] transition-[width] duration-75"
            style={{ width: `${Math.round(diagnostics.mouthOpen * 100)}%` }}
          />
        </div>
      </div>

      {diagnostics.unsupportedParameters.length > 0 && (
        <p className="mt-2 leading-snug text-amber-300/80">
          unmapped: {diagnostics.unsupportedParameters.slice(0, 3).join(', ')}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-600">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
