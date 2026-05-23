import type { Persona } from '@/types/persona';

/**
 * Rehearsal Mode — the keyless fallback.
 *
 * `git clone && npm run dev` has to produce a talking, blinking, expressive
 * character with no account, no key and no credit card. Anything less and most
 * people who open the repo never see the thing actually work.
 *
 * So when no gateway key is configured the chat route serves scripted replies
 * from here instead of returning a 500. They are clearly labelled in the UI —
 * the point is to exercise the full pipeline (streaming, directive parsing,
 * expression changes, lip sync), not to pretend there is a model behind it.
 */

interface Script {
  /** Matched against the lower-cased user message. */
  test: RegExp;
  /** Replies are cycled so repeated questions do not repeat verbatim. */
  replies: string[];
}

const SCRIPTS: Script[] = [
  {
    test: /\b(hi|hey|hello|yo|good (morning|evening|afternoon))\b/,
    replies: [
      '[[joy:0.8]] Hey! Good to see you. [[neutral]] I should mention I am running in Rehearsal Mode right now — no model key configured, so these replies are scripted.',
      '[[excited:0.7]] Hello! Everything you are seeing — the expressions, the lip sync, the streaming — is real. Only the words are canned.',
    ],
  },
  {
    test: /\b(who are you|what are you|your name)\b/,
    replies: [
      '[[neutral]] I am the front end of a Live2D companion. Add an AI Gateway key and an actual model takes over from this script.',
      '[[thinking:0.6]] Right now? A very well-animated placeholder. [[joy:0.7]] With a key, someone much more interesting.',
    ],
  },
  {
    test: /\b(key|api|setup|configure|install|env)\b/,
    replies: [
      '[[thinking:0.7]] Copy `.env.example` to `.env.local`, drop in `AI_GATEWAY_API_KEY`, restart the dev server. [[joy:0.8]] That is the whole setup.',
      '[[neutral]] One key covers chat, speech and transcription — it all routes through the Vercel AI Gateway.',
    ],
  },
  {
    test: /\b(how|does|work|lip ?sync|expression|emotion|live2d|model)\b/,
    replies: [
      '[[thinking:0.8]] The model punctuates its replies with inline `[[emotion]]` markers. The client strips them out as they stream and hands each one to the Live2D layer. [[joy:0.7]] That is why my face changes mid-sentence instead of after.',
      '[[neutral]] Lip sync reads the real audio through an AnalyserNode and drives the mouth parameter. [[excited:0.7]] With browser speech, where there is no audio stream to read, it synthesises an envelope from the text instead.',
    ],
  },
  {
    test: /\b(bug|error|broken|fail|crash|not working)\b/,
    replies: [
      '[[surprised:0.7]] That sounds annoying. [[thinking:0.7]] With a real model behind me I could actually read the stack trace — right now I can only sympathise.',
    ],
  },
  {
    test: /\b(thanks|thank you|nice|cool|awesome|love it)\b/,
    replies: [
      '[[shy:0.7]] Oh — thank you. [[joy:0.8]] Wait until you plug in a real model.',
      '[[joy:0.9]] Glad you like it. The rig is doing most of the work here.',
    ],
  },
  {
    test: /\b(bye|goodbye|see you|later|good night)\b/,
    replies: ['[[sad:0.5]] Going already? [[joy:0.7]] Come back with a key.'],
  },
];

const FALLBACKS = [
  '[[thinking:0.7]] I only have a handful of scripted answers in Rehearsal Mode, and that is not one of them. [[neutral]] Add `AI_GATEWAY_API_KEY` to `.env.local` and ask me again.',
  '[[shy:0.6]] I cannot actually answer that one yet. [[neutral]] Everything except the words is live though — watch my face while this streams.',
  '[[neutral]] Scripted reply number three. [[joy:0.6]] The expression engine, the streaming and the lip sync are all genuinely running.',
];

/** Rotates through variants so the same prompt does not always match. */
let cursor = 0;

export function rehearsalReply(userText: string, persona: Persona): string {
  const normalised = userText.toLowerCase();
  cursor += 1;

  for (const script of SCRIPTS) {
    if (script.test.test(normalised)) {
      const reply = script.replies[cursor % script.replies.length];
      if (reply) return reply;
    }
  }

  const fallback = FALLBACKS[cursor % FALLBACKS.length] ?? (FALLBACKS[0] as string);
  // Nova and Rin would never say the same sentence the same way; a small
  // persona-flavoured tail keeps the fallback from feeling like one voice.
  return `${fallback}${personaTail(persona)}`;
}

function personaTail(persona: Persona): string {
  switch (persona.id) {
    case 'nova':
      return ' [[excited:0.8]] Go get the key, it takes a minute.';
    case 'yuki':
      return '';
    case 'rin':
      return ' [[neutral]] Not that I was waiting or anything.';
    default:
      return '';
  }
}

/**
 * Splits a reply into stream-sized chunks.
 *
 * Chunking mid-word on purpose: it produces the same partial-directive
 * situation a real provider does (`"[[jo"` arriving with `"y]]"` next), which
 * means Rehearsal Mode genuinely exercises the parser's hardest path rather
 * than a tidied-up version of it.
 */
export function* chunkReply(text: string, size = 7): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}
