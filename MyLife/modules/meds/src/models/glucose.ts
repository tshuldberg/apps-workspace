import { z } from 'zod';

// -- Glucose unit ------------------------------------------------------------
export const GlucoseUnitSchema = z.enum(['mg/dL', 'mmol/L']);
export type GlucoseUnit = z.infer<typeof GlucoseUnitSchema>;

// -- Meal context ------------------------------------------------------------
export const MealContextSchema = z.enum([
  'fasting',
  'before_meal',
  'after_meal',
  'bedtime',
  'random',
  'after_exercise',
]);
export type MealContext = z.infer<typeof MealContextSchema>;

// -- Meal type ---------------------------------------------------------------
export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof MealTypeSchema>;

// -- Range status ------------------------------------------------------------
export const GlucoseRangeStatusSchema = z.enum([
  'very_low',
  'low',
  'in_range',
  'high',
  'very_high',
]);
export type GlucoseRangeStatus = z.infer<typeof GlucoseRangeStatusSchema>;

// -- Full record -------------------------------------------------------------
export const GlucoseReadingSchema = z.object({
  id: z.string(),
  value: z.number().positive(),
  unit: GlucoseUnitSchema,
  mealContext: MealContextSchema.nullable(),
  mealType: MealTypeSchema.nullable(),
  inRange: z.boolean(),
  rangeStatus: GlucoseRangeStatusSchema,
  notes: z.string().nullable(),
  measuredAt: z.string(),
  createdAt: z.string(),
});
export type GlucoseReading = z.infer<typeof GlucoseReadingSchema>;

// -- Create input ------------------------------------------------------------
export const CreateGlucoseReadingInputSchema = z.object({
  value: z.number().positive().max(600),
  unit: GlucoseUnitSchema.optional(),
  mealContext: MealContextSchema.optional(),
  mealType: MealTypeSchema.optional(),
  notes: z.string().optional(),
  measuredAt: z.string().optional(),
});
export type CreateGlucoseReadingInput = z.infer<typeof CreateGlucoseReadingInputSchema>;

// -- Update input ------------------------------------------------------------
export const UpdateGlucoseReadingInputSchema = z.object({
  value: z.number().positive().max(600).optional(),
  unit: GlucoseUnitSchema.optional(),
  mealContext: MealContextSchema.optional().nullable(),
  mealType: MealTypeSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  measuredAt: z.string().optional(),
});
export type UpdateGlucoseReadingInput = z.infer<typeof UpdateGlucoseReadingInputSchema>;

// -- Target ranges -----------------------------------------------------------
export interface GlucoseTargets {
  urgentLow: number;  // default 54 mg/dL
  low: number;        // default 70 mg/dL
  high: number;       // default 180 mg/dL
  veryHigh: number;   // default 250 mg/dL
}

export const DEFAULT_GLUCOSE_TARGETS: GlucoseTargets = {
  urgentLow: 54,
  low: 70,
  high: 180,
  veryHigh: 250,
};

// -- Pattern analysis --------------------------------------------------------
export interface GlucosePatternAnalysis {
  averageFasting: number | null;
  averagePostMeal: number | null;
  averageOverall: number;
  readingCount: number;
  fastingCount: number;
  postMealCount: number;
}

// -- Conversion constant -----------------------------------------------------
export const GLUCOSE_CONVERSION_FACTOR = 18.0182;
