'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  countRecipes,
  toggleFavorite,
  setRating,
  getIngredients,
  getTags,
  getCookingStepsWithTimers,
  getMealPlanWeekBundle,
  upsertMealPlanItem,
  removeMealPlanItem,
  generateMealPlanShoppingList,
  getPantryItems,
  createPantryItem,
  updatePantryItem,
  deletePantryItem,
  getExpiringItems,
  getShoppingLists,
  getShoppingListById,
  createShoppingList,
  deleteShoppingList,
  addShoppingListItem,
  getShoppingListItems,
  toggleItemChecked,
  deleteShoppingListItem,
  getShoppingListSummary,
  parseRecipeFromText,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  getDefaultServings,
  getMeasurementSystem,
  getSetting,
  setSetting,
  getNutritionForItem,
  type RecipeFilters,
  type CreateRecipe,
  type CreateCollection,
  type CreatePantryItem,
  type UpdatePantryItem,
  type PantryFilters,
  type MealSlot,
  recipeToNutritionRule,
} from '@mylife/bestchef';
import { logAutomationEvent } from '@mylife/automations';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('recipes');
  return adapter;
}

export async function fetchRecipes(filters?: RecipeFilters) {
  try {
    return getRecipes(db(), filters);
  } catch (err) {
    console.error('[recipes] fetchRecipes failed:', err);
    return [];
  }
}

export async function fetchRecipe(id: string) {
  try {
    return getRecipeById(db(), id);
  } catch (err) {
    console.error('[recipes] fetchRecipe failed:', err);
    return null;
  }
}

export async function fetchRecipeWithDetails(id: string) {
  try {
    const adapter = db();
    const recipe = getRecipeById(adapter, id);
    if (!recipe) return null;
    const ingredients = getIngredients(adapter, id);
    const tags = getTags(adapter, id);
    const steps = getCookingStepsWithTimers(adapter, id);
    return { recipe, ingredients, tags, steps };
  } catch (err) {
    console.error('[recipes] fetchRecipeWithDetails failed:', err);
    return null;
  }
}

export async function fetchRecipeCount() {
  try {
    return countRecipes(db());
  } catch (err) {
    console.error('[recipes] fetchRecipeCount failed:', err);
    return 0;
  }
}

export async function addRecipe(input: CreateRecipe) {
  try {
    const id = crypto.randomUUID();
    return createRecipe(db(), id, input);
  } catch (err) {
    console.error('[recipes] addRecipe failed:', err);
    throw err;
  }
}

export async function editRecipe(id: string, updates: Partial<CreateRecipe>) {
  try {
    updateRecipe(db(), id, updates);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] editRecipe failed:', err);
    throw err;
  }
}

export async function removeRecipe(id: string) {
  try {
    deleteRecipe(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] removeRecipe failed:', err);
    throw err;
  }
}

export async function toggleRecipeFavorite(id: string) {
  try {
    toggleFavorite(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] toggleRecipeFavorite failed:', err);
    throw err;
  }
}

export async function setRecipeRating(id: string, rating: number) {
  try {
    setRating(db(), id, rating);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] setRecipeRating failed:', err);
    throw err;
  }
}

export async function fetchIngredients(recipeId: string) {
  try {
    return getIngredients(db(), recipeId);
  } catch (err) {
    console.error('[recipes] fetchIngredients failed:', err);
    return [];
  }
}

export async function fetchCookingSteps(recipeId: string) {
  try {
    return getCookingStepsWithTimers(db(), recipeId);
  } catch (err) {
    console.error('[recipes] fetchCookingSteps failed:', err);
    return [];
  }
}

export async function fetchMealPlanBundle(weekStart: string) {
  try {
    return getMealPlanWeekBundle(db(), weekStart);
  } catch (err) {
    console.error('[recipes] fetchMealPlanBundle failed:', err);
    return { plan: null, items: [] };
  }
}

export async function addMealPlanItem(input: {
  weekStart: string;
  recipeId: string;
  dayOfWeek: number;
  mealSlot: MealSlot;
  servings?: number;
}) {
  try {
    upsertMealPlanItem(db(), {
      weekStartDate: input.weekStart,
      recipeId: input.recipeId,
      dayOfWeek: input.dayOfWeek,
      mealSlot: input.mealSlot,
      servings: input.servings ?? 1,
    });
    return { ok: true };
  } catch (err) {
    console.error('[recipes] addMealPlanItem failed:', err);
    throw err;
  }
}

export async function removeMealItem(itemId: string) {
  try {
    removeMealPlanItem(db(), itemId);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] removeMealItem failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Pantry
// ---------------------------------------------------------------------------

export async function fetchPantryItems(filters?: PantryFilters) {
  try {
    return getPantryItems(db(), filters);
  } catch (err) {
    console.error('[recipes] fetchPantryItems failed:', err);
    return [];
  }
}

export async function addPantryItem(input: CreatePantryItem) {
  try {
    const item = createPantryItem(db(), input);
    return { ok: true, id: item.id };
  } catch (err) {
    console.error('[recipes] addPantryItem failed:', err);
    throw err;
  }
}

export async function editPantryItem(id: string, updates: UpdatePantryItem) {
  try {
    updatePantryItem(db(), id, updates);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] editPantryItem failed:', err);
    throw err;
  }
}

export async function removePantryItem(id: string) {
  try {
    deletePantryItem(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] removePantryItem failed:', err);
    throw err;
  }
}

export async function fetchExpiringItems(days: number = 7) {
  try {
    return getExpiringItems(db(), days);
  } catch (err) {
    console.error('[recipes] fetchExpiringItems failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Shopping Lists
// ---------------------------------------------------------------------------

export async function fetchShoppingLists() {
  try {
    return getShoppingLists(db());
  } catch (err) {
    console.error('[recipes] fetchShoppingLists failed:', err);
    return [];
  }
}

export async function fetchShoppingList(id: string) {
  try {
    const list = getShoppingListById(db(), id);
    if (!list) return null;
    const items = getShoppingListItems(db(), id);
    const summary = getShoppingListSummary(db(), id);
    return { list, items, summary };
  } catch (err) {
    console.error('[recipes] fetchShoppingList failed:', err);
    return null;
  }
}

export async function addShoppingList(name: string) {
  try {
    const id = crypto.randomUUID();
    createShoppingList(db(), id, name);
    return { ok: true, id };
  } catch (err) {
    console.error('[recipes] addShoppingList failed:', err);
    throw err;
  }
}

export async function removeShoppingList(id: string) {
  try {
    deleteShoppingList(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] removeShoppingList failed:', err);
    throw err;
  }
}

export async function addGroceryItem(listId: string, name: string, quantity?: string, unit?: string) {
  try {
    const id = crypto.randomUUID();
    addShoppingListItem(db(), id, listId, { item: name, quantity: quantity ? Number(quantity) : null, unit: unit ?? null });
    return { ok: true, id };
  } catch (err) {
    console.error('[recipes] addGroceryItem failed:', err);
    throw err;
  }
}

export async function toggleGroceryItem(id: string) {
  try {
    toggleItemChecked(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] toggleGroceryItem failed:', err);
    throw err;
  }
}

export async function removeGroceryItem(id: string) {
  try {
    deleteShoppingListItem(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] removeGroceryItem failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function parseRecipeText(text: string) {
  try {
    return parseRecipeFromText(text);
  } catch (err) {
    console.error('[recipes] parseRecipeText failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function fetchCollections() {
  try {
    return getCollections(db());
  } catch (err) {
    console.error('[recipes] fetchCollections failed:', err);
    return [];
  }
}

export async function addCollection(input: CreateCollection) {
  try {
    const id = crypto.randomUUID();
    return createCollection(db(), id, input);
  } catch (err) {
    console.error('[recipes] addCollection failed:', err);
    throw err;
  }
}

export async function editCollection(id: string, updates: Partial<CreateCollection>) {
  try {
    updateCollection(db(), id, updates);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] editCollection failed:', err);
    throw err;
  }
}

export async function removeCollection(id: string) {
  try {
    deleteCollection(db(), id);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] removeCollection failed:', err);
    throw err;
  }
}

export async function linkRecipeToCollection(collectionId: string, recipeId: string) {
  try {
    addRecipeToCollection(db(), collectionId, recipeId);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] linkRecipeToCollection failed:', err);
    throw err;
  }
}

export async function unlinkRecipeFromCollection(collectionId: string, recipeId: string) {
  try {
    removeRecipeFromCollection(db(), collectionId, recipeId);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] unlinkRecipeFromCollection failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function fetchDefaultServings() {
  try {
    return getDefaultServings(db());
  } catch (err) {
    console.error('[recipes] fetchDefaultServings failed:', err);
    return 2;
  }
}

export async function fetchMeasurementSystem() {
  try {
    return getMeasurementSystem(db());
  } catch (err) {
    console.error('[recipes] fetchMeasurementSystem failed:', err);
    return 'metric';
  }
}

export async function fetchSetting(key: string) {
  try {
    return getSetting(db(), key);
  } catch (err) {
    console.error('[recipes] fetchSetting failed:', err);
    return null;
  }
}

export async function saveSetting(key: string, value: string) {
  try {
    setSetting(db(), key, value);
    return { ok: true };
  } catch (err) {
    console.error('[recipes] saveSetting failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export async function fetchNutrition(itemId: string) {
  try {
    return getNutritionForItem(db(), itemId);
  } catch (err) {
    console.error('[recipes] fetchNutrition failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Meal Plan Shopping List
// ---------------------------------------------------------------------------

export async function generateShoppingListFromPlan(weekStart: string) {
  try {
    return generateMealPlanShoppingList(db(), weekStart);
  } catch (err) {
    console.error('[recipes] generateShoppingListFromPlan failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// I cooked this: recipe -> nutrition log + pantry decrement
// ---------------------------------------------------------------------------

export interface CookedRecipeOutcome {
  ok: boolean;
  /** Set when ok. */
  loggedToNutrition?: boolean;
  calories?: number;
  proteinG?: number;
  pantryItemsDecremented?: number;
  /** Set when not ok: honest reason, never a fake success. */
  reason?: string;
}

/**
 * Run the recipe-to-nutrition automation rule for a cooked recipe. The rule
 * wraps all writes (nu_food_log parent + items, rc_pantry_items decrement,
 * audit row) in one transaction; mirrors applyReceiptToBudgetAction.
 */
export async function logCookedRecipeAction(
  recipeId: string,
  servingsCooked: number,
): Promise<CookedRecipeOutcome> {
  const adapter = db();
  const state = recipeToNutritionRule.check(adapter, {
    recipeId,
    servingsCooked,
    cookedAt: new Date().toISOString(),
  });
  if (!state) {
    return {
      ok: false,
      reason:
        'Nothing to log: this recipe has no computable macros and no pantry matches. Add nutrition data or pantry items first.',
    };
  }
  try {
    const result = recipeToNutritionRule.apply(adapter, state);
    return {
      ok: true,
      loggedToNutrition: result.foodLogId !== null,
      calories: Math.round(state.scaledMacros.calories ?? 0),
      proteinG: Math.round(state.scaledMacros.protein_g ?? 0),
      pantryItemsDecremented: result.pantryItemsDecremented,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      logAutomationEvent(adapter, {
        ruleId: recipeToNutritionRule.id,
        outcome: 'error',
        error: message,
      });
    } catch {
      // Log-write failures must not mask the original error.
    }
    return { ok: false, reason: message };
  }
}
