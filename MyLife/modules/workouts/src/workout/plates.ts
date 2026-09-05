/**
 * Plate calculator for barbell loading.
 * Greedy algorithm: subtract bar weight, divide by 2, fit largest plates first.
 * Supports both standard plate sets and custom plate inventories with count limits.
 */

import type { WeightUnit, PlateResult } from '../types';

export const STANDARD_PLATES_LBS = [45, 35, 25, 10, 5, 2.5];
export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/** A plate entry in a custom inventory: weight and total count owned. */
export interface InventoryPlate {
  weight: number;
  count: number;
}

/**
 * Calculate plates needed per side to reach the target weight.
 * Returns the plate breakdown, actual total weight achieved, and any remainder
 * that cannot be loaded with available plates.
 *
 * If customPlates is provided, the calculator uses those plates and respects
 * count limits (count is total owned, max per side = floor(count / 2)).
 */
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  unit: WeightUnit,
  customPlates?: InventoryPlate[],
): PlateResult {
  if (targetWeight <= barWeight) {
    return { perSide: [], totalWeight: barWeight, remainder: 0 };
  }

  let remaining = (targetWeight - barWeight) / 2;
  const perSide: { weight: number; count: number }[] = [];

  if (customPlates && customPlates.length > 0) {
    // Sort custom plates descending by weight for greedy algorithm
    const sorted = [...customPlates].sort((a, b) => b.weight - a.weight);
    for (const plate of sorted) {
      if (remaining <= 0) break;
      // Max per side is half the total owned (each side gets equal plates)
      const maxPerSide = Math.floor(plate.count / 2);
      if (maxPerSide <= 0) continue;
      const needed = Math.floor(remaining / plate.weight);
      const count = Math.min(needed, maxPerSide);
      if (count > 0) {
        perSide.push({ weight: plate.weight, count });
        remaining -= count * plate.weight;
      }
    }
  } else {
    const plates = unit === 'lbs' ? STANDARD_PLATES_LBS : STANDARD_PLATES_KG;
    for (const plate of plates) {
      if (remaining <= 0) break;
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        perSide.push({ weight: plate, count });
        remaining -= count * plate;
      }
    }
  }

  // Round remainder to avoid floating point issues
  const remainder = Math.round(remaining * 100) / 100;
  const loadedPerSide = perSide.reduce((sum, p) => sum + p.weight * p.count, 0);
  const totalWeight = barWeight + loadedPerSide * 2;

  return { perSide, totalWeight, remainder };
}
