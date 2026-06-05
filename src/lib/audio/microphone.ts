import { createLogger } from '@/lib/utils/logger';

const log = createLogger('mic');

/**
 * Voice input with two interchangeable implementations.
 *
 * `SpeechRecognition` (Chrome, Edge, Safari 16+) is free, streams interim
 * results as you speak, and needs no server. Firefox has never shipped it, so
 * there it records a clip with `MediaRecorder` and posts it to
 * `/api/transcribe`.
 *
 * Both are hidden behind one `start()/stop()` pair, and interim results simply
 * never fire on the recording path.
 */

export type ListenMode = 'native' | 'recorded';

export interface ListenEvents {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: Error) => void;
  onStateChange?: (listening: boolean) => void;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function nativeRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function detectListenMode(): ListenMode {
  return nativeRecognition() ? 'native' : 'recorded';
}

export function isMicrophoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

export class Microphone {
  private events: ListenEvents;
  private mode: ListenMode;
  private recognition: SpeechRecognitionLike | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private listening = false;

  constructor(events: ListenEvents = {}) {
    this.events = events;
    this.mode = detectListenMode();
  }

  get currentMode(): ListenMode {
    return this.mode;
  }

  get isListening(): boolean {
    return this.listening;
  }

  async start(): Promise<void> {
    if (this.listening) return;
    if (this.mode === 'native') {
      this.startNative();
    } else {
      await this.startRecording();
    }
  }

  stop(): void {
    if (!this.listening) return;
    if (this.recognition) {
      this.recognition.stop();
    } else if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
  }

  /** Aborts without emitting a final result. */
  cancel(): void {
    this.recognition?.abort();
    if (this.recorder && this.recorder.state !== 'inactive') {
      // Drop the buffer first so `onstop` has nothing to upload.
      this.chunks = [];
      this.recorder.stop();
    }
    this.teardown();
  }

  // ───────────────────────────────── native ─────────────────────────────────

  private startNative(): void {
    const Ctor = nativeRecognition();
    if (!Ctor) {
      this.mode = 'recorded';
      void this.startRecording();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) this.events.onInterim?.(interim);
    };

    recognition.onerror = (event) => {
      // `no-speech` and `aborted` are routine; surfacing them as errors makes
      // the mic button feel broken when the user simply paused.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.events.onError?.(new Error(`Speech recognition: ${event.error}`));
      }
    };

    recognition.onend = () => {
      const text = finalText.trim();
      if (text) this.events.onFinal?.(text);
      this.teardown();
    };

    this.recognition = recognition;
    this.setListening(true);
    try {
      recognition.start();
    } catch (error) {
      log.warn('recognition start failed', error);
      this.teardown();
    }
  }

  // ──────────────────────────────── recorded ────────────────────────────────

  private async startRecording(): Promise<void> {
    if (!isMicrophoneSupported()) {
      this.events.onError?.(new Error('This browser has no microphone API.'));
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      this.events.onError?.(new Error('Microphone permission was denied.'));
      return;
    }

    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined,
    );
    this.chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, {
        type: mimeType || 'audio/webm',
      });
      this.chunks = [];
      this.teardown();
      if (blob.size > 0) void this.upload(blob);
    };

    this.recorder = recorder;
    this.setListening(true);
    recorder.start();
  }

  private async upload(blob: Blob): Promise<void> {
    const form = new FormData();
    form.append('audio', blob, 'speech.webm');
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(detail?.error ?? 'Transcription failed.');
      }
      const { text } = (await response.json()) as { text: string };
      if (text) this.events.onFinal?.(text);
    } catch (error) {
      this.events.onError?.(
        error instanceof Error ? error : new Error('Transcription failed.'),
      );
    }
  }

  // ───────────────────────────────── shared ─────────────────────────────────

  private setListening(value: boolean): void {
    if (this.listening === value) return;
    this.listening = value;
    this.events.onStateChange?.(value);
  }

  private teardown(): void {
    this.recognition = null;
    this.recorder = null;
    // Releasing the tracks is what turns off the browser's recording
    // indicator; skipping it leaves a red dot in the tab forever.
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.setListening(false);
  }
}

/** Picks a container the current browser can actually record. */
function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
