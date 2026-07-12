'use client';

import { cn } from '@/lib/utils/cn';
import { useStage } from '@/lib/store/stage-store';

/**
 * The ambient background.
 *
 * Three heavily blurred radial gradients on long, mutually-prime animation
 * cycles, plus a grain overlay. Two of them are tinted with `--emotion`, so
 * the room the character sits in changes colour with her mood.
 *
 * Cheap on purpose: no canvas, no WebGL, no per-frame JS. The avatar already
 * owns a WebGL context and a 60fps render loop, and a second animation system
 * competing for the same frame budget is exactly how a pretty background
 * turns into a stuttering one.
 */
export function AuroraBackdrop() {
  const speaking = useStage((state) => state.speaking);

  return (
    <div
      aria-hidden
      className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950"
    >
      {/* Primary emotion wash, top-left. */}
      <div
        className={cn(
          'absolute -top-1/4 -left-1/4 size-[70vmax] rounded-full blur-[110px]',
          'animate-drift transition-opacity duration-1000',
          speaking ? 'opacity-55' : 'opacity-35',
        )}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--emotion) / 0.55), transparent 62%)',
        }}
      />

      {/* Cool counterweight, bottom-right, so the palette never goes flat. */}
      <div
        className="absolute -right-1/4 -bottom-1/3 size-[65vmax] animate-float rounded-full opacity-30 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, oklch(0.62 0.17 215 / 0.5), transparent 62%)',
        }}
      />

      {/* A small, slower highlight to break the symmetry of the other two. */}
      <div
        className="absolute top-1/3 left-1/2 size-[38vmax] animate-drift rounded-full opacity-25 blur-[100px] [animation-delay:-8s]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--emotion) / 0.4), transparent 65%)',
        }}
      />

      {/* Vignette — pulls focus to the centre and hides the blob edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-ink-950)_95%)]" />
    </div>
  );
}
