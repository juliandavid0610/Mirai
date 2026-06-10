import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODEL_ID as DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DEFAULT_PERSONA_ID } from '@/lib/ai/personas';
import { DEFAULT_MODEL_ID as DEFAULT_LIVE2D_MODEL } from '@/lib/live2d/catalog';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { clamp01 } from '@/lib/utils/math';
import { safePersistStorage } from './persist';

export interface SettingsState {
  /** Gateway model id for chat. */
  chatModelId: string;
  /** Live2D rig id from the catalog. */
  avatarId: string;
  personaId: string;

  /** Speak replies aloud as they finish. */
  voiceEnabled: boolean;
  voiceRate: number;
  /** Send the message as soon as speech recognition returns a final result. */
  autoSendOnVoice: boolean;

  /** 0…1, scales every emotional expression. */
  expressiveness: number;
  /** 0…2, strength of the secondary idle sway. */
  idleMotion: number;
  /** Head tracking follows the pointer. */
  followPointer: boolean;
  /** Respect the OS "reduce motion" preference. */
  reducedMotion: boolean;

  showDebugOverlay: boolean;
  showTranscript: boolean;

  set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]): void;
  reset(): void;
}

type SettingsValues = Omit<SettingsState, 'set' | 'reset'>;

const DEFAULTS: SettingsValues = {
  chatModelId: DEFAULT_CHAT_MODEL,
  avatarId: DEFAULT_LIVE2D_MODEL,
  personaId: DEFAULT_PERSONA_ID,
  voiceEnabled: true,
  voiceRate: 1,
  autoSendOnVoice: true,
  expressiveness: 0.85,
  idleMotion: 1,
  followPointer: true,
  reducedMotion: false,
  showDebugOverlay: false,
  showTranscript: true,
};

/** Values that must stay inside a range even if localStorage is edited. */
function sanitise(values: SettingsValues): SettingsValues {
  return {
    ...values,
    expressiveness: clamp01(values.expressiveness),
    idleMotion: Math.min(2, Math.max(0, values.idleMotion)),
    voiceRate: Math.min(2, Math.max(0.5, values.voiceRate)),
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: safePersistStorage<SettingsValues>(),
      version: 1,
      // Only persist data, never the actions.
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([, value]) => typeof value !== 'function'),
        ) as SettingsValues,
      // Ranges are re-checked on load: localStorage is user-writable, and a
      // hand-edited `expressiveness: 40` would otherwise reach the rig.
      merge: (persisted, current) => ({
        ...current,
        ...sanitise({ ...current, ...(persisted as Partial<SettingsValues>) }),
      }),
    },
  ),
);

export const SETTINGS_DEFAULTS = DEFAULTS;
