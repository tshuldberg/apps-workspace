/**
 * BestChef provider broker client.
 *
 * Routes user-initiated provider calls (vision OCR, food recognition,
 * nutrition lookup, product identity) through Supabase Edge Functions
 * so that third-party API keys never enter the public-launch app bundle.
 *
 * The Edge Function endpoints live at:
 *   - bestchef-vision           (Anthropic vision: food, expiration, recipe, receipt OCR)
 *   - bestchef-nutrition        (USDA FDC + Open Food Facts nutrition)
 *   - bestchef-product-identity (GS1 + Open Food Facts barcode resolution)
 *
 * Each call returns a discriminated union; callers pattern-match on
 * `result.ok` and `result.errorKind` and never need direct `fetch`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { parseEdgeFunctionError } from './edge-errors';

export type BrokerVisionTask =
  | 'food_recognition'
  | 'expiration_ocr'
  | 'recipe_extract_text'
  | 'recipe_extract_image'
  | 'receipt_ocr';

export type BrokerNutritionSource = 'usda_fdc' | 'open_food_facts';

export type BrokerProductIdentitySource = 'gs1' | 'open_food_facts';

export type BrokerErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'provider_outage'
  | 'invalid_input'
  | 'unknown';

export interface BrokerOk<T> {
  ok: true;
  provider: string;
  source: string;
  confidence: number | null;
  data: T;
}

export interface BrokerErr {
  ok: false;
  errorKind: BrokerErrorKind;
  message: string;
  provider: string | null;
}

export type BrokerResult<T> = BrokerOk<T> | BrokerErr;

export interface BrokerVisionRequest {
  task: BrokerVisionTask;
  imageBase64?: string;
  photoMime?: string;
  text?: string;
  context?: { sourceUrl?: string; author?: string };
}

export interface BrokerVisionResponse {
  rawText: string;
}

export interface BrokerNutritionRequest {
  source: BrokerNutritionSource;
  barcode?: string | null;
  query?: string | null;
  brand?: string | null;
}

export interface BrokerNutritionCandidate {
  source: BrokerNutritionSource;
  source_id: string;
  source_url: string | null;
  barcode: string | null;
  product_name: string | null;
  brand: string | null;
  serving_size_text: string | null;
  serving_basis: 'per_100g' | 'per_item' | 'per_serving';
  serving_quantity: number;
  serving_unit: string;
  nutrients: {
    calories: number | null;
    fat_g: number | null;
    saturated_fat_g: number | null;
    carbs_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    protein_g: number | null;
    sodium_mg: number | null;
  };
  confidence: number;
  quality_flags?: string[];
}

export interface BrokerNutritionResponse {
  candidates: BrokerNutritionCandidate[];
  status: { code: 'ok' | 'skipped' | 'not_configured' | 'error' | 'rate_limited'; message: string };
}

export interface BrokerProductIdentityRequest {
  source: BrokerProductIdentitySource;
  barcode: string;
}

export interface BrokerProductIdentityResponse {
  product: {
    barcode: string;
    product_name: string | null;
    brand: string | null;
    category: string | null;
    image_url: string | null;
  } | null;
  status: { code: 'ok' | 'skipped' | 'not_configured' | 'not_found' | 'error'; message: string };
}

interface FunctionsInvokeError {
  name?: string;
  message?: string;
  context?: { status?: number };
}

interface BrokerEnvelope<T> {
  ok: boolean;
  provider?: string;
  source?: string;
  confidence?: number | null;
  data?: T;
  error?: { kind: BrokerErrorKind; message: string };
}

function brokerKindFromBodyKind(kind: string | null): BrokerErrorKind | null {
  switch (kind) {
    case 'auth':
      return 'auth';
    case 'rate_limit':
    case 'rate_limited':
      return 'rate_limit';
    case 'invalid_input':
      return 'invalid_input';
    case 'provider_outage':
    case 'config':
      return 'provider_outage';
    case 'unknown':
      return 'unknown';
    default:
      return null;
  }
}

/**
 * Non-2xx invoke errors hide the function's `{ error: { kind } }` body
 * behind error.context; read it first (plan 33 Phase 2.2) and only fall
 * back to status-code classification when the body is unreadable.
 */
async function classifyInvokeError(error: FunctionsInvokeError): Promise<BrokerErr> {
  const message = error.message ?? 'Provider broker invocation failed.';
  const parsed = await parseEdgeFunctionError(error);
  const bodyKind = brokerKindFromBodyKind(parsed.kind);
  if (bodyKind) {
    // Keep the generic invoke message: the body message is ops detail (for
    // 'config' it can contain raw internal exception text) and broker
    // consumers surface BrokerErr.message in UI-visible errors.
    return { ok: false, errorKind: bodyKind, message, provider: null };
  }

  const status = parsed.status ?? error.context?.status;
  if (status === 401 || status === 403) {
    return { ok: false, errorKind: 'auth', message, provider: null };
  }
  if (status === 429) {
    return { ok: false, errorKind: 'rate_limit', message, provider: null };
  }
  if (status === 400 || status === 422) {
    return { ok: false, errorKind: 'invalid_input', message, provider: null };
  }
  if (status && status >= 500 && status < 600) {
    return { ok: false, errorKind: 'provider_outage', message, provider: null };
  }
  return { ok: false, errorKind: 'unknown', message, provider: null };
}

async function callBroker<T>(
  supabase: SupabaseClient,
  fn: 'bestchef-vision' | 'bestchef-nutrition' | 'bestchef-product-identity',
  body: Record<string, unknown>,
): Promise<BrokerResult<T>> {
  let raw: { data: BrokerEnvelope<T> | null; error: FunctionsInvokeError | null };
  try {
    raw = await supabase.functions.invoke<BrokerEnvelope<T>>(fn, { body });
  } catch (err) {
    return {
      ok: false,
      errorKind: 'unknown',
      message: err instanceof Error ? err.message : String(err),
      provider: null,
    };
  }

  if (raw.error) {
    return await classifyInvokeError(raw.error);
  }

  const envelope = raw.data;
  if (!envelope) {
    return {
      ok: false,
      errorKind: 'unknown',
      message: 'Provider broker returned no payload.',
      provider: null,
    };
  }

  if (envelope.ok && envelope.data !== undefined) {
    return {
      ok: true,
      provider: envelope.provider ?? fn,
      source: envelope.source ?? fn,
      confidence: envelope.confidence ?? null,
      data: envelope.data,
    };
  }

  return {
    ok: false,
    errorKind: envelope.error?.kind ?? 'unknown',
    message: envelope.error?.message ?? 'Provider broker reported an error.',
    provider: envelope.provider ?? null,
  };
}

export function callVisionBroker(
  supabase: SupabaseClient,
  request: BrokerVisionRequest,
): Promise<BrokerResult<BrokerVisionResponse>> {
  return callBroker<BrokerVisionResponse>(
    supabase,
    'bestchef-vision',
    { ...request },
  );
}

export function callNutritionBroker(
  supabase: SupabaseClient,
  request: BrokerNutritionRequest,
): Promise<BrokerResult<BrokerNutritionResponse>> {
  return callBroker<BrokerNutritionResponse>(
    supabase,
    'bestchef-nutrition',
    { ...request },
  );
}

export function callProductIdentityBroker(
  supabase: SupabaseClient,
  request: BrokerProductIdentityRequest,
): Promise<BrokerResult<BrokerProductIdentityResponse>> {
  return callBroker<BrokerProductIdentityResponse>(
    supabase,
    'bestchef-product-identity',
    { ...request },
  );
}
