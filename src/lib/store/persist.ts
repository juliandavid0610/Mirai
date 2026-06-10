import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { readJSON, remove, writeJSON } from '@/lib/utils/storage';

/**
 * A zustand persistence adapter backed by the never-throwing storage helpers.
 *
 * zustand's default adapter reaches straight for `localStorage`, which throws
 * outright in Safari private mode and in sandboxed iframes. Routing through
 * the safe helpers turns persistence into a best-effort feature: state still
 * lives in memory, it simply does not survive a reload.
 */
export function safePersistStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => readJSON<StorageValue<T> | null>(name, null),
    setItem: (name, value) => {
      writeJSON(name, value);
    },
    removeItem: (name) => remove(name),
  };
}
