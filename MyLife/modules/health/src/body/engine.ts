/**
 * Body composition engine.
 * BMI calculation, lean mass derivation, moving average, unit conversions.
 * Pure functions, no side effects.
 */

import type { BmiCategory } from '../types';

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

export function convertLbsToKg(lbs: number): number {
  return Math.round(lbs * 0.45359237 * 100) / 100;
}

export function convertKgToLbs(kg: number): number {
  return Math.round(kg / 0.45359237 * 100) / 100;
}

export function convertInchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 100) / 100;
}

export function convertCmToInches(cm: number): number {
  return Math.round(cm / 2.54 * 100) / 100;
}

export function convertFeetInchesToCm(feet: number, inches: number): number {
  return convertInchesToCm(feet * 12 + inches);
}

// ---------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------

export function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

// ---------------------------------------------------------------------------
// Body composition
// ---------------------------------------------------------------------------

export function calculateLeanMass(weightKg: number, bodyFatPercent: number): number {
  return Math.round(weightKg * (1 - bodyFatPercent / 100) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Trend analysis
// ---------------------------------------------------------------------------

/**
 * Calculate a simple moving average with the given window size.
 * Values should be ordered oldest to newest.
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  if (values.length === 0 || windowSize <= 0) return [];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    result.push(Math.round(avg * 100) / 100);
  }
  return result;
}
