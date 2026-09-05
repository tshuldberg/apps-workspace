import type { CoverlineResult } from '../types';

/**
 * Convert Celsius to Fahrenheit.
 * Rounds to 1 decimal place.
 */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9 / 5 + 32) * 10) / 10;
}

/**
 * Convert Fahrenheit to Celsius.
 * Rounds to 2 decimal places for storage precision.
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return Math.round(((fahrenheit - 32) * 5 / 9) * 100) / 100;
}

/**
 * Calculate the coverline (baseline temperature) from follicular-phase readings.
 * Coverline = average of the 6 lowest temperature values.
 *
 * Returns null if fewer than 6 readings are provided.
 *
 * @param temperatures - Array of temperature values in Celsius, ordered chronologically.
 */
export function calculateCoverline(temperatures: number[]): number | null {
  if (temperatures.length < 6) return null;
  const sorted = [...temperatures].sort((a, b) => a - b);
  const lowest6 = sorted.slice(0, 6);
  const sum = lowest6.reduce((a, b) => a + b, 0);
  return Math.round((sum / 6) * 100) / 100;
}

/**
 * Detect a post-ovulation temperature shift.
 *
 * A shift is confirmed when 3 consecutive readings are at least 0.1 C (0.2 F)
 * above the coverline.
 *
 * @param temperatures - Array of temperature values in Celsius, ordered chronologically.
 * @param coverline - The calculated coverline value.
 * @returns Object with shiftDetected flag and the index where the shift starts (0-based).
 */
export function detectTemperatureShift(
  temperatures: number[],
  coverline: number,
): { shiftDetected: boolean; shiftStartIndex: number | null } {
  // Round threshold to avoid floating point issues (e.g., 36.2 + 0.1 = 36.30000000000001)
  const threshold = Math.round((coverline + 0.1) * 100) / 100;
  let consecutiveAbove = 0;
  let shiftStartIndex: number | null = null;

  for (let i = 0; i < temperatures.length; i++) {
    if (Math.round(temperatures[i] * 100) / 100 >= threshold) {
      if (consecutiveAbove === 0) {
        shiftStartIndex = i;
      }
      consecutiveAbove++;
      if (consecutiveAbove >= 3) {
        return { shiftDetected: true, shiftStartIndex: shiftStartIndex! };
      }
    } else {
      consecutiveAbove = 0;
      shiftStartIndex = null;
    }
  }

  return { shiftDetected: false, shiftStartIndex: null };
}

/**
 * Analyze temperature data for a cycle.
 * Computes coverline from the provided readings and checks for a temperature shift.
 *
 * @param temperatures - Array of temperature values in Celsius, ordered chronologically.
 * @returns CoverlineResult with coverline value, shift detection, and shift start index.
 *          Returns null if insufficient data (< 6 readings).
 */
export function analyzeTemperatures(temperatures: number[]): CoverlineResult | null {
  const coverline = calculateCoverline(temperatures);
  if (coverline === null) return null;

  const shift = detectTemperatureShift(temperatures, coverline);

  return {
    coverline,
    shiftDetected: shift.shiftDetected,
    shiftStartIndex: shift.shiftStartIndex,
  };
}
