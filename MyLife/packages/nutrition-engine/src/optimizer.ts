import type {
  MealPlanNutrition,
  DailyNutritionSummary,
  DietaryGoal,
  OptimizationSuggestion,
  NutrientName,
} from './types';
import { evaluateGoalProgress } from './goals';

/**
 * Analyzes a meal plan against dietary goals and produces optimization suggestions.
 * Identifies days and meals that deviate most from targets, ordered by impact.
 */
export function optimizeMealPlan(
  currentPlan: MealPlanNutrition,
  goals: DietaryGoal,
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  for (const day of currentPlan.days) {
    const progress = evaluateGoalProgress(goals, day);

    for (const nutrientProgress of progress.nutrients) {
      if (nutrientProgress.status === 'on_track') continue;
      if (nutrientProgress.percentage === null) continue;

      const deviation = Math.abs(1 - nutrientProgress.percentage);
      const impact: OptimizationSuggestion['impact'] =
        deviation > 0.3 ? 'high' : deviation > 0.15 ? 'medium' : 'low';

      // Find the meal most responsible for this nutrient's deviation
      let targetMeal = day.meals[0];
      if (!targetMeal) continue;

      if (nutrientProgress.status === 'over') {
        // Find meal contributing most
        let maxVal = 0;
        for (const meal of day.meals) {
          const val = meal.nutrition[nutrientProgress.nutrient];
          if (val !== null && val > maxVal) {
            maxVal = val;
            targetMeal = meal;
          }
        }
      } else {
        // Under: find meal with lowest contribution to suggest boosting
        let minVal = Infinity;
        for (const meal of day.meals) {
          const val = meal.nutrition[nutrientProgress.nutrient];
          if (val !== null && val < minVal) {
            minVal = val;
            targetMeal = meal;
          }
        }
      }

      const nutrientLabel = formatNutrientLabel(nutrientProgress.nutrient);
      const direction = nutrientProgress.status === 'over' ? 'Reduce' : 'Increase';
      const pctOff = Math.round(deviation * 100);
      const issue = `${nutrientLabel} is ${pctOff}% ${nutrientProgress.status === 'over' ? 'above' : 'below'} target`;
      const suggestion = `${direction} ${nutrientLabel} in "${targetMeal.label}"`;

      suggestions.push({
        day: day.date,
        mealId: targetMeal.mealId,
        mealLabel: targetMeal.label,
        issue,
        suggestion,
        impact,
      });
    }
  }

  const impactOrder: Record<OptimizationSuggestion['impact'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return suggestions;
}

/**
 * Scores a meal plan from 0-100 based on how well it meets dietary goals.
 * 100 means every day hits every target within 10%.
 */
export function calculateMealPlanScore(
  plan: MealPlanNutrition,
  goals: DietaryGoal,
): number {
  const trackedDays = plan.days.filter((d: DailyNutritionSummary) => d.mealCount > 0);
  if (trackedDays.length === 0) return 0;

  const dayScores = trackedDays.map((day: DailyNutritionSummary) => {
    const progress = evaluateGoalProgress(goals, day);
    return progress.overallScore;
  });

  return Math.round(dayScores.reduce((sum: number, s: number) => sum + s, 0) / dayScores.length);
}

function formatNutrientLabel(nutrient: NutrientName): string {
  const labels: Record<NutrientName, string> = {
    calories: 'Calories',
    protein_g: 'Protein',
    carbs_g: 'Carbs',
    fat_g: 'Fat',
    fiber_g: 'Fiber',
    sodium_mg: 'Sodium',
    sugar_g: 'Sugar',
  };
  return labels[nutrient];
}
