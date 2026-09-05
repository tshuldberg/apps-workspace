import type { MealNutrition, DailyNutritionSummary, WeeklyNutritionSummary } from './types';
import { emptyBreakdown, sumBreakdowns, divideBreakdown } from './calculator';

/**
 * Aggregates an array of meals into a daily nutrition summary.
 * Sums all meal breakdowns into a single total for the day.
 */
export function aggregateDailyNutrition(
  date: string,
  meals: MealNutrition[],
): DailyNutritionSummary {
  const totals = meals.reduce(
    (acc, meal) => sumBreakdowns(acc, meal.nutrition),
    emptyBreakdown(),
  );

  return {
    date,
    meals,
    totals,
    mealCount: meals.length,
  };
}

/**
 * Aggregates an array of daily summaries into a weekly summary.
 * Computes both total and average breakdowns across all tracked days.
 */
export function aggregateWeeklyNutrition(
  weekStartDate: string,
  days: DailyNutritionSummary[],
): WeeklyNutritionSummary {
  const trackedDays = days.filter((d) => d.mealCount > 0);
  const totals = trackedDays.reduce(
    (acc, day) => sumBreakdowns(acc, day.totals),
    emptyBreakdown(),
  );

  const daysTracked = trackedDays.length;
  const averages = daysTracked > 0
    ? divideBreakdown(totals, daysTracked)
    : emptyBreakdown();

  return {
    weekStartDate,
    days,
    averages,
    totals,
    daysTracked,
  };
}
