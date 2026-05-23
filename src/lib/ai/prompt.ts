import { EMOTIONS } from '@/types/emotion';
import type { Persona } from '@/types/persona';

/**
 * Builds the system prompt.
 *
 * Structure matters more than wording here. The character brief goes *first*
 * so it frames everything after it, and the mechanical protocol (emotion
 * markers, length) goes last so it is closest to the generation and least
 * likely to be forgotten by turn twenty. Putting the protocol first — the
 * obvious layout — measurably increases how often the model stops emitting
 * markers in long conversations.
 */

const EMOTION_LIST = EMOTIONS.join(', ');

export interface PromptContext {
  persona: Persona;
  /** Facts the user has asked the assistant to remember. */
  memory?: string[];
  /** Local time string, so "good morning" is not a coin flip. */
  localTime?: string;
}

export function buildSystemPrompt({
  persona,
  memory = [],
  localTime,
}: PromptContext): string {
  const sections: string[] = [];

  sections.push(`# Who you are\n\n${persona.brief.trim()}`);

  if (persona.style.length > 0) {
    sections.push(
      `# How you speak\n\n${persona.style.map((rule) => `- ${rule}`).join('\n')}`,
    );
  }

  if (persona.boundaries.length > 0) {
    sections.push(
      `# Lines you do not cross\n\n${persona.boundaries
        .map((rule) => `- ${rule}`)
        .join('\n')}`,
    );
  }

  if (memory.length > 0) {
    sections.push(
      [
        '# What you remember about this person',
        '',
        ...memory.slice(0, 40).map((fact) => `- ${fact}`),
        '',
        'Refer to these naturally when relevant. Never recite the list back.',
      ].join('\n'),
    );
  }

  sections.push(buildEmbodimentSection(persona));

  const context: string[] = [];
  if (localTime) context.push(`The user's local time is ${localTime}.`);
  context.push(
    'You are rendered as an animated Live2D character. The user sees your face react as you speak.',
  );
  sections.push(`# Context\n\n${context.join(' ')}`);

  return sections.join('\n\n');
}

/**
 * The emotion-marker protocol.
 *
 * Written as an instruction plus a worked example, because models follow a
 * demonstrated format far more reliably than a described one — and the whole
 * expression pipeline degrades to a blank stare if the markers stop arriving.
 */
function buildEmbodimentSection(persona: Persona): string {
  const frequency =
    persona.expressiveness >= 0.85
      ? 'Use a marker in almost every reply, often more than one.'
      : persona.expressiveness >= 0.6
        ? 'Use a marker once or twice per reply, where the feeling is real.'
        : 'Use markers sparingly — only when the feeling is genuinely strong.';

  return [
    '# Showing emotion',
    '',
    'Your face is animated. You control it by placing markers inline in your reply:',
    '',
    '    [[emotion]]  or  [[emotion:intensity]]',
    '',
    `Valid emotions: ${EMOTION_LIST}.`,
    'Intensity is a decimal from 0 to 1 and defaults to 0.85.',
    '',
    'Place a marker immediately before the words it applies to, so your',
    'expression changes at the right moment rather than after the fact.',
    '',
    'Example:',
    '',
    '    [[thinking:0.6]] Give me a second, that stack trace is unusual.',
    '    [[surprised]] Oh — your loop is mutating the array it iterates.',
    '    [[joy:0.8]] One-line fix. Copy the array first.',
    '',
    frequency,
    `Your resting expression is ${persona.baseEmotion}; return to it between beats.`,
    'Never mention the markers, never explain them, never wrap them in code',
    'fences. They are removed before the user sees your reply.',
    '',
    '# Length',
    '',
    'You are speaking out loud, not writing a document. Keep replies to a few',
    'sentences unless the user asks for depth. Never use headings. Use code',
    'blocks only for actual code.',
  ].join('\n');
}

/**
 * A compact recap injected when the conversation gets long.
 *
 * Trimming old turns keeps latency and cost flat over a long session, but
 * dropping them outright makes the character forget the last hour mid-chat.
 */
export function buildMemoryDigest(facts: string[]): string | null {
  if (facts.length === 0) return null;
  return `Earlier in this conversation: ${facts.join('; ')}.`;
}
