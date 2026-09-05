/**
 * recipe-to-nutrition — second automation rule (Phase 5-core).
 *
 * When a user marks a recipe as cooked, this rule atomically logs the meal
 * into the nutrition module's food log (parent + per-ingredient item rows)
 * and decrements matching pantry items via the existing fuzzy-match deduction
 * engine. All writes happen in a single db.transaction(); the audit log row
 * is written in the same transaction so rollback is atomic.
 *
 * Graceful degradation: if the nutrition module is not installed the rule
 * still decrements pantry + writes the audit row. If the pantry table is
 * missing the rule still logs nutrition. If BOTH are missing check() returns
 * null (nothing useful can happen).
 *
 * Schema reality notes:
 *   - rc_recipes has no per-recipe nutrition columns; per-serving macros are
 *     computed at runtime from rc_nutrition_data + rc_ingredients through
 *     fuzzy pantry matching and unit conversion (see calculateRecipeNutrition).
 *   - Pantry table is rc_pantry_items (not rc_pantry).
 *   - nu_food_log is a parent row (date + meal_type); macros live on
 *     nu_food_log_items children, one per food reference.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { AutomationRule } from '@mylife/automations';
import { logAutomationEvent } from '@mylife/automations';
import { calculateRecipeNutrition } from '../nutrition/recipe-nutrition';
import { previewDeduction } from '../pantry/deduction';
import type {
  DeductionResult,
  NutritionBreakdown,
  RecipeNutritionSummary,
} from '../types';

/** UUID v4-shaped id generator (no crypto dep, matches receipt-to-budget rule). */
function generateId(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        hex[Math.floor(Math.random() * 16)],
      ).join(''),
    )
    .join('-');
}

function tableExists(db: DatabaseAdapter, name: string): boolean {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name],
  );
  return rows.length > 0;
}

function scaleBreakdown(
  breakdown: NutritionBreakdown,
  servings: number,
): NutritionBreakdown {
  const m = (v: number | null): number | null =>
    v === null ? null : Math.round(v * servings * 10) / 10;
  return {
    calories: m(breakdown.calories),
    fat_g: m(breakdown.fat_g),
    saturated_fat_g: m(breakdown.saturated_fat_g),
    carbs_g: m(breakdown.carbs_g),
    fiber_g: m(breakdown.fiber_g),
    sugar_g: m(breakdown.sugar_g),
    protein_g: m(breakdown.protein_g),
    sodium_mg: m(breakdown.sodium_mg),
  };
}

function hasAnyMacros(b: NutritionBreakdown): boolean {
  return (
    b.calories !== null ||
    b.protein_g !== null ||
    b.carbs_g !== null ||
    b.fat_g !== null
  );
}

export interface RecipeCookedInput {
  recipeId: string;
  servingsCooked: number;
  cookedAt: string; // ISO
}

export interface RecipeCookedPreviewState {
  recipeId: string;
  recipeTitle: string;
  servingsCooked: number;
  cookedAt: string;
  /** Macro totals scaled by servingsCooked (per-serving × servingsCooked). */
  scaledMacros: NutritionBreakdown;
  /** The nutrition summary at time of check, including conversion confidence. */
  nutritionSummary: RecipeNutritionSummary;
  /** Pantry items that will be decremented + amounts (reused by apply). */
  deduction: DeductionResult;
  hasNutritionModule: boolean;
  hasPantryModule: boolean;
}

export interface RecipeCookedResult {
  recipeId: string;
  foodLogId: string | null;
  foodLogItemIds: string[];
  pantryItemsDecremented: number;
  auditEntryId: string;
}

export const recipeToNutritionRule: AutomationRule<
  RecipeCookedInput,
  RecipeCookedPreviewState,
  RecipeCookedResult
> = {
  id: 'recipe-to-nutrition',
  label: 'Log cooked recipes to nutrition + decrement pantry',
  description:
    'When you mark a recipe as cooked, auto-log the meal into the nutrition food log and decrement the matching ingredients from your pantry. You can skip the suggestion any time.',
  clusters: ['food', 'health'],

  check(db, input) {
    if (!input || typeof input !== 'object') return null;
    if (typeof input.recipeId !== 'string' || input.recipeId.length === 0) {
      return null;
    }
    if (
      typeof input.servingsCooked !== 'number' ||
      !Number.isFinite(input.servingsCooked) ||
      input.servingsCooked <= 0
    ) {
      return null;
    }

    const adapter = db as DatabaseAdapter;

    // Recipe must exist. If not, the rule doesn't apply.
    const recipeRows = adapter.query<{ id: string; title: string }>(
      `SELECT id, title FROM rc_recipes WHERE id = ?`,
      [input.recipeId],
    );
    if (recipeRows.length === 0) return null;

    const hasNutritionModule = tableExists(adapter, 'nu_food_log');
    const hasPantryModule = tableExists(adapter, 'rc_pantry_items');

    // If neither target table exists, there's nothing this rule can do.
    if (!hasNutritionModule && !hasPantryModule) return null;

    // Compute per-serving macros (rc_recipes has no per-serving columns — the
    // engine joins rc_nutrition_data via rc_pantry_items fuzzy match).
    const nutritionSummary = calculateRecipeNutrition(
      adapter,
      input.recipeId,
    );

    // If nutrition module is available but the recipe has zero macro coverage
    // there's nothing to log to nutrition. Still useful to decrement pantry
    // if pantry is available. If nutrition is available AND pantry is not
    // AND macros are empty, the rule genuinely has nothing to do.
    const macrosPresent = hasAnyMacros(nutritionSummary.perServing);
    if (!macrosPresent && !hasPantryModule) return null;

    const scaledMacros = scaleBreakdown(
      nutritionSummary.perServing,
      input.servingsCooked,
    );

    // Compute pantry deduction preview (no writes).
    const deduction: DeductionResult = hasPantryModule
      ? previewDeduction(adapter, input.recipeId, input.servingsCooked)
      : { deducted: [], unmatched: [] };

    return {
      recipeId: input.recipeId,
      recipeTitle: recipeRows[0]!.title,
      servingsCooked: input.servingsCooked,
      cookedAt: input.cookedAt,
      scaledMacros,
      nutritionSummary,
      deduction,
      hasNutritionModule,
      hasPantryModule,
    };
  },

  previewCard(state) {
    const calories = state.scaledMacros.calories ?? 0;
    const protein = state.scaledMacros.protein_g ?? 0;
    const decrementCount = state.deduction.deducted.length;
    return {
      title: 'Log this meal?',
      subtitle: `${Math.round(calories)} calories, ${Math.round(
        protein,
      )}g protein. Decrements ${decrementCount} pantry items.`,
      cta: { apply: 'Log + decrement', dismiss: 'Skip' },
    };
  },

  apply(db, state) {
    const adapter = db as DatabaseAdapter;
    let result: RecipeCookedResult | null = null;

    adapter.transaction(() => {
      const foodLogItemIds: string[] = [];
      let foodLogId: string | null = null;
      let pantryDecremented = 0;

      // 1. Nutrition log (only if the nutrition module is installed AND we
      // have at least some macros to log).
      if (
        state.hasNutritionModule &&
        hasAnyMacros(state.scaledMacros)
      ) {
        foodLogId = generateId();
        // meal_type is required + CHECKed; default to 'dinner' since we have
        // no contextual hint in the trigger input.
        const date = (state.cookedAt || new Date().toISOString()).slice(0, 10);
        adapter.execute(
          `INSERT INTO nu_food_log (id, date, meal_type, notes, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [
            foodLogId,
            date,
            'dinner',
            `Cooked: ${state.recipeTitle} (${state.servingsCooked} serving${
              state.servingsCooked === 1 ? '' : 's'
            })`,
          ],
        );

        // One child item row per matched ingredient. Each row carries its
        // share of the scaled macros proportional to ingredient count (the
        // recipe engine doesn't split macros per-ingredient, so we split
        // evenly across matched ingredients).
        const matchedCount = Math.max(
          1,
          state.nutritionSummary.missingIngredients.length === 0
            ? state.deduction.deducted.length || 1
            : state.deduction.deducted.length || 1,
        );
        const perItem = {
          calories: (state.scaledMacros.calories ?? 0) / matchedCount,
          protein_g: (state.scaledMacros.protein_g ?? 0) / matchedCount,
          carbs_g: (state.scaledMacros.carbs_g ?? 0) / matchedCount,
          fat_g: (state.scaledMacros.fat_g ?? 0) / matchedCount,
        };

        // If the nutrition module has no seeded foods for these ingredients
        // we still need a food_id. Create a placeholder food row representing
        // the recipe itself so the FK constraint is satisfied.
        const placeholderFoodId = generateId();
        adapter.execute(
          `INSERT INTO nu_foods (
             id, name, brand, serving_size, serving_unit,
             calories, protein_g, carbs_g, fat_g,
             fiber_g, sugar_g, sodium_mg, source
           ) VALUES (?, ?, NULL, 1, 'serving', ?, ?, ?, ?, 0, 0, 0, 'custom')`,
          [
            placeholderFoodId,
            `Recipe: ${state.recipeTitle}`,
            state.scaledMacros.calories ?? 0,
            state.scaledMacros.protein_g ?? 0,
            state.scaledMacros.carbs_g ?? 0,
            state.scaledMacros.fat_g ?? 0,
          ],
        );

        const itemCount = Math.max(1, state.deduction.deducted.length);
        for (let i = 0; i < itemCount; i++) {
          const itemId = generateId();
          foodLogItemIds.push(itemId);
          adapter.execute(
            `INSERT INTO nu_food_log_items (
               id, log_id, food_id, serving_count,
               calories, protein_g, carbs_g, fat_g
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              foodLogId,
              placeholderFoodId,
              1,
              perItem.calories,
              perItem.protein_g,
              perItem.carbs_g,
              perItem.fat_g,
            ],
          );
        }
      }

      // 2. Pantry decrement (only if the pantry table exists).
      if (state.hasPantryModule) {
        for (const item of state.deduction.deducted) {
          if (item.newQuantity === null) continue;
          adapter.execute(
            `UPDATE rc_pantry_items
             SET quantity = MAX(0, ?), updated_at = datetime('now')
             WHERE id = ?`,
            [item.newQuantity, item.pantryItemId],
          );
          pantryDecremented++;
        }
      }

      // 3. Audit log (always — shares the transaction so rollback is atomic).
      const audit = logAutomationEvent(adapter, {
        ruleId: 'recipe-to-nutrition',
        outcome: 'applied',
      });

      result = {
        recipeId: state.recipeId,
        foodLogId,
        foodLogItemIds,
        pantryItemsDecremented: pantryDecremented,
        auditEntryId: audit.id,
      };
    });

    if (!result) {
      throw new Error(
        'recipe-to-nutrition apply failed: transaction rolled back',
      );
    }
    return result;
  },
};
