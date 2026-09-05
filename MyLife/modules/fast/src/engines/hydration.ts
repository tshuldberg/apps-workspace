/**
 * Hydration Calculation Engine
 *
 * Pure functions for computing daily hydration from beverage logs.
 * No database access -- takes data as input.
 */

import type { BeverageLog } from '../types';

/**
 * Calculate total hydration from beverage logs.
 * Returns total in oz, clamped to >= 0.
 */
export function calculateDailyHydration(logs: BeverageLog[]): number {
  const total = logs.reduce((sum, log) => sum + log.hydrationOz, 0);
  return Math.max(0, total);
}

/**
 * Convert hydration oz to glass equivalents (1 glass = 8oz).
 */
export function hydrationToGlasses(hydrationOz: number): number {
  return hydrationOz / 8.0;
}

/**
 * Check if daily hydration target is met.
 * @param hydrationOz Total hydration in ounces
 * @param targetGlasses Target in glasses (each glass = 8oz)
 */
export function meetsHydrationTarget(hydrationOz: number, targetGlasses: number): boolean {
  return hydrationOz / 8.0 >= targetGlasses;
}

/**
 * Compute hydration contribution for a single drink.
 * @param volumeOz Volume consumed in fluid ounces
 * @param coefficient Hydration coefficient of the beverage type
 * @returns Effective hydration in ounces
 */
export function computeHydration(volumeOz: number, coefficient: number): number {
  return volumeOz * coefficient;
}
