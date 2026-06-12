import { create } from 'zustand';
import type { Emotion } from '@/types/emotion';
import type { StageStatus } from '@/types/live2d';
import type { StageDiagnostics } from '@/lib/live2d/stage';
import type { VoiceMode } from '@/lib/audio/voice';

/**
 * Live view state for the avatar.
 *
 * Deliberately *not* persisted — everything here describes the current frame,
 * and restoring "speaking: true" from a previous session would leave the UI
 * showing a talking indicator for a reply that finished yesterday.
 */
export interface StageState {
  status: StageStatus;
  error: string | null;
  emotion: Emotion;
  intensity: number;
  speaking: boolean;
  listening: boolean;
  voiceMode: VoiceMode;
  diagnostics: StageDiagnostics | null;

  setStatus(status: StageStatus, error?: string | null): void;
  setEmotion(emotion: Emotion, intensity?: number): void;
  setSpeaking(speaking: boolean, mode?: VoiceMode): void;
  setListening(listening: boolean): void;
  setDiagnostics(diagnostics: StageDiagnostics | null): void;
}

export const useStage = create<StageState>()((set) => ({
  status: 'idle',
  error: null,
  emotion: 'neutral',
  intensity: 1,
  speaking: false,
  listening: false,
  voiceMode: 'muted',
  diagnostics: null,

  setStatus: (status, error = null) => set({ status, error }),
  setEmotion: (emotion, intensity = 1) => set({ emotion, intensity }),
  setSpeaking: (speaking, mode) =>
    set((state) => ({
      speaking,
      voiceMode: mode ?? (speaking ? state.voiceMode : 'muted'),
    })),
  setListening: (listening) => set({ listening }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
}));
