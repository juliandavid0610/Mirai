import { experimental_generateSpeech as generateSpeech, gateway } from 'ai';
import { speechRequestSchema } from '@/lib/ai/schema';
import { stripDirectives } from '@/lib/ai/directives';
import { env, hasSpeech } from '@/lib/env';
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
} from '@/lib/utils/rate-limit';

export const maxDuration = 60;

/**
 * Server-side text-to-speech.
 *
 * This route is what makes *real* lip sync possible. The browser's built-in
 * `SpeechSynthesis` deliberately exposes no audio stream, so it can never be
 * routed through an AnalyserNode — the mouth has to be faked from the text.
 * Audio bytes coming back from here can be decoded, analysed and used to drive
 * the jaw from actual amplitude.
 *
 * When no speech model is configured the route returns 204 rather than an
 * error, which the client reads as "fall back to browser speech".
 */
export async function POST(request: Request) {
  if (!hasSpeech()) {
    return new Response(null, {
      status: 204,
      headers: { 'X-Mirai-Speech': 'unavailable' },
    });
  }

  const limit = rateLimit(
    clientKey(request, 'speech'),
    env.rateLimitRequests,
    env.rateLimitWindowSeconds,
  );
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  const parsed = speechRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Directives are stripped client-side before display, but never trust that:
  // an un-stripped marker would be read aloud as "bracket bracket joy".
  const text = stripDirectives(parsed.data.text).trim();
  if (!text) {
    return new Response(null, { status: 204 });
  }

  try {
    const result = await generateSpeech({
      model: gateway.speech(env.speechModel),
      text,
      voice: parsed.data.voice || env.speechVoice,
      speed: parsed.data.speed,
      abortSignal: request.signal,
    });

    const audio = result.audio;
    return new Response(audio.uint8Array as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': audio.mediaType || 'audio/mpeg',
        'Cache-Control': 'no-store',
        ...rateLimitHeaders(limit),
      },
    });
  } catch (error) {
    console.error('[mirai:speech]', error);
    // 204 rather than 5xx: a voice failure should downgrade to browser speech,
    // not surface as a broken app.
    return new Response(null, {
      status: 204,
      headers: { 'X-Mirai-Speech': 'failed' },
    });
  }
}
