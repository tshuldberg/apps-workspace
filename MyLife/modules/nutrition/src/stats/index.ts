export {
  getDailySummary,
  getDailyGoalProgress,
  getMealBreakdown,
} from './daily-summary';
export type { DailySummary, GoalProgress, MealBreakdown } from './daily-summary';

export {
  getWeeklyTrends,
  getMonthlyTrends,
  getCalorieHistory,
  getMacroRatios,
} from './trends';
export type { DayTotal, MacroRatios } from './trends';

export {
  getMicronutrientSummary,
  getMicronutrientDeficiencies,
  getTopNutrientSources,
} from './micronutrients';
export type { NutrientStatus, NutrientSummaryItem, NutrientDeficiency, TopNutrientSource } from './micronutrients';

export { getStreakInfo } from './streak';
export type { StreakInfo } from './streak';

export { getAggregateTargetScore, getDailyReport } from './daily-report';
export type { AggregateTargetScore, DailyReport } from './daily-report';
