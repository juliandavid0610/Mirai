import { TextEnvelope } from '@/lib/live2d/lip-sync';
import { createLogger } from '@/lib/utils/logger';
import { clamp01 } from '@/lib/utils/math';
import { createAmplitudeReader, getAudioBus } from './audio-bus';

const log = createLogger('voice');

/**
 * Speaks a reply and exposes a live amplitude signal for the mouth to follow.
 *
 * Two paths, chosen at runtime:
 *
 *  **Neural** — `POST /api/speech` returns audio bytes, which are decoded and
 *  played through the shared AnalyserNode. Amplitude is measured from the real
 *  waveform, so the lip sync is genuinely driven by the voice.
 *
 *  **Browser** — `SpeechSynthesis`. Free, offline, no key, and it exposes no
 *  audio stream whatsoever, by design. Amplitude therefore comes from
 *  `TextEnvelope`, which estimates a syllable envelope from the text. The
 *  mouth is following a prediction rather than the sound, but at conversational
 *  pace the difference is hard to see.
 *
 * The caller never has to know which one ran.
 */
export type VoiceMode = 'neural' | 'browser' | 'muted';

export interface VoiceEvents {
  onStart?: (mode: VoiceMode) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface SpeakOptions {
  voice?: string;
  /** 0.5…2. Applied to both paths. */
  rate?: number;
  signal?: AbortSignal;
}

export class VoicePlayer {
  private events: VoiceEvents;
  private mode: VoiceMode = 'muted';
  private speaking = false;

  /** Neural path. */
  private source: AudioBufferSourceNode | null = null;
  private readAmplitude: (() => number) | null = null;

  /** Browser path. */
  private utterance: SpeechSynthesisUtterance | null = null;
  private envelope: TextEnvelope | null = null;
  private envelopeStartedAt = 0;

  private generation = 0;

  constructor(events: VoiceEvents = {}) {
    this.events = events;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get currentMode(): VoiceMode {
    return this.mode;
  }

  /** Current loudness, 0…1. Wired straight into the Live2D stage. */
  amplitude(): number {
    if (!this.speaking) return 0;
    if (this.readAmplitude) return clamp01(this.readAmplitude());
    if (this.envelope) {
      return this.envelope.sample(performance.now() - this.envelopeStartedAt);
    }
    return 0;
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.stop();
    const generation = ++this.generation;

    const played = await this.speakNeural(trimmed, options, generation);
    if (played || options.signal?.aborted) return;
    if (generation !== this.generation) return;

    this.speakBrowser(trimmed, options, generation);
  }

  // ───────────────────────────────── neural ─────────────────────────────────

  private async speakNeural(
    text: string,
    options: SpeakOptions,
    generation: number,
  ): Promise<boolean> {
    const bus = getAudioBus();
    if (!bus) return false;

    let buffer: AudioBuffer;
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: options.voice,
          speed: options.rate,
        }),
        signal: options.signal,
      });

      // 204 is the documented "no speech model configured" answer.
      if (response.status === 204 || !response.ok) return false;

      const bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0) return false;
      buffer = await bus.context.decodeAudioData(bytes);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return true;
      log.warn('neural speech unavailable, falling back', error);
      return false;
    }

    if (generation !== this.generation) return true;

    const source = bus.context.createBufferSource();
    source.buffer = buffer;
    source.connect(bus.destination);

    this.source = source;
    this.readAmplitude = createAmplitudeReader(bus.analyser);
    this.envelope = null;
    this.mode = 'neural';
    this.speaking = true;
    this.events.onStart?.('neural');

    source.onended = () => {
      if (generation !== this.generation) return;
      this.finish();
    };

    options.signal?.addEventListener('abort', () => this.stop(), { once: true });
    source.start();
    return true;
  }

  // ───────────────────────────────── browser ────────────────────────────────

  private speakBrowser(
    text: string,
    options: SpeakOptions,
    generation: number,
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      log.warn('no speech synthesis available');
      this.events.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1;
    utterance.pitch = 1.05;

    const preferred = pickBrowserVoice(options.voice);
    if (preferred) utterance.voice = preferred;

    this.utterance = utterance;
    this.envelope = new TextEnvelope(text, 165 * (options.rate ?? 1));
    this.readAmplitude = null;
    this.mode = 'browser';

    utterance.onstart = () => {
      if (generation !== this.generation) return;
      this.envelopeStartedAt = performance.now();
      this.speaking = true;
      this.events.onStart?.('browser');
    };
    utterance.onend = () => {
      if (generation !== this.generation) return;
      this.finish();
    };
    utterance.onerror = (event) => {
      if (generation !== this.generation) return;
      // "interrupted" and "canceled" are what `cancel()` produces; they are
      // control flow, not failures.
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        this.events.onError?.(new Error(`Speech synthesis: ${event.error}`));
      }
      this.finish();
    };

    // Chrome drops queued utterances that follow a cancel() in the same tick.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  // ───────────────────────────────── control ────────────────────────────────

  stop(): void {
    this.generation += 1;

    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
        this.source.disconnect();
      } catch {
        /* already stopped */
      }
      this.source = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.utterance = null;

    if (this.speaking) {
      this.speaking = false;
      this.events.onEnd?.();
    }
    this.readAmplitude = null;
    this.envelope = null;
    this.mode = 'muted';
  }

  private finish(): void {
    this.speaking = false;
    this.source = null;
    this.utterance = null;
    this.readAmplitude = null;
    this.envelope = null;
    this.mode = 'muted';
    this.events.onEnd?.();
  }
}

/**
 * Picks a browser voice.
 *
 * Voice availability is wildly inconsistent across platforms, so this matches
 * loosely by name and then by locale, and happily returns null — an unset
 * `utterance.voice` uses the system default, which always exists.
 */
function pickBrowserVoice(preferred?: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  if (preferred) {
    const byName = voices.find((voice) =>
      voice.name.toLowerCase().includes(preferred.toLowerCase()),
    );
    if (byName) return byName;
  }

  // Prefer a higher-quality local English voice where one exists.
  const ranked = [
    voices.find((v) => /natural|neural|premium|enhanced/i.test(v.name) && v.lang.startsWith('en')),
    voices.find((v) => v.lang.startsWith('en') && v.localService),
    voices.find((v) => v.lang.startsWith('en')),
  ];
  return ranked.find(Boolean) ?? null;
}

/**
 * Warms up the browser voice list.
 *
 * `getVoices()` returns an empty array on first call in Chrome until the
 * `voiceschanged` event fires. Calling this early means the first reply does
 * not get stuck with the default voice.
 */
export function primeBrowserVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener(
    'voiceschanged',
    () => window.speechSynthesis.getVoices(),
    { once: true },
  );
}
