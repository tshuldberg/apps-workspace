import type { DatabaseAdapter } from '@mylife/db';
import type {
  NutritionBreakdown,
  NutritionCandidateCompleteness,
  NutritionData,
  NutritionDetail,
  NutritionHealthSummary,
  NutritionSourceSummary,
  RecipeNutritionSummary,
} from '../types';
import { emptyBreakdown, addNutrient, divideBreakdown } from '@mylife/nutrition-engine';
import {
  buildNutritionHealthSummary,
  getNutritionForItem,
  getNutritionMissingFields,
  getNutritionSourceDisplayData,
  nutritionFactsWithAddedSugar,
} from '../db/nutrition';
import { getReusableUnitConversionCorrections } from '../db/unit-conversions';
import { parseIngredientText } from '../parser/ingredient-parser';
import { resolveIngredientNutritionScale } from '../grocery/units';
import { fuzzyItemMatch } from '../pantry';

const MATCH_THRESHOLD = 0.6;

interface IngredientRow {
  id: string;
  item: string | null;
  name: string;
  quantity_value: number | null;
  quantity?: string | null;
  unit: string | null;
}

interface PantryRow {
  id: string;
  name: string;
}

export interface IngredientListNutritionInput {
  recipeId: string;
  servings?: number | null;
  ingredients: IngredientRow[];
}

interface DishSubmissionRow {
  id: string;
  ingredients_json: string;
}

function addScaledNutrition(total: NutritionBreakdown, nutrition: NutritionData, scale: number): void {
  total.calories = addNutrient(total.calories, nutrition.calories !== null ? nutrition.calories * scale : null);
  total.fat_g = addNutrient(total.fat_g, nutrition.fat_g !== null ? nutrition.fat_g * scale : null);
  total.saturated_fat_g = addNutrient(total.saturated_fat_g, nutrition.saturated_fat_g !== null ? nutrition.saturated_fat_g * scale : null);
  total.carbs_g = addNutrient(total.carbs_g, nutrition.carbs_g !== null ? nutrition.carbs_g * scale : null);
  total.fiber_g = addNutrient(total.fiber_g, nutrition.fiber_g !== null ? nutrition.fiber_g * scale : null);
  total.sugar_g = addNutrient(total.sugar_g, nutrition.sugar_g !== null ? nutrition.sugar_g * scale : null);
  total.protein_g = addNutrient(total.protein_g, nutrition.protein_g !== null ? nutrition.protein_g * scale : null);
  total.sodium_mg = addNutrient(total.sodium_mg, nutrition.sodium_mg !== null ? nutrition.sodium_mg * scale : null);
}

function nutritionCompleteness(nutrition: NutritionBreakdown): NutritionCandidateCompleteness {
  const values = Object.values(nutrition);
  const present = values.filter((value) => value !== null).length;
  if (present === 0) return 'incomplete';
  if (
    nutrition.calories !== null &&
    nutrition.protein_g !== null &&
    nutrition.carbs_g !== null &&
    nutrition.fat_g !== null
  ) {
    return 'complete';
  }
  return 'partial';
}

function rowBreakdown(row: NutritionData): NutritionBreakdown {
  return {
    calories: row.calories,
    fat_g: row.fat_g,
    saturated_fat_g: row.saturated_fat_g,
    carbs_g: row.carbs_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    protein_g: row.protein_g,
    sodium_mg: row.sodium_mg,
  };
}

function nutritionConfidence(row: NutritionData): number {
  if (typeof row.confidence === 'number' && Number.isFinite(row.confidence)) {
    return Math.max(0, Math.min(1, row.confidence));
  }
  return row.is_user_confirmed === 1 ? 0.98 : 0.5;
}

function emptyRecipeSummary(recipeId: string, servings: number): RecipeNutritionSummary {
  const total = emptyBreakdown();
  return {
    recipeId,
    servings,
    perServing: emptyBreakdown(),
    total,
    coverage: 0,
    coveragePercent: 0,
    missingIngredients: [],
    conversionConfidence: 0,
    lowConfidenceIngredients: [],
    lowConfidenceWarnings: [],
    missingIngredientDetails: [],
    ambiguousConversions: [],
    sourceBreakdown: [],
    missingFields: getNutritionMissingFields(nutritionFactsWithAddedSugar(total)),
    ingredientConversions: [],
  };
}

function addSourceBreakdown(
  map: Map<string, NutritionSourceSummary>,
  row: NutritionData,
  confidence: number,
): void {
  const display = getNutritionSourceDisplayData(
    row.source,
    confidence,
    nutritionCompleteness(rowBreakdown(row)),
  );
  const key = `${row.source}:${row.source_id ?? ''}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      source: row.source,
      label: display.label,
      sourceId: row.source_id,
      count: 1,
      confidence,
      confirmedCount: row.is_user_confirmed === 1 ? 1 : 0,
    });
    return;
  }

  existing.count += 1;
  existing.confirmedCount += row.is_user_confirmed === 1 ? 1 : 0;
  existing.confidence = existing.confidence === null
    ? confidence
    : Math.round(((existing.confidence * (existing.count - 1)) + confidence) / existing.count * 100) / 100;
}

function parseAdHocIngredients(submissionId: string, raw: string): IngredientRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry, index) => {
      const parsedIngredient = parseIngredientText(entry);
      return {
        id: `${submissionId}:ingredient:${index}`,
        item: parsedIngredient.item,
        name: entry,
        quantity: parsedIngredient.quantity === null ? null : String(parsedIngredient.quantity),
        quantity_value: parsedIngredient.quantity,
        unit: parsedIngredient.unit,
      };
    });
}

export function calculateIngredientListNutrition(
  db: DatabaseAdapter,
  input: IngredientListNutritionInput,
): RecipeNutritionSummary {
  const effectiveServings = input.servings && input.servings > 0 ? input.servings : 1;
  if (input.ingredients.length === 0) {
    return emptyRecipeSummary(input.recipeId, effectiveServings);
  }

  const pantryItems = db.query<PantryRow>(`SELECT id, name FROM rc_pantry_items`, []);
  const unitConversionCorrections = getReusableUnitConversionCorrections(db);
  const total = emptyBreakdown();
  const missingIngredients: string[] = [];
  const lowConfidenceIngredients: string[] = [];
  const lowConfidenceWarnings: string[] = [];
  const ingredientConversions: RecipeNutritionSummary['ingredientConversions'] = [];
  const missingIngredientDetails: RecipeNutritionSummary['missingIngredientDetails'] = [];
  const ambiguousConversions: RecipeNutritionSummary['ambiguousConversions'] = [];
  const sourceMap = new Map<string, NutritionSourceSummary>();
  let matchedCount = 0;
  let confidenceTotal = 0;

  for (const ingredient of input.ingredients) {
    const ingredientName = ingredient.item || ingredient.name;

    let bestMatch: PantryRow | null = null;
    let bestScore = 0;

    for (const pantryItem of pantryItems) {
      const score = fuzzyItemMatch(ingredientName, pantryItem.name);
      if (score > bestScore && score >= MATCH_THRESHOLD) {
        bestScore = score;
        bestMatch = pantryItem;
      }
    }

    if (!bestMatch) {
      missingIngredients.push(ingredientName);
      missingIngredientDetails.push({
        ingredientId: ingredient.id,
        ingredientName,
        reason: 'no_pantry_match',
        quantity: ingredient.quantity_value,
        unit: ingredient.unit,
      });
      continue;
    }

    const nutrition = getNutritionForItem(db, bestMatch.id);
    if (!nutrition) {
      missingIngredients.push(ingredientName);
      missingIngredientDetails.push({
        ingredientId: ingredient.id,
        ingredientName,
        reason: 'no_nutrition_data',
        quantity: ingredient.quantity_value,
        unit: ingredient.unit,
      });
      continue;
    }

    const conversion = resolveIngredientNutritionScale({
      ingredientName,
      quantity: ingredient.quantity_value,
      unit: ingredient.unit,
      nutrition,
      corrections: unitConversionCorrections,
    });
    const confidence = nutritionConfidence(nutrition);
    const display = getNutritionSourceDisplayData(
      nutrition.source,
      confidence,
      nutritionCompleteness(rowBreakdown(nutrition)),
    );

    addScaledNutrition(total, nutrition, conversion.scale);
    addSourceBreakdown(sourceMap, nutrition, confidence);

    confidenceTotal += conversion.confidence;
    if (conversion.confidence < 0.65) {
      lowConfidenceIngredients.push(ingredientName);
      lowConfidenceWarnings.push(`${ingredientName}: ${conversion.warnings.join(', ') || 'Low conversion confidence'}`);
      ambiguousConversions.push({
        ingredientId: ingredient.id,
        ingredientName,
        confidence: conversion.confidence,
        warnings: conversion.warnings,
      });
    }
    ingredientConversions.push({
      ingredientId: ingredient.id,
      ingredientName,
      pantryItemId: bestMatch.id,
      pantryItemName: bestMatch.name,
      nutritionDataId: nutrition.id,
      nutritionSource: nutrition.source,
      sourceId: nutrition.source_id,
      sourceLabel: display.label,
      confidenceLabel: display.confidenceLabel,
      fetchedAt: nutrition.fetched_at,
      confirmedAt: nutrition.confirmed_at,
      isUserConfirmed: nutrition.is_user_confirmed === 1,
      missingFields: getNutritionMissingFields(nutritionFactsWithAddedSugar(nutrition)),
      scale: conversion.scale,
      confidence: conversion.confidence,
      basis: conversion.basis,
      ingredientQuantity: conversion.ingredientQuantity,
      ingredientUnit: conversion.ingredientUnit,
      referenceQuantity: conversion.referenceQuantity,
      referenceUnit: conversion.referenceUnit,
      warnings: conversion.warnings,
    });

    matchedCount++;
  }

  const coverage = matchedCount / input.ingredients.length;

  return {
    recipeId: input.recipeId,
    servings: effectiveServings,
    perServing: divideBreakdown(total, effectiveServings),
    total,
    coverage,
    coveragePercent: Math.round(coverage * 100),
    missingIngredients,
    conversionConfidence: matchedCount > 0 ? confidenceTotal / matchedCount : 0,
    lowConfidenceIngredients,
    lowConfidenceWarnings,
    missingIngredientDetails,
    ambiguousConversions,
    sourceBreakdown: Array.from(sourceMap.values()).sort((a, b) => b.count - a.count),
    missingFields: getNutritionMissingFields(nutritionFactsWithAddedSugar(total)),
    ingredientConversions,
  };
}

export function calculateRecipeNutrition(
  db: DatabaseAdapter,
  recipeId: string,
): RecipeNutritionSummary {
  const recipe = db.query<{ servings: number | null }>(
    `SELECT servings FROM rc_recipes WHERE id = ?`,
    [recipeId],
  );
  const servings = recipe[0]?.servings ?? 1;

  const ingredients = db.query<IngredientRow>(
    `SELECT id, item, name, quantity, quantity_value, unit FROM rc_ingredients WHERE recipe_id = ?`,
    [recipeId],
  );

  return calculateIngredientListNutrition(db, {
    recipeId,
    servings,
    ingredients,
  });
}

export function calculateDishNutrition(
  db: DatabaseAdapter,
  dishId: string,
): RecipeNutritionSummary {
  let rows: DishSubmissionRow[] = [];
  try {
    rows = db.query<DishSubmissionRow>(
      `SELECT id, ingredients_json
       FROM rc_bestchef_submissions
       WHERE dish_id = ?
       ORDER BY vote_score DESC, created_at DESC
       LIMIT 10`,
      [dishId],
    );
  } catch {
    rows = [];
  }

  const ingredients = rows.flatMap((row) => parseAdHocIngredients(row.id, row.ingredients_json));
  return calculateIngredientListNutrition(db, {
    recipeId: `dish:${dishId}`,
    servings: Math.max(1, rows.length),
    ingredients,
  });
}

export function recipeNutritionToDetail(
  summary: RecipeNutritionSummary,
  input: {
    surface: NutritionDetail['surface'];
    subjectId: string;
    title: string;
    subtitle?: string | null;
  },
): NutritionDetail {
  const confidence = summary.conversionConfidence;
  const confidenceLabel = summary.ingredientConversions.length === 0
    ? 'Needs review'
    : confidence >= 0.85
      ? 'High'
      : confidence >= 0.65
        ? 'Medium'
        : 'Low';
  const perServing = nutritionFactsWithAddedSugar(summary.perServing);
  const total = nutritionFactsWithAddedSugar(summary.total);
  const dominantSource = summary.sourceBreakdown[0] ?? null;
  const sourceDisplay = dominantSource
    ? getNutritionSourceDisplayData(
        dominantSource.source,
        dominantSource.confidence ?? confidence,
        nutritionCompleteness(summary.perServing),
      )
    : null;
  const healthSummary: NutritionHealthSummary = buildNutritionHealthSummary(
    perServing,
    confidence,
    confidenceLabel,
  );

  return {
    surface: input.surface,
    subjectId: input.subjectId,
    title: input.title,
    subtitle: input.subtitle ?? `${summary.coveragePercent}% nutrition coverage`,
    status: summary.ingredientConversions.length === 0
      ? 'missing'
      : summary.coveragePercent >= 100 && summary.missingFields.length === 0
        ? 'available'
        : 'partial',
    nutrients: perServing,
    totalNutrients: total,
    perServingNutrients: perServing,
    servingBasis: 'per_serving',
    servingQuantity: 1,
    servingUnit: 'serving',
    servingSizeText: `${summary.servings} serving${summary.servings === 1 ? '' : 's'}`,
    source: dominantSource?.source ?? null,
    sourceId: dominantSource?.sourceId ?? null,
    sourceUrl: null,
    sourceDisplay,
    confidence,
    confidenceLabel,
    fetchedAt: null,
    confirmedAt: null,
    isUserConfirmed: summary.sourceBreakdown.some((source) => source.confirmedCount > 0),
    coverage: summary.coverage,
    coveragePercent: summary.coveragePercent,
    sourceBreakdown: summary.sourceBreakdown,
    missingFields: summary.missingFields,
    missingIngredients: summary.missingIngredients,
    ambiguousConversions: summary.ambiguousConversions.map((entry) => (
      `${entry.ingredientName}: ${entry.warnings.join(', ') || 'Low conversion confidence'}`
    )),
    lowConfidenceWarnings: summary.lowConfidenceWarnings,
    healthSummary,
  };
}
