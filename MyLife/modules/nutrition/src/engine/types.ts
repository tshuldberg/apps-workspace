import { z } from 'zod';

// ── Insight Types ────────────────────────────────────────────────────

export const NutritionInsightTypeSchema = z.enum([
  'fasting_break_quality',
  'restaurant_impact',
  'water_snacking',
  'meal_timing',
  'gym_day_delta',
  'protein_workout',
]);
export type NutritionInsightType = z.infer<typeof NutritionInsightTypeSchema>;

export const NutritionInsightSeveritySchema = z.enum(['info', 'notable', 'actionable']);
export type NutritionInsightSeverity = z.infer<typeof NutritionInsightSeveritySchema>;

export const NutritionInsightSchema = z.object({
  id: z.string(),
  type: NutritionInsightTypeSchema,
  severity: NutritionInsightSeveritySchema,
  title: z.string(),
  body: z.string(),
  metric: z.string(),
  recommendation: z.string(),
  data: z.record(z.unknown()).optional(),
  generatedAt: z.string(),
});
export type NutritionInsight = z.infer<typeof NutritionInsightSchema>;

// ── Minimum Sample Thresholds ────────────────────────────────────────

export const MIN_DAYS_INTERNAL = 7;
export const MIN_DAYS_CROSS_MODULE = 14;
export const MIN_DAYS_COMPLEX = 30;

// ── Input Data Structures ────────────────────────────────────────────

export interface DayNutritionData {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealCount: number;
  snackCount: number;
  lastMealHour: number | null; // 0-23
  firstMealHour: number | null; // 0-23
  isRestaurantMeal: boolean;
  waterMl: number;
}

export interface DayFastingData {
  date: string;
  didFast: boolean;
  breakfastProteinG: number | null;
  breakfastCalories: number | null;
  wasUnderCalorieGoal: boolean;
}

export interface DayWorkoutData {
  date: string;
  didWorkout: boolean;
}

export interface DayMoodData {
  date: string;
  energyScore: number | null; // 1-10
}

export interface InsightInput {
  nutritionDays: DayNutritionData[];
  fastingDays: DayFastingData[];
  workoutDays: DayWorkoutData[];
  moodDays: DayMoodData[];
  calorieGoal: number | null;
}
