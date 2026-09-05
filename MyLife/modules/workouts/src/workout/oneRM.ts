/**
 * One-Rep Max (1RM) calculators for strength training.
 */

import type { OneRMFormula } from '../types';

/**
 * Epley formula: weight * (1 + reps / 30)
 * Most widely used 1RM estimation.
 */
export function calculateEpley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Brzycki formula: weight * 36 / (37 - reps)
 * More accurate for lower rep ranges (1-10).
 */
export function calculateBrzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return 0; // Formula breaks down at 37+ reps
  return Math.round(weight * 36 / (37 - reps));
}

/**
 * Calculate estimated 1RM using the specified formula.
 * Defaults to Epley.
 */
export function calculate1RM(
  weight: number,
  reps: number,
  formula: OneRMFormula = 'epley',
): number {
  switch (formula) {
    case 'epley':
      return calculateEpley1RM(weight, reps);
    case 'brzycki':
      return calculateBrzycki1RM(weight, reps);
  }
}
