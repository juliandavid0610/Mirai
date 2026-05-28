import 'server-only';

/**
 * Server-side environment access.
 *
 * Mirai is designed to boot with zero configuration, so nothing here throws on
 * a missing value. Instead each getter reports whether the capability it backs
 * is available, and the API routes degrade to a local fallback when it is not.
 */

function str(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(str(name), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  gatewayApiKey: str('AI_GATEWAY_API_KEY'),
  defaultModel: str('MIRAI_DEFAULT_MODEL', 'anthropic/claude-sonnet-5'),
  speechModel: str('MIRAI_SPEECH_MODEL', 'openai/tts-1-hd'),
  speechVoice: str('MIRAI_SPEECH_VOICE', 'nova'),
  transcribeModel: str('MIRAI_TRANSCRIBE_MODEL', 'openai/whisper-1'),
  rateLimitRequests: int('MIRAI_RATE_LIMIT_REQUESTS', 30),
  rateLimitWindowSeconds: int('MIRAI_RATE_LIMIT_WINDOW_SECONDS', 60),
  siteUrl: str('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000'),
} as const;

/**
 * True when a Gateway key is present. Every model-backed route checks this
 * first and falls back to a keyless experience rather than returning a 500.
 */
export function hasGateway(): boolean {
  return env.gatewayApiKey.length > 0;
}

export function hasSpeech(): boolean {
  return hasGateway() && env.speechModel.length > 0;
}

export function hasTranscription(): boolean {
  return hasGateway() && env.transcribeModel.length > 0;
}
