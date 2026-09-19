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
          speaking ? 'opacity-80' : 'opacity-60',
        )}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--emotion) / 0.7), transparent 64%)',
        }}
      />

      {/* Cool counterweight, bottom-right, so the palette never goes flat. */}
      <div
        className="absolute -right-1/4 -bottom-1/3 size-[65vmax] animate-float rounded-full opacity-50 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, oklch(0.7 0.17 215 / 0.62), transparent 64%)',
        }}
      />

      {/* A small, slower highlight to break the symmetry of the other two. */}
      <div
        className="absolute top-1/3 left-1/2 size-[38vmax] animate-drift rounded-full opacity-45 blur-[100px] [animation-delay:-8s]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--emotion) / 0.55), transparent 66%)',
        }}
      />

      {/* A warm low glow along the bottom, so the stage floor is lit rather
          than fading into the vignette. */}
      <div
        className="absolute inset-x-0 -bottom-1/4 h-[45vmax] opacity-40 blur-[120px]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, hsl(var(--emotion) / 0.45), transparent 60%)',
        }}
      />

      {/* Vignette — pulls focus to the centre and hides the blob edges.
          Stops short of the corners now; at full strength it undid most of the
          brightness the washes above are there to provide. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,color-mix(in_oklab,var(--color-ink-950)_82%,transparent)_100%)]" />
    </div>
  );
}
