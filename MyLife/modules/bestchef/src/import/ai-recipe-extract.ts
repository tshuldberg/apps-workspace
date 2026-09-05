/**
 * AI-powered recipe extraction using Claude API.
 * Extracts structured recipe data from text (social media captions) and images (cookbook photos).
 * Follows the same API call pattern as pantry/food-recognition.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedRecipe, ReceiptOcrProvider } from '../types';
import { callVisionBroker } from '../cloud/provider-broker';

const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const TEXT_PROMPT = `Extract the recipe from this text. If this is not a recipe or does not contain enough information for a recipe, respond with {"error": "not_a_recipe"}.
Otherwise respond with ONLY a JSON object (no markdown, no code fences):
{"title": "recipe name", "description": "brief description", "prep_time_min": number_or_null, "cook_time_min": number_or_null, "servings": number_or_null, "ingredients": ["ingredient line 1", "ingredient line 2"], "steps": ["step 1", "step 2"]}`;

const IMAGE_PROMPT = `Extract the recipe from this photo. The photo may show a cookbook page, recipe card, printed recipe, handwritten recipe, or screenshot of a recipe.
If no recipe is visible, respond with {"error": "no_recipe_found"}.
Otherwise respond with ONLY a JSON object (no markdown, no code fences):
{"title": "recipe name", "description": "brief description", "prep_time_min": number_or_null, "cook_time_min": number_or_null, "servings": number_or_null, "ingredients": ["ingredient line 1", "ingredient line 2"], "steps": ["step 1", "step 2"]}`;

const RECEIPT_OCR_PROMPT = `Transcribe this grocery receipt as plain text. Preserve the merchant, date, totals, and each visible line item on separate lines. Do not infer missing products, prices, or quantities. Return only plain text, no markdown.`;

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}

interface RecipeJson {
  title?: string;
  description?: string;
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  servings?: number | null;
  ingredients?: string[];
  steps?: string[];
  error?: string;
}

/**
 * Extract a structured recipe from text (e.g., social media caption, pasted text).
 * Returns null if the text doesn't contain a recipe or parsing fails.
 */
export async function extractRecipeFromText(
  text: string,
  apiKey: string,
  context?: { sourceUrl?: string; author?: string },
): Promise<ParsedRecipe | null> {
  if (!apiKey || !text.trim()) return null;

  const contextLine = context?.author
    ? `\nSource: ${context.author}${context.sourceUrl ? ` (${context.sourceUrl})` : ''}`
    : '';

  try {
    const response = await callClaude(apiKey, [
      { type: 'text', text: `${TEXT_PROMPT}${contextLine}\n\nText to extract from:\n${text}` },
    ]);

    return parseRecipeResponse(response);
  } catch {
    return null;
  }
}

/**
 * Extract a structured recipe from a photo (e.g., cookbook page, recipe card).
 * Returns null if no recipe is found or parsing fails.
 */
export async function extractRecipeFromImage(
  imageBase64: string,
  apiKey: string,
): Promise<ParsedRecipe | null> {
  if (!apiKey || !imageBase64) return null;

  try {
    const response = await callClaude(apiKey, [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      },
      { type: 'text', text: IMAGE_PROMPT },
    ]);

    return parseRecipeResponse(response);
  } catch {
    return null;
  }
}

/**
 * Extract a recipe from text via the BestChef vision broker.
 * Public-launch builds must use this path; no API key reaches the Expo
 * bundle.
 */
export async function extractRecipeFromTextViaBroker(
  supabase: SupabaseClient,
  text: string,
  context?: { sourceUrl?: string; author?: string },
): Promise<ParsedRecipe | null> {
  if (!text.trim()) return null;
  const result = await callVisionBroker(supabase, {
    task: 'recipe_extract_text',
    text,
    context,
  });
  if (!result.ok) return null;
  return parseRecipeResponse(result.data.rawText);
}

/**
 * Extract a recipe from an image via the BestChef vision broker.
 */
export async function extractRecipeFromImageViaBroker(
  supabase: SupabaseClient,
  imageBase64: string,
  photoMime = 'image/jpeg',
): Promise<ParsedRecipe | null> {
  if (!imageBase64) return null;
  const result = await callVisionBroker(supabase, {
    task: 'recipe_extract_image',
    imageBase64,
    photoMime,
  });
  if (!result.ok) return null;
  return parseRecipeResponse(result.data.rawText);
}

/**
 * Receipt OCR provider backed by the BestChef vision broker. Public
 * launch builds must use this factory; the BYO Claude variant is
 * internal-beta only.
 */
export function createBrokerReceiptOcrProvider(
  supabase: SupabaseClient,
): ReceiptOcrProvider {
  return {
    id: 'bestchef-vision-broker',
    async recognize(input) {
      if (!input.imageBase64) {
        throw new Error('Receipt OCR broker requires an image.');
      }
      const result = await callVisionBroker(supabase, {
        task: 'receipt_ocr',
        imageBase64: input.imageBase64,
        photoMime: input.photoMime ?? 'image/jpeg',
      });
      if (!result.ok) {
        throw new Error(result.message);
      }
      const rawText = result.data.rawText.trim();
      return { rawText, confidence: rawText.length > 0 ? 0.72 : 0 };
    },
  };
}

/**
 * INTERNAL-BETA ONLY. Public launch builds must call
 * `createBrokerReceiptOcrProvider` so the Anthropic key stays server-side.
 */
export function createClaudeReceiptOcrProvider(apiKey: string): ReceiptOcrProvider {
  return {
    id: 'claude-vision',
    async recognize(input) {
      if (!apiKey || !input.imageBase64) {
        throw new Error('Receipt OCR provider is not configured.');
      }

      const rawText = await callClaude(apiKey, [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: input.photoMime ?? 'image/jpeg',
            data: input.imageBase64,
          },
        },
        { type: 'text', text: RECEIPT_OCR_PROMPT },
      ]);

      return {
        rawText: rawText.trim(),
        confidence: rawText.trim().length > 0 ? 0.72 : 0,
      };
    },
  };
}

/** Make a Claude API call with the given content blocks. */
async function callClaude(
  apiKey: string,
  content: Array<Record<string, unknown>>,
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API returned ${response.status}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  return data?.content?.[0]?.text ?? '';
}

/** Parse Claude's JSON response into a ParsedRecipe. */
function parseRecipeResponse(responseText: string): ParsedRecipe | null {
  // Strip any markdown code fences Claude might add despite instructions
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as RecipeJson;

    if (parsed.error) return null;
    if (!parsed.title) return null;

    return {
      title: parsed.title,
      description: parsed.description,
      prep_time_min: toPositiveInt(parsed.prep_time_min),
      cook_time_min: toPositiveInt(parsed.cook_time_min),
      servings: toPositiveInt(parsed.servings),
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.filter(Boolean) : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

function toPositiveInt(val: unknown): number | undefined {
  if (typeof val === 'number' && val > 0 && Number.isFinite(val)) {
    return Math.round(val);
  }
  return undefined;
}
