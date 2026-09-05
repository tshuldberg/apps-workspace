import type { HarvestUnit } from '../types';

// Unit conversion factors to grams
const TO_GRAMS: Record<HarvestUnit, number> = {
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  lbs: 453.592,
  count: 1, // count stays as count
  bunches: 1, // bunches stays as bunches
  cups: 1, // cups stays as cups
};

/**
 * Convert quantity from one unit to another.
 * Only weight units (grams, kg, oz, lbs) are convertible between each other.
 */
export function convertUnit(quantity: number, from: HarvestUnit, to: HarvestUnit): number {
  const weightUnits: HarvestUnit[] = ['grams', 'kg', 'oz', 'lbs'];
  if (!weightUnits.includes(from) || !weightUnits.includes(to)) {
    return quantity; // Non-weight units are not convertible
  }
  const grams = quantity * TO_GRAMS[from];
  return Math.round((grams / TO_GRAMS[to]) * 100) / 100;
}

/**
 * Check if a unit is a weight unit (convertible).
 */
export function isWeightUnit(unit: HarvestUnit): boolean {
  return ['grams', 'kg', 'oz', 'lbs'].includes(unit);
}
