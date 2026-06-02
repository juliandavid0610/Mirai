import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  gateway,
  smoothStream,
  streamText,
  type UIMessage,
} from 'ai';
import { buildSystemPrompt } from '@/lib/ai/prompt';
import { chatRequestSchema, toPersona } from '@/lib/ai/schema';
import { chunkReply, rehearsalReply } from '@/lib/ai/rehearsal';
import { resolveModelId } from '@/lib/ai/models';
import { resolvePersona } from '@/lib/ai/personas';
import { env, hasGateway } from '@/lib/env';
import { createId } from '@/lib/utils/id';
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
} from '@/lib/utils/rate-limit';
import type { MiraiMessageMetadata, MiraiUIMessage } from '@/types/chat';

// Streaming needs a long-lived request; Fluid Compute handles this on the
// default Node runtime, so there is no reason to reach for the edge runtime.
export const maxDuration = 120;

export async function POST(request: Request) {
  const limit = rateLimit(
    clientKey(request, 'chat'),
    env.rateLimitRequests,
    env.rateLimitWindowSeconds,
  );
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many requests. Give it a moment.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request.', issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  const { messages, modelId, personaId, memory, localTime } = parsed.data;
  // A persona sent inline wins, so user-authored characters work without any
  // server-side storage; otherwise fall back to the built-in by id.
  const persona = parsed.data.persona
    ? toPersona(parsed.data.persona)
    : resolvePersona(personaId);

  const uiMessages = messages as MiraiUIMessage[];

  if (!hasGateway()) {
    return rehearsalResponse(uiMessages, persona);
  }

  const model = resolveModelId(modelId ?? env.defaultModel);
  const startedAt = Date.now();

  try {
    const result = streamText({
      model: gateway(model),
      system: buildSystemPrompt({ persona, memory, localTime }),
      messages: await convertToModelMessages(uiMessages),
      temperature: persona.temperature,
      // Word-level chunking. Providers emit wildly different token sizes, and
      // without this the reply arrives in visible lurches — which the lip-sync
      // driver then faithfully reproduces as a stuttering jaw.
      experimental_transform: smoothStream({ chunking: 'word' }),
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
      messageMetadata: ({ part }): MiraiMessageMetadata | undefined => {
        if (part.type === 'start') {
          return { createdAt: Date.now(), model };
        }
        if (part.type === 'finish') {
          return { durationMs: Date.now() - startedAt };
        }
        return undefined;
      },
      onError: (error) => {
        console.error('[mirai:chat]', error);
        return error instanceof Error
          ? `The model call failed: ${error.message}`
          : 'The model call failed.';
      },
      headers: rateLimitHeaders(limit),
    });
  } catch (error) {
    console.error('[mirai:chat] stream setup failed', error);
    return Response.json(
      { error: 'Could not reach the model provider.' },
      { status: 502 },
    );
  }
}

/**
 * Keyless fallback.
 *
 * Emits exactly the same chunk sequence a real provider would, so the client
 * has no special case: the directive parser, the expression pipeline and the
 * lip-sync driver all run identically whether or not a key is configured.
 */
function rehearsalResponse(
  messages: MiraiUIMessage[],
  persona: Parameters<typeof rehearsalReply>[1],
) {
  const lastUserText = extractText(messages.at(-1));
  const reply = rehearsalReply(lastUserText, persona);
  const startedAt = Date.now();

  const stream = createUIMessageStream<MiraiUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const textId = createId('txt');

      writer.write({
        type: 'start',
        messageMetadata: {
          createdAt: startedAt,
          model: 'rehearsal',
          rehearsal: true,
        },
      });
      writer.write({ type: 'text-start', id: textId });

      for (const chunk of chunkReply(reply)) {
        // Roughly a fast human speaking pace. Without a delay the whole reply
        // lands in one frame and there is nothing to lip sync to.
        await sleep(22);
        writer.write({ type: 'text-delta', id: textId, delta: chunk });
      }

      writer.write({ type: 'text-end', id: textId });
      writer.write({
        type: 'finish',
        messageMetadata: { durationMs: Date.now() - startedAt },
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function extractText(message: UIMessage | undefined): string {
  if (!message) return '';
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .slice(0, 2000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
