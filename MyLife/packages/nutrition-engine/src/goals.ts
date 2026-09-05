import type {
  DietaryGoal,
  DailyNutritionSummary,
  GoalProgress,
  GoalNutrientProgress,
  NutrientName,
  Adjustment,
  MealNutrition,
} from './types';

const ON_TRACK_LOW = 0.9;
const ON_TRACK_HIGH = 1.1;

function nutrientStatus(percentage: number | null): 'under' | 'on_track' | 'over' {
  if (percentage === null) return 'under';
  if (percentage < ON_TRACK_LOW) return 'under';
  if (percentage > ON_TRACK_HIGH) return 'over';
  return 'on_track';
}

function getActualValue(actual: DailyNutritionSummary, nutrient: NutrientName): number | null {
  return actual.totals[nutrient];
}

interface GoalNutrientEntry {
  nutrient: NutrientName;
  target: number;
}

function extractGoalNutrients(goal: DietaryGoal): GoalNutrientEntry[] {
  const entries: GoalNutrientEntry[] = [
    { nutrient: 'calories', target: goal.targetCalories },
    { nutrient: 'protein_g', target: goal.targetProtein_g },
    { nutrient: 'carbs_g', target: goal.targetCarbs_g },
    { nutrient: 'fat_g', target: goal.targetFat_g },
  ];
  if (goal.targetFiber_g !== undefined) {
    entries.push({ nutrient: 'fiber_g', target: goal.targetFiber_g });
  }
  if (goal.targetSodium_mg !== undefined) {
    entries.push({ nutrient: 'sodium_mg', target: goal.targetSodium_mg });
  }
  if (goal.targetSugar_g !== undefined) {
    entries.push({ nutrient: 'sugar_g', target: goal.targetSugar_g });
  }
  return entries;
}

/**
 * Evaluates how a day's actual nutrition stacks up against dietary goals.
 * Returns per-nutrient progress and an overall 0-100 score.
 */
export function evaluateGoalProgress(
  goal: DietaryGoal,
  actual: DailyNutritionSummary,
): GoalProgress {
  const goalNutrients = extractGoalNutrients(goal);
  const nutrients: GoalNutrientProgress[] = goalNutrients.map((entry) => {
    const actualValue = getActualValue(actual, entry.nutrient);
    const percentage = actualValue !== null && entry.target > 0
      ? actualValue / entry.target
      : null;
    return {
      nutrient: entry.nutrient,
      target: entry.target,
      actual: actualValue,
      percentage,
      status: nutrientStatus(percentage),
    };
  });

  const scored = nutrients.filter((n) => n.percentage !== null);
  const overallScore = scored.length > 0
    ? Math.round(
        (scored.reduce((sum, n) => {
          const pct = n.percentage!;
          // Score: 100 when on track, decreases as you deviate
          const deviation = Math.abs(1 - pct);
          return sum + Math.max(0, 100 - deviation * 100);
        }, 0) / scored.length),
      )
    : 0;

  return { goal, nutrients, overallScore };
}

/**
 * Suggests simple adjustments to meals to move closer to dietary goals.
 * Identifies the largest deviations and recommends proportional changes.
 */
export function suggestMealAdjustments(
  goal: DietaryGoal,
  currentMeals: MealNutrition[],
): Adjustment[] {
  const adjustments: Adjustment[] = [];
  const goalNutrients = extractGoalNutrients(goal);

  // Sum current totals across all meals
  const currentTotals: Record<string, number> = {};
  for (const entry of goalNutrients) {
    currentTotals[entry.nutrient] = 0;
  }
  for (const meal of currentMeals) {
    for (const entry of goalNutrients) {
      const val = meal.nutrition[entry.nutrient];
      if (val !== null) {
        currentTotals[entry.nutrient] += val;
      }
    }
  }

  for (const entry of goalNutrients) {
    const current = currentTotals[entry.nutrient];
    const diff = entry.target - current;
    const percentage = entry.target > 0 ? current / entry.target : 0;

    if (percentage >= ON_TRACK_LOW && percentage <= ON_TRACK_HIGH) continue;

    // Find the meal contributing most to this nutrient for targeted advice
    let targetMeal = currentMeals[0];
    if (!targetMeal) continue;

    let maxContribution = 0;
    for (const meal of currentMeals) {
      const val = meal.nutrition[entry.nutrient];
      if (val !== null && Math.abs(val) > maxContribution) {
        maxContribution = Math.abs(val);
        targetMeal = meal;
      }
    }

    const direction = diff > 0 ? 'increase' : 'decrease';
    const suggestion = `${direction} ${entry.nutrient.replace('_g', '').replace('_mg', '')} by ~${Math.abs(Math.round(diff))} in this meal`;

    adjustments.push({
      mealId: targetMeal.mealId,
      mealLabel: targetMeal.label,
      suggestion,
      nutrient: entry.nutrient,
      currentValue: targetMeal.nutrition[entry.nutrient],
      suggestedChange: Math.round(diff),
    });
  }

  return adjustments;
}
