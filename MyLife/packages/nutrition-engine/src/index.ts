// @mylife/nutrition-engine -- shared nutrition calculation, aggregation, and goal tracking

// Types
export type {
  NutritionBreakdown,
  RecipeNutritionSummary,
  MealNutrition,
  DailyNutritionSummary,
  WeeklyNutritionSummary,
  DietaryGoal,
  NutrientName,
  GoalNutrientProgress,
  GoalProgress,
  Adjustment,
  RecommendedDailyAllowance,
  NutrientGap,
  FoodSuggestion,
  MealPlanNutrition,
  OptimizationSuggestion,
} from './types';

// Schemas
export {
  NutritionBreakdownSchema,
  RecipeNutritionSummarySchema,
  MealNutritionSchema,
  DailyNutritionSummarySchema,
  WeeklyNutritionSummarySchema,
  DietaryGoalSchema,
  RecommendedDailyAllowanceSchema,
  MealPlanNutritionSchema,
} from './types';

// Calculator utilities
export {
  emptyBreakdown,
  addNutrient,
  divideBreakdown,
  sumBreakdowns,
  scaleBreakdown,
} from './calculator';

// Aggregation
export {
  aggregateDailyNutrition,
  aggregateWeeklyNutrition,
} from './aggregator';

// Goal tracking
export {
  evaluateGoalProgress,
  suggestMealAdjustments,
} from './goals';

// Gap analysis
export {
  analyzeNutrientGaps,
  suggestFoodsForGap,
} from './gaps';

// Meal plan optimization
export {
  optimizeMealPlan,
  calculateMealPlanScore,
} from './optimizer';
