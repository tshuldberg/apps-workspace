import { z } from 'zod';

// --- Core Nutrition Breakdown ---

export const NutritionBreakdownSchema = z.object({
  calories: z.number().nullable(),
  fat_g: z.number().nullable(),
  saturated_fat_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  protein_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
});

export type NutritionBreakdown = z.infer<typeof NutritionBreakdownSchema>;

export const RecipeNutritionSummarySchema = z.object({
  recipeId: z.string(),
  servings: z.number(),
  perServing: NutritionBreakdownSchema,
  total: NutritionBreakdownSchema,
  coverage: z.number(),
  missingIngredients: z.array(z.string()),
});

export type RecipeNutritionSummary = z.infer<typeof RecipeNutritionSummarySchema>;

// --- Meal / Daily / Weekly Aggregation ---

export const MealNutritionSchema = z.object({
  mealId: z.string(),
  label: z.string(),
  nutrition: NutritionBreakdownSchema,
  servings: z.number().positive(),
});

export type MealNutrition = z.infer<typeof MealNutritionSchema>;

export const DailyNutritionSummarySchema = z.object({
  date: z.string(),
  meals: z.array(MealNutritionSchema),
  totals: NutritionBreakdownSchema,
  mealCount: z.number().int().nonnegative(),
});

export type DailyNutritionSummary = z.infer<typeof DailyNutritionSummarySchema>;

export const WeeklyNutritionSummarySchema = z.object({
  weekStartDate: z.string(),
  days: z.array(DailyNutritionSummarySchema),
  averages: NutritionBreakdownSchema,
  totals: NutritionBreakdownSchema,
  daysTracked: z.number().int().nonnegative(),
});

export type WeeklyNutritionSummary = z.infer<typeof WeeklyNutritionSummarySchema>;

// --- Dietary Goals ---

export const DietaryGoalSchema = z.object({
  targetCalories: z.number().positive(),
  targetProtein_g: z.number().nonnegative(),
  targetCarbs_g: z.number().nonnegative(),
  targetFat_g: z.number().nonnegative(),
  targetFiber_g: z.number().nonnegative().optional(),
  targetSodium_mg: z.number().nonnegative().optional(),
  targetSugar_g: z.number().nonnegative().optional(),
});

export type DietaryGoal = z.infer<typeof DietaryGoalSchema>;

export type NutrientName = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sodium_mg' | 'sugar_g';

export interface GoalNutrientProgress {
  nutrient: NutrientName;
  target: number;
  actual: number | null;
  percentage: number | null;
  status: 'under' | 'on_track' | 'over';
}

export interface GoalProgress {
  goal: DietaryGoal;
  nutrients: GoalNutrientProgress[];
  overallScore: number;
}

export interface Adjustment {
  mealId: string;
  mealLabel: string;
  suggestion: string;
  nutrient: NutrientName;
  currentValue: number | null;
  suggestedChange: number;
}

// --- Nutrient Gap Analysis ---

export const RecommendedDailyAllowanceSchema = z.object({
  calories: z.number().positive(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
  sugar_g: z.number().nonnegative(),
  sodium_mg: z.number().nonnegative(),
  saturated_fat_g: z.number().nonnegative().optional(),
});

export type RecommendedDailyAllowance = z.infer<typeof RecommendedDailyAllowanceSchema>;

export interface NutrientGap {
  nutrient: NutrientName;
  recommended: number;
  actual: number | null;
  deficit: number | null;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface FoodSuggestion {
  name: string;
  nutrient: NutrientName;
  amountPer100g: number;
  suggestedServing: string;
}

// --- Meal Plan Optimization ---

export const MealPlanNutritionSchema = z.object({
  planId: z.string(),
  days: z.array(DailyNutritionSummarySchema),
});

export type MealPlanNutrition = z.infer<typeof MealPlanNutritionSchema>;

export interface OptimizationSuggestion {
  day: string;
  mealId: string;
  mealLabel: string;
  issue: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}
