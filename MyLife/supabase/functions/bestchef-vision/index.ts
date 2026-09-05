/**
 * BestChef vision broker Edge Function.
 *
 * Accepts an authenticated request from the BestChef app and forwards
 * the image/text task to Anthropic's vision API using a server-side
 * `ANTHROPIC_API_KEY`. Receipt OCR responses are redacted before they
 * leave the function.
 *
 * Tests live alongside this file at `__tests__/index.test.ts`. They
 * import `handleVisionRequest` directly and stub the `BrokerDeps`.
 */

import {
  classifyUpstreamStatus,
  createInMemoryRateLimiter,
  createServiceQuotaCheck,
  envelopeError,
  envelopeOk,
  getUserIdFromAuth,
  isAnonymousAuth,
  isProviderKillSwitchEnabled,
  redactPaymentText,
  type BrokerDeps,
} from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const VISION_MODEL = 'claude-haiku-4-5-20251001';
const VISION_RATE_LIMIT = { max: 30, windowMs: 60_000 };
/** Anonymous sessions are free to mint; give them a third of the window. */
const VISION_ANON_MAX = 10;

const PROMPTS: Record<string, string> = {
  food_recognition:
    'Identify all grocery or pantry food items visible in this image. Return ONLY JSON, no markdown. Shape: {"candidates":[{"name":"specific food name","brand":null_or_string,"category":"one of produce,dairy,meat,pantry,frozen,bakery,beverages,snacks,condiments,other","storage_location":"one of fridge,freezer,pantry,counter,other","confidence":0.0-1.0,"labels":["visible label or package text"],"quantity":number_or_null,"unit":null_or_string,"notes":null_or_string,"bounding_box":{"x":0.0,"y":0.0,"width":0.0,"height":0.0}_or_null}],"labels":["all visible food/package words"]}.',
  expiration_ocr:
    'Transcribe the visible expiration, best-by, sell-by, use-by, packed-on, batch, and lot text in this grocery or pantry photo. Return plain text only. Do not infer a date that is not visible.',
  recipe_extract_text:
    'Extract the recipe from this text. If this is not a recipe, respond with {"error":"not_a_recipe"}. Otherwise respond with ONLY a JSON object: {"title": "recipe name", "description": "brief description", "prep_time_min": number_or_null, "cook_time_min": number_or_null, "servings": number_or_null, "ingredients": ["..."], "steps": ["..."]}.',
  recipe_extract_image:
    'Extract the recipe from this photo. If no recipe is visible, respond with {"error":"no_recipe_found"}. Otherwise respond with ONLY a JSON object: {"title": "recipe name", "description": "brief description", "prep_time_min": number_or_null, "cook_time_min": number_or_null, "servings": number_or_null, "ingredients": ["..."], "steps": ["..."]}.',
  receipt_ocr:
    'Transcribe this grocery receipt as plain text. Preserve the merchant, date, totals, and each visible line item on separate lines. Do not infer missing products, prices, or quantities. Return only plain text, no markdown.',
};

interface VisionRequestBody {
  task?: string;
  imageBase64?: string;
  photoMime?: string;
  text?: string;
  context?: { sourceUrl?: string; author?: string };
}

function buildContent(body: VisionRequestBody): Array<Record<string, unknown>> | null {
  const prompt = PROMPTS[body.task ?? ''];
  if (!prompt) return null;

  const blocks: Array<Record<string, unknown>> = [];

  if (body.imageBase64) {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: body.photoMime ?? 'image/jpeg',
        data: body.imageBase64,
      },
    });
  }

  let textPrompt = prompt;
  if (body.task === 'recipe_extract_text') {
    if (!body.text || !body.text.trim()) return null;
    const contextLine = body.context?.author
      ? `\nSource: ${body.context.author}${body.context.sourceUrl ? ` (${body.context.sourceUrl})` : ''}`
      : '';
    textPrompt = `${prompt}${contextLine}\n\nText to extract from:\n${body.text}`;
  } else if (!body.imageBase64) {
    return null;
  }

  blocks.push({ type: 'text', text: textPrompt });
  return blocks;
}

export async function handleVisionRequest(
  req: Request,
  deps: BrokerDeps,
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  if (!userId) {
    return envelopeError('auth', 'Missing or invalid Authorization header.', 401);
  }
  if (isProviderKillSwitchEnabled(deps.env)) {
    return envelopeError('provider_outage', 'Vision broker is temporarily disabled.', 503, 'anthropic');
  }
  const visionMax = isAnonymousAuth(authHeader) ? VISION_ANON_MAX : VISION_RATE_LIMIT.max;
  if (!deps.rateLimit.consume(userId, 'vision', visionMax, VISION_RATE_LIMIT.windowMs)) {
    return envelopeError('rate_limit', 'Vision broker rate limit exceeded.', 429);
  }
  const quota = await deps.quota(userId, 'vision', visionMax, VISION_RATE_LIMIT.windowMs);
  if (!quota.allowed) {
    if (quota.reason === 'user_rate_limit' || quota.reason === 'global_daily_cap') {
      return envelopeError('rate_limit', 'Vision broker quota exceeded.', 429);
    }
    return envelopeError('provider_outage', 'Vision broker is temporarily unavailable.', 503, 'anthropic');
  }

  let body: VisionRequestBody;
  try {
    body = (await req.json()) as VisionRequestBody;
  } catch {
    return envelopeError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const content = buildContent(body);
  if (!content) {
    return envelopeError('invalid_input', 'Unsupported vision task or missing inputs.', 400);
  }

  const apiKey = deps.env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return envelopeError(
      'provider_outage',
      'Vision provider is not configured for this environment.',
      503,
      'anthropic',
    );
  }

  let upstream: Response;
  try {
    upstream = await deps.fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: body.task === 'recipe_extract_image' || body.task === 'recipe_extract_text' ? 1024 : 768,
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (err) {
    return envelopeError(
      'provider_outage',
      err instanceof Error ? err.message : 'Vision provider unreachable.',
      503,
      'anthropic',
    );
  }

  if (!upstream.ok) {
    const failure = classifyUpstreamStatus(upstream.status);
    return envelopeError(failure.errorKind, failure.message, failure.status, 'anthropic');
  }

  const upstreamData = (await upstream.json().catch(() => null)) as
    | { content?: Array<{ text?: string }> }
    | null;
  const text = upstreamData?.content?.[0]?.text ?? '';
  const finalText = body.task === 'receipt_ocr' ? redactPaymentText(text) : text;

  return envelopeOk({
    provider: 'anthropic',
    source: VISION_MODEL,
    confidence: text ? 0.78 : 0,
    data: { rawText: finalText },
  });
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const rateLimit = createInMemoryRateLimiter();
  const denoEnv = Deno.env;
  const env = (key: string) => denoEnv.get(key);
  const quota = createServiceQuotaCheck(env, fetch);
  Deno.serve((req) =>
    handleVisionRequest(req, {
      env,
      fetch,
      now: () => Date.now(),
      rateLimit,
      quota,
    }),
  );
}
