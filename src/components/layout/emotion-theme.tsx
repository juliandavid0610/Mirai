'use client';

import { useEffect } from 'react';
import { EMOTION_HUES } from '@/types/emotion';
import { useStage } from '@/lib/store/stage-store';

/**
 * Publishes the character's current emotion as a CSS custom property.
 *
 * Everything themeable in the app — buttons, focus rings, the aurora, the
 * selection colour — is expressed in terms of `--emotion`. Writing the
 * variable once on `<html>` means a mood change repaints the entire interface
 * without a single React re-render, and the transition is handled by CSS
 * rather than by animating state in JS.
 */
export function EmotionTheme() {
  const emotion = useStage((state) => state.emotion);

  useEffect(() => {
    const hue = EMOTION_HUES[emotion];
    if (!hue) return;
    document.documentElement.style.setProperty('--emotion', hue);
  }, [emotion]);

  return null;
}
