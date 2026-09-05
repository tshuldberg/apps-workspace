import type { DatabaseAdapter } from '@mylife/db';
import type {
  ExpiringRecipeSuggestion,
  MatchOptions,
  MatchedIngredient,
  PantryItem,
  RecipeMatch,
  ReceiptLineMatch,
  ReceiptLineMatchInput,
  ReceiptLineMatchOptions,
  ReceiptLineMatchStatus,
  ReceiptLineProductCandidate,
  StructuredIngredient,
  UseNextPantryBatchPrompt,
  UseNextRecipePrompt,
} from '../types';
import { getPantryItems, getExpiringItems } from '../db/pantry';
import { getRecipes } from '../db/crud';
import { resolveNutritionCandidates } from '../db/nutrition';
import {
  extractBarcodeFromReceiptLine,
  fuzzyItemMatch,
  normalizeReceiptLineDescription,
  resolveItemName,
} from './name-normalizer';
import { classifyExpiration, daysUntilExpiration } from './expiration';
import {
  areUnitsCompatible,
  convertUnit,
  getUnitCategory,
  getUnitConversionConfidence,
  normalizeUnit,
} from '../grocery/units';

const MATCH_THRESHOLD = 0.6;
const DEFAULT_MIN_MATCH_PERCENT = 50;
const DEFAULT_MAX_RESULTS = 50;
const AUTO_MATCH_THRESHOLD = 0.86;
const AUTO_MATCH_MARGIN = 0.1;
const CONFIDENT_UNIT_CONVERSION_THRESHOLD = 0.75;

interface NormalizedPantryEntry {
  item: PantryItem;
  normalizedName: string;
}

interface ProductLookupRow {
  id: string;
  canonical_name: string;
  brand: string | null;
  grocery_section: ReceiptLineProductCandidate['grocery_section'];
  default_storage_location: ReceiptLineProductCandidate['storage_location'];
  confidence: number | null;
  is_user_confirmed: number;
  alias_id?: string | null;
  alias_value?: string | null;
  alias_confidence?: number | null;
  nutrition_data_id?: string | null;
  barcode?: string | null;
}

interface UseNextBatchRow {
  pantry_item_id: string;
  pantry_item_name: string;
  batch_id: string;
  expiration_date: string | null;
  quantity: number | null;
  unit: string | null;
  lot_code: string | null;
}

interface QuantitySufficiencyResult {
  sufficient: boolean | null;
  available: number | null;
  unit: string | null;
  status: 'sufficient' | 'insufficient' | 'unknown';
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function quantityStatus(sufficient: boolean | null): QuantitySufficiencyResult['status'] {
  if (sufficient === true) return 'sufficient';
  if (sufficient === false) return 'insufficient';
  return 'unknown';
}

function effectiveNeededUnit(ingredientUnit: string | null, availableUnit: string | null): string | null {
  if (ingredientUnit) return ingredientUnit;
  if (!availableUnit) return null;
  const confidence = getUnitConversionConfidence('item', availableUnit);
  return confidence !== null && confidence >= CONFIDENT_UNIT_CONVERSION_THRESHOLD ? 'item' : null;
}

function unitsAreSameOrBothMissing(left: string | null, right: string | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const leftCanonical = normalizeUnit(left);
  const rightCanonical = normalizeUnit(right);
  if (leftCanonical && rightCanonical) return leftCanonical === rightCanonical;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function resolveQuantitySufficiency(input: {
  neededQuantity: number | null;
  neededUnit: string | null;
  availableQuantity: number | null;
  availableUnit: string | null;
}): QuantitySufficiencyResult {
  if (input.neededQuantity == null || input.availableQuantity == null) {
    return {
      sufficient: null,
      available: input.availableQuantity,
      unit: input.neededUnit ?? input.availableUnit,
      status: 'unknown',
    };
  }

  const neededUnit = effectiveNeededUnit(input.neededUnit, input.availableUnit);
  const neededCanonical = normalizeUnit(neededUnit);

  if (unitsAreSameOrBothMissing(neededUnit, input.availableUnit)) {
    const sufficient = input.availableQuantity >= input.neededQuantity;
    return {
      sufficient,
      available: input.availableQuantity,
      unit: neededCanonical ?? neededUnit ?? input.availableUnit,
      status: quantityStatus(sufficient),
    };
  }

  if (
    neededUnit &&
    input.availableUnit &&
    areUnitsCompatible(input.availableUnit, neededUnit)
  ) {
    const converted = convertUnit(input.availableQuantity, input.availableUnit, neededUnit);
    const confidence = getUnitConversionConfidence(input.availableUnit, neededUnit);
    if (converted !== null) {
      if (confidence === null || confidence < CONFIDENT_UNIT_CONVERSION_THRESHOLD) {
        return {
          sufficient: null,
          available: roundQuantity(converted),
          unit: neededCanonical ?? neededUnit,
          status: 'unknown',
        };
      }
      const sufficient = converted >= input.neededQuantity;
      return {
        sufficient,
        available: roundQuantity(converted),
        unit: neededCanonical ?? neededUnit,
        status: quantityStatus(sufficient),
      };
    }
  }

  if (!input.neededUnit && getUnitCategory(input.availableUnit) === 'count') {
    const confidence = getUnitConversionConfidence('item', input.availableUnit);
    if (confidence !== null && confidence >= CONFIDENT_UNIT_CONVERSION_THRESHOLD) {
      const converted = convertUnit(input.availableQuantity, input.availableUnit!, 'item') ?? input.availableQuantity;
      const sufficient = converted >= input.neededQuantity;
      return {
        sufficient,
        available: roundQuantity(converted),
        unit: 'item',
        status: quantityStatus(sufficient),
      };
    }
  }

  return {
    sufficient: null,
    available: input.availableQuantity,
    unit: input.neededUnit ?? input.availableUnit,
    status: 'unknown',
  };
}

function resolveBatchQuantitySufficiency(
  ingredient: MatchedIngredient,
  batches: UseNextPantryBatchPrompt[],
): QuantitySufficiencyResult {
  if (ingredient.quantityNeeded == null) {
    return {
      sufficient: null,
      available: null,
      unit: ingredient.unit,
      status: 'unknown',
    };
  }

  const neededUnit = effectiveNeededUnit(ingredient.unit, batches[0]?.unit ?? null);
  let total = 0;
  let hasQuantity = false;
  for (const batch of batches) {
    if (batch.quantity == null) continue;
    hasQuantity = true;
    if (!neededUnit && !batch.unit) {
      total += batch.quantity;
      continue;
    }
    if (unitsAreSameOrBothMissing(neededUnit, batch.unit)) {
      total += batch.quantity;
      continue;
    }
    if (neededUnit && batch.unit && areUnitsCompatible(batch.unit, neededUnit)) {
      const converted = convertUnit(batch.quantity, batch.unit, neededUnit);
      const confidence = getUnitConversionConfidence(batch.unit, neededUnit);
      if (converted === null || confidence === null || confidence < CONFIDENT_UNIT_CONVERSION_THRESHOLD) {
        return {
          sufficient: null,
          available: total > 0 ? roundQuantity(total) : batch.quantity,
          unit: neededUnit,
          status: 'unknown',
        };
      }
      total += converted;
      continue;
    }
    return {
      sufficient: null,
      available: total > 0 ? roundQuantity(total) : batch.quantity,
      unit: neededUnit ?? batch.unit,
      status: 'unknown',
    };
  }

  if (!hasQuantity) {
    return {
      sufficient: null,
      available: null,
      unit: neededUnit ?? ingredient.unit,
      status: 'unknown',
    };
  }

  const sufficient = total >= ingredient.quantityNeeded;
  return {
    sufficient,
    available: roundQuantity(total),
    unit: neededUnit ?? ingredient.unit,
    status: quantityStatus(sufficient),
  };
}

function receiptTextScore(left: string, right: string): number {
  if (!left.trim() || !right.trim()) return 0;
  const score = fuzzyItemMatch(left, right);
  if (score > 0) return score;

  const leftWords = new Set(resolveItemName(left).split(' ').filter((word) => word.length > 2));
  const rightWords = new Set(resolveItemName(right).split(' ').filter((word) => word.length > 2));
  if (leftWords.size === 0 || rightWords.size === 0) return 0;

  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return Math.max(shared / leftWords.size, shared / rightWords.size);
}

function candidateKey(candidate: ReceiptLineProductCandidate): string {
  return [
    candidate.source,
    candidate.product_id,
    candidate.pantry_item_id,
    candidate.nutrition_data_id,
    candidate.barcode,
    candidate.label,
  ].join('|');
}

function addReceiptCandidate(
  candidates: Map<string, ReceiptLineProductCandidate>,
  candidate: ReceiptLineProductCandidate,
): void {
  const key = candidateKey(candidate);
  const existing = candidates.get(key);
  if (!existing || candidate.confidence > existing.confidence) {
    candidates.set(key, { ...candidate, confidence: clampConfidence(candidate.confidence) });
  }
}

function productLabel(row: ProductLookupRow): string {
  return [row.brand, row.canonical_name].filter(Boolean).join(' ') || row.canonical_name;
}

function productCandidate(
  row: ProductLookupRow,
  source: ReceiptLineProductCandidate['source'],
  confidence: number,
  reason: string,
): ReceiptLineProductCandidate {
  return {
    id: `${source}:${row.id}:${row.alias_id ?? row.nutrition_data_id ?? row.barcode ?? 'product'}`,
    source,
    label: productLabel(row),
    product_id: row.id,
    pantry_item_id: null,
    nutrition_data_id: row.nutrition_data_id ?? null,
    barcode: row.barcode ?? null,
    confidence,
    reason,
    grocery_section: row.grocery_section ?? null,
    storage_location: row.default_storage_location ?? null,
  };
}

function resolveReceiptMatchStatus(candidates: ReceiptLineProductCandidate[]): {
  status: ReceiptLineMatch['status'];
  confidence: number | null;
  reason: string | null;
} {
  const top = candidates[0];
  if (!top) {
    return { status: 'unmatched', confidence: null, reason: 'No product, pantry, or nutrition candidate matched.' };
  }

  const second = candidates[1];
  const margin = top.confidence - (second?.confidence ?? 0);
  if (top.confidence >= AUTO_MATCH_THRESHOLD && margin >= AUTO_MATCH_MARGIN) {
    return { status: 'matched', confidence: top.confidence, reason: top.reason };
  }

  return {
    status: 'ambiguous',
    confidence: top.confidence,
    reason: second
      ? `Top candidates are close: ${top.label} and ${second.label}.`
      : top.reason,
  };
}

export async function matchReceiptLineToPantry(
  db: DatabaseAdapter,
  line: ReceiptLineMatchInput,
  options: ReceiptLineMatchOptions = {},
): Promise<ReceiptLineMatch> {
  const normalizedName = normalizeReceiptLineDescription(line.description);
  const barcode = extractBarcodeFromReceiptLine(line.description);
  const candidates = new Map<string, ReceiptLineProductCandidate>();

  if (normalizedName) {
    for (const item of getPantryItems(db)) {
      const score = receiptTextScore(normalizedName, item.name);
      if (score < MATCH_THRESHOLD) continue;
      addReceiptCandidate(candidates, {
        id: `pantry_item:${item.id}`,
        source: 'pantry_item',
        label: item.name,
        product_id: item.product_id,
        pantry_item_id: item.id,
        nutrition_data_id: item.nutrition_data_id,
        barcode: item.barcode,
        confidence: clampConfidence(score * 0.78 + (item.confirmation_status === 'confirmed' ? 0.16 : 0.04)),
        reason: 'Matches an existing pantry item.',
        grocery_section: item.grocery_section,
        storage_location: item.storage_location,
      });
    }
  }

  if (barcode) {
    const rows = db.query<ProductLookupRow>(
      `SELECT
         p.id,
         p.canonical_name,
         p.brand,
         p.grocery_section,
         p.default_storage_location,
         p.confidence,
         p.is_user_confirmed,
         a.id AS alias_id,
         a.alias_value,
         a.confidence AS alias_confidence,
         nd.id AS nutrition_data_id,
         COALESCE(nd.barcode, a.normalized_value) AS barcode
       FROM rc_food_product_aliases a
       INNER JOIN rc_food_products p ON p.id = a.product_id
       LEFT JOIN rc_nutrition_data nd ON nd.product_id = p.id
       WHERE a.alias_type = 'barcode'
         AND a.normalized_value = ?
       ORDER BY a.is_user_confirmed DESC, a.confidence DESC, nd.is_user_confirmed DESC, nd.confidence DESC
       LIMIT 8`,
      [barcode],
    );
    for (const row of rows) {
      addReceiptCandidate(
        candidates,
        productCandidate(
          row,
          'barcode_alias',
          row.is_user_confirmed === 1 ? 0.99 : row.alias_confidence ?? 0.94,
          'Barcode alias matched a known product.',
        ),
      );
    }
  }

  if (normalizedName) {
    const aliasRows = db.query<ProductLookupRow>(
      `SELECT
         p.id,
         p.canonical_name,
         p.brand,
         p.grocery_section,
         p.default_storage_location,
         p.confidence,
         p.is_user_confirmed,
         a.id AS alias_id,
         a.alias_value,
         a.confidence AS alias_confidence,
         nd.id AS nutrition_data_id,
         nd.barcode
       FROM rc_food_product_aliases a
       INNER JOIN rc_food_products p ON p.id = a.product_id
       LEFT JOIN rc_nutrition_data nd ON nd.product_id = p.id
       WHERE a.alias_type IN ('receipt_line', 'name', 'ocr_label')
         AND a.normalized_value = ?
       ORDER BY a.is_user_confirmed DESC, a.confidence DESC, nd.is_user_confirmed DESC, nd.confidence DESC
       LIMIT 8`,
      [normalizedName],
    );
    for (const row of aliasRows) {
      addReceiptCandidate(
        candidates,
        productCandidate(
          row,
          'product_alias',
          row.is_user_confirmed === 1 ? 0.94 : row.alias_confidence ?? 0.88,
          'Receipt wording matched a known product alias.',
        ),
      );
    }

    const productRows = db.query<ProductLookupRow>(
      `SELECT
         p.id,
         p.canonical_name,
         p.brand,
         p.grocery_section,
         p.default_storage_location,
         p.confidence,
         p.is_user_confirmed,
         NULL AS alias_id,
         NULL AS alias_value,
         NULL AS alias_confidence,
         nd.id AS nutrition_data_id,
         nd.barcode
       FROM rc_food_products p
       LEFT JOIN rc_nutrition_data nd ON nd.product_id = p.id
       ORDER BY p.is_user_confirmed DESC, p.confidence DESC, nd.is_user_confirmed DESC, nd.confidence DESC
       LIMIT 500`,
    );
    for (const row of productRows) {
      const score = receiptTextScore(normalizedName, productLabel(row));
      if (score < MATCH_THRESHOLD) continue;
      addReceiptCandidate(
        candidates,
        productCandidate(
          row,
          'product_cache',
          clampConfidence(score * 0.78 + (row.is_user_confirmed === 1 ? 0.12 : row.confidence ?? 0.04)),
          'Product cache name matched the receipt line.',
        ),
      );
    }
  }

  const topProductId = Array.from(candidates.values())
    .sort((left, right) => right.confidence - left.confidence)
    .find((candidate) => candidate.product_id)?.product_id ?? null;
  const nutrition = await resolveNutritionCandidates(db, {
    barcode,
    query: normalizedName || line.description,
    productId: topProductId,
    includeNetwork: options.includeNetworkNutrition ?? false,
  }, options.nutritionProviders ?? []);

  for (const candidate of nutrition.candidates.slice(0, 6)) {
    addReceiptCandidate(candidates, {
      id: `nutrition_candidate:${candidate.id}`,
      source: 'nutrition_candidate',
      label: [candidate.brand, candidate.product_name].filter(Boolean).join(' ') || normalizedName || line.description,
      product_id: candidate.product_id,
      pantry_item_id: null,
      nutrition_data_id: candidate.nutrition_data_id,
      barcode: candidate.barcode,
      confidence: clampConfidence(candidate.confidence * (candidate.completeness === 'incomplete' ? 0.7 : 0.92)),
      reason: `${candidate.display.shortLabel} nutrition candidate is available.`,
      grocery_section: null,
      storage_location: null,
      nutritionCandidate: candidate,
    });
  }

  const sortedCandidates = Array.from(candidates.values())
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 12);
  const resolved = resolveReceiptMatchStatus(sortedCandidates);
  return {
    normalizedName,
    status: resolved.status as Exclude<ReceiptLineMatchStatus, 'confirmed' | 'ignored'>,
    confidence: resolved.confidence,
    reason: resolved.reason,
    candidates: sortedCandidates,
  };
}

export function matchRecipesToPantry(
  db: DatabaseAdapter,
  options?: MatchOptions,
): RecipeMatch[] {
  const minMatchPercent = options?.minMatchPercent ?? DEFAULT_MIN_MATCH_PERCENT;
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
  const includeStaples = options?.includeStaplesAsAvailable ?? true;

  const pantryItems = getPantryItems(db);
  const pantryLookup: NormalizedPantryEntry[] = pantryItems.map((item) => ({
    item,
    normalizedName: resolveItemName(item.name),
  }));

  const stapleNames = new Set<string>();
  if (includeStaples) {
    const stapleRows = db.query<{ item: string }>('SELECT item FROM rc_pantry_staples');
    for (const row of stapleRows) {
      stapleNames.add(resolveItemName(row.item));
    }
  }

  const recipes = getRecipes(db, { limit: 500 });
  const results: RecipeMatch[] = [];

  for (const recipe of recipes) {
    const ingredients = db.query<StructuredIngredient>(
      `SELECT
        id,
        recipe_id,
        section,
        quantity_value,
        quantity,
        unit,
        COALESCE(item, name) AS item,
        name,
        prep_note,
        COALESCE(is_optional, 0) AS is_optional,
        sort_order
       FROM rc_ingredients
       WHERE recipe_id = ?
       ORDER BY sort_order`,
      [recipe.id],
    );
    if (ingredients.length === 0) continue;

    const availableIngredients: MatchedIngredient[] = [];
    const missingIngredients: MatchedIngredient[] = [];
    for (const ingredient of ingredients) {
      const matched = matchIngredientToPantry(ingredient, pantryLookup, stapleNames);
      if (matched.pantryItemId !== null || matched.matchScore > 0) {
        availableIngredients.push(matched);
      } else {
        missingIngredients.push(matched);
      }
    }

    const totalIngredients = ingredients.length;
    const matchedIngredients = availableIngredients.length;
    const matchPercentage =
      totalIngredients > 0 ? Math.round((matchedIngredients / totalIngredients) * 100) : 0;

    if (matchPercentage >= minMatchPercent) {
      results.push({
        recipeId: recipe.id,
        title: recipe.title,
        totalIngredients,
        matchedIngredients,
        missingIngredients,
        availableIngredients,
        matchPercentage,
        canMake:
          matchedIngredients === totalIngredients &&
          availableIngredients.every((ingredient) => ingredient.quantitySufficient !== false),
      });
    }
  }

  results.sort((left, right) => {
    if (right.matchPercentage !== left.matchPercentage) {
      return right.matchPercentage - left.matchPercentage;
    }
    return left.title.localeCompare(right.title);
  });

  return results.slice(0, maxResults);
}

export function suggestRecipesForExpiringItems(
  db: DatabaseAdapter,
  daysAhead = 5,
  maxResults = 10,
): ExpiringRecipeSuggestion[] {
  const expiringItems = getExpiringItems(db, daysAhead);
  if (expiringItems.length === 0) {
    return [];
  }

  const expiringLookup = expiringItems.map((item) => ({
    item,
    normalizedName: resolveItemName(item.name),
    daysLeft: item.expiration_date ? daysUntilExpiration(item.expiration_date) : daysAhead,
  }));

  const allMatches = matchRecipesToPantry(db, { minMatchPercent: 30, maxResults: 100 });
  const suggestions: ExpiringRecipeSuggestion[] = [];

  for (const match of allMatches) {
    const usedExpiringItems: Array<{ name: string; daysLeft: number }> = [];
    for (const available of match.availableIngredients) {
      for (const expiring of expiringLookup) {
        if (
          available.pantryItemId === expiring.item.id ||
          fuzzyItemMatch(available.ingredientItem, expiring.item.name) >= MATCH_THRESHOLD
        ) {
          usedExpiringItems.push({
            name: expiring.item.name,
            daysLeft: expiring.daysLeft,
          });
        }
      }
    }

    if (usedExpiringItems.length > 0) {
      suggestions.push({ recipe: match, expiringItems: usedExpiringItems });
    }
  }

  suggestions.sort((left, right) => {
    if (right.expiringItems.length !== left.expiringItems.length) {
      return right.expiringItems.length - left.expiringItems.length;
    }
    const leftMin = Math.min(...left.expiringItems.map((item) => item.daysLeft));
    const rightMin = Math.min(...right.expiringItems.map((item) => item.daysLeft));
    return leftMin - rightMin;
  });

  return suggestions.slice(0, maxResults);
}

function getUseNextBatchPrompts(
  db: DatabaseAdapter,
  daysAhead: number,
): UseNextPantryBatchPrompt[] {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureString = futureDate.toISOString().split('T')[0];
  const rows = db.query<UseNextBatchRow>(
    `SELECT
       item.id AS pantry_item_id,
       item.name AS pantry_item_name,
       batch.id AS batch_id,
       batch.expiration_date,
       batch.quantity,
       batch.unit,
       batch.lot_code
     FROM rc_pantry_batches batch
     INNER JOIN rc_pantry_items item ON item.id = batch.pantry_item_id
     WHERE batch.expiration_date IS NOT NULL
       AND batch.expiration_date <= ?
       AND (batch.quantity IS NULL OR batch.quantity > 0)
     ORDER BY batch.expiration_date ASC, item.name ASC
     LIMIT 100`,
    [futureString],
  );

  return rows.map((row) => {
    const daysLeft = row.expiration_date ? daysUntilExpiration(row.expiration_date) : null;
    return {
      pantryItemId: row.pantry_item_id,
      pantryItemName: row.pantry_item_name,
      batchId: row.batch_id,
      expirationDate: row.expiration_date,
      daysLeft,
      status: classifyExpiration(row.expiration_date),
      quantity: row.quantity,
      unit: row.unit,
      lotCode: row.lot_code,
      ingredientId: null,
      ingredientItem: null,
      quantityNeeded: null,
      neededUnit: null,
      quantityAvailable: null,
      availableUnit: null,
      quantitySufficient: null,
      sufficiencyStatus: 'unknown',
    };
  });
}

export function suggestRecipesForUseNextBatches(
  db: DatabaseAdapter,
  daysAhead = 5,
  maxResults = 6,
): UseNextRecipePrompt[] {
  const batches = getUseNextBatchPrompts(db, daysAhead);
  if (batches.length === 0) return [];

  const recipeMatches = matchRecipesToPantry(db, { minMatchPercent: 25, maxResults: 100 });
  const prompts: UseNextRecipePrompt[] = [];

  for (const recipe of recipeMatches) {
    const batchesByIngredient = new Map<string, {
      ingredient: MatchedIngredient;
      batches: UseNextPantryBatchPrompt[];
    }>();
    for (const ingredient of recipe.availableIngredients) {
      for (const batch of batches) {
        if (
          ingredient.pantryItemId === batch.pantryItemId ||
          fuzzyItemMatch(ingredient.ingredientItem, batch.pantryItemName) >= MATCH_THRESHOLD
        ) {
          const existing = batchesByIngredient.get(ingredient.ingredientId) ?? {
            ingredient,
            batches: [],
          };
          if (!existing.batches.some((entry) => entry.batchId === batch.batchId)) {
            existing.batches.push(batch);
          }
          batchesByIngredient.set(ingredient.ingredientId, existing);
        }
      }
    }

    if (batchesByIngredient.size === 0) continue;
    const matchedPrompts = new Map<string, UseNextPantryBatchPrompt>();
    for (const { ingredient, batches: ingredientBatches } of batchesByIngredient.values()) {
      const quantityResult = resolveBatchQuantitySufficiency(ingredient, ingredientBatches);
      for (const batch of ingredientBatches) {
        const promptBatch: UseNextPantryBatchPrompt = {
          ...batch,
          ingredientId: ingredient.ingredientId,
          ingredientItem: ingredient.ingredientItem,
          quantityNeeded: ingredient.quantityNeeded,
          neededUnit: quantityResult.unit ?? ingredient.unit,
          quantityAvailable: quantityResult.available,
          availableUnit: quantityResult.unit ?? ingredient.unit ?? batch.unit,
          quantitySufficient: quantityResult.sufficient,
          sufficiencyStatus: quantityResult.status,
        };
        const key = `${batch.batchId}:${ingredient.ingredientId}`;
        matchedPrompts.set(key, promptBatch);
      }
    }
    const useNextBatches = Array.from(matchedPrompts.values()).sort((left, right) => {
      const leftDays = left.daysLeft ?? Number.POSITIVE_INFINITY;
      const rightDays = right.daysLeft ?? Number.POSITIVE_INFINITY;
      if (leftDays !== rightDays) return leftDays - rightDays;
      return left.pantryItemName.localeCompare(right.pantryItemName);
    });
    const urgencyScore = useNextBatches.reduce((score, batch) => {
      const daysLeft = batch.daysLeft ?? daysAhead;
      return score + Math.max(0, daysAhead + 1 - daysLeft);
    }, recipe.matchPercentage / 100);
    const hasInsufficientUseNext = useNextBatches.some((batch) => batch.quantitySufficient === false);
    const hasUnknownUseNext = useNextBatches.some((batch) => batch.sufficiencyStatus === 'unknown');
    const promptStatus: UseNextRecipePrompt['promptStatus'] =
      !recipe.canMake || hasInsufficientUseNext
        ? 'needs_more'
        : hasUnknownUseNext
          ? 'check_units'
          : 'ready_to_cook';

    prompts.push({
      recipe,
      useNextBatches,
      urgencyScore,
      readyToCook: promptStatus === 'ready_to_cook',
      promptStatus,
    });
  }

  return prompts
    .sort((left, right) => {
      if (right.urgencyScore !== left.urgencyScore) return right.urgencyScore - left.urgencyScore;
      const leftDays = Math.min(...left.useNextBatches.map((batch) => batch.daysLeft ?? daysAhead));
      const rightDays = Math.min(...right.useNextBatches.map((batch) => batch.daysLeft ?? daysAhead));
      if (leftDays !== rightDays) return leftDays - rightDays;
      return right.recipe.matchPercentage - left.recipe.matchPercentage;
    })
    .slice(0, maxResults);
}

export function calculateMaxServings(
  db: DatabaseAdapter,
  recipeId: string,
  baseServings = 1,
): number {
  if (baseServings <= 0) return 0;

  const pantryItems = getPantryItems(db);
  const ingredients = db.query<StructuredIngredient>(
    `SELECT
      id,
      recipe_id,
      section,
      quantity_value,
      quantity,
      unit,
      COALESCE(item, name) AS item,
      name,
      prep_note,
      COALESCE(is_optional, 0) AS is_optional,
      sort_order
     FROM rc_ingredients
     WHERE recipe_id = ?
     ORDER BY sort_order`,
    [recipeId],
  );

  let maxMultiplier = Number.POSITIVE_INFINITY;
  for (const ingredient of ingredients) {
    if (ingredient.is_optional || ingredient.quantity_value == null) {
      continue;
    }

    const pantryMatch = pantryItems
      .map((item) => ({ item, score: fuzzyItemMatch(ingredient.item, item.name) }))
      .filter((entry) => entry.score >= MATCH_THRESHOLD)
      .sort((left, right) => right.score - left.score)[0];

    if (!pantryMatch || pantryMatch.item.quantity == null) {
      return 0;
    }

    let available = pantryMatch.item.quantity;
    if (
      ingredient.unit &&
      pantryMatch.item.unit &&
      ingredient.unit !== pantryMatch.item.unit &&
      areUnitsCompatible(pantryMatch.item.unit, ingredient.unit)
    ) {
      const converted = convertUnit(pantryMatch.item.quantity, pantryMatch.item.unit, ingredient.unit);
      if (converted !== null) {
        available = converted;
      }
    }

    maxMultiplier = Math.min(maxMultiplier, available / ingredient.quantity_value);
  }

  if (!Number.isFinite(maxMultiplier)) {
    return baseServings;
  }

  return Math.max(0, Math.floor(maxMultiplier * baseServings));
}

function matchIngredientToPantry(
  ingredient: StructuredIngredient,
  pantryLookup: NormalizedPantryEntry[],
  stapleNames: Set<string>,
): MatchedIngredient {
  const resolvedName = resolveItemName(ingredient.item);

  let bestMatch: NormalizedPantryEntry | null = null;
  let bestScore = 0;
  for (const entry of pantryLookup) {
    const score = fuzzyItemMatch(ingredient.item, entry.item.name);
    if (score >= MATCH_THRESHOLD && score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    const quantityResult = checkQuantitySufficiency(ingredient, bestMatch.item);
    return {
      ingredientId: ingredient.id,
      ingredientItem: ingredient.item,
      pantryItemId: bestMatch.item.id,
      pantryItemName: bestMatch.item.name,
      matchScore: bestScore,
      quantitySufficient: quantityResult.sufficient,
      quantityNeeded: ingredient.quantity_value,
      quantityAvailable: quantityResult.available,
      unit: ingredient.unit,
    };
  }

  if (stapleNames.has(resolvedName)) {
    return {
      ingredientId: ingredient.id,
      ingredientItem: ingredient.item,
      pantryItemId: null,
      pantryItemName: null,
      matchScore: 1,
      quantitySufficient: null,
      quantityNeeded: ingredient.quantity_value,
      quantityAvailable: null,
      unit: ingredient.unit,
    };
  }

  return {
    ingredientId: ingredient.id,
    ingredientItem: ingredient.item,
    pantryItemId: null,
    pantryItemName: null,
    matchScore: 0,
    quantitySufficient: null,
    quantityNeeded: ingredient.quantity_value,
    quantityAvailable: null,
    unit: ingredient.unit,
  };
}

function checkQuantitySufficiency(
  ingredient: StructuredIngredient,
  pantryItem: PantryItem,
): { sufficient: boolean | null; available: number | null } {
  const result = resolveQuantitySufficiency({
    neededQuantity: ingredient.quantity_value,
    neededUnit: ingredient.unit,
    availableQuantity: pantryItem.quantity,
    availableUnit: pantryItem.unit,
  });
  return { sufficient: result.sufficient, available: result.available };
}
