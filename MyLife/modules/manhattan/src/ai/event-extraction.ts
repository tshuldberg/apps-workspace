/**
 * Opt-in AI event extraction from shared text (share-sheet intent).
 *
 * This is OFF BY DEFAULT. It returns null whenever the user has not
 * configured and consented to an LLM provider, and is never required for
 * any core flow. Core ingestion (NYC Open Data, SeatGeek, ICS import) works
 * with this module absent entirely.
 *
 * WHY the extracted event rides inside the insight `description` field:
 * the shared LLM transport in @mylife/intelligence hardcodes an insights
 * json_schema (title/description/modules) on the OpenAI Responses request
 * and parses every provider response into LLMInsight[]. We cannot change
 * that response shape per call. So we instruct the model to emit the event
 * as a JSON object stringified into `description`, then JSON.parse it back
 * out here. This keeps event extraction additive and avoids forking the
 * transport's schema.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { LLMFetchFn, LLMInsight } from '@mylife/intelligence';
import { isLLMConfigured, getLLMConfig, queryLLM } from '@mylife/intelligence';
import { z } from 'zod';
import type { NormalizedEvent } from '../sources/types';

/**
 * Zod schema for the model-emitted event. Title is required; everything else
 * is optional and conservative. Unknown keys are stripped.
 */
export const ExtractedEventSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    venueName: z.string().optional(),
    address: z.string().optional(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    allDay: z.boolean().optional(),
    category: z.string().optional(),
    priceMin: z.number().optional(),
    priceMax: z.number().optional(),
    isFree: z.boolean().optional(),
    imageUrl: z.string().optional(),
    purchaseUrl: z.string().optional(),
  })
  .strip();

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

/**
 * Extract a NormalizedEvent from arbitrary shared text using the configured
 * LLM. Returns null when AI is not configured/consented, when the model
 * yields nothing usable, or on any thrown / malformed response. Never throws.
 */
export async function extractEventFromShare(
  db: DatabaseAdapter,
  text: string,
  fetchFn: LLMFetchFn,
): Promise<NormalizedEvent | null> {
  if (!isLLMConfigured(db)) return null;
  const cfg = getLLMConfig(db);
  if (!cfg) return null;

  const prompt = buildEventExtractionPrompt(text);
  try {
    const result = await queryLLM(prompt, cfg.apiKey, cfg.provider, fetchFn, {
      maxTokens: 512,
    });
    return parseExtractionInsights(result.insights);
  } catch {
    return null;
  }
}

/**
 * Build the extraction prompt. Instructs the model to return the event as a
 * JSON object embedded (stringified) in the insight `description`, since the
 * transport enforces the insights json_schema. Asks for ISO 8601 dates and
 * conservative extraction (omit fields rather than guess).
 */
export function buildEventExtractionPrompt(text: string): string {
  return [
    'You extract a single real-world event from shared text (a webpage, message, or post).',
    'Return exactly one insight.',
    'Set the insight "title" to the event title.',
    'Set "modules" to ["manhattan"].',
    'Set the insight "description" to a JSON object string with these keys when present:',
    'title (required, string), description, venueName, address, startAt, endAt,',
    'allDay (boolean), category, priceMin (number), priceMax (number), isFree (boolean),',
    'imageUrl, purchaseUrl.',
    'Use ISO 8601 for startAt and endAt (for example 2026-07-01T20:00:00).',
    'Be conservative: omit any field you are not confident about rather than guessing.',
    'If the text does not describe a real event, set title to an empty string.',
    'The "description" MUST be valid JSON parseable by JSON.parse.',
    '',
    'Shared text:',
    text,
  ].join('\n');
}

/**
 * Parse extraction insights into a NormalizedEvent.
 *
 * Takes the first insight, attempts to JSON.parse its `description` into the
 * event fields and validate via ExtractedEventSchema. If the description is
 * not JSON (or fails validation), falls back to a title-only event using the
 * insight's `title` when non-empty. Returns null when nothing usable remains.
 */
export function parseExtractionInsights(insights: LLMInsight[]): NormalizedEvent | null {
  const insight = insights[0];
  if (!insight) return null;

  let parsedObject: unknown;
  try {
    parsedObject = JSON.parse(insight.description);
  } catch {
    parsedObject = undefined;
  }

  if (parsedObject && typeof parsedObject === 'object') {
    const validated = ExtractedEventSchema.safeParse(parsedObject);
    if (validated.success) {
      return { sourceId: 'share_intent', ...validated.data };
    }
  }

  const title = insight.title.trim();
  if (title.length > 0) {
    return { sourceId: 'share_intent', title };
  }

  return null;
}
