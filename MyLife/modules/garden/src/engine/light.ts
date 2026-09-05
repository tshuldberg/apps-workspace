import type { LightLevel } from '../types';

/**
 * Classify a lux reading into a plant-friendly light level.
 * Thresholds based on standard horticultural ranges.
 */
export function classifyLight(lux: number): LightLevel {
  if (lux < 500) return 'low';
  if (lux < 2500) return 'medium';
  if (lux < 10000) return 'bright_indirect';
  return 'direct';
}

/**
 * Get a human-readable description for a light level.
 */
export function lightLevelDescription(level: LightLevel): string {
  switch (level) {
    case 'low': return 'Low light (< 500 lux): north-facing rooms, far from windows';
    case 'medium': return 'Medium light (500-2,500 lux): east/west windows, filtered light';
    case 'bright_indirect': return 'Bright indirect (2,500-10,000 lux): near south window, sheer curtains';
    case 'direct': return 'Direct sun (> 10,000 lux): unfiltered direct sunlight';
  }
}

/**
 * Calculate average lux from an array of readings.
 */
export function averageLux(readings: number[]): number | null {
  if (readings.length === 0) return null;
  return Math.round(readings.reduce((a, b) => a + b, 0) / readings.length);
}
