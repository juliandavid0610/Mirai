import type { ChatModelOption } from '@/types/chat';

/**
 * Models offered in the picker.
 *
 * Every id is a Vercel AI Gateway route, so one key covers all of them and
 * switching vendor at runtime costs nothing. The list is deliberately short:
 * a dropdown with forty entries is a worse experience than five good ones.
 */
export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-5',
    label: 'Claude Sonnet 5',
    vendor: 'Anthropic',
    note: 'Best balance of character consistency and speed. The default.',
    speed: 2,
  },
  {
    id: 'anthropic/claude-opus-5',
    label: 'Claude Opus 5',
    vendor: 'Anthropic',
    note: 'Deepest reasoning. Noticeably better at staying in character.',
    speed: 3,
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    vendor: 'Anthropic',
    note: 'Fastest first token — the most lifelike for back-and-forth chat.',
    speed: 1,
  },
  {
    id: 'openai/gpt-5.5',
    label: 'GPT-5.5',
    vendor: 'OpenAI',
    note: 'Strong general reasoning with a distinct conversational voice.',
    speed: 2,
  },
  {
    id: 'google/gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    vendor: 'Google',
    note: 'Very fast and inexpensive. Good for long casual sessions.',
    speed: 1,
  },
];

export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-5';

export function isKnownModel(id: string | undefined): boolean {
  return CHAT_MODELS.some((model) => model.id === id);
}

/**
 * Resolves a requested model id.
 *
 * Unknown ids fall back to the default rather than being passed through,
 * because the client is untrusted input and an arbitrary string here would let
 * a caller route requests to any model the gateway key can reach.
 */
export function resolveModelId(requested: string | undefined): string {
  return isKnownModel(requested) ? (requested as string) : DEFAULT_MODEL_ID;
}

export function findChatModel(id: string): ChatModelOption | undefined {
  return CHAT_MODELS.find((model) => model.id === id);
}
