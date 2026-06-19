'use client';

import { useSyncExternalStore } from 'react';

/** A subscription that never fires — the value is fixed for the session. */
const NEVER_CHANGES = () => () => {};

/**
 * Reads a browser capability without tripping hydration.
 *
 * Feature detection (`'speechSynthesis' in window`, `MediaRecorder` support,
 * …) cannot run during SSR, and doing it in an effect means rendering one
 * frame with the wrong answer and then calling `setState` — which React 19
 * correctly flags as a cascading render.
 *
 * `useSyncExternalStore` is the sanctioned way out: it takes a separate server
 * snapshot, so the markup matches on the server and the real value is present
 * from the first client render onward.
 *
 * `getSnapshot` must return a primitive or a cached reference — returning a
 * fresh object each call makes React re-render forever.
 */
export function useClientValue<T>(getSnapshot: () => T, serverSnapshot: T): T {
  return useSyncExternalStore(
    NEVER_CHANGES,
    getSnapshot,
    () => serverSnapshot,
  );
}
