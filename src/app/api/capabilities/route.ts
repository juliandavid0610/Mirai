import { CHAT_MODELS, DEFAULT_MODEL_ID } from '@/lib/ai/models';
import { env, hasGateway, hasSpeech, hasTranscription } from '@/lib/env';

/**
 * What this deployment can actually do.
 *
 * The client boots against this instead of guessing. It is why the UI can
 * honestly say "Rehearsal Mode" instead of letting someone send three messages
 * into a void before working out that no key is configured.
 */
export async function GET() {
  return Response.json(
    {
      chat: hasGateway(),
      speech: hasSpeech(),
      transcription: hasTranscription(),
      defaultModel: hasGateway() ? env.defaultModel : DEFAULT_MODEL_ID,
      models: CHAT_MODELS.map(({ id, label, vendor, note, speed }) => ({
        id,
        label,
        vendor,
        note,
        speed,
      })),
    },
    {
      headers: {
        // Capabilities only change on redeploy, but a short TTL keeps a
        // freshly added key from needing a hard refresh to show up.
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
      },
    },
  );
}
