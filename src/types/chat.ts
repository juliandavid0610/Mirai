import type { UIMessage } from 'ai';
import type { Emotion } from './emotion';

/** Metadata Mirai attaches to assistant messages. */
export interface MiraiMessageMetadata {
  createdAt?: number;
  model?: string;
  /** Dominant emotion detected for the finished message. */
  emotion?: Emotion;
  /** Wall-clock milliseconds the generation took. */
  durationMs?: number;
  /** Present when the reply came from the keyless fallback. */
  rehearsal?: boolean;
}

export type MiraiUIMessage = UIMessage<MiraiMessageMetadata>;

/** Request body accepted by `POST /api/chat`. */
export interface ChatRequestBody {
  messages: MiraiUIMessage[];
  modelId?: string;
  personaId?: string;
  /** A persona sent inline, so custom personas work without server storage. */
  persona?: unknown;
  memory?: string[];
}

export interface ChatModelOption {
  id: string;
  label: string;
  vendor: 'Anthropic' | 'OpenAI' | 'Google';
  /** Short note about when to pick this model. */
  note: string;
  /** Rough relative latency, used to sort and to render the speed pips. */
  speed: 1 | 2 | 3;
}
