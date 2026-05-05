import type { Emotion } from './emotion';

/**
 * A persona is the complete description of who the assistant is: how it
 * speaks, what it cares about, and how expressive it is allowed to be.
 *
 * Personas are plain data so they can be edited in the UI, serialised to
 * localStorage, exported as JSON and shared between installs without any code
 * changes.
 */
export interface Persona {
  id: string;
  name: string;
  /** One-line description shown on the persona card. */
  summary: string;
  /** Emoji or short glyph used as the card avatar. */
  glyph: string;
  /** Free-form character brief injected into the system prompt. */
  brief: string;
  /** Speech-style rules, rendered as a bullet list in the system prompt. */
  style: string[];
  /** Topics or behaviours the persona should avoid. */
  boundaries: string[];
  /** The greeting used to open a fresh conversation. */
  greeting: string;
  /** Resting emotion the model returns to between beats. */
  baseEmotion: Emotion;
  /**
   * How freely the persona emits emotion cues, 0…1. Low values keep the model
   * composed; high values make it visibly reactive.
   */
  expressiveness: number;
  /** Sampling temperature used for this persona. */
  temperature: number;
  /** Voice id passed to the speech model. */
  voice: string;
  /** Built-in personas cannot be deleted, only duplicated. */
  builtIn: boolean;
}

export type PersonaDraft = Omit<Persona, 'id' | 'builtIn'>;
