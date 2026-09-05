import type { DatabaseAdapter } from '@mylife/db';
import type { ShoppingListItem, StructuredIngredient } from '../types';
import { getPantryItems } from '../db/pantry';
import { mergeIngredients } from './merge';
import { areUnitsCompatible, convertUnit } from './units';
import { resolveItemName, fuzzyItemMatch } from '../pantry/name-normalizer';

export interface ShoppingListInput {
  recipeIds: string[];
  subtractPantry?: boolean;
  subtractStaples?: boolean;
}

export function generateShoppingList(
  db: DatabaseAdapter,
  input: ShoppingListInput,
): ShoppingListItem[] {
  const { recipeIds, subtractPantry = true, subtractStaples = true } = input;
  if (recipeIds.length === 0) {
    return [];
  }

  const allIngredients: Array<StructuredIngredient & { recipe_id: string }> = [];
  for (const recipeId of recipeIds) {
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
    allIngredients.push(...ingredients);
  }

  if (allIngredients.length === 0) {
    return [];
  }

  const merged = mergeIngredients(allIngredients);
  const pantryItems = subtractPantry ? getPantryItems(db) : [];
  const pantryLookup = new Map<string, typeof pantryItems>();
  for (const pantryItem of pantryItems) {
    const key = resolveItemName(pantryItem.name);
    const rows = pantryLookup.get(key) ?? [];
    rows.push(pantryItem);
    pantryLookup.set(key, rows);
  }

  const stapleNames = new Set<string>();
  if (subtractStaples) {
    const staples = db.query<{ item: string }>(`SELECT item FROM rc_pantry_staples`);
    for (const staple of staples) {
      stapleNames.add(resolveItemName(staple.item));
    }
  }

  const result: ShoppingListItem[] = [];
  for (const mergedItem of merged) {
    const resolvedName = resolveItemName(mergedItem.item);
    if (subtractStaples && stapleNames.has(resolvedName)) {
      result.push({
        item: mergedItem.item,
        quantity: mergedItem.quantity,
        unit: mergedItem.unit,
        grocerySection: mergedItem.section,
        inPantry: true,
        pantryQuantity: null,
        pantryUnit: null,
        needed: 0,
        recipeIds: mergedItem.recipeIds,
      });
      continue;
    }

    let matchedPantry = pantryLookup.get(resolvedName)?.[0] ?? null;
    let bestScore = matchedPantry ? 1 : 0;
    if (!matchedPantry) {
      for (const [, items] of pantryLookup) {
        const score = fuzzyItemMatch(mergedItem.item, items[0].name);
        if (score >= 0.6 && score > bestScore) {
          bestScore = score;
          matchedPantry = items[0];
        }
      }
    }

    if (!matchedPantry) {
      result.push({
        item: mergedItem.item,
        quantity: mergedItem.quantity,
        unit: mergedItem.unit,
        grocerySection: mergedItem.section,
        inPantry: false,
        pantryQuantity: null,
        pantryUnit: null,
        needed: mergedItem.quantity,
        recipeIds: mergedItem.recipeIds,
      });
      continue;
    }

    const pantryQuantity = matchedPantry.quantity;
    const pantryUnit = matchedPantry.unit;
    const neededQuantity = mergedItem.quantity;
    const neededUnit = mergedItem.unit;

    if (pantryQuantity === null || neededQuantity === null) {
      result.push({
        item: mergedItem.item,
        quantity: mergedItem.quantity,
        unit: mergedItem.unit,
        grocerySection: mergedItem.section,
        inPantry: true,
        pantryQuantity,
        pantryUnit,
        needed: 0,
        recipeIds: mergedItem.recipeIds,
      });
      continue;
    }

    let pantryInNeededUnits: number | null = null;
    if (pantryUnit === neededUnit || (!pantryUnit && !neededUnit)) {
      pantryInNeededUnits = pantryQuantity;
    } else if (pantryUnit && neededUnit && areUnitsCompatible(pantryUnit, neededUnit)) {
      pantryInNeededUnits = convertUnit(pantryQuantity, pantryUnit, neededUnit);
    }

    if (pantryInNeededUnits !== null) {
      const deficit = neededQuantity - pantryInNeededUnits;
      result.push({
        item: mergedItem.item,
        quantity: mergedItem.quantity,
        unit: mergedItem.unit,
        grocerySection: mergedItem.section,
        inPantry: deficit <= 0,
        pantryQuantity,
        pantryUnit,
        needed: deficit > 0 ? Math.round(deficit * 1000) / 1000 : 0,
        recipeIds: mergedItem.recipeIds,
      });
      continue;
    }

    result.push({
      item: mergedItem.item,
      quantity: mergedItem.quantity,
      unit: mergedItem.unit,
      grocerySection: mergedItem.section,
      inPantry: false,
      pantryQuantity,
      pantryUnit,
      needed: neededQuantity,
      recipeIds: mergedItem.recipeIds,
    });
  }

  return result;
}
