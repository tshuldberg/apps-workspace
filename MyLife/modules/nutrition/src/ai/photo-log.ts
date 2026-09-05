import type { AIFoodEstimate, PhotoAnalysisResult, PhotoAnalysisError } from './types';
import { FOOD_IDENTIFICATION_SYSTEM_PROMPT, buildUserPrompt } from './prompts';

/**
 * Analyze a meal photo using Claude Vision API to identify foods and estimate macros.
 *
 * Returns AIFoodEstimate[] for user confirmation/editing before logging.
 * The user should review and adjust estimates before committing to the food log.
 */
export async function analyzePhotoForFoods(
  imageBase64: string,
  apiKey: string,
  context?: string,
): Promise<PhotoAnalysisResult | PhotoAnalysisError> {
  if (!apiKey) {
    return { type: 'no_api_key', message: 'Claude API key not configured. Set it in Settings > API Keys.' };
  }

  if (!imageBase64 || imageBase64.length < 100) {
    return { type: 'invalid_image', message: 'Invalid or empty image data.' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: FOOD_IDENTIFICATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: buildUserPrompt(context),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { type: 'network', message: `API returned ${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const textContent = data.content.find((c) => c.type === 'text');
    const rawResponse = textContent?.text || '[]';

    // Parse the JSON array of food estimates
    let foods: AIFoodEstimate[];
    try {
      const parsed = JSON.parse(rawResponse);
      if (!Array.isArray(parsed)) {
        return { type: 'no_food_detected', message: 'AI response was not a food array.' };
      }
      foods = parsed.map((item: Record<string, unknown>) => ({
        name: String(item.name || 'Unknown'),
        servingSize: String(item.servingSize || '100'),
        servingUnit: String(item.servingUnit || 'g'),
        calories: Number(item.calories) || 0,
        proteinG: Number(item.proteinG || item.protein_g) || 0,
        carbsG: Number(item.carbsG || item.carbs_g) || 0,
        fatG: Number(item.fatG || item.fat_g) || 0,
        confidence: (['high', 'medium', 'low'].includes(String(item.confidence)) ? String(item.confidence) : 'medium') as 'high' | 'medium' | 'low',
      }));
    } catch {
      return { type: 'no_food_detected', message: 'Failed to parse AI response as food data.' };
    }

    if (foods.length === 0) {
      return { type: 'no_food_detected', message: 'No food detected in the image.' };
    }

    return {
      foods,
      rawResponse,
      imageUri: '',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error';
    return { type: 'network', message };
  }
}

/** Type guard to check if a result is an error. */
export function isPhotoAnalysisError(
  result: PhotoAnalysisResult | PhotoAnalysisError,
): result is PhotoAnalysisError {
  return 'type' in result && 'message' in result && !('foods' in result);
}
