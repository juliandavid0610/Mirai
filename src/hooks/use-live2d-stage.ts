'use client';

import { useEffect, useRef } from 'react';
import { resolveModel } from '@/lib/live2d/catalog';
import { MiraiStage } from '@/lib/live2d/stage';
import { useSettings } from '@/lib/store/settings-store';
import { useStage } from '@/lib/store/stage-store';
import { useStageApi } from '@/components/live2d/stage-provider';
import { createLogger } from '@/lib/utils/logger';

const log = createLogger('use-stage');

/**
 * Mounts a Live2D rig onto a canvas and keeps it in sync with settings.
 *
 * The lifecycle here is fiddly for two reasons:
 *
 *  1. Creating a stage is async (two network fetches and a WebGL context), and
 *     React 19 strict mode mounts every effect twice in development. Without a
 *     generation token the second mount races the first and you end up with
 *     two rigs, two WebGL contexts, and a browser that starts dropping
 *     contexts a few reloads later.
 *  2. Switching avatars has to tear down the old stage *completely* before the
 *     new one attaches, or the detach from the outgoing stage clears the
 *     incoming one.
 */
export function useLive2DStage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const avatarId = useSettings((state) => state.avatarId);
  const expressiveness = useSettings((state) => state.expressiveness);
  const idleMotion = useSettings((state) => state.idleMotion);
  const followPointer = useSettings((state) => state.followPointer);
  const reducedMotion = useSettings((state) => state.reducedMotion);

  const setStatus = useStage((state) => state.setStatus);
  const setDiagnostics = useStage((state) => state.setDiagnostics);
  const stageApi = useStageApi();

  // ── create / destroy ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let stage: MiraiStage | null = null;

    setStatus('loading-runtime');

    void MiraiStage.create({
      canvas,
      descriptor: resolveModel(avatarId),
      onStatus: (status) => {
        if (!disposed) setStatus(status);
      },
    })
      .then((created) => {
        if (disposed) {
          // The effect was cleaned up while the rig was still loading.
          created.destroy();
          return;
        }
        stage = created;
        stageApi.attach(created);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (disposed) return;
        log.error('stage creation failed', error);
        setStatus(
          'error',
          error instanceof Error ? error.message : 'Failed to load the model.',
        );
      });

    return () => {
      disposed = true;
      if (stage) {
        stageApi.detach(stage);
        stage.destroy();
      }
      setDiagnostics(null);
    };
  }, [avatarId, stageApi, setStatus, setDiagnostics]);

  // ── responsive layout ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      // Resize events arrive in bursts while dragging a window edge; one
      // layout per frame is plenty and avoids thrashing the WebGL viewport.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => stageApi.current()?.layout());
    });

    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [stageApi]);

  // ── pointer tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!followPointer || reducedMotion) {
      stageApi.current()?.clearFocus();
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      stageApi
        .current()
        ?.setFocus(event.clientX - rect.left, event.clientY - rect.top);
    };
    const onPointerLeave = () => stageApi.current()?.clearFocus();
    const onPointerDown = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      stageApi.current()?.tap(event.clientX - rect.left, event.clientY - rect.top);
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('pointerdown', onPointerDown);
    return () => {
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('pointerdown', onPointerDown);
    };
  }, [followPointer, reducedMotion, stageApi]);

  // ── settings → stage ──────────────────────────────────────────────────────
  useEffect(() => {
    stageApi.current()?.setExpressiveness(expressiveness);
  }, [expressiveness, stageApi]);

  useEffect(() => {
    stageApi.current()?.setIdleAmplitude(reducedMotion ? 0 : idleMotion);
  }, [idleMotion, reducedMotion, stageApi]);

  // ── diagnostics polling ───────────────────────────────────────────────────
  const showDebug = useSettings((state) => state.showDebugOverlay);
  useEffect(() => {
    if (!showDebug) return;
    // 4 Hz: fast enough to watch the mouth value move, slow enough that the
    // overlay is not itself a performance problem.
    const timer = setInterval(() => {
      setDiagnostics(stageApi.current()?.diagnostics() ?? null);
    }, 250);
    return () => clearInterval(timer);
  }, [showDebug, setDiagnostics, stageApi]);

  return { canvasRef, containerRef };
}
