import { rms } from '@/lib/utils/math';

/**
 * A single shared AudioContext with an analyser on the output path.
 *
 * Browsers cap the number of AudioContexts a page may create (Chrome allows
 * six, then throws), so creating one per utterance breaks after half a dozen
 * replies. One context, created lazily on the first user gesture and resumed
 * whenever it gets suspended, avoids the whole class of problem.
 */

export interface AudioBus {
  context: AudioContext;
  analyser: AnalyserNode;
  /** Connect a source here to have it analysed and heard. */
  destination: AudioNode;
}

let bus: AudioBus | null = null;

type AudioContextCtor = typeof AudioContext;

function contextConstructor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
}

export function isAudioSupported(): boolean {
  return contextConstructor() !== null;
}

/**
 * Returns the shared bus, creating it on first call.
 *
 * Must be called from inside a user gesture the first time, or the context
 * starts suspended and every subsequent play is silent with no error.
 */
export function getAudioBus(): AudioBus | null {
  if (bus) {
    // Autoplay policies suspend the context when a tab is backgrounded; a
    // resume here is cheap and idempotent.
    if (bus.context.state === 'suspended') void bus.context.resume();
    return bus;
  }

  const Ctor = contextConstructor();
  if (!Ctor) return null;

  const context = new Ctor();
  const analyser = context.createAnalyser();
  // 1024 gives ~21ms of audio at 48kHz — long enough for a stable RMS, short
  // enough that the mouth is not visibly lagging the sound.
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.35;
  analyser.connect(context.destination);

  bus = { context, analyser, destination: analyser };
  return bus;
}

/** Reads the current loudness, 0…1. Safe to call every frame. */
export function createAmplitudeReader(analyser: AnalyserNode): () => number {
  const buffer = new Float32Array(analyser.fftSize);
  return () => {
    analyser.getFloatTimeDomainData(buffer);
    return rms(buffer);
  };
}

/** Releases the shared context. Only used when tearing down in tests. */
export async function closeAudioBus(): Promise<void> {
  if (!bus) return;
  const { context } = bus;
  bus = null;
  try {
    await context.close();
  } catch {
    /* already closed */
  }
}
