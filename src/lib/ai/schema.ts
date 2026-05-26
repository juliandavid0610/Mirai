import { z } from 'zod';
import { EMOTIONS } from '@/types/emotion';
import type { Persona } from '@/types/persona';

/**
 * Request validation for the public routes.
 *
 * Personas are editable in the UI and sent inline with each request, which
 * means the system prompt is partly attacker-controlled on a public deploy.
 * The limits below are the containment: bounded lengths, bounded array sizes,
 * and no way to smuggle in a different model id. Worst case a caller gives
 * themselves a weird chatbot on their own screen.
 */

export const personaSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  summary: z.string().max(240).default(''),
  glyph: z.string().max(8).default('✦'),
  brief: z.string().max(4000),
  style: z.array(z.string().max(280)).max(20).default([]),
  boundaries: z.array(z.string().max(280)).max(20).default([]),
  greeting: z.string().max(600).default(''),
  baseEmotion: z.enum(EMOTIONS).default('neutral'),
  expressiveness: z.number().min(0).max(1).default(0.8),
  temperature: z.number().min(0).max(2).default(0.8),
  voice: z.string().max(32).default('nova'),
  builtIn: z.boolean().default(false),
});

export const chatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(200),
  modelId: z.string().max(120).optional(),
  personaId: z.string().max(64).optional(),
  persona: personaSchema.optional(),
  memory: z.array(z.string().max(400)).max(40).optional(),
  localTime: z.string().max(64).optional(),
});

export const speechRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().max(32).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

export type ValidatedPersona = z.infer<typeof personaSchema>;

/** Narrows a validated payload to the app's `Persona` type. */
export function toPersona(value: ValidatedPersona): Persona {
  return value as Persona;
}
