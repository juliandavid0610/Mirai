'use client';

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Emotion } from '@/types/emotion';
import type { AmplitudeSource, MiraiStage } from '@/lib/live2d/stage';

/**
 * A stable handle on the live avatar.
 *
 * The chat layer needs to push emotions and an amplitude signal into the
 * stage, but the stage is created asynchronously deep inside a dynamically
 * imported, client-only component. Passing the instance down through props
 * would force every component between them to re-render whenever the rig
 * reloads.
 *
 * Instead the context value is a set of methods over a ref, created once and
 * never changing identity. Callers can hold onto it forever; calls made before
 * the rig finishes loading are simply dropped, which is the correct behaviour
 * anyway — there is no face to move yet.
 */
export interface StageApi {
  attach(stage: MiraiStage): void;
  detach(stage: MiraiStage): void;
  current(): MiraiStage | null;
  setEmotion(emotion: Emotion, intensity?: number): void;
  setSpeaking(speaking: boolean): void;
  setAmplitudeSource(source: AmplitudeSource | null): void;
  nod(depth?: number): void;
  playMotion(group: string, index?: number): void;
}

const StageContext = createContext<StageApi | null>(null);

export function StageProvider({ children }: { children: ReactNode }) {
  const stageRef = useRef<MiraiStage | null>(null);
  /**
   * The amplitude source can be registered before the stage exists (the voice
   * player is constructed on mount, the rig loads a second later), so it is
   * held here and replayed on attach.
   */
  const pendingAmplitude = useRef<AmplitudeSource | null>(null);

  const api = useMemo<StageApi>(
    () => ({
      attach(stage) {
        stageRef.current = stage;
        if (pendingAmplitude.current) {
          stage.setAmplitudeSource(pendingAmplitude.current);
        }
      },
      detach(stage) {
        // Guard against a stale teardown clearing a newer stage, which is
        // exactly what happens on a fast avatar switch.
        if (stageRef.current === stage) stageRef.current = null;
      },
      current: () => stageRef.current,
      setEmotion: (emotion, intensity) =>
        stageRef.current?.setEmotion(emotion, intensity),
      setSpeaking: (speaking) => stageRef.current?.setSpeaking(speaking),
      setAmplitudeSource: (source) => {
        pendingAmplitude.current = source;
        stageRef.current?.setAmplitudeSource(source);
      },
      nod: (depth) => stageRef.current?.nod(depth),
      playMotion: (group, index) => stageRef.current?.playMotion(group, index),
    }),
    [],
  );

  return <StageContext.Provider value={api}>{children}</StageContext.Provider>;
}

export function useStageApi(): StageApi {
  const api = useContext(StageContext);
  if (!api) {
    throw new Error('useStageApi must be used inside <StageProvider>');
  }
  return api;
}
