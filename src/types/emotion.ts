/**
 * The emotional vocabulary shared by the whole app.
 *
 * This list is deliberately small. Every entry has to be (a) something a
 * language model reliably distinguishes, and (b) something a Live2D model can
 * actually show. Adding a 30th nuanced mood buys nothing if the rig cannot
 * render it, so the set stays close to Ekman's basic emotions plus the two
 * conversational states that matter most for a companion — `thinking` and
 * `shy`.
 */
export const EMOTIONS = [
  'neutral',
  'joy',
  'excited',
  'shy',
  'sad',
  'angry',
  'surprised',
  'thinking',
  'sleepy',
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const DEFAULT_EMOTION: Emotion = 'neutral';

export function isEmotion(value: unknown): value is Emotion {
  return (
    typeof value === 'string' && (EMOTIONS as readonly string[]).includes(value)
  );
}

/** Human-facing label, used in the debug overlay and settings. */
export const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: 'Neutral',
  joy: 'Joy',
  excited: 'Excited',
  shy: 'Shy',
  sad: 'Sad',
  angry: 'Angry',
  surprised: 'Surprised',
  thinking: 'Thinking',
  sleepy: 'Sleepy',
};

/**
 * A colour per emotion, used for the ambient rim light behind the model and
 * for the emotion pill in the UI. Stored as HSL triples so the UI can build
 * alpha variants without a colour library.
 */
export const EMOTION_HUES: Record<Emotion, string> = {
  neutral: '265 85% 68%',
  joy: '43 96% 62%',
  excited: '12 92% 64%',
  shy: '342 88% 72%',
  sad: '212 86% 62%',
  angry: '0 84% 60%',
  surprised: '175 84% 58%',
  thinking: '258 70% 66%',
  sleepy: '232 46% 58%',
};

/** An emotion together with how strongly it was expressed (0…1). */
export interface EmotionCue {
  emotion: Emotion;
  intensity: number;
  /** Index into the cleaned text where the cue was raised. */
  offset: number;
}
