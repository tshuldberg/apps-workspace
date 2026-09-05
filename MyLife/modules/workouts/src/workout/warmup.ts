/**
 * Warmup set calculator for strength training.
 * Generates progressive warmup sets leading to the working weight.
 */

import type { WarmupSet } from '../types';

/**
 * Calculate warmup sets for a given working weight.
 * Standard progression: bar only x 10, 50% x 8, 70% x 5, 85% x 3, then working weight.
 * Weights are rounded to the nearest 5 (lbs) or 2.5 (kg).
 */
export function calculateWarmupSets(
  workingWeight: number,
  barWeight: number,
): WarmupSet[] {
  if (workingWeight <= barWeight) {
    return [{ weight: barWeight, reps: 10, percentage: 0 }];
  }

  const sets: WarmupSet[] = [];

  // Bar only
  sets.push({ weight: barWeight, reps: 10, percentage: 0 });

  const percentages = [
    { pct: 0.5, reps: 8 },
    { pct: 0.7, reps: 5 },
    { pct: 0.85, reps: 3 },
  ];

  for (const { pct, reps } of percentages) {
    const raw = workingWeight * pct;
    // Round to nearest 5
    const rounded = Math.round(raw / 5) * 5;
    // Skip if it equals bar weight (already added) or if it equals working weight
    if (rounded <= barWeight || rounded >= workingWeight) continue;
    sets.push({ weight: rounded, reps, percentage: Math.round(pct * 100) });
  }

  return sets;
}
