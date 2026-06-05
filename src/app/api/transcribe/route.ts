import { experimental_transcribe as transcribe, gateway } from 'ai';
import { env, hasTranscription } from '@/lib/env';
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
} from '@/lib/utils/rate-limit';

export const maxDuration = 60;

/** Hard cap on uploaded audio — roughly two minutes of compressed speech. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Speech-to-text for the mic button.
 *
 * Chrome and Edge ship `webkitSpeechRecognition`, which is free, instant and
 * needs no server round trip — the client prefers it. Firefox and several
 * Safari builds do not, so those browsers record a clip and post it here
 * instead. Same button, same UX, different path underneath.
 */
export async function POST(request: Request) {
  if (!hasTranscription()) {
    return Response.json(
      { error: 'Transcription is not configured on this deployment.' },
      { status: 501 },
    );
  }

  const limit = rateLimit(
    clientKey(request, 'transcribe'),
    env.rateLimitRequests,
    env.rateLimitWindowSeconds,
  );
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('audio');
    if (value instanceof File) file = value;
  } catch {
    return Response.json({ error: 'Expected multipart form data.' }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: 'Missing "audio" field.' }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: 'Empty recording.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Recording is too long.' }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await transcribe({
      model: gateway.transcription(env.transcribeModel),
      audio: bytes,
      abortSignal: request.signal,
    });

    return Response.json(
      { text: result.text.trim() },
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    console.error('[mirai:transcribe]', error);
    return Response.json({ error: 'Could not transcribe audio.' }, { status: 502 });
  }
}
