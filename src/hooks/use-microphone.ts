'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Microphone,
  detectListenMode,
  isMicrophoneSupported,
  type ListenMode,
} from '@/lib/audio/microphone';
import { useStage } from '@/lib/store/stage-store';
import { useClientValue } from './use-client-value';

export interface UseMicrophoneOptions {
  /** Called with the finished transcript. */
  onTranscript: (text: string) => void;
}

/**
 * Push-to-talk state for the composer.
 *
 * `interim` is the partial transcript shown live in the input while the user
 * is still speaking — only the native recognition path can produce it, so it
 * stays empty in Firefox and the button simply shows a recording state
 * instead.
 */
export function useMicrophone({ onTranscript }: UseMicrophoneOptions) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Capability, not state: read through an external-store snapshot so SSR and
  // the first client render agree without a set-state-in-effect round trip.
  const mode = useClientValue<ListenMode>(detectListenMode, 'native');
  const supported = useClientValue(
    () => isMicrophoneSupported() || detectListenMode() === 'native',
    true,
  );

  const micRef = useRef<Microphone | null>(null);
  const setStageListening = useStage((state) => state.setListening);

  // The transcript callback changes identity on every parent render. Holding
  // the latest one in a ref lets the Microphone instance be built exactly once
  // while still calling the current handler.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const mic = new Microphone({
      onInterim: setInterim,
      onFinal: (text) => {
        setInterim('');
        onTranscriptRef.current(text);
      },
      onError: (err) => {
        setInterim('');
        setError(err.message);
      },
      onStateChange: (value) => {
        setListening(value);
        setStageListening(value);
        if (value) setError(null);
      },
    });

    micRef.current = mic;
    return () => {
      mic.cancel();
      if (micRef.current === mic) micRef.current = null;
      setStageListening(false);
    };
  }, [setStageListening]);

  const toggle = useCallback(() => {
    const mic = micRef.current;
    if (!mic) return;
    if (mic.isListening) mic.stop();
    else void mic.start();
  }, []);

  return { listening, interim, error, mode, supported, toggle };
}
