import type { DatabaseAdapter } from '@mylife/db';
import type {
  CreateFoodConfirmation,
  CreateFoodProduct,
  CreateFoodProductAlias,
  CreateNutritionData,
  FoodDataSource,
  FoodConfirmation,
  FoodConfirmationDecision,
  FoodConfirmationSubjectType,
  FoodProduct,
  FoodProductAlias,
  FoodProductAliasType,
  NutritionBreakdown,
  NutritionCandidate,
  NutritionCandidateCompleteness,
  NutritionConfidenceLabel,
  NutritionData,
  NutritionDetail,
  NutritionDetailStatus,
  NutritionFactsWithAddedSugar,
  NutritionFieldKey,
  NutritionHealthSummary,
  NutritionMissingField,
  NutritionProviderAdapter,
  NutritionProviderResult,
  NutritionProviderStatus,
  NutritionResolutionResult,
  NutritionResolveInput,
  NutritionSourceChoice,
  NutritionSourceDisplayData,
  UpdateFoodProduct,
  UpdateFoodProductAlias,
  UpdateNutritionData,
} from '../types';
import { fuzzyItemMatch } from '../pantry/name-normalizer';

function valueOrFallback<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function normalizeFoodAliasValue(value: string, aliasType?: FoodProductAliasType): string {
  const trimmed = value.trim();
  if (aliasType === 'barcode') {
    return trimmed.replace(/\s+/g, '');
  }
  return trimmed.replace(/\s+/g, ' ').toLowerCase();
}

function confirmedFlag(input: { is_user_confirmed?: number; confirmed_at?: string | null }, now: string): {
  isUserConfirmed: number;
  confirmedAt: string | null;
} {
  const isUserConfirmed = input.is_user_confirmed ?? (input.confirmed_at ? 1 : 0);
  return {
    isUserConfirmed,
    confirmedAt: input.confirmed_at ?? (isUserConfirmed === 1 ? now : null),
  };
}

const NUTRIENT_KEYS: Array<keyof NutritionBreakdown> = [
  'calories',
  'fat_g',
  'saturated_fat_g',
  'carbs_g',
  'fiber_g',
  'sugar_g',
  'protein_g',
  'sodium_mg',
];

const NUTRITION_DETAIL_KEYS: NutritionFieldKey[] = [
  'calories',
  'fat_g',
  'saturated_fat_g',
  'carbs_g',
  'fiber_g',
  'sugar_g',
  'added_sugar_g',
  'protein_g',
  'sodium_mg',
];

const HEALTH_SUMMARY_KEYS: NutritionFieldKey[] = [
  'protein_g',
  'fiber_g',
  'sodium_mg',
  'saturated_fat_g',
  'added_sugar_g',
];

const NUTRIENT_LABELS: Record<NutritionFieldKey, string> = {
  calories: 'Calories',
  fat_g: 'Total fat',
  saturated_fat_g: 'Saturated fat',
  carbs_g: 'Total carbohydrate',
  fiber_g: 'Dietary fiber',
  sugar_g: 'Total sugars',
  added_sugar_g: 'Added sugars',
  protein_g: 'Protein',
  sodium_mg: 'Sodium',
};

interface SourcePolicy {
  label: string;
  shortLabel: string;
  description: string;
  access: NutritionSourceDisplayData['access'];
  apiKeyLabel: string;
  rateLimitLabel: string;
  licenseLabel: string;
  attributionLabel: string;
  constraints: string[];
  defaultConfidence: number;
}

const SOURCE_POLICIES: Record<FoodDataSource, SourcePolicy> = {
  manual: {
    label: 'Manual entry',
    shortLabel: 'Manual',
    description: 'User-entered nutrition facts.',
    access: 'local_only',
    apiKeyLabel: 'No API key',
    rateLimitLabel: 'No network calls',
    licenseLabel: 'User supplied',
    attributionLabel: 'User confirmed',
    constraints: ['Treat as personal data until explicitly shared.'],
    defaultConfidence: 1,
  },
  unknown: {
    label: 'Unknown nutrition',
    shortLabel: 'Unknown',
    description: 'No nutrition source has been selected or verified yet.',
    access: 'local_only',
    apiKeyLabel: 'No API key',
    rateLimitLabel: 'No network calls',
    licenseLabel: 'No nutrition facts stored',
    attributionLabel: 'User confirmed that nutrition facts are unknown.',
    constraints: [
      'Do not fill missing nutrition facts with zero.',
      'Use only as an explicit unknown/manual fallback.',
    ],
    defaultConfidence: 0.12,
  },
  open_food_facts: {
    label: 'Open Food Facts',
    shortLabel: 'OFF',
    description: 'Community product database for barcode, label, ingredient, and nutrition facts.',
    access: 'open',
    apiKeyLabel: 'No API key for reads',
    rateLimitLabel: '100 read product requests/min and 10 search requests/min per the public API docs.',
    licenseLabel: 'ODbL database, DbCL contents, CC BY-SA product images',
    attributionLabel: 'Attribute Open Food Facts and preserve share-alike obligations.',
    constraints: [
      'User-contributed data must be shown with review state.',
      'Use a custom User-Agent for API calls.',
      'Do not upload images unless the user owns or has consent for them.',
    ],
    defaultConfidence: 0.78,
  },
  usda_fdc: {
    label: 'USDA FoodData Central',
    shortLabel: 'USDA',
    description: 'USDA nutrient data for Foundation, FNDDS, SR Legacy, and branded food records.',
    access: 'api_key_required',
    apiKeyLabel: 'data.gov API key required',
    rateLimitLabel: 'Default FoodData Central limit is 1,000 requests/hour/IP.',
    licenseLabel: 'CC0 public domain data',
    attributionLabel: 'List FoodData Central as source when practical.',
    constraints: [
      'Keep API keys out of the client bundle and repositories.',
      'Branded Food records are label-based and can differ from analytical Foundation data.',
    ],
    defaultConfidence: 0.86,
  },
  gs1: {
    label: 'GS1 US Data Hub',
    shortLabel: 'GS1',
    description: 'Official GTIN, brand owner, product, location, and company identity metadata.',
    access: 'paid_subscription',
    apiKeyLabel: 'GS1 US API subscription and keys required',
    rateLimitLabel: 'Use only within the subscriber agreement and portal limits.',
    licenseLabel: 'Licensed GS1 US Data Hub data',
    attributionLabel: 'Use according to GS1 US subscription terms.',
    constraints: [
      'Treat as product identity, not a standalone nutrition source.',
      'Do not enable live calls without legal and subscription approval.',
    ],
    defaultConfidence: 0.7,
  },
  bestchef_cache: {
    label: 'BestChef cache',
    shortLabel: 'BestChef',
    description: 'Server-side BestChef product cache synced after user confirmation.',
    access: 'local_only',
    apiKeyLabel: 'No client API key',
    rateLimitLabel: 'Local read after sync',
    licenseLabel: 'Mixed upstream licenses preserved per source record',
    attributionLabel: 'Display the original upstream source.',
    constraints: ['Do not strip upstream source and license metadata.'],
    defaultConfidence: 0.82,
  },
  local_cache: {
    label: 'Local cache',
    shortLabel: 'Cache',
    description: 'Device-local nutrition records already stored in BestChef.',
    access: 'local_only',
    apiKeyLabel: 'No API key',
    rateLimitLabel: 'No network calls',
    licenseLabel: 'Preserves original source license',
    attributionLabel: 'Display the original upstream source when known.',
    constraints: ['Local cache should be searched before network providers.'],
    defaultConfidence: 0.84,
  },
  receipt_ocr: {
    label: 'Receipt OCR',
    shortLabel: 'Receipt',
    description: 'Parsed receipt text and line-item inference.',
    access: 'api_key_required',
    apiKeyLabel: 'OCR provider key required when cloud OCR is used',
    rateLimitLabel: 'Provider-specific OCR limits',
    licenseLabel: 'User-private receipt data',
    attributionLabel: 'User supplied receipt',
    constraints: ['Never create pantry or nutrition facts from OCR without user confirmation.'],
    defaultConfidence: 0.58,
  },
  food_recognition: {
    label: 'Food recognition',
    shortLabel: 'Photo AI',
    description: 'Image-based food recognition candidate.',
    access: 'api_key_required',
    apiKeyLabel: 'Vision provider key required unless on-device',
    rateLimitLabel: 'Provider-specific image analysis limits',
    licenseLabel: 'User-private photo data',
    attributionLabel: 'User supplied photo',
    constraints: ['Image candidates require confirmation before pantry mutation.'],
    defaultConfidence: 0.62,
  },
};

function clampConfidence(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function createGeneratedId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function confidenceLabel(confidence: number, completeness: NutritionCandidateCompleteness): NutritionConfidenceLabel {
  if (completeness === 'incomplete') return 'Needs review';
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.65) return 'Medium';
  return 'Low';
}

function badgeTone(label: NutritionConfidenceLabel): NutritionSourceDisplayData['badgeTone'] {
  if (label === 'High') return 'success';
  if (label === 'Medium') return 'neutral';
  if (label === 'Low') return 'warning';
  return 'danger';
}

export function getNutritionSourceDisplayData(
  source: FoodDataSource,
  confidence: number,
  completeness: NutritionCandidateCompleteness,
): NutritionSourceDisplayData {
  const policy = SOURCE_POLICIES[source];
  const label = confidenceLabel(confidence, completeness);
  return {
    label: policy.label,
    shortLabel: policy.shortLabel,
    description: policy.description,
    confidenceLabel: label,
    badgeTone: badgeTone(label),
    access: policy.access,
    apiKeyLabel: policy.apiKeyLabel,
    rateLimitLabel: policy.rateLimitLabel,
    licenseLabel: policy.licenseLabel,
    attributionLabel: policy.attributionLabel,
    constraints: policy.constraints,
  };
}

function nutritionCompleteness(nutrients: NutritionBreakdown): NutritionCandidateCompleteness {
  const present = NUTRIENT_KEYS.filter((key) => nutrients[key] !== null).length;
  if (present === 0) return 'incomplete';
  if (nutrients.calories !== null && nutrients.protein_g !== null && nutrients.carbs_g !== null && nutrients.fat_g !== null) {
    return 'complete';
  }
  return 'partial';
}

function nutritionQualityFlags(nutrients: NutritionBreakdown, sourceFlags: string[] | undefined): string[] {
  const flags = [...(sourceFlags ?? [])];
  if (nutritionCompleteness(nutrients) === 'incomplete') {
    flags.push('No usable nutrition facts returned');
  } else {
    for (const key of ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const) {
      if (nutrients[key] === null) {
        flags.push(`Missing ${key}`);
      }
    }
  }
  return Array.from(new Set(flags));
}

function autoSelectable(confidence: number, completeness: NutritionCandidateCompleteness, source: FoodDataSource): boolean {
  if (source === 'gs1') return false;
  return confidence >= 0.8 && completeness !== 'incomplete';
}

function makeCandidateId(input: {
  origin: string;
  source: string;
  nutritionDataId?: string | null;
  sourceId?: string | null;
  productName?: string | null;
  barcode?: string | null;
}): string {
  const key = input.nutritionDataId ?? input.sourceId ?? input.barcode ?? input.productName ?? 'unknown';
  return `${input.origin}:${input.source}:${key}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, '-');
}

function normalizeNutrients(input: Partial<NutritionBreakdown>): NutritionBreakdown {
  return {
    calories: input.calories ?? null,
    fat_g: input.fat_g ?? null,
    saturated_fat_g: input.saturated_fat_g ?? null,
    carbs_g: input.carbs_g ?? null,
    fiber_g: input.fiber_g ?? null,
    sugar_g: input.sugar_g ?? null,
    protein_g: input.protein_g ?? null,
    sodium_mg: input.sodium_mg ?? null,
  };
}

export function nutritionFactsWithAddedSugar(
  input: Partial<NutritionBreakdown> & { added_sugar_g?: number | null },
): NutritionFactsWithAddedSugar {
  return {
    ...normalizeNutrients(input),
    added_sugar_g: input.added_sugar_g ?? null,
  };
}

export function getNutritionMissingFields(
  nutrients: NutritionFactsWithAddedSugar,
  keys: NutritionFieldKey[] = NUTRITION_DETAIL_KEYS,
): NutritionMissingField[] {
  return keys
    .filter((key) => nutrients[key] === null)
    .map((key) => ({
      key,
      label: NUTRIENT_LABELS[key],
    }));
}

function detailStatusForNutrients(nutrients: NutritionBreakdown): NutritionDetailStatus {
  const completeness = nutritionCompleteness(nutrients);
  if (completeness === 'complete') return 'available';
  if (completeness === 'partial') return 'partial';
  return 'missing';
}

export function buildNutritionHealthSummary(
  nutrients: NutritionFactsWithAddedSugar,
  confidence: number | null,
  confidenceLabel: NutritionConfidenceLabel,
): NutritionHealthSummary {
  return {
    protein_g: nutrients.protein_g,
    fiber_g: nutrients.fiber_g,
    sodium_mg: nutrients.sodium_mg,
    saturated_fat_g: nutrients.saturated_fat_g,
    added_sugar_g: nutrients.added_sugar_g,
    confidence,
    confidenceLabel,
    missingFields: getNutritionMissingFields(nutrients, HEALTH_SUMMARY_KEYS),
    hasMedicalClaim: false,
  };
}

function emptyDetailNutrients(): NutritionFactsWithAddedSugar {
  return nutritionFactsWithAddedSugar({});
}

export function createMissingNutritionDetail(input: {
  surface: NutritionDetail['surface'];
  subjectId: string;
  title: string;
  subtitle?: string | null;
  missingIngredients?: string[];
  ambiguousConversions?: string[];
  lowConfidenceWarnings?: string[];
}): NutritionDetail {
  const nutrients = emptyDetailNutrients();
  return {
    surface: input.surface,
    subjectId: input.subjectId,
    title: input.title,
    subtitle: input.subtitle ?? null,
    status: 'missing',
    nutrients,
    totalNutrients: null,
    perServingNutrients: null,
    servingBasis: null,
    servingQuantity: null,
    servingUnit: null,
    servingSizeText: null,
    source: null,
    sourceId: null,
    sourceUrl: null,
    sourceDisplay: null,
    confidence: null,
    confidenceLabel: 'Needs review',
    fetchedAt: null,
    confirmedAt: null,
    isUserConfirmed: false,
    coverage: null,
    coveragePercent: null,
    sourceBreakdown: [],
    missingFields: getNutritionMissingFields(nutrients),
    missingIngredients: input.missingIngredients ?? [],
    ambiguousConversions: input.ambiguousConversions ?? [],
    lowConfidenceWarnings: input.lowConfidenceWarnings ?? [],
    healthSummary: buildNutritionHealthSummary(nutrients, null, 'Needs review'),
  };
}

export function nutritionDataToDetail(
  data: NutritionData,
  input: {
    surface: NutritionDetail['surface'];
    subjectId: string;
    title: string;
    subtitle?: string | null;
  },
): NutritionDetail {
  const coreNutrients = normalizeNutrients(data);
  const nutrients = nutritionFactsWithAddedSugar(data);
  const completeness = nutritionCompleteness(coreNutrients);
  const confidence = clampConfidence(
    data.confidence,
    data.is_user_confirmed === 1 ? 0.98 : SOURCE_POLICIES[data.source].defaultConfidence,
  );
  const sourceDisplay = getNutritionSourceDisplayData(data.source, confidence, completeness);
  const confidenceLabel = sourceDisplay.confidenceLabel;

  return {
    surface: input.surface,
    subjectId: input.subjectId,
    title: input.title,
    subtitle: input.subtitle ?? data.serving_size_text,
    status: detailStatusForNutrients(coreNutrients),
    nutrients,
    totalNutrients: null,
    perServingNutrients: null,
    servingBasis: data.serving_basis,
    servingQuantity: data.serving_quantity,
    servingUnit: data.serving_unit,
    servingSizeText: data.serving_size_text,
    source: data.source,
    sourceId: data.source_id,
    sourceUrl: data.source_url,
    sourceDisplay,
    confidence,
    confidenceLabel,
    fetchedAt: data.fetched_at,
    confirmedAt: data.confirmed_at,
    isUserConfirmed: data.is_user_confirmed === 1,
    coverage: null,
    coveragePercent: null,
    sourceBreakdown: [{
      source: data.source,
      label: sourceDisplay.label,
      sourceId: data.source_id,
      count: 1,
      confidence,
      confirmedCount: data.is_user_confirmed === 1 ? 1 : 0,
    }],
    missingFields: getNutritionMissingFields(nutrients),
    missingIngredients: [],
    ambiguousConversions: [],
    lowConfidenceWarnings: confidenceLabel === 'Low' || confidenceLabel === 'Needs review'
      ? [`${sourceDisplay.label} nutrition needs review.`]
      : [],
    healthSummary: buildNutritionHealthSummary(nutrients, confidence, confidenceLabel),
  };
}

function nutritionDataToSourceChoice(
  data: NutritionData,
  selectedNutritionDataId: string | null,
): NutritionSourceChoice {
  const coreNutrients = normalizeNutrients(data);
  const nutrients = nutritionFactsWithAddedSugar(data);
  const completeness = nutritionCompleteness(coreNutrients);
  const confidence = clampConfidence(
    data.confidence,
    data.is_user_confirmed === 1 ? 0.98 : SOURCE_POLICIES[data.source].defaultConfidence,
  );
  const display = getNutritionSourceDisplayData(data.source, confidence, completeness);

  return {
    nutritionDataId: data.id,
    source: data.source,
    sourceId: data.source_id,
    sourceUrl: data.source_url,
    productName: data.product_name,
    brand: data.brand,
    servingSizeText: data.serving_size_text,
    servingBasis: data.serving_basis,
    servingQuantity: data.serving_quantity,
    servingUnit: data.serving_unit,
    calories: data.calories,
    protein_g: data.protein_g,
    confidence,
    confidenceLabel: display.confidenceLabel,
    isUserConfirmed: data.is_user_confirmed === 1,
    isSelected: data.id === selectedNutritionDataId,
    fetchedAt: data.fetched_at,
    confirmedAt: data.confirmed_at,
    display,
    missingFields: getNutritionMissingFields(nutrients),
  };
}

function normalizeProviderCandidate(
  result: NutritionProviderResult,
  origin: NutritionCandidate['origin'],
): NutritionCandidate {
  const nutrients = normalizeNutrients(result.nutrients);
  const completeness = nutritionCompleteness(nutrients);
  const fallback = SOURCE_POLICIES[result.source].defaultConfidence;
  const confidence = clampConfidence(result.confidence, fallback);
  return {
    id: makeCandidateId({
      origin,
      source: result.source,
      sourceId: result.source_id,
      productName: result.product_name,
      barcode: result.barcode,
    }),
    origin,
    source: result.source,
    source_id: result.source_id,
    source_url: result.source_url ?? null,
    product_id: null,
    nutrition_data_id: null,
    barcode: result.barcode ?? null,
    product_name: result.product_name,
    brand: result.brand ?? null,
    serving_size_text: result.serving_size_text ?? null,
    serving_basis: result.serving_basis,
    serving_quantity: result.serving_quantity ?? null,
    serving_unit: result.serving_unit ?? null,
    nutrients,
    confidence,
    completeness,
    auto_selectable: autoSelectable(confidence, completeness, result.source),
    is_user_confirmed: result.source === 'manual',
    fetched_at: result.fetched_at ?? null,
    display: getNutritionSourceDisplayData(result.source, confidence, completeness),
    quality_flags: nutritionQualityFlags(nutrients, result.quality_flags),
    rank: 0,
  };
}

function normalizeNutritionRowCandidate(row: NutritionData, origin: NutritionCandidate['origin']): NutritionCandidate {
  const nutrients = normalizeNutrients(row);
  const completeness = nutritionCompleteness(nutrients);
  const fallback = row.is_user_confirmed === 1 ? 0.98 : SOURCE_POLICIES[row.source].defaultConfidence;
  const confidence = clampConfidence(row.confidence, fallback);
  return {
    id: makeCandidateId({
      origin,
      source: row.source,
      nutritionDataId: row.id,
      sourceId: row.source_id,
      productName: row.product_name,
      barcode: row.barcode,
    }),
    origin,
    source: row.source,
    source_id: row.source_id,
    source_url: row.source_url,
    product_id: row.product_id,
    nutrition_data_id: row.id,
    barcode: row.barcode,
    product_name: row.product_name,
    brand: row.brand,
    serving_size_text: row.serving_size_text,
    serving_basis: row.serving_basis,
    serving_quantity: row.serving_quantity,
    serving_unit: row.serving_unit,
    nutrients,
    confidence,
    completeness,
    auto_selectable: autoSelectable(confidence, completeness, row.source),
    is_user_confirmed: row.is_user_confirmed === 1,
    fetched_at: row.fetched_at,
    display: getNutritionSourceDisplayData(row.source, confidence, completeness),
    quality_flags: nutritionQualityFlags(nutrients, undefined),
    rank: 0,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

function addNutritionRows(
  byId: Map<string, NutritionData>,
  rows: NutritionData[],
): void {
  for (const row of rows) {
    byId.set(row.id, row);
  }
}

function getLocalNutritionRows(db: DatabaseAdapter, input: NutritionResolveInput): NutritionData[] {
  const byId = new Map<string, NutritionData>();

  if (input.pantryItemId) {
    addNutritionRows(
      byId,
      db.query<NutritionData>(
        `SELECT nd.*
         FROM rc_nutrition_data nd
         LEFT JOIN rc_pantry_items pi ON pi.id = ?
         WHERE nd.pantry_item_id = ?
            OR nd.id = pi.nutrition_data_id
            OR (pi.product_id IS NOT NULL AND nd.product_id = pi.product_id)
         ORDER BY nd.is_user_confirmed DESC, nd.confidence DESC, nd.fetched_at DESC`,
        [input.pantryItemId, input.pantryItemId],
      ),
    );
  }

  if (input.productId) {
    addNutritionRows(
      byId,
      db.query<NutritionData>(
        `SELECT * FROM rc_nutrition_data
         WHERE product_id = ?
         ORDER BY is_user_confirmed DESC, confidence DESC, fetched_at DESC`,
        [input.productId],
      ),
    );
  }

  if (input.barcode) {
    const normalizedBarcode = normalizeFoodAliasValue(input.barcode, 'barcode');
    addNutritionRows(
      byId,
      db.query<NutritionData>(
        `SELECT * FROM rc_nutrition_data
         WHERE barcode = ?
            OR product_id IN (
              SELECT product_id FROM rc_food_product_aliases
              WHERE alias_type = 'barcode' AND normalized_value = ?
            )
         ORDER BY is_user_confirmed DESC, confidence DESC, fetched_at DESC`,
        [input.barcode, normalizedBarcode],
      ),
    );
  }

  const query = input.query?.trim();
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    const brandPattern = `%${escapeLike(input.brand?.trim() || query)}%`;
    addNutritionRows(
      byId,
      db.query<NutritionData>(
        `SELECT nd.*
         FROM rc_nutrition_data nd
         LEFT JOIN rc_food_products fp ON fp.id = nd.product_id
         WHERE nd.product_name LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR fp.canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR nd.brand LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR fp.brand LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY nd.is_user_confirmed DESC, nd.confidence DESC, nd.fetched_at DESC
         LIMIT 25`,
        [pattern, pattern, brandPattern, brandPattern],
      ),
    );
  }

  return Array.from(byId.values());
}

interface ProductCandidateRow {
  id: string;
  canonical_name: string;
  brand: string | null;
  source: FoodDataSource;
  source_id: string | null;
  confidence: number | null;
  is_user_confirmed: number;
  updated_at: string;
  alias_value: string | null;
  alias_confidence: number | null;
  alias_fetched_at: string | null;
  barcode: string | null;
}

function addProductRows(
  byId: Map<string, ProductCandidateRow>,
  rows: ProductCandidateRow[],
): void {
  for (const row of rows) {
    byId.set(row.id, row);
  }
}

function getLocalProductCandidateRows(db: DatabaseAdapter, input: NutritionResolveInput): ProductCandidateRow[] {
  const byId = new Map<string, ProductCandidateRow>();

  if (input.productId) {
    addProductRows(
      byId,
      db.query<ProductCandidateRow>(
        `SELECT
           p.id,
           p.canonical_name,
           p.brand,
           p.source,
           p.source_id,
           p.confidence,
           p.is_user_confirmed,
           p.updated_at,
           NULL AS alias_value,
           NULL AS alias_confidence,
           NULL AS alias_fetched_at,
           (
             SELECT a.normalized_value
             FROM rc_food_product_aliases a
             WHERE a.product_id = p.id AND a.alias_type = 'barcode'
             ORDER BY a.is_user_confirmed DESC, a.confidence DESC, a.fetched_at DESC
             LIMIT 1
           ) AS barcode
         FROM rc_food_products p
         WHERE p.id = ?
         LIMIT 1`,
        [input.productId],
      ),
    );
  }

  if (input.barcode) {
    const normalizedBarcode = normalizeFoodAliasValue(input.barcode, 'barcode');
    addProductRows(
      byId,
      db.query<ProductCandidateRow>(
        `SELECT
           p.id,
           p.canonical_name,
           p.brand,
           p.source,
           p.source_id,
           p.confidence,
           p.is_user_confirmed,
           p.updated_at,
           a.alias_value,
           a.confidence AS alias_confidence,
           a.fetched_at AS alias_fetched_at,
           a.normalized_value AS barcode
         FROM rc_food_product_aliases a
         INNER JOIN rc_food_products p ON p.id = a.product_id
         WHERE a.alias_type = 'barcode'
           AND a.normalized_value = ?
         ORDER BY a.is_user_confirmed DESC, a.confidence DESC, p.is_user_confirmed DESC, p.confidence DESC
         LIMIT 10`,
        [normalizedBarcode],
      ),
    );
  }

  const query = input.query?.trim();
  if (query) {
    const normalizedQuery = normalizeFoodAliasValue(query, 'name');
    const pattern = `%${escapeLike(query)}%`;
    const brandPattern = `%${escapeLike(input.brand?.trim() || query)}%`;
    addProductRows(
      byId,
      db.query<ProductCandidateRow>(
        `SELECT
           p.id,
           p.canonical_name,
           p.brand,
           p.source,
           p.source_id,
           p.confidence,
           p.is_user_confirmed,
           p.updated_at,
           a.alias_value,
           a.confidence AS alias_confidence,
           a.fetched_at AS alias_fetched_at,
           (
             SELECT b.normalized_value
             FROM rc_food_product_aliases b
             WHERE b.product_id = p.id AND b.alias_type = 'barcode'
             ORDER BY b.is_user_confirmed DESC, b.confidence DESC, b.fetched_at DESC
             LIMIT 1
           ) AS barcode
         FROM rc_food_products p
         LEFT JOIN rc_food_product_aliases a
           ON a.product_id = p.id
          AND a.alias_type IN ('name', 'receipt_line', 'ocr_label')
         WHERE p.canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR p.brand LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR a.normalized_value = ?
         ORDER BY p.is_user_confirmed DESC, p.confidence DESC, a.confidence DESC, p.updated_at DESC
         LIMIT 25`,
        [pattern, brandPattern, normalizedQuery],
      ),
    );
  }

  return Array.from(byId.values());
}

function normalizeProductRowCandidate(row: ProductCandidateRow): NutritionCandidate {
  const nutrients = normalizeNutrients({});
  const completeness = nutritionCompleteness(nutrients);
  const confidence = clampConfidence(
    row.alias_confidence ?? row.confidence,
    row.is_user_confirmed === 1 ? 0.92 : SOURCE_POLICIES.local_cache.defaultConfidence,
  );
  return {
    id: makeCandidateId({
      origin: 'local_cache',
      source: 'local_cache',
      sourceId: row.source_id,
      productName: row.canonical_name,
      barcode: row.barcode,
    }),
    origin: 'local_cache',
    source: 'local_cache',
    source_id: row.source_id,
    source_url: null,
    product_id: row.id,
    nutrition_data_id: null,
    barcode: row.barcode,
    product_name: row.canonical_name,
    brand: row.brand,
    serving_size_text: null,
    serving_basis: 'per_item',
    serving_quantity: 1,
    serving_unit: 'item',
    nutrients,
    confidence,
    completeness,
    auto_selectable: false,
    is_user_confirmed: row.is_user_confirmed === 1,
    fetched_at: row.alias_fetched_at ?? row.updated_at,
    display: getNutritionSourceDisplayData('local_cache', confidence, completeness),
    quality_flags: nutritionQualityFlags(nutrients, ['Product identity match has no stored nutrition facts']),
    rank: 0,
  };
}

function candidateSort(a: NutritionCandidate, b: NutritionCandidate): number {
  const originRank: Record<NutritionCandidate['origin'], number> = {
    local_cache: 0,
    manual_input: 1,
    provider: 2,
  };
  const sourceRank: Record<FoodDataSource, number> = {
    manual: 0,
    usda_fdc: 1,
    open_food_facts: 2,
    bestchef_cache: 3,
    local_cache: 4,
    gs1: 5,
    receipt_ocr: 6,
    food_recognition: 7,
    unknown: 8,
  };
  return (
    originRank[a.origin] - originRank[b.origin] ||
    Number(b.is_user_confirmed) - Number(a.is_user_confirmed) ||
    Number(b.auto_selectable) - Number(a.auto_selectable) ||
    b.confidence - a.confidence ||
    sourceRank[a.source] - sourceRank[b.source]
  );
}

function addCandidate(byId: Map<string, NutritionCandidate>, candidate: NutritionCandidate): void {
  const duplicateKey = [
    candidate.source,
    candidate.source_id,
    candidate.nutrition_data_id,
    candidate.barcode,
    candidate.product_name,
    candidate.brand,
  ].join('|');
  const existing = byId.get(duplicateKey);
  if (!existing || candidateSort(candidate, existing) < 0) {
    byId.set(duplicateKey, candidate);
  }
}

export async function resolveNutritionCandidates(
  db: DatabaseAdapter,
  input: NutritionResolveInput,
  providers: NutritionProviderAdapter[] = [],
): Promise<NutritionResolutionResult> {
  const byId = new Map<string, NutritionCandidate>();
  const providerStatuses: NutritionProviderStatus[] = [];

  for (const row of getLocalNutritionRows(db, input)) {
    addCandidate(byId, normalizeNutritionRowCandidate(row, 'local_cache'));
  }

  for (const row of getLocalProductCandidateRows(db, input)) {
    addCandidate(byId, normalizeProductRowCandidate(row));
  }

  for (const manual of input.manualCandidates ?? []) {
    addCandidate(byId, normalizeProviderCandidate(manual, 'manual_input'));
  }

  if (input.includeNetwork) {
    for (const provider of providers) {
      try {
        const result = await provider.search(input);
        providerStatuses.push(result.status);
        for (const candidate of result.candidates) {
          addCandidate(byId, normalizeProviderCandidate(candidate, 'provider'));
        }
      } catch (error) {
        providerStatuses.push({
          source: provider.source,
          status: 'error',
          message: error instanceof Error ? error.message : 'Provider failed',
        });
      }
    }
  } else {
    for (const provider of providers) {
      providerStatuses.push({
        source: provider.source,
        status: 'skipped',
        message: 'Network provider skipped because includeNetwork is false',
      });
    }
  }

  const candidates = Array.from(byId.values()).sort(candidateSort);
  candidates.forEach((candidate, index) => {
    candidate.rank = index + 1;
  });

  return { candidates, providerStatuses };
}

export function createFoodProduct(
  db: DatabaseAdapter,
  id: string,
  input: CreateFoodProduct,
): FoodProduct {
  const now = new Date().toISOString();
  const confirmation = confirmedFlag(input, now);
  const product: FoodProduct = {
    id,
    canonical_name: input.canonical_name,
    brand: input.brand ?? null,
    manufacturer: input.manufacturer ?? null,
    product_type: input.product_type ?? 'generic',
    grocery_section: input.grocery_section ?? 'other',
    default_storage_location: input.default_storage_location ?? null,
    image_uri: input.image_uri ?? null,
    source: input.source ?? 'manual',
    source_id: input.source_id ?? null,
    confidence: input.confidence ?? null,
    is_user_confirmed: confirmation.isUserConfirmed,
    confirmed_at: confirmation.confirmedAt,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO rc_food_products (
      id,
      canonical_name,
      brand,
      manufacturer,
      product_type,
      grocery_section,
      default_storage_location,
      image_uri,
      source,
      source_id,
      confidence,
      is_user_confirmed,
      confirmed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.canonical_name,
      product.brand,
      product.manufacturer,
      product.product_type,
      product.grocery_section,
      product.default_storage_location,
      product.image_uri,
      product.source,
      product.source_id,
      product.confidence,
      product.is_user_confirmed,
      product.confirmed_at,
      product.created_at,
      product.updated_at,
    ],
  );

  return product;
}

export function getFoodProductById(db: DatabaseAdapter, id: string): FoodProduct | null {
  const rows = db.query<FoodProduct>(
    `SELECT * FROM rc_food_products WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export function getFoodProducts(db: DatabaseAdapter, search?: string): FoodProduct[] {
  const normalizedSearch = search?.trim() ?? '';
  if (normalizedSearch.length === 0) {
    return db.query<FoodProduct>(
      `SELECT * FROM rc_food_products ORDER BY updated_at DESC LIMIT 500`,
      [],
    );
  }

  return db.query<FoodProduct>(
    `SELECT * FROM rc_food_products
     WHERE canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR brand LIKE ? ESCAPE '\\' COLLATE NOCASE
     ORDER BY updated_at DESC
     LIMIT 500`,
    [`%${normalizedSearch.replace(/[%_]/g, (ch) => `\\${ch}`)}%`, `%${normalizedSearch.replace(/[%_]/g, (ch) => `\\${ch}`)}%`],
  );
}

const FOOD_PRODUCT_COLUMNS: Record<string, keyof UpdateFoodProduct> = {
  canonical_name: 'canonical_name',
  brand: 'brand',
  manufacturer: 'manufacturer',
  product_type: 'product_type',
  grocery_section: 'grocery_section',
  default_storage_location: 'default_storage_location',
  image_uri: 'image_uri',
  source: 'source',
  source_id: 'source_id',
  confidence: 'confidence',
  is_user_confirmed: 'is_user_confirmed',
  confirmed_at: 'confirmed_at',
};

export function updateFoodProduct(db: DatabaseAdapter, id: string, updates: UpdateFoodProduct): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [column, key] of Object.entries(FOOD_PRODUCT_COLUMNS)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.execute(`UPDATE rc_food_products SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteFoodProduct(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_food_products WHERE id = ?`, [id]);
}

export function createFoodProductAlias(
  db: DatabaseAdapter,
  id: string,
  input: CreateFoodProductAlias,
): FoodProductAlias {
  const now = new Date().toISOString();
  const confirmation = confirmedFlag(input, now);
  const alias: FoodProductAlias = {
    id,
    product_id: input.product_id,
    alias_type: input.alias_type,
    alias_value: input.alias_value,
    normalized_value: input.normalized_value ?? normalizeFoodAliasValue(input.alias_value, input.alias_type),
    source: input.source ?? 'manual',
    source_id: input.source_id ?? null,
    confidence: input.confidence ?? null,
    fetched_at: input.fetched_at ?? now,
    is_user_confirmed: confirmation.isUserConfirmed,
    confirmed_at: confirmation.confirmedAt,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO rc_food_product_aliases (
      id,
      product_id,
      alias_type,
      alias_value,
      normalized_value,
      source,
      source_id,
      confidence,
      fetched_at,
      is_user_confirmed,
      confirmed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alias.id,
      alias.product_id,
      alias.alias_type,
      alias.alias_value,
      alias.normalized_value,
      alias.source,
      alias.source_id,
      alias.confidence,
      alias.fetched_at,
      alias.is_user_confirmed,
      alias.confirmed_at,
      alias.created_at,
      alias.updated_at,
    ],
  );

  return alias;
}

export function getFoodProductAliases(db: DatabaseAdapter, productId: string): FoodProductAlias[] {
  return db.query<FoodProductAlias>(
    `SELECT * FROM rc_food_product_aliases
     WHERE product_id = ?
     ORDER BY alias_type ASC, is_user_confirmed DESC, confidence DESC, updated_at DESC`,
    [productId],
  );
}

export function getFoodProductByBarcode(db: DatabaseAdapter, barcode: string): FoodProduct | null {
  const rows = db.query<FoodProduct>(
    `SELECT p.*
     FROM rc_food_products p
     INNER JOIN rc_food_product_aliases a ON a.product_id = p.id
     WHERE a.alias_type = 'barcode' AND a.normalized_value = ?
     ORDER BY a.is_user_confirmed DESC, a.confidence DESC, a.fetched_at DESC
     LIMIT 1`,
    [normalizeFoodAliasValue(barcode, 'barcode')],
  );
  return rows[0] ?? null;
}

export function updateFoodProductAlias(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateFoodProductAlias,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  const nextAliasType = updates.alias_type;
  const nextAliasValue = updates.alias_value;

  const fieldMap: Record<string, keyof UpdateFoodProductAlias> = {
    product_id: 'product_id',
    alias_type: 'alias_type',
    alias_value: 'alias_value',
    source: 'source',
    source_id: 'source_id',
    confidence: 'confidence',
    fetched_at: 'fetched_at',
    is_user_confirmed: 'is_user_confirmed',
    confirmed_at: 'confirmed_at',
  };

  for (const [column, key] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (nextAliasValue !== undefined) {
    fields.push('normalized_value = ?');
    values.push(updates.normalized_value ?? normalizeFoodAliasValue(nextAliasValue, nextAliasType));
  } else if (updates.normalized_value !== undefined) {
    fields.push('normalized_value = ?');
    values.push(updates.normalized_value);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.execute(`UPDATE rc_food_product_aliases SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteFoodProductAlias(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_food_product_aliases WHERE id = ?`, [id]);
}

export function recordFoodConfirmation(
  db: DatabaseAdapter,
  id: string,
  input: CreateFoodConfirmation,
): FoodConfirmation {
  const confirmation: FoodConfirmation = {
    id,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    decision: input.decision,
    confidence: input.confidence ?? null,
    notes: input.notes ?? null,
    created_at: new Date().toISOString(),
  };

  db.execute(
    `INSERT INTO rc_food_confirmations (
      id,
      subject_type,
      subject_id,
      decision,
      confidence,
      notes,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      confirmation.id,
      confirmation.subject_type,
      confirmation.subject_id,
      confirmation.decision,
      confirmation.confidence,
      confirmation.notes,
      confirmation.created_at,
    ],
  );

  return confirmation;
}

export function getFoodConfirmations(
  db: DatabaseAdapter,
  subjectType: FoodConfirmationSubjectType,
  subjectId: string,
): FoodConfirmation[] {
  return db.query<FoodConfirmation>(
    `SELECT * FROM rc_food_confirmations
     WHERE subject_type = ? AND subject_id = ?
     ORDER BY created_at DESC`,
    [subjectType, subjectId],
  );
}

function markConfirmed(
  db: DatabaseAdapter,
  subjectType: FoodConfirmationSubjectType,
  subjectId: string,
  decision: FoodConfirmationDecision,
  confirmedAt: string,
): void {
  if (subjectType === 'food_product') {
    db.execute(
      `UPDATE rc_food_products
       SET is_user_confirmed = ?, confirmed_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [decision === 'confirmed' ? 1 : 0, decision === 'confirmed' ? confirmedAt : null, subjectId],
    );
  }

  if (subjectType === 'product_alias') {
    db.execute(
      `UPDATE rc_food_product_aliases
       SET is_user_confirmed = ?, confirmed_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [decision === 'confirmed' ? 1 : 0, decision === 'confirmed' ? confirmedAt : null, subjectId],
    );
  }

  if (subjectType === 'nutrition_data') {
    db.execute(
      `UPDATE rc_nutrition_data
       SET is_user_confirmed = ?, confirmed_at = ?
       WHERE id = ?`,
      [decision === 'confirmed' || decision === 'manual_override' ? 1 : 0, confirmedAt, subjectId],
    );
  }

  if (subjectType === 'pantry_item') {
    db.execute(
      `UPDATE rc_pantry_items
       SET confirmation_status = ?, confirmed_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [decision === 'rejected' ? 'rejected' : 'confirmed', confirmedAt, subjectId],
    );
  }
}

export function confirmFoodRecord(
  db: DatabaseAdapter,
  confirmationId: string,
  subjectType: FoodConfirmationSubjectType,
  subjectId: string,
  decision: FoodConfirmationDecision = 'confirmed',
  notes?: string | null,
): FoodConfirmation {
  const confirmedAt = new Date().toISOString();
  let confirmation: FoodConfirmation | null = null;

  db.transaction(() => {
    markConfirmed(db, subjectType, subjectId, decision, confirmedAt);
    confirmation = recordFoodConfirmation(db, confirmationId, {
      subject_type: subjectType,
      subject_id: subjectId,
      decision,
      notes: notes ?? null,
    });
  });

  return confirmation!;
}

export function createNutritionData(
  db: DatabaseAdapter,
  id: string,
  input: CreateNutritionData,
): NutritionData {
  const now = new Date().toISOString();
  const isManual = input.source === 'manual';
  const confirmation = confirmedFlag(
    {
      is_user_confirmed: input.is_user_confirmed ?? (isManual ? 1 : 0),
      confirmed_at: input.confirmed_at,
    },
    now,
  );
  const data: NutritionData = {
    id,
    pantry_item_id: input.pantry_item_id ?? null,
    product_id: input.product_id ?? null,
    barcode: input.barcode ?? null,
    product_name: input.product_name ?? null,
    brand: input.brand ?? null,
    serving_size_text: input.serving_size_text ?? null,
    calories: input.calories ?? null,
    fat_g: input.fat_g ?? null,
    saturated_fat_g: input.saturated_fat_g ?? null,
    carbs_g: input.carbs_g ?? null,
    fiber_g: input.fiber_g ?? null,
    sugar_g: input.sugar_g ?? null,
    protein_g: input.protein_g ?? null,
    sodium_mg: input.sodium_mg ?? null,
    source: input.source,
    source_id: input.source_id ?? null,
    source_url: input.source_url ?? null,
    confidence: input.confidence ?? null,
    serving_basis: input.serving_basis ?? 'per_serving',
    serving_quantity: input.serving_quantity ?? null,
    serving_unit: input.serving_unit ?? null,
    parent_nutrition_data_id: input.parent_nutrition_data_id ?? null,
    is_user_confirmed: confirmation.isUserConfirmed,
    confirmed_at: confirmation.confirmedAt,
    fetched_at: input.fetched_at ?? now,
  };
  db.execute(
    `INSERT INTO rc_nutrition_data (
      id,
      pantry_item_id,
      product_id,
      barcode,
      product_name,
      brand,
      serving_size_text,
      calories,
      fat_g,
      saturated_fat_g,
      carbs_g,
      fiber_g,
      sugar_g,
      protein_g,
      sodium_mg,
      source,
      source_id,
      source_url,
      confidence,
      serving_basis,
      serving_quantity,
      serving_unit,
      parent_nutrition_data_id,
      is_user_confirmed,
      confirmed_at,
      fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.id,
      data.pantry_item_id,
      data.product_id,
      data.barcode,
      data.product_name,
      data.brand,
      data.serving_size_text,
      data.calories,
      data.fat_g,
      data.saturated_fat_g,
      data.carbs_g,
      data.fiber_g,
      data.sugar_g,
      data.protein_g,
      data.sodium_mg,
      data.source,
      data.source_id,
      data.source_url,
      data.confidence,
      data.serving_basis,
      data.serving_quantity,
      data.serving_unit,
      data.parent_nutrition_data_id,
      data.is_user_confirmed,
      data.confirmed_at,
      data.fetched_at,
    ],
  );
  return data;
}

export function getNutritionById(db: DatabaseAdapter, id: string): NutritionData | null {
  const rows = db.query<NutritionData>(
    `SELECT * FROM rc_nutrition_data WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export function getNutritionForItem(db: DatabaseAdapter, pantryItemId: string): NutritionData | null {
  const rows = db.query<NutritionData>(
    `SELECT nd.*
     FROM rc_pantry_items pi
     INNER JOIN rc_nutrition_data nd
       ON nd.id = pi.nutrition_data_id
       OR nd.pantry_item_id = pi.id
       OR (pi.product_id IS NOT NULL AND nd.product_id = pi.product_id)
     WHERE pi.id = ?
     ORDER BY
       CASE
         WHEN nd.id = pi.nutrition_data_id THEN 0
         WHEN nd.pantry_item_id = pi.id THEN 1
         ELSE 2
       END,
       nd.is_user_confirmed DESC,
       nd.confidence DESC,
       nd.fetched_at DESC
     LIMIT 1`,
    [pantryItemId],
  );
  return rows[0] ?? null;
}

interface PantryNutritionChoiceRow extends NutritionData {
  selected_nutrition_data_id: string | null;
}

export function getNutritionSourceChoicesForPantryItem(
  db: DatabaseAdapter,
  pantryItemId: string,
): NutritionSourceChoice[] {
  const rows = db.query<PantryNutritionChoiceRow>(
    `SELECT
       nd.*,
       pi.nutrition_data_id AS selected_nutrition_data_id
     FROM rc_pantry_items pi
     INNER JOIN rc_nutrition_data nd
       ON nd.id = pi.nutrition_data_id
       OR nd.pantry_item_id = pi.id
       OR (pi.product_id IS NOT NULL AND nd.product_id = pi.product_id)
       OR (pi.barcode IS NOT NULL AND nd.barcode = pi.barcode)
     WHERE pi.id = ?
     ORDER BY
       CASE
         WHEN nd.id = pi.nutrition_data_id THEN 0
         WHEN nd.pantry_item_id = pi.id THEN 1
         WHEN pi.product_id IS NOT NULL AND nd.product_id = pi.product_id THEN 2
         WHEN pi.barcode IS NOT NULL AND nd.barcode = pi.barcode THEN 3
         ELSE 4
       END,
       nd.is_user_confirmed DESC,
       nd.confidence DESC,
       nd.fetched_at DESC`,
    [pantryItemId],
  );
  const selectedNutritionDataId = rows[0]?.selected_nutrition_data_id ?? rows[0]?.id ?? null;
  return rows.map((row) => nutritionDataToSourceChoice(row, selectedNutritionDataId));
}

export function selectNutritionSourceForPantryItem(
  db: DatabaseAdapter,
  pantryItemId: string,
  nutritionDataId: string,
  confirmationId = createGeneratedId('food-confirmation'),
): NutritionSourceChoice {
  const choices = getNutritionSourceChoicesForPantryItem(db, pantryItemId);
  const choice = choices.find((entry) => entry.nutritionDataId === nutritionDataId);
  if (!choice) {
    throw new Error(`Nutrition source ${nutritionDataId} is not linked to pantry item ${pantryItemId}.`);
  }

  const confirmedAt = new Date().toISOString();
  db.transaction(() => {
    db.execute(
      `UPDATE rc_pantry_items
       SET nutrition_data_id = ?,
           confirmation_status = 'confirmed',
           confirmed_at = COALESCE(confirmed_at, ?),
           updated_at = datetime('now')
       WHERE id = ?`,
      [nutritionDataId, confirmedAt, pantryItemId],
    );
    db.execute(
      `UPDATE rc_nutrition_data
       SET is_user_confirmed = 1,
           confirmed_at = COALESCE(confirmed_at, ?)
       WHERE id = ?`,
      [confirmedAt, nutritionDataId],
    );
    recordFoodConfirmation(db, confirmationId, {
      subject_type: 'nutrition_data',
      subject_id: nutritionDataId,
      decision: 'confirmed',
      confidence: choice.confidence,
      notes: `Selected nutrition source for pantry item ${pantryItemId}.`,
    });
  });

  return getNutritionSourceChoicesForPantryItem(db, pantryItemId)
    .find((entry) => entry.nutritionDataId === nutritionDataId)!;
}

export function getNutritionByBarcode(db: DatabaseAdapter, barcode: string): NutritionData | null {
  const normalizedBarcode = normalizeFoodAliasValue(barcode, 'barcode');
  const rows = db.query<NutritionData>(
    `SELECT * FROM rc_nutrition_data
     WHERE barcode = ?
        OR product_id IN (
          SELECT product_id
          FROM rc_food_product_aliases
          WHERE alias_type = 'barcode' AND normalized_value = ?
        )
     ORDER BY is_user_confirmed DESC, confidence DESC, fetched_at DESC
     LIMIT 1`,
    [barcode, normalizedBarcode],
  );
  return rows[0] ?? null;
}

export function getNutritionCandidatesForProduct(
  db: DatabaseAdapter,
  productId: string,
): NutritionData[] {
  return db.query<NutritionData>(
    `SELECT * FROM rc_nutrition_data
     WHERE product_id = ?
     ORDER BY is_user_confirmed DESC, confidence DESC, fetched_at DESC`,
    [productId],
  );
}

interface NutritionLookupRow extends NutritionData {
  pantry_name: string | null;
  canonical_name: string | null;
}

function bestFoodNameScore(query: string, row: NutritionLookupRow): number {
  return Math.max(
    row.product_name ? fuzzyItemMatch(query, row.product_name) : 0,
    row.pantry_name ? fuzzyItemMatch(query, row.pantry_name) : 0,
    row.canonical_name ? fuzzyItemMatch(query, row.canonical_name) : 0,
  );
}

export function getBestNutritionForFoodName(
  db: DatabaseAdapter,
  name: string,
  input: {
    barcode?: string | null;
    productId?: string | null;
    pantryItemId?: string | null;
  } = {},
): NutritionData | null {
  if (input.pantryItemId) {
    const pantryNutrition = getNutritionForItem(db, input.pantryItemId);
    if (pantryNutrition) return pantryNutrition;
  }

  if (input.barcode) {
    const barcodeNutrition = getNutritionByBarcode(db, input.barcode);
    if (barcodeNutrition) return barcodeNutrition;
  }

  if (input.productId) {
    const candidates = getNutritionCandidatesForProduct(db, input.productId);
    if (candidates[0]) return candidates[0];
  }

  const query = name.trim();
  if (!query) return null;
  const pattern = `%${escapeLike(query)}%`;
  const rows = db.query<NutritionLookupRow>(
    `SELECT
       nd.*,
       pi.name AS pantry_name,
       fp.canonical_name AS canonical_name
     FROM rc_nutrition_data nd
     LEFT JOIN rc_pantry_items pi
       ON pi.id = nd.pantry_item_id
       OR pi.nutrition_data_id = nd.id
       OR (pi.product_id IS NOT NULL AND pi.product_id = nd.product_id)
     LEFT JOIN rc_food_products fp ON fp.id = nd.product_id
     LEFT JOIN rc_food_product_aliases alias
       ON alias.product_id = nd.product_id
      AND alias.alias_type IN ('name', 'receipt_line', 'ocr_label')
     WHERE nd.product_name LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR pi.name LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR fp.canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR alias.normalized_value = ?
     ORDER BY nd.is_user_confirmed DESC, nd.confidence DESC, nd.fetched_at DESC
     LIMIT 25`,
    [pattern, pattern, pattern, normalizeFoodAliasValue(query, 'name')],
  );

  return rows
    .map((row) => ({ row, score: bestFoodNameScore(query, row) }))
    .filter((entry) => entry.score >= 0.6)
    .sort((left, right) => (
      right.score - left.score ||
      right.row.is_user_confirmed - left.row.is_user_confirmed ||
      (right.row.confidence ?? 0) - (left.row.confidence ?? 0)
    ))[0]?.row ?? null;
}

export function getNutritionDetailForNutritionData(
  db: DatabaseAdapter,
  nutritionDataId: string,
  input: {
    surface?: NutritionDetail['surface'];
    subjectId?: string;
    title?: string;
    subtitle?: string | null;
  } = {},
): NutritionDetail | null {
  const data = getNutritionById(db, nutritionDataId);
  if (!data) return null;
  return nutritionDataToDetail(data, {
    surface: input.surface ?? 'pantry_item',
    subjectId: input.subjectId ?? data.pantry_item_id ?? data.product_id ?? data.id,
    title: input.title ?? data.product_name ?? data.brand ?? 'Nutrition facts',
    subtitle: input.subtitle ?? data.serving_size_text,
  });
}

export function getNutritionDetailForPantryItem(
  db: DatabaseAdapter,
  pantryItemId: string,
): NutritionDetail {
  const rows = db.query<{
    id: string;
    name: string;
    brand: string | null;
    barcode: string | null;
    product_id: string | null;
    storage_location: string;
    grocery_section: string;
  }>(
    `SELECT
       pi.id,
       pi.name,
       fp.brand,
       pi.barcode,
       pi.product_id,
       pi.storage_location,
       pi.grocery_section
     FROM rc_pantry_items pi
     LEFT JOIN rc_food_products fp ON fp.id = pi.product_id
     WHERE pi.id = ?
     LIMIT 1`,
    [pantryItemId],
  );
  const row = rows[0];
  if (!row) {
    return createMissingNutritionDetail({
      surface: 'pantry_item',
      subjectId: pantryItemId,
      title: 'Pantry item',
      subtitle: 'Nutrition data is missing.',
    });
  }

  const nutrition = getBestNutritionForFoodName(db, row.name, {
    barcode: row.barcode,
    productId: row.product_id,
    pantryItemId: row.id,
  });
  if (!nutrition) {
    return createMissingNutritionDetail({
      surface: 'pantry_item',
      subjectId: row.id,
      title: row.name,
      subtitle: [row.grocery_section, row.storage_location].filter(Boolean).join(' / '),
    });
  }

  return nutritionDataToDetail(nutrition, {
    surface: 'pantry_item',
    subjectId: row.id,
    title: row.name,
    subtitle: [row.brand, nutrition.serving_size_text].filter(Boolean).join(' / ') || null,
  });
}

export function getNutritionDetailForPantryBatch(
  db: DatabaseAdapter,
  pantryBatchId: string,
): NutritionDetail {
  const rows = db.query<{
    id: string;
    pantry_item_id: string;
    item_name: string;
    lot_code: string | null;
    quantity: number | null;
    unit: string | null;
    expiration_date: string | null;
  }>(
    `SELECT
       batch.id,
       batch.pantry_item_id,
       pi.name AS item_name,
       batch.lot_code,
       batch.quantity,
       batch.unit,
       batch.expiration_date
     FROM rc_pantry_batches batch
     INNER JOIN rc_pantry_items pi ON pi.id = batch.pantry_item_id
     WHERE batch.id = ?
     LIMIT 1`,
    [pantryBatchId],
  );
  const row = rows[0];
  if (!row) {
    return createMissingNutritionDetail({
      surface: 'pantry_batch',
      subjectId: pantryBatchId,
      title: 'Pantry batch',
      subtitle: 'Nutrition data is missing.',
    });
  }

  const itemDetail = getNutritionDetailForPantryItem(db, row.pantry_item_id);
  return {
    ...itemDetail,
    surface: 'pantry_batch',
    subjectId: row.id,
    title: row.item_name,
    subtitle: [
      row.lot_code ? `Lot ${row.lot_code}` : null,
      [row.quantity ?? null, row.unit].filter(Boolean).join(' ') || null,
      row.expiration_date ? `Expires ${row.expiration_date}` : null,
    ].filter(Boolean).join(' / ') || itemDetail.subtitle,
  };
}

export function getNutritionDetailForGroceryItem(
  db: DatabaseAdapter,
  shoppingListItemId: string,
): NutritionDetail {
  const rows = db.query<{
    id: string;
    item: string;
    quantity: number | null;
    unit: string | null;
    grocery_section: string;
  }>(
    `SELECT id, item, quantity, unit, grocery_section
     FROM rc_shopping_list_items
     WHERE id = ?
     LIMIT 1`,
    [shoppingListItemId],
  );
  const row = rows[0];
  if (!row) {
    return createMissingNutritionDetail({
      surface: 'grocery_item',
      subjectId: shoppingListItemId,
      title: 'Grocery item',
      subtitle: 'Nutrition data is missing.',
    });
  }

  const nutrition = getBestNutritionForFoodName(db, row.item);
  if (!nutrition) {
    return createMissingNutritionDetail({
      surface: 'grocery_item',
      subjectId: row.id,
      title: row.item,
      subtitle: [row.quantity ?? null, row.unit, row.grocery_section].filter(Boolean).join(' / '),
    });
  }

  return nutritionDataToDetail(nutrition, {
    surface: 'grocery_item',
    subjectId: row.id,
    title: row.item,
    subtitle: [row.quantity ?? null, row.unit, nutrition.serving_size_text].filter(Boolean).join(' / ') || null,
  });
}

const NUTRITION_COLUMNS: Record<string, keyof UpdateNutritionData> = {
  pantry_item_id: 'pantry_item_id',
  product_id: 'product_id',
  barcode: 'barcode',
  product_name: 'product_name',
  brand: 'brand',
  serving_size_text: 'serving_size_text',
  calories: 'calories',
  fat_g: 'fat_g',
  saturated_fat_g: 'saturated_fat_g',
  carbs_g: 'carbs_g',
  fiber_g: 'fiber_g',
  sugar_g: 'sugar_g',
  protein_g: 'protein_g',
  sodium_mg: 'sodium_mg',
  source: 'source',
  source_id: 'source_id',
  source_url: 'source_url',
  confidence: 'confidence',
  serving_basis: 'serving_basis',
  serving_quantity: 'serving_quantity',
  serving_unit: 'serving_unit',
  parent_nutrition_data_id: 'parent_nutrition_data_id',
  is_user_confirmed: 'is_user_confirmed',
  confirmed_at: 'confirmed_at',
  fetched_at: 'fetched_at',
};

export function updateNutritionData(db: DatabaseAdapter, id: string, updates: UpdateNutritionData): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [column, key] of Object.entries(NUTRITION_COLUMNS)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  db.execute(`UPDATE rc_nutrition_data SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteNutritionData(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_nutrition_data WHERE id = ?`, [id]);
}

export function createManualNutritionOverride(
  db: DatabaseAdapter,
  id: string,
  sourceNutritionDataId: string,
  input: Omit<CreateNutritionData, 'source' | 'parent_nutrition_data_id'>,
  confirmationId: string,
): NutritionData {
  const source = getNutritionById(db, sourceNutritionDataId);
  if (!source) {
    throw new Error(`Nutrition source not found: ${sourceNutritionDataId}`);
  }

  const now = new Date().toISOString();
  let created: NutritionData | null = null;

  db.transaction(() => {
    created = createNutritionData(db, id, {
      pantry_item_id: valueOrFallback(input.pantry_item_id, source.pantry_item_id),
      product_id: valueOrFallback(input.product_id, source.product_id),
      barcode: valueOrFallback(input.barcode, source.barcode),
      product_name: valueOrFallback(input.product_name, source.product_name),
      brand: valueOrFallback(input.brand, source.brand),
      serving_size_text: valueOrFallback(input.serving_size_text, source.serving_size_text),
      calories: valueOrFallback(input.calories, source.calories),
      fat_g: valueOrFallback(input.fat_g, source.fat_g),
      saturated_fat_g: valueOrFallback(input.saturated_fat_g, source.saturated_fat_g),
      carbs_g: valueOrFallback(input.carbs_g, source.carbs_g),
      fiber_g: valueOrFallback(input.fiber_g, source.fiber_g),
      sugar_g: valueOrFallback(input.sugar_g, source.sugar_g),
      protein_g: valueOrFallback(input.protein_g, source.protein_g),
      sodium_mg: valueOrFallback(input.sodium_mg, source.sodium_mg),
      source: 'manual',
      source_id: input.source_id ?? null,
      source_url: input.source_url ?? null,
      confidence: input.confidence ?? 1,
      serving_basis: valueOrFallback(input.serving_basis, source.serving_basis),
      serving_quantity: valueOrFallback(input.serving_quantity, source.serving_quantity),
      serving_unit: valueOrFallback(input.serving_unit, source.serving_unit),
      parent_nutrition_data_id: source.id,
      is_user_confirmed: 1,
      confirmed_at: input.confirmed_at ?? now,
      fetched_at: input.fetched_at ?? now,
    });

    recordFoodConfirmation(db, confirmationId, {
      subject_type: 'nutrition_data',
      subject_id: created.id,
      decision: 'manual_override',
      confidence: input.confidence ?? 1,
      notes: 'Manual nutrition override',
    });
  });

  return created!;
}
