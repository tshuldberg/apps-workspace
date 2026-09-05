import type { NutritionBreakdown } from './types';

/**
 * Creates an empty NutritionBreakdown with all fields set to null.
 */
export function emptyBreakdown(): NutritionBreakdown {
  return {
    calories: null,
    fat_g: null,
    saturated_fat_g: null,
    carbs_g: null,
    fiber_g: null,
    sugar_g: null,
    protein_g: null,
    sodium_mg: null,
  };
}

/**
 * Adds a nutrient value to a running total. Returns null only if both
 * the current accumulator and the incoming value are null.
 */
export function addNutrient(current: number | null, value: number | null): number | null {
  if (value === null) return current;
  return (current ?? 0) + value;
}

/**
 * Divides every non-null field in a NutritionBreakdown by a divisor,
 * rounding to one decimal place.
 */
export function divideBreakdown(total: NutritionBreakdown, divisor: number): NutritionBreakdown {
  const divide = (v: number | null): number | null =>
    v === null ? null : Math.round((v / divisor) * 10) / 10;
  return {
    calories: divide(total.calories),
    fat_g: divide(total.fat_g),
    saturated_fat_g: divide(total.saturated_fat_g),
    carbs_g: divide(total.carbs_g),
    fiber_g: divide(total.fiber_g),
    sugar_g: divide(total.sugar_g),
    protein_g: divide(total.protein_g),
    sodium_mg: divide(total.sodium_mg),
  };
}

/**
 * Sums two NutritionBreakdown objects field by field.
 */
export function sumBreakdowns(a: NutritionBreakdown, b: NutritionBreakdown): NutritionBreakdown {
  return {
    calories: addNutrient(a.calories, b.calories),
    fat_g: addNutrient(a.fat_g, b.fat_g),
    saturated_fat_g: addNutrient(a.saturated_fat_g, b.saturated_fat_g),
    carbs_g: addNutrient(a.carbs_g, b.carbs_g),
    fiber_g: addNutrient(a.fiber_g, b.fiber_g),
    sugar_g: addNutrient(a.sugar_g, b.sugar_g),
    protein_g: addNutrient(a.protein_g, b.protein_g),
    sodium_mg: addNutrient(a.sodium_mg, b.sodium_mg),
  };
}

/**
 * Scales every non-null field in a NutritionBreakdown by a multiplier.
 */
export function scaleBreakdown(breakdown: NutritionBreakdown, scale: number): NutritionBreakdown {
  const multiply = (v: number | null): number | null =>
    v === null ? null : v * scale;
  return {
    calories: multiply(breakdown.calories),
    fat_g: multiply(breakdown.fat_g),
    saturated_fat_g: multiply(breakdown.saturated_fat_g),
    carbs_g: multiply(breakdown.carbs_g),
    fiber_g: multiply(breakdown.fiber_g),
    sugar_g: multiply(breakdown.sugar_g),
    protein_g: multiply(breakdown.protein_g),
    sodium_mg: multiply(breakdown.sodium_mg),
  };
}
