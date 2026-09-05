import type { DatabaseAdapter } from '@mylife/db';
import type { DeductionResult, StructuredIngredient } from '../types';
import { getPantryItems, updatePantryItem, deletePantryItem } from '../db/pantry';
import { fuzzyItemMatch } from './name-normalizer';
import { areUnitsCompatible, convertUnit } from '../grocery/units';

const MATCH_THRESHOLD = 0.6;

export function previewDeduction(
  db: DatabaseAdapter,
  recipeId: string,
  servings = 1,
): DeductionResult {
  return computeDeduction(db, recipeId, servings);
}

export function deductPantryForRecipe(
  db: DatabaseAdapter,
  recipeId: string,
  servings = 1,
): DeductionResult {
  const result = computeDeduction(db, recipeId, servings);

  db.transaction(() => {
    for (const item of result.deducted) {
      if (item.removed) {
        deletePantryItem(db, item.pantryItemId);
      } else if (item.newQuantity !== null) {
        updatePantryItem(db, item.pantryItemId, { quantity: item.newQuantity });
      }
    }
  });

  return result;
}

function computeDeduction(
  db: DatabaseAdapter,
  recipeId: string,
  servings: number,
): DeductionResult {
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

  const deducted: DeductionResult['deducted'] = [];
  const unmatched: string[] = [];
  const adjustments = new Map<string, number | null>();

  for (const ingredient of ingredients) {
    let bestMatch = null;
    let bestScore = 0;
    for (const pantryItem of pantryItems) {
      const score = fuzzyItemMatch(ingredient.item, pantryItem.name);
      if (score >= MATCH_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestMatch = pantryItem;
      }
    }

    if (!bestMatch) {
      if (!ingredient.is_optional) {
        unmatched.push(ingredient.item);
      }
      continue;
    }

    const currentQuantity = adjustments.has(bestMatch.id)
      ? adjustments.get(bestMatch.id)!
      : bestMatch.quantity;

    if (currentQuantity == null || ingredient.quantity_value == null) {
      deducted.push({
        pantryItemId: bestMatch.id,
        pantryItemName: bestMatch.name,
        ingredientItem: ingredient.item,
        previousQuantity: currentQuantity,
        newQuantity: currentQuantity,
        removed: false,
      });
      continue;
    }

    let amountToDeduct = ingredient.quantity_value * servings;
    if (
      ingredient.unit &&
      bestMatch.unit &&
      ingredient.unit !== bestMatch.unit &&
      areUnitsCompatible(ingredient.unit, bestMatch.unit)
    ) {
      const converted = convertUnit(amountToDeduct, ingredient.unit, bestMatch.unit);
      if (converted !== null) {
        amountToDeduct = converted;
      }
    }

    const newQuantity = Math.max(0, Math.round((currentQuantity - amountToDeduct) * 1000) / 1000);
    adjustments.set(bestMatch.id, newQuantity);
    deducted.push({
      pantryItemId: bestMatch.id,
      pantryItemName: bestMatch.name,
      ingredientItem: ingredient.item,
      previousQuantity: currentQuantity,
      newQuantity,
      removed: newQuantity === 0,
    });
  }

  return { deducted, unmatched };
}
