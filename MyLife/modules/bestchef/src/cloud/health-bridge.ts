/**
 * Health bridge -- integration between BestChef and nutrition engine.
 *
 * Connects recipe data to @mylife/nutrition-engine for nutrition summaries,
 * meal plan aggregation, gap analysis, and health scoring.
 */

import type {
  NutritionBreakdown,
  DailyNutritionSummary,
  NutrientGap,
  OptimizationSuggestion,
  DietaryGoal,
  MealNutrition,
  MealPlanNutrition,
} from '@mylife/nutrition-engine';
import {
  emptyBreakdown,
  aggregateDailyNutrition,
  optimizeMealPlan,
} from '@mylife/nutrition-engine';
import { getBestChefClient, ok, err, type BestChefResult } from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface RecipeNutritionCard {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  coverage: number;
}

export interface RecipeSuggestion {
  snapshotId: string;
  title: string;
  nutrientDensity: number;
  nutrition: NutritionBreakdown;
}

export interface HealthScore {
  score: number;
  breakdown: {
    macroBalance: number;
    fiberScore: number;
    sodiumScore: number;
    satFatScore: number;
  };
}

// ── Pure helpers ──────────────────────────────────────────────────────

/**
 * Calculate a 0-100 health score based on nutritional balance.
 *
 * Scoring dimensions (each 0-25, summed):
 * - Macro balance: protein 10-35%, carbs 45-65%, fat 20-35% of calories
 * - Fiber: target 25g, full marks at 25+
 * - Sodium: penalty if above 2300mg
 * - Saturated fat: penalty if above 10% of calories
 */
export function calculateHealthScore(nutrition: NutritionBreakdown): HealthScore {
  const cal = nutrition.calories ?? 0;
  if (cal <= 0) {
    return { score: 0, breakdown: { macroBalance: 0, fiberScore: 0, sodiumScore: 0, satFatScore: 0 } };
  }

  // Macro balance (0-25)
  const proteinCal = (nutrition.protein_g ?? 0) * 4;
  const carbCal = (nutrition.carbs_g ?? 0) * 4;
  const fatCal = (nutrition.fat_g ?? 0) * 9;

  const proteinPct = proteinCal / cal;
  const carbPct = carbCal / cal;
  const fatPct = fatCal / cal;

  const proteinScore = inRange(proteinPct, 0.10, 0.35) ? 8.33 : 8.33 * (1 - distFromRange(proteinPct, 0.10, 0.35));
  const carbScore = inRange(carbPct, 0.45, 0.65) ? 8.33 : 8.33 * (1 - distFromRange(carbPct, 0.45, 0.65));
  const fatScore = inRange(fatPct, 0.20, 0.35) ? 8.34 : 8.34 * (1 - distFromRange(fatPct, 0.20, 0.35));
  const macroBalance = Math.max(0, Math.round(proteinScore + carbScore + fatScore));

  // Fiber (0-25)
  const fiber = nutrition.fiber_g ?? 0;
  const fiberScore = Math.min(25, Math.round((fiber / 25) * 25));

  // Sodium (0-25, penalty above 2300mg)
  const sodium = nutrition.sodium_mg ?? 0;
  const sodiumScore = sodium <= 2300 ? 25 : Math.max(0, 25 - Math.round(((sodium - 2300) / 2300) * 25));

  // Saturated fat (0-25, penalty above 10% of calories)
  const satFatCal = (nutrition.saturated_fat_g ?? 0) * 9;
  const satFatPct = cal > 0 ? satFatCal / cal : 0;
  const satFatScore = satFatPct <= 0.10 ? 25 : Math.max(0, 25 - Math.round(((satFatPct - 0.10) / 0.10) * 25));

  const score = Math.min(100, macroBalance + fiberScore + sodiumScore + satFatScore);

  return {
    score,
    breakdown: {
      macroBalance,
      fiberScore,
      sodiumScore,
      satFatScore,
    },
  };
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function distFromRange(value: number, min: number, max: number): number {
  if (value < min) return Math.min(1, (min - value) / min);
  if (value > max) return Math.min(1, (value - max) / (1 - max));
  return 0;
}

// ── Shorthand ─────────────────────────────────────────────────────────

function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Cloud functions ───────────────────────────────────────────────────

/**
 * Get nutrition data for a published recipe snapshot.
 */
export async function getRecipeNutritionSummary(
  snapshotId: string,
): Promise<BestChefResult<RecipeNutritionCard>> {
  try {
    const { data: snapshot, error: snapError } = await from('bc_recipe_snapshots')
      .select('nutrition_json, servings')
      .eq('id', snapshotId)
      .single();

    if (snapError || !snapshot) {
      return err(snapError?.message ?? 'Snapshot not found');
    }

    const nutrition = snapshot.nutrition_json as NutritionBreakdown | null;
    if (!nutrition) {
      return ok({
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        coverage: 0,
      });
    }

    return ok({
      calories: nutrition.calories,
      protein_g: nutrition.protein_g,
      carbs_g: nutrition.carbs_g,
      fat_g: nutrition.fat_g,
      fiber_g: nutrition.fiber_g,
      coverage: 1,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to get nutrition summary');
  }
}

/**
 * Aggregate nutrition from a day's meal plan items.
 */
export async function getDailyNutritionFromMealPlan(
  profileId: string,
  date: string,
): Promise<BestChefResult<DailyNutritionSummary>> {
  try {
    // Fetch meal plan items for the date
    const { data: items, error: itemsError } = await from('bc_recipe_snapshots')
      .select('id, title, nutrition_json, servings')
      .eq('profile_id', profileId);

    if (itemsError) return err(itemsError.message);
    if (!items || items.length === 0) {
      return ok({
        date,
        meals: [],
        totals: emptyBreakdown(),
        mealCount: 0,
      });
    }

    const meals: MealNutrition[] = items
      .filter((item: Record<string, unknown>) => item.nutrition_json != null)
      .map((item: Record<string, unknown>, idx: number) => ({
        mealId: item.id as string,
        label: (item.title as string) ?? `Meal ${idx + 1}`,
        nutrition: item.nutrition_json as NutritionBreakdown,
        servings: (item.servings as number) ?? 1,
      }));

    const daily = aggregateDailyNutrition(date, meals);
    return ok(daily);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to aggregate daily nutrition');
  }
}

/**
 * Given a nutrient gap, find recipes that help fill it.
 * Returns recipe suggestions sorted by nutrient density for the missing nutrient.
 */
export async function suggestRecipesForNutrientGap(
  gap: NutrientGap,
): Promise<BestChefResult<RecipeSuggestion[]>> {
  if (gap.severity === 'none') {
    return ok([]);
  }

  try {
    // Fetch recipes with nutrition data
    const { data: snapshots, error: snapError } = await from('bc_recipe_snapshots')
      .select('id, title, nutrition_json')
      .not('nutrition_json', 'is', null)
      .limit(100);

    if (snapError) return err(snapError.message);
    if (!snapshots || snapshots.length === 0) return ok([]);

    const suggestions: RecipeSuggestion[] = snapshots
      .map((s: Record<string, unknown>) => {
        const nutrition = s.nutrition_json as NutritionBreakdown;
        const nutrientValue = nutrition[gap.nutrient];
        return {
          snapshotId: s.id as string,
          title: s.title as string,
          nutrientDensity: nutrientValue ?? 0,
          nutrition,
        };
      })
      .filter((s) => s.nutrientDensity > 0)
      .sort((a, b) => b.nutrientDensity - a.nutrientDensity)
      .slice(0, 10);

    return ok(suggestions);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to suggest recipes for gap');
  }
}

/**
 * Use @mylife/nutrition-engine optimizer to suggest meal plan improvements.
 */
export async function getMealPlanOptimizationHints(
  profileId: string,
  goals: DietaryGoal,
): Promise<BestChefResult<OptimizationSuggestion[]>> {
  try {
    // Fetch the user's recent meal plan data (last 7 days)
    const { data: items, error: itemsError } = await from('bc_recipe_snapshots')
      .select('id, title, nutrition_json, servings, created_at')
      .eq('profile_id', profileId)
      .not('nutrition_json', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (itemsError) return err(itemsError.message);
    if (!items || items.length === 0) {
      return ok([]);
    }

    // Group by date and build MealPlanNutrition
    const dayMap = new Map<string, MealNutrition[]>();
    for (const item of items) {
      const rec = item as Record<string, unknown>;
      const date = (rec.created_at as string).slice(0, 10);
      const meals = dayMap.get(date) ?? [];
      meals.push({
        mealId: rec.id as string,
        label: (rec.title as string) ?? 'Meal',
        nutrition: rec.nutrition_json as NutritionBreakdown,
        servings: (rec.servings as number) ?? 1,
      });
      dayMap.set(date, meals);
    }

    const days: DailyNutritionSummary[] = Array.from(dayMap.entries()).map(
      ([date, meals]) => aggregateDailyNutrition(date, meals),
    );

    const plan: MealPlanNutrition = { planId: profileId, days };
    const suggestions = optimizeMealPlan(plan, goals);

    return ok(suggestions);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to get optimization hints');
  }
}

/**
 * Calculate a 0-100 health score for a recipe snapshot based on nutritional balance.
 */
export async function getRecipeHealthScore(
  snapshotId: string,
): Promise<BestChefResult<HealthScore>> {
  try {
    const { data: snapshot, error: snapError } = await from('bc_recipe_snapshots')
      .select('nutrition_json')
      .eq('id', snapshotId)
      .single();

    if (snapError || !snapshot) {
      return err(snapError?.message ?? 'Snapshot not found');
    }

    const nutrition = snapshot.nutrition_json as NutritionBreakdown | null;
    if (!nutrition) {
      return ok({ score: 0, breakdown: { macroBalance: 0, fiberScore: 0, sodiumScore: 0, satFatScore: 0 } });
    }

    return ok(calculateHealthScore(nutrition));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to calculate health score');
  }
}
