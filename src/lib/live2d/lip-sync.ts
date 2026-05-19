import { clamp01, damp, remap } from '@/lib/utils/math';

/**
 * Turns a loudness signal into a believable mouth.
 *
 * Driving `ParamMouthOpenY` straight from RMS looks wrong, and it took a while
 * to work out why. Three things fix it:
 *
 *  1. **Asymmetric smoothing.** Real jaws open fast and close slowly. Using one
 *     smoothing constant for both directions gives you either a flapping mouth
 *     or a sluggish one, never speech.
 *  2. **A noise gate.** Room tone and codec hiss sit around 0.01–0.03 RMS. With
 *     no gate the mouth never fully closes between words, which reads as a
 *     permanent slack jaw.
 *  3. **A moving ceiling.** TTS output is loudness-normalised per clip, so a
 *     fixed gain either clips quiet voices shut or leaves loud ones gaping. The
 *     driver tracks a decaying peak and normalises against it.
 */
export interface LipSyncOptions {
  /** Seconds-ish constant for opening. Lower = snappier. */
  attack: number;
  /** Seconds-ish constant for closing. Higher than attack. */
  release: number;
  /** Signal below this is treated as silence. */
  gate: number;
  /** Multiplier applied before normalisation. */
  gain: number;
  /** Upper bound written to the mouth parameter. */
  ceiling: number;
}

export const DEFAULT_LIP_SYNC: LipSyncOptions = {
  attack: 0.0001,
  release: 0.02,
  gate: 0.018,
  gain: 1.6,
  ceiling: 1,
};

export interface MouthState {
  /** 0…1 for `mouthOpen`. */
  open: number;
  /** −1…1 for `mouthForm`; widens on louder vowels. */
  form: number;
}

export class LipSyncDriver {
  private options: LipSyncOptions;
  private open = 0;
  private form = 0;
  /** Decaying peak used as the normalisation ceiling. */
  private peak = 0.08;
  private elapsed = 0;

  constructor(options: Partial<LipSyncOptions> = {}) {
    this.options = { ...DEFAULT_LIP_SYNC, ...options };
  }

  configure(options: Partial<LipSyncOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * @param amplitude raw RMS of the current audio frame, 0…1
   * @param deltaSeconds time since the previous call
   */
  update(amplitude: number, deltaSeconds: number): MouthState {
    const { attack, release, gate, gain, ceiling } = this.options;
    this.elapsed += deltaSeconds;

    const level = clamp01(amplitude * gain);

    // Track a peak that decays ~40%/second so the ceiling follows the clip
    // without being permanently dragged up by one loud consonant.
    this.peak = Math.max(level, this.peak * Math.pow(0.6, deltaSeconds));
    const normalised =
      this.peak > gate ? clamp01(remap(level, gate, this.peak, 0, 1)) : 0;

    const target = level <= gate ? 0 : normalised * ceiling;
    const smoothing = target > this.open ? attack : release;
    this.open = damp(this.open, target, smoothing, deltaSeconds);

    // A slow wobble on mouth *form* stops the shape from being a pure volume
    // meter; wider on loud vowels, rounder on quiet ones.
    const wobble = Math.sin(this.elapsed * 7.3) * 0.12;
    this.form = damp(
      this.form,
      clamp01(this.open) * 0.7 + wobble,
      0.02,
      deltaSeconds,
    );

    return { open: clamp01(this.open), form: this.form };
  }

  /** Eases the mouth shut; call when playback stops. */
  release(deltaSeconds: number): MouthState {
    return this.update(0, deltaSeconds);
  }

  reset(): void {
    this.open = 0;
    this.form = 0;
    this.peak = 0.08;
    this.elapsed = 0;
  }
}

/**
 * A synthetic amplitude source for when there is no audio to analyse.
 *
 * The browser's `SpeechSynthesis` API deliberately exposes no audio stream —
 * you cannot route it through an AnalyserNode. Since that is the zero-config
 * voice path, the mouth would otherwise sit still during the entire reply. So
 * instead we *estimate* an envelope from the text itself: count syllables,
 * spread them over the expected duration, and emit a vowel-shaped pulse per
 * syllable. It is not real lip sync, but at conversational speed it is
 * convincingly close.
 */
export class TextEnvelope {
  private readonly pulses: number[];
  private readonly durationMs: number;

  constructor(text: string, wordsPerMinute = 165) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    this.durationMs = Math.max(
      400,
      (words.length / Math.max(1, wordsPerMinute)) * 60_000,
    );

    const syllables = words.reduce(
      (total, word) => total + countSyllables(word),
      0,
    );
    const count = Math.max(1, syllables);

    // Pulse centres, jittered so the rhythm is not metronomic.
    this.pulses = Array.from({ length: count }, (_, i) => {
      const even = (i + 0.5) / count;
      const jitter = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.35 - 0.175;
      return clamp01(even + jitter / count);
    });
  }

  get duration(): number {
    return this.durationMs;
  }

  /** Amplitude 0…1 at `elapsedMs` into the utterance. */
  sample(elapsedMs: number): number {
    if (elapsedMs >= this.durationMs) return 0;
    const t = clamp01(elapsedMs / this.durationMs);
    // Width of one syllable as a fraction of the whole utterance.
    const width = 0.7 / this.pulses.length;

    let amplitude = 0;
    for (const centre of this.pulses) {
      const distance = Math.abs(t - centre);
      if (distance > width) continue;
      // Raised cosine — smooth in, smooth out, no clicks at the edges.
      const shape = 0.5 * (1 + Math.cos((distance / width) * Math.PI));
      amplitude = Math.max(amplitude, shape);
    }
    return amplitude * 0.85;
  }
}

/**
 * Vowel-group syllable estimate. Wrong for plenty of words, but lip sync only
 * needs the *rate* to be right, not the linguistics.
 */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) {
    // CJK and emoji fall through here; treat each glyph as one beat.
    return Math.max(1, Math.ceil([...word].length * 0.6));
  }
  if (cleaned.length <= 3) return 1;

  // A *run* of vowels is one nucleus: "beau" in "beautiful" is a single beat,
  // and matching in pairs instead counts it as two.
  const groups = cleaned
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]+/g);

  return Math.max(1, groups?.length ?? 1);
}
