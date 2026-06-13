import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILT_IN_PERSONAS } from '@/lib/ai/personas';
import type { Persona, PersonaDraft } from '@/types/persona';
import { createId, slugify } from '@/lib/utils/id';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import { safePersistStorage } from './persist';

/** Only this slice reaches localStorage. */
interface PersistedPersonas {
  custom: Persona[];
}

export interface PersonaState {
  /** User-authored personas only; built-ins are code, not state. */
  custom: Persona[];
  create(draft: PersonaDraft): Persona;
  duplicate(source: Persona): Persona;
  update(id: string, patch: Partial<PersonaDraft>): void;
  remove(id: string): void;
  all(): Persona[];
  byId(id: string): Persona | undefined;
}

export const usePersonas = create<PersonaState>()(
  persist(
    (set, get) => ({
      custom: [],

      create(draft) {
        const persona: Persona = {
          ...draft,
          // Slug plus a random suffix: readable in exports, still unique when
          // two personas are both called "Assistant".
          id: `${slugify(draft.name) || 'persona'}-${createId().slice(0, 6)}`,
          builtIn: false,
        };
        set((state) => ({ custom: [...state.custom, persona] }));
        return persona;
      },

      duplicate(source) {
        return get().create({
          ...source,
          name: `${source.name} copy`,
        });
      },

      update(id, patch) {
        set((state) => ({
          custom: state.custom.map((persona) =>
            persona.id === id ? { ...persona, ...patch } : persona,
          ),
        }));
      },

      remove(id) {
        set((state) => ({
          custom: state.custom.filter((persona) => persona.id !== id),
        }));
      },

      all() {
        return [...BUILT_IN_PERSONAS, ...get().custom];
      },

      byId(id) {
        return get()
          .all()
          .find((persona) => persona.id === id);
      },
    }),
    {
      name: STORAGE_KEYS.personas,
      storage: safePersistStorage<PersistedPersonas>(),
      version: 1,
      // Built-ins are code, so only the user's own personas are stored.
      partialize: (state): PersistedPersonas => ({ custom: state.custom }),
    },
  ),
);
