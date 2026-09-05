export {
  detectRestaurantImpact,
  detectWaterSnacking,
  detectFastingBreakQuality,
  detectMealTimingEnergy,
  detectGymDayDelta,
  detectProteinWorkoutAdherence,
  generateNutritionInsights,
} from './insight';

export {
  getNutritionDays,
  getFastingDays,
  getWorkoutDays,
  getMoodDays,
  getCalorieGoal,
} from './data-bridge';

export {
  calculateTDEE,
  calculateDailyCalories,
  calculateMacroGrams,
  normalizeMacroSplit,
  lbsToKg,
  kgToLbs,
  ftInToCm,
  cmToFtIn,
} from './tdee';

export type {
  WeightGoalDirection,
  MacroSplitPercents,
  MacroGramTargets,
} from './tdee';

export type {
  NutritionInsight,
  NutritionInsightType,
  NutritionInsightSeverity,
  DayNutritionData,
  DayFastingData,
  DayWorkoutData,
  DayMoodData,
  InsightInput,
} from './types';

export {
  NutritionInsightSchema,
  NutritionInsightTypeSchema,
  NutritionInsightSeveritySchema,
  MIN_DAYS_INTERNAL,
  MIN_DAYS_CROSS_MODULE,
  MIN_DAYS_COMPLEX,
} from './types';
