import type { DatabaseAdapter } from '@mylife/db';
import type {
  CookingStepWithTimer,
  CreatePantryItem,
  GrocerySection,
  PantryItem,
  RecipeCookHistoryEntry,
  RecipeCookPantryApplyInput,
  RecipeCookPantryApplyResult,
  RecipeCookPantryReview,
  RecipeCookPantryReviewItem,
  StorageLocation,
  SubstitutionSuggestion,
} from '../types';
import { fuzzyItemMatch, resolveItemName } from '../pantry/name-normalizer';
import { areUnitsCompatible, categorizeItem, convertUnit } from '../grocery';
import {
  createPantryItem,
  getPantryBatches,
  getPantryItemById,
  getPantryItems,
  updatePantryBatch,
  updatePantryItem,
} from './pantry';
import { getStructuredIngredients } from './crud';

const MATCH_THRESHOLD = 0.6;

const SUBSTITUTION_MAP: Record<string, Array<{ substitute: string; quantity_hint: string }>> = {
  milk: [
    { substitute: 'oat milk', quantity_hint: '1:1' },
    { substitute: 'almond milk', quantity_hint: '1:1' },
    { substitute: 'water + butter', quantity_hint: '3/4 cup water + 1/4 cup butter per cup' },
  ],
  egg: [
    { substitute: 'flax egg', quantity_hint: '1 tbsp flax meal + 3 tbsp water per egg' },
    { substitute: 'chia egg', quantity_hint: '1 tbsp chia + 3 tbsp water per egg' },
    { substitute: 'unsweetened applesauce', quantity_hint: '1/4 cup per egg' },
  ],
  butter: [
    { substitute: 'olive oil', quantity_hint: '3/4 amount' },
    { substitute: 'ghee', quantity_hint: '1:1' },
    { substitute: 'coconut oil', quantity_hint: '1:1' },
  ],
  onion: [
    { substitute: 'shallot', quantity_hint: '1:1 by weight' },
    { substitute: 'leek', quantity_hint: '1:1 by volume' },
    { substitute: 'onion powder', quantity_hint: '1 tsp per 1/2 cup chopped onion' },
  ],
  garlic: [
    { substitute: 'garlic powder', quantity_hint: '1/8 tsp per clove' },
    { substitute: 'shallot', quantity_hint: '1 small shallot per 2 cloves' },
    { substitute: 'asafoetida', quantity_hint: 'pinch for aroma only' },
  ],
  flour: [
    { substitute: 'all-purpose flour', quantity_hint: '1:1' },
    { substitute: 'gluten-free flour blend', quantity_hint: '1:1' },
    { substitute: 'almond flour', quantity_hint: '1:1 with extra binder' },
  ],
  sugar: [
    { substitute: 'brown sugar', quantity_hint: '1:1' },
    { substitute: 'honey', quantity_hint: '3/4 cup per cup sugar' },
    { substitute: 'maple syrup', quantity_hint: '3/4 cup per cup sugar' },
  ],
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeServings(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}

function roundQuantity(value: number): number {
  return Math.max(0, Math.round(value * 1000) / 1000);
}

function defaultStorageForSection(section: GrocerySection): StorageLocation {
  switch (section) {
    case 'dairy':
    case 'meat':
      return 'fridge';
    case 'frozen':
      return 'freezer';
    case 'produce':
      return 'fridge';
    case 'bakery':
      return 'counter';
    default:
      return 'pantry';
  }
}

function getRecipeCookRow(
  db: DatabaseAdapter,
  recipeId: string,
): { id: string; title: string; servings: number | null } | null {
  return db.query<{ id: string; title: string; servings: number | null }>(
    `SELECT id, title, servings
     FROM rc_recipes
     WHERE id = ?
     LIMIT 1`,
    [recipeId],
  )[0] ?? null;
}

function bestPantryMatch(
  ingredientItem: string,
  pantryItems: PantryItem[],
): { item: PantryItem; score: number } | null {
  let bestMatch: { item: PantryItem; score: number } | null = null;
  for (const item of pantryItems) {
    const score = fuzzyItemMatch(ingredientItem, item.name);
    if (score < MATCH_THRESHOLD) continue;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { item, score };
    }
  }
  return bestMatch;
}

function getSuggestedDecrement(
  quantity: number | null,
  fromUnit: string | null,
  pantryUnit: string | null,
): {
  quantity: number | null;
  unit: string | null;
  status: RecipeCookPantryReviewItem['status'];
  note: string | null;
} {
  if (quantity === null) {
    return {
      quantity: null,
      unit: pantryUnit ?? fromUnit,
      status: 'review_quantity',
      note: 'Recipe amount needs review before pantry changes.',
    };
  }

  if (!fromUnit || !pantryUnit || fromUnit === pantryUnit) {
    return {
      quantity: roundQuantity(quantity),
      unit: pantryUnit ?? fromUnit,
      status: 'matched',
      note: null,
    };
  }

  if (areUnitsCompatible(fromUnit, pantryUnit)) {
    const converted = convertUnit(quantity, fromUnit, pantryUnit);
    if (converted !== null) {
      return {
        quantity: roundQuantity(converted),
        unit: pantryUnit,
        status: 'matched',
        note: `Converted from ${fromUnit} to ${pantryUnit}.`,
      };
    }
  }

  return {
    quantity: roundQuantity(quantity),
    unit: fromUnit,
    status: 'unit_mismatch',
    note: `Review units before applying. Pantry tracks ${pantryUnit}.`,
  };
}

function decrementPantryItem(
  db: DatabaseAdapter,
  pantryItemId: string,
  quantity: number,
  unit: string | null,
): RecipeCookPantryApplyResult['updatedPantryItems'][number] | null {
  const before = getPantryItemById(db, pantryItemId);
  if (!before || !Number.isFinite(quantity) || quantity <= 0) return null;

  const batches = getPantryBatches(db, pantryItemId);
  let remaining = quantity;
  let applied = 0;

  if (batches.length === 0) {
    if (before.quantity === null) return null;
    let amount = quantity;
    if (unit && before.unit && unit !== before.unit) {
      const converted = convertUnit(quantity, unit, before.unit);
      if (converted === null) return null;
      amount = converted;
    }
    updatePantryItem(db, pantryItemId, { quantity: roundQuantity(before.quantity - amount) });
    applied = quantity;
  } else {
    for (const batch of batches) {
      if (remaining <= 0) break;
      if (batch.quantity === null) continue;

      let decrementInBatchUnit = remaining;
      if (unit && batch.unit && unit !== batch.unit) {
        const converted = convertUnit(remaining, unit, batch.unit);
        if (converted === null) continue;
        decrementInBatchUnit = converted;
      }

      const usedInBatchUnit = Math.min(batch.quantity, decrementInBatchUnit);
      if (usedInBatchUnit <= 0) continue;
      updatePantryBatch(db, batch.id, { quantity: roundQuantity(batch.quantity - usedInBatchUnit) });

      let usedInInputUnit = usedInBatchUnit;
      if (unit && batch.unit && unit !== batch.unit) {
        usedInInputUnit = convertUnit(usedInBatchUnit, batch.unit, unit) ?? 0;
      }
      remaining = roundQuantity(remaining - usedInInputUnit);
      applied = roundQuantity(applied + usedInInputUnit);
    }
  }

  if (applied <= 0) return null;

  const after = getPantryItemById(db, pantryItemId);
  return {
    pantryItemId,
    pantryItemName: before.name,
    decrementedQuantity: applied,
    decrementUnit: unit,
    previousQuantity: before.quantity,
    newQuantity: after?.quantity ?? null,
    pantryUnit: after?.unit ?? before.unit,
  };
}

export function getRecipeCookHistory(
  db: DatabaseAdapter,
  recipeId: string,
  limit = 20,
): RecipeCookHistoryEntry[] {
  return db.query<RecipeCookHistoryEntry>(
    `SELECT id, recipe_id, cooked_at, servings, pantry_decrements_json, created_at
     FROM rc_recipe_cook_history
     WHERE recipe_id = ?
     ORDER BY cooked_at DESC, created_at DESC
     LIMIT ?`,
    [recipeId, limit],
  );
}

export function detectStepTimerMinutes(instruction: string): number | null {
  const text = instruction.toLowerCase();
  const range = text.match(/(\d+)\s*-\s*(\d+)\s*(minute|min|minutes|hour|hours|hr|hrs)/);
  if (range) {
    const high = Number.parseInt(range[2], 10);
    return range[3].startsWith('h') ? high * 60 : high;
  }

  const hours = text.match(/(\d+)\s*(hour|hours|hr|hrs)/);
  const minutes = text.match(/(\d+)\s*(minute|minutes|min|mins)/);
  const hourValue = hours ? Number.parseInt(hours[1], 10) : 0;
  const minuteValue = minutes ? Number.parseInt(minutes[1], 10) : 0;
  if (hourValue > 0 || minuteValue > 0) {
    return (hourValue * 60) + minuteValue;
  }

  return null;
}

export function getCookingStepsWithTimers(
  db: DatabaseAdapter,
  recipeId: string,
): CookingStepWithTimer[] {
  const steps = db.query<{
    id: string;
    recipe_id: string;
    step_number: number;
    instruction: string;
    timer_minutes: number | null;
    sort_order: number;
    section: string | null;
  }>(
    `SELECT id, recipe_id, step_number, instruction, timer_minutes, sort_order, section
     FROM rc_steps
     WHERE recipe_id = ?
     ORDER BY sort_order ASC, step_number ASC`,
    [recipeId],
  );

  return steps.map((step) => ({
    ...step,
    inferred_timer_minutes: step.timer_minutes ?? detectStepTimerMinutes(step.instruction),
  }));
}

export function suggestIngredientSubstitutions(
  db: DatabaseAdapter,
  recipeId: string,
): Record<string, SubstitutionSuggestion[]> {
  const pantry = getPantryItems(db);
  const pantryNames = new Set(pantry.map((item) => resolveItemName(item.name)));
  const ingredients = getStructuredIngredients(db, recipeId);
  const suggestions: Record<string, SubstitutionSuggestion[]> = {};

  for (const ingredient of ingredients) {
    const key = resolveItemName(ingredient.item);
    const matches = SUBSTITUTION_MAP[key];
    if (!matches || matches.length === 0) {
      continue;
    }

    suggestions[ingredient.item] = matches.map((match) => ({
      substitute: match.substitute,
      quantity_hint: match.quantity_hint,
      reason: `Useful swap for ${ingredient.item}`,
      in_pantry: pantryNames.has(resolveItemName(match.substitute)),
    }));
  }

  return suggestions;
}

export function getRecipeCookPantryReview(
  db: DatabaseAdapter,
  recipeId: string,
  input: { servings?: number | null; cookedAt?: string | null } = {},
): RecipeCookPantryReview | null {
  const recipe = getRecipeCookRow(db, recipeId);
  if (!recipe) return null;

  const servings = normalizeServings(input.servings ?? 1);
  const cookedAt = input.cookedAt ?? new Date().toISOString();
  const pantryItems = getPantryItems(db);
  const ingredients = getStructuredIngredients(db, recipeId);
  const items = ingredients.map((ingredient): RecipeCookPantryReviewItem => {
    const match = bestPantryMatch(ingredient.item, pantryItems);
    if (!match) {
      return {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        ingredientItem: ingredient.item,
        ingredientQuantity: ingredient.quantity,
        ingredientQuantityValue: ingredient.quantity_value,
        ingredientUnit: ingredient.unit,
        pantryItemId: null,
        pantryItemName: null,
        pantryQuantity: null,
        pantryUnit: null,
        matchScore: 0,
        suggestedDecrementQuantity: null,
        suggestedDecrementUnit: ingredient.unit,
        status: 'not_tracked',
        note: 'Not tracked in pantry.',
      };
    }

    const scaledQuantity = ingredient.quantity_value === null
      ? null
      : ingredient.quantity_value * servings;
    const suggestion = getSuggestedDecrement(
      scaledQuantity,
      ingredient.unit,
      match.item.unit,
    );

    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      ingredientItem: ingredient.item,
      ingredientQuantity: ingredient.quantity,
      ingredientQuantityValue: ingredient.quantity_value,
      ingredientUnit: ingredient.unit,
      pantryItemId: match.item.id,
      pantryItemName: match.item.name,
      pantryQuantity: match.item.quantity,
      pantryUnit: match.item.unit,
      matchScore: match.score,
      suggestedDecrementQuantity: suggestion.quantity,
      suggestedDecrementUnit: suggestion.unit,
      status: suggestion.status,
      note: suggestion.note,
    };
  });

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    servings,
    cookedAt,
    items,
    cookHistory: getRecipeCookHistory(db, recipeId),
  };
}

export function addRecipeIngredientToPantry(
  db: DatabaseAdapter,
  recipeId: string,
  ingredientId: string,
): PantryItem | null {
  const ingredient = getStructuredIngredients(db, recipeId)
    .find((entry) => entry.id === ingredientId);
  if (!ingredient) return null;

  const grocerySection = categorizeItem(ingredient.item);
  const input: CreatePantryItem = {
    name: ingredient.item,
    quantity: ingredient.quantity_value,
    unit: ingredient.unit,
    storage_location: defaultStorageForSection(grocerySection),
    grocery_section: grocerySection,
    batch_source: 'manual',
    notes: `Added while cooking recipe ${recipeId}.`,
  };
  return createPantryItem(db, input);
}

export function applyRecipeCookPantryReview(
  db: DatabaseAdapter,
  input: RecipeCookPantryApplyInput,
): RecipeCookPantryApplyResult {
  const recipe = getRecipeCookRow(db, input.recipeId);
  if (!recipe) throw new Error('Recipe not found.');

  const servings = normalizeServings(input.servings ?? 1);
  const cookedAt = input.cookedAt ?? new Date().toISOString();
  const skippedIngredientIds: string[] = [];
  let result: RecipeCookPantryApplyResult | null = null;

  db.transaction(() => {
    const updatedPantryItems: RecipeCookPantryApplyResult['updatedPantryItems'] = [];
    for (const decrement of input.decrements) {
      if (!Number.isFinite(decrement.quantity) || decrement.quantity <= 0) {
        skippedIngredientIds.push(decrement.ingredientId);
        continue;
      }

      const updated = decrementPantryItem(
        db,
        decrement.pantryItemId,
        decrement.quantity,
        decrement.unit ?? null,
      );
      if (updated) {
        updatedPantryItems.push(updated);
      } else {
        skippedIngredientIds.push(decrement.ingredientId);
      }
    }

    const historyId = createId('cook');
    db.execute(
      `INSERT INTO rc_recipe_cook_history (
        id,
        recipe_id,
        cooked_at,
        servings,
        pantry_decrements_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        historyId,
        recipe.id,
        cookedAt,
        servings,
        JSON.stringify(updatedPantryItems),
        new Date().toISOString(),
      ],
    );

    const historyEntry = getRecipeCookHistory(db, recipe.id, 1)[0];
    if (!historyEntry) throw new Error('Recipe cook history was not recorded.');

    result = {
      historyEntry,
      updatedPantryItems,
      skippedIngredientIds,
    };
  });

  if (!result) {
    throw new Error('Unable to apply recipe cook pantry review.');
  }
  return result;
}
