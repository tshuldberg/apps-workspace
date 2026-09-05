import type { StructuredIngredient } from '../types';

export interface ScaledIngredient extends StructuredIngredient {
  scaled_quantity: number | null;
}

export function scaleIngredients(
  ingredients: StructuredIngredient[],
  originalServings: number,
  targetServings: number,
): ScaledIngredient[] {
  if (originalServings <= 0 || targetServings <= 0) {
    return ingredients.map((ingredient) => ({
      ...ingredient,
      scaled_quantity: ingredient.quantity_value,
    }));
  }

  const ratio = targetServings / originalServings;
  return ingredients.map((ingredient) => ({
    ...ingredient,
    scaled_quantity:
      ingredient.quantity_value !== null
        ? roundQuantity(ingredient.quantity_value * ratio)
        : null,
  }));
}

function roundQuantity(value: number): number {
  if (value === 0) return 0;

  const fractions = [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75];
  const whole = Math.floor(value);
  const fractional = value - whole;

  if (fractional < 0.0625) return whole;
  if (fractional > 0.9375) return whole + 1;

  let closest = fractional;
  let minDiff = 1;
  for (const fraction of fractions) {
    const diff = Math.abs(fractional - fraction);
    if (diff < minDiff) {
      minDiff = diff;
      closest = fraction;
    }
  }

  if (minDiff < 0.05) {
    return whole + closest;
  }

  return Math.round(value * 100) / 100;
}
