/**
 * A localStorage wrapper that never throws.
 *
 * Storage access fails in more situations than people expect: Safari private
 * mode, embedded webviews, blocked third-party contexts, and a full quota.
 * None of those should take the app down, so every operation degrades to a
 * no-op and the caller just keeps its in-memory state.
 */

function available(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const probe = '__mirai_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const store = available();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  const store = available();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  const store = available();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEYS = {
  settings: 'mirai.settings.v1',
  personas: 'mirai.personas.v1',
  conversation: 'mirai.conversation.v1',
  memory: 'mirai.memory.v1',
  onboarding: 'mirai.onboarding.v1',
} as const;
