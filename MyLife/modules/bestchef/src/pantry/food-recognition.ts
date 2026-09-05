import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FoodRecognitionCandidate,
  FoodRecognitionBoundingBox,
  FoodRecognitionResult,
  GrocerySection,
  NutritionBreakdown,
  NutritionCandidate,
  NutritionProviderAdapter,
  StorageLocation,
} from '../types';
import { getNutritionSourceDisplayData, resolveNutritionCandidates } from '../db/nutrition';
import { callVisionBroker } from '../cloud/provider-broker';

export type { FoodRecognitionCandidate, FoodRecognitionResult } from '../types';

const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const GROCERY_SECTIONS: GrocerySection[] = [
  'produce',
  'dairy',
  'meat',
  'pantry',
  'frozen',
  'bakery',
  'beverages',
  'snacks',
  'condiments',
  'other',
];

const DEFAULT_STORAGE_BY_SECTION: Record<GrocerySection, StorageLocation> = {
  produce: 'fridge',
  dairy: 'fridge',
  meat: 'fridge',
  pantry: 'pantry',
  frozen: 'freezer',
  bakery: 'counter',
  beverages: 'pantry',
  snacks: 'pantry',
  condiments: 'fridge',
  other: 'pantry',
};

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}

interface RawFoodCandidate {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  category?: unknown;
  grocery_section?: unknown;
  storage_location?: unknown;
  confidence?: unknown;
  labels?: unknown;
  quantity?: unknown;
  unit?: unknown;
  notes?: unknown;
  barcode?: unknown;
  gtin?: unknown;
  upc?: unknown;
  bounding_box?: unknown;
  boundingBox?: unknown;
  box?: unknown;
  crop_uri?: unknown;
  cropUri?: unknown;
  image_crop_uri?: unknown;
}

export interface FoodRecognitionEnrichmentOptions {
  providers?: NutritionProviderAdapter[];
  includeNetwork?: boolean;
  fetchedAt?: string;
}

function emptyResult(rawText?: string | null): FoodRecognitionResult {
  return {
    suggestedName: null,
    suggestedCategory: null,
    confidence: 0,
    labels: [],
    candidates: [],
    rawText: rawText ?? null,
  };
}

function clampConfidence(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function normalizeSection(value: unknown): GrocerySection {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return GROCERY_SECTIONS.includes(normalized as GrocerySection)
    ? normalized as GrocerySection
    : 'other';
}

function normalizeStorageLocation(value: unknown, section: GrocerySection): StorageLocation {
  if (typeof value !== 'string') return DEFAULT_STORAGE_BY_SECTION[section];
  const normalized = value.trim().toLowerCase();
  if (normalized === 'fridge' || normalized === 'freezer' || normalized === 'pantry' || normalized === 'counter' || normalized === 'other') {
    return normalized;
  }
  return DEFAULT_STORAGE_BY_SECTION[section];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBarcode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).replace(/\D+/g, '');
  return normalized.length >= 8 && normalized.length <= 14 ? normalized : null;
}

function barcodeFromLabels(labels: string[]): string | null {
  for (const label of labels) {
    const match = label.match(/\b\d{8,14}\b/);
    if (match) return match[0] ?? null;
  }
  return null;
}

function nullableQuantity(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function normalizedNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
  }
  return null;
}

function normalizeBoundingBox(value: unknown): FoodRecognitionBoundingBox | null {
  if (!value || typeof value !== 'object') return null;
  const box = value as Record<string, unknown>;
  const x = normalizedNumber(box.x ?? box.left);
  const y = normalizedNumber(box.y ?? box.top);
  const width = normalizedNumber(box.width ?? box.w);
  const height = normalizedNumber(box.height ?? box.h);
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function candidateId(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `food-photo-${slug || 'candidate'}-${index + 1}`;
}

function toCandidate(raw: RawFoodCandidate, index: number): FoodRecognitionCandidate | null {
  const name = nullableString(raw.name);
  if (!name) return null;
  const section = normalizeSection(raw.grocery_section ?? raw.category);
  const confidence = clampConfidence(raw.confidence, 0.58);
  const labels = Array.from(new Set([name, ...stringList(raw.labels)]));
  return {
    id: nullableString(raw.id) ?? candidateId(name, index),
    name,
    brand: nullableString(raw.brand),
    barcode: normalizeBarcode(raw.barcode ?? raw.gtin ?? raw.upc) ?? barcodeFromLabels(labels),
    bounding_box: normalizeBoundingBox(raw.bounding_box ?? raw.boundingBox ?? raw.box),
    crop_uri: nullableString(raw.crop_uri ?? raw.cropUri ?? raw.image_crop_uri),
    grocery_section: section,
    storage_location: normalizeStorageLocation(raw.storage_location, section),
    confidence,
    labels,
    quantity: nullableQuantity(raw.quantity),
    unit: nullableString(raw.unit),
    notes: nullableString(raw.notes),
    product_id: null,
    nutrition_data_id: null,
    nutrition_candidates: [],
    nutrition_provider_statuses: [],
  };
}

function emptyNutrients(): NutritionBreakdown {
  return {
    calories: null,
    fat_g: null,
    saturated_fat_g: null,
    carbs_g: null,
    fiber_g: null,
    sugar_g: null,
    protein_g: null,
    sodium_mg: null,
  };
}

function unknownNutritionCandidate(candidate: FoodRecognitionCandidate, fetchedAt: string): NutritionCandidate {
  const nutrients = emptyNutrients();
  const confidence = Math.max(0.05, Math.min(0.2, candidate.confidence * 0.18));
  return {
    id: `unknown:${candidate.id}`,
    origin: 'manual_input',
    source: 'unknown',
    source_id: candidate.id,
    source_url: null,
    product_id: null,
    nutrition_data_id: null,
    barcode: candidate.barcode,
    product_name: candidate.name,
    brand: candidate.brand,
    serving_size_text: null,
    serving_basis: 'per_item',
    serving_quantity: 1,
    serving_unit: candidate.unit ?? 'item',
    nutrients,
    confidence,
    completeness: 'incomplete',
    auto_selectable: false,
    is_user_confirmed: false,
    fetched_at: fetchedAt,
    display: getNutritionSourceDisplayData('unknown', confidence, 'incomplete'),
    quality_flags: ['Nutrition facts are missing until the user selects a source or enters facts manually'],
    rank: 0,
  };
}

function cleanJsonResponse(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();
}

function rawCandidatesFromJson(parsed: unknown): RawFoodCandidate[] {
  if (Array.isArray(parsed)) return parsed as RawFoodCandidate[];
  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as Record<string, unknown>;
  for (const key of ['candidates', 'foods', 'items', 'labels']) {
    if (Array.isArray(obj[key])) return obj[key] as RawFoodCandidate[];
  }
  if (typeof obj.name === 'string') return [obj as RawFoodCandidate];
  return [];
}

export function parseFoodRecognitionResult(responseText: string): FoodRecognitionResult {
  const cleaned = cleanJsonResponse(responseText);
  if (!cleaned) return emptyResult(responseText);

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const labels = !Array.isArray(parsed) && parsed && typeof parsed === 'object'
      ? stringList((parsed as Record<string, unknown>).labels)
      : [];
    const candidates = rawCandidatesFromJson(parsed)
      .map(toCandidate)
      .filter((candidate): candidate is FoodRecognitionCandidate => candidate !== null)
      .sort((left, right) => right.confidence - left.confidence);
    const top = candidates[0] ?? null;

    return {
      suggestedName: top?.name ?? null,
      suggestedCategory: top?.grocery_section ?? null,
      confidence: top?.confidence ?? 0,
      labels: Array.from(new Set([...labels, ...candidates.flatMap((candidate) => candidate.labels)])),
      candidates,
      rawText: responseText,
    };
  } catch {
    return emptyResult(responseText);
  }
}

export async function enrichFoodRecognitionCandidates(
  db: DatabaseAdapter,
  candidates: FoodRecognitionCandidate[],
  options: FoodRecognitionEnrichmentOptions = {},
): Promise<FoodRecognitionCandidate[]> {
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const providers = options.providers ?? [];
  const includeNetwork = options.includeNetwork ?? providers.length > 0;

  return Promise.all(candidates.map(async (candidate) => {
    const barcode = candidate.barcode ?? barcodeFromLabels(candidate.labels);
    const resolution = await resolveNutritionCandidates(
      db,
      {
        barcode,
        query: [candidate.brand, candidate.name].filter(Boolean).join(' ') || candidate.name,
        brand: candidate.brand,
        productId: candidate.product_id,
        includeNetwork,
      },
      providers,
    );

    const nutritionCandidates = [
      ...resolution.candidates,
      unknownNutritionCandidate({ ...candidate, barcode }, fetchedAt),
    ].map((entry, index) => ({ ...entry, rank: index + 1 }));

    return {
      ...candidate,
      barcode,
      product_id: nutritionCandidates.find((entry) => entry.product_id)?.product_id ?? candidate.product_id,
      nutrition_data_id: nutritionCandidates.find((entry) => entry.nutrition_data_id)?.nutrition_data_id ?? candidate.nutrition_data_id,
      nutrition_candidates: nutritionCandidates,
      nutrition_provider_statuses: resolution.providerStatuses,
    };
  }));
}

/**
 * Identify food items via the BestChef vision broker (Edge Function).
 * Public-launch builds must use this path so no Anthropic key is in the
 * Expo bundle. Returns the same structured shape as `identifyFood`.
 */
export async function identifyFoodViaBroker(
  supabase: SupabaseClient,
  imageBase64: string,
  photoMime = 'image/jpeg',
): Promise<FoodRecognitionResult> {
  if (!imageBase64) return emptyResult();
  const result = await callVisionBroker(supabase, {
    task: 'food_recognition',
    imageBase64,
    photoMime,
  });
  if (!result.ok) return emptyResult();
  return parseFoodRecognitionResult(result.data.rawText);
}

/**
 * Identify food items in a photo using a user-supplied Claude API key.
 * INTERNAL-BETA ONLY. Public launch builds must not call this path; route
 * through `identifyFoodViaBroker` instead. Callers are gated by
 * `shouldAllowBestChefByoProviderKeys` in the app layer.
 *
 * @param imageBase64 - Base64-encoded image data
 * @param apiKey - User's Claude API key (stored in preferences)
 * @param photoMime - MIME type for the selected image
 * @returns Structured multi-candidate food recognition result
 */
export async function identifyFood(
  imageBase64: string,
  apiKey: string,
  photoMime = 'image/jpeg',
): Promise<FoodRecognitionResult> {
  if (!apiKey || !imageBase64) return emptyResult();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 768,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: photoMime,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Identify all grocery or pantry food items visible in this image. Return ONLY JSON, no markdown. Shape: {"candidates":[{"name":"specific food name","brand":null_or_string,"category":"one of produce,dairy,meat,pantry,frozen,bakery,beverages,snacks,condiments,other","storage_location":"one of fridge,freezer,pantry,counter,other","confidence":0.0-1.0,"labels":["visible label or package text"],"quantity":number_or_null,"unit":null_or_string,"notes":null_or_string,"bounding_box":{"x":0.0,"y":0.0,"width":0.0,"height":0.0}_or_null,"crop_uri":null_or_string}],"labels":["all visible food/package words"]}. Bounding box values must be normalized 0-1 when visible. Do not invent nutrition facts, barcodes, or expiration dates.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return emptyResult();

    const data = (await response.json()) as ClaudeResponse;
    const text = data?.content?.[0]?.text ?? '';
    return parseFoodRecognitionResult(text);
  } catch {
    return emptyResult();
  }
}
