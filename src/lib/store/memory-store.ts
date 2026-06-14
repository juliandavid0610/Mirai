import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { safePersistStorage } from './persist';

/** Hard cap — the whole list is injected into every system prompt. */
const MAX_FACTS = 40;

/**
 * Long-term memory, stored entirely on the user's device.
 *
 * No database, no account, no server-side profile. The facts are sent inline
 * with each request and never retained after the response, which means a
 * public deployment of Mirai holds nothing about anyone. It also means
 * clearing site data genuinely clears the memory.
 */
export interface MemoryState {
  facts: string[];
  remember(fact: string): void;
  forget(index: number): void;
  clear(): void;
}

export const useMemory = create<MemoryState>()(
  persist(
    (set) => ({
      facts: [],

      remember(fact) {
        const trimmed = fact.trim().slice(0, 400);
        if (!trimmed) return;
        set((state) => {
          const lower = trimmed.toLowerCase();
          if (state.facts.some((f) => f.toLowerCase() === lower)) return state;
          // Oldest out first once the cap is reached.
          const next = [...state.facts, trimmed];
          return { facts: next.slice(-MAX_FACTS) };
        });
      },

      forget(index) {
        set((state) => ({
          facts: state.facts.filter((_, i) => i !== index),
        }));
      },

      clear: () => set({ facts: [] }),
    }),
    {
      name: STORAGE_KEYS.memory,
      storage: safePersistStorage<{ facts: string[] }>(),
      version: 1,
      partialize: (state) => ({ facts: state.facts }),
    },
  ),
);
