import type { LightLevel } from '../types';

/**
 * Classify a lux reading into plant-friendly categories.
 * Thresholds based on standard horticultural ranges.
 */
export function classifyLight(lux: number): LightLevel {
  if (lux < 500) return 'low';
  if (lux < 2500) return 'medium';
  if (lux < 10000) return 'bright_indirect';
  return 'direct';
}

/**
 * Compute average from an array of lux readings.
 * Returns null if empty.
 */
export function averageLux(readings: number[]): number | null {
  if (readings.length === 0) return null;
  return Math.round(readings.reduce((a, b) => a + b, 0) / readings.length);
}

/**
 * Stabilize readings by averaging the last N values.
 */
export function stabilizeReading(readings: number[], windowSize: number = 6): number {
  const window = readings.slice(-windowSize);
  if (window.length === 0) return 0;
  return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
}
