import {
  DEFAULT_EMOTION,
  isEmotion,
  type Emotion,
  type EmotionCue,
} from '@/types/emotion';
import { clamp01 } from '@/lib/utils/math';

/**
 * Inline emotion directives.
 *
 * The model is asked to punctuate its reply with `[[emotion]]` or
 * `[[emotion:intensity]]` markers, e.g.
 *
 *   "[[excited:0.9]] You got it working! [[joy]] That last bug was nasty."
 *
 * Why inline tags rather than a tool call or a structured-output schema:
 *
 *  - **They stream.** A tool call arrives after the text, which means the face
 *    would react a beat *after* the words land. Inline tags fire mid-sentence,
 *    at the exact word the model meant them for.
 *  - **They are provider-agnostic.** Every model that can follow an
 *    instruction can emit a bracket; structured output support varies.
 *  - **They degrade safely.** A model that ignores the convention produces a
 *    perfectly normal reply, and the face just stays on the persona's base
 *    emotion.
 *
 * The costs are that the parser has to run against *partial* text on every
 * frame of the stream, and that it must not touch code — an assistant
 * explaining its own protocol will write `[[joy]]` in backticks, and eating
 * that is both wrong and very confusing to read.
 */

const DIRECTIVE = /\[\[([a-z]+)(?::([0-9]*\.?[0-9]+))?\]\]/gi;

/**
 * The longest prefix of a directive that could still turn into a complete one.
 * `"[["` + the longest emotion name + `":0.99"` + `"]]"`.
 */
const MAX_PARTIAL = 24;

type Range = readonly [start: number, end: number];

export interface ParsedDirectives {
  /** The reply with every directive removed — what the user reads. */
  text: string;
  /** Cues in the order they appeared. */
  cues: EmotionCue[];
  /** Last cue's emotion, or the default when there were none. */
  dominant: Emotion;
  /**
   * True when the tail of the input looks like the beginning of a directive.
   * The UI uses this to hold back the final characters for one more chunk
   * rather than briefly rendering a naked `[[jo` to the user.
   */
  pendingTail: boolean;
}

const EMPTY: ParsedDirectives = {
  text: '',
  cues: [],
  dominant: DEFAULT_EMOTION,
  pendingTail: false,
};

/**
 * Strips directives out of `raw` and returns the cues they carried.
 *
 * Safe to call on partial text: a trailing fragment such as `"[[exci"` is
 * withheld from `text` and reported via `pendingTail`, so a tag split across
 * two stream chunks never flashes on screen. This is the whole reason the
 * function exists rather than a one-line `.replace()`.
 */
export function parseDirectives(raw: string): ParsedDirectives {
  if (!raw) return EMPTY;

  // Hold back anything that might be the start of a directive.
  const { body, tail } = splitPendingTail(raw);
  const protectedRanges = codeRanges(body);

  const cues: EmotionCue[] = [];
  let text = '';

  // Walk the body as alternating plain / code segments. Code is copied
  // verbatim — no directive removal, no whitespace collapsing — so a fenced
  // block keeps its indentation and an inline span keeps its brackets.
  let cursor = 0;
  const segments: Array<{ content: string; code: boolean }> = [];
  for (const [start, end] of protectedRanges) {
    if (start > cursor) {
      segments.push({ content: body.slice(cursor, start), code: false });
    }
    segments.push({ content: body.slice(start, end), code: true });
    cursor = end;
  }
  segments.push({ content: body.slice(cursor), code: false });

  segments.forEach((segment, index) => {
    if (segment.code) {
      text += segment.content;
      return;
    }

    const isFirst = index === 0;
    const isLast = index === segments.length - 1;
    const base = text.length;

    let stripped = '';
    let last = 0;

    DIRECTIVE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DIRECTIVE.exec(segment.content)) !== null) {
      stripped += segment.content.slice(last, match.index);
      last = match.index + match[0].length;

      const name = (match[1] ?? '').toLowerCase();
      if (!isEmotion(name)) {
        // Unknown tag: still removed from the text, but raises no cue. Models
        // occasionally invent moods ("[[curious]]"), and leaking that into the
        // transcript looks far worse than silently dropping it.
        continue;
      }

      const rawIntensity = match[2];
      const intensity =
        rawIntensity === undefined
          ? 0.85
          : clamp01(Number.parseFloat(rawIntensity));

      cues.push({
        emotion: name,
        intensity: Number.isFinite(intensity) ? intensity : 0.85,
        // Offsets are used to decide *when* a cue has been revealed during
        // streaming, so being out by the handful of whitespace characters
        // collapsed below is immaterial.
        offset: base + stripped.length,
      });
    }

    stripped += segment.content.slice(last);
    text += collapseGaps(stripped, isFirst, isLast);
  });

  return {
    text,
    cues,
    dominant:
      cues.length > 0
        ? (cues[cues.length - 1] as EmotionCue).emotion
        : DEFAULT_EMOTION,
    pendingTail: tail.length > 0,
  };
}

/**
 * Finds the regions that must be copied through untouched: fenced code blocks
 * and inline code spans.
 *
 * An unterminated fence counts to the end of the input, because mid-stream
 * that is exactly what a code block looks like.
 */
function codeRanges(text: string): Range[] {
  const ranges: Range[] = [];

  const fence = /```[\s\S]*?(?:```|$)/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  const inline = /`[^`\n]*`/g;
  while ((match = inline.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // Backticks inside a fenced block are already covered.
    if (!ranges.some(([s, e]) => start >= s && end <= e)) {
      ranges.push([start, end]);
    }
  }

  return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * Splits off a trailing fragment that could still grow into a directive.
 *
 * Only the last `MAX_PARTIAL` characters are examined — a `[[` further back
 * than that is not an unfinished tag, it is a user talking about brackets.
 */
function splitPendingTail(raw: string): { body: string; tail: string } {
  const searchFrom = Math.max(0, raw.length - MAX_PARTIAL);
  const open = raw.lastIndexOf('[[', raw.length);
  if (open < searchFrom) return { body: raw, tail: '' };

  const candidate = raw.slice(open);
  // A complete directive is not pending; let the main pass handle it.
  if (/\]\]/.test(candidate)) return { body: raw, tail: '' };
  // Anything that cannot become a directive (a space, punctuation) is just
  // text that happens to contain brackets. The optional trailing `]` matters:
  // a chunk boundary lands between the two closing brackets often enough that
  // omitting it leaks `[[joy:0.9]` to the reader for one frame.
  if (!/^\[\[[a-z]*(?::[0-9]*\.?[0-9]*)?\]?$/i.test(candidate)) {
    return { body: raw, tail: '' };
  }

  return { body: raw.slice(0, open), tail: candidate };
}

/**
 * Tidies whitespace left behind by removed tags, without touching the
 * paragraph structure the model intended.
 *
 * `trimStart`/`trimEnd` are only applied at the outer edges of the whole
 * message; trimming at an internal segment boundary would glue prose onto an
 * adjacent code span ("use`x`here").
 */
function collapseGaps(text: string, trimStart: boolean, trimEnd: boolean): string {
  let out = text
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  if (trimStart) out = out.replace(/^[^\S\n]+/, '');
  // Removing a tag leaves the space that preceded it dangling at the end of
  // the visible text. Harmless in a paragraph, visible as a stray gap when the
  // tag was the last thing to arrive.
  if (trimEnd) out = out.replace(/[^\S\n]+$/, '');

  return out;
}

/**
 * Finds the cue that should be showing once `charactersRevealed` characters of
 * the cleaned text have streamed in.
 *
 * During streaming the UI knows how much text has arrived, and this maps that
 * position back to an emotion, so the face changes exactly when the words
 * carrying that emotion appear rather than all at once at the end.
 */
export function cueAt(
  cues: EmotionCue[],
  charactersRevealed: number,
): EmotionCue | null {
  let active: EmotionCue | null = null;
  for (const cue of cues) {
    if (cue.offset <= charactersRevealed) active = cue;
    else break;
  }
  return active;
}

/**
 * Strips directives without any of the streaming bookkeeping.
 *
 * Used before text-to-speech, where an un-stripped marker would otherwise be
 * read aloud as "bracket bracket joy".
 */
export function stripDirectives(raw: string): string {
  return parseDirectives(raw).text;
}
