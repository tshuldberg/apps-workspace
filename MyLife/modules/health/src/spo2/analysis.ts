/**
 * Blood oxygen (SpO2) analysis engine.
 * Analyzes existing hl_vitals SpO2 data for trends, categories, and alerts.
 * Pure functions, no side effects.
 */

import type { Spo2Analysis, Spo2Category } from '../types';

export function categorizeSpo2(value: number): Spo2Category {
  if (value >= 95) return 'normal';
  if (value >= 90) return 'borderline';
  return 'low';
}

export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function determineTrend(
  recentWeek: number[],
  previousWeek: number[],
): 'stable' | 'declining' | 'improving' {
  if (recentWeek.length === 0 || previousWeek.length === 0) return 'stable';
  const avgRecent = calculateAverage(recentWeek);
  const avgPrevious = calculateAverage(previousWeek);
  const diff = avgRecent - avgPrevious;
  if (diff > 1) return 'improving';
  if (diff < -1) return 'declining';
  return 'stable';
}

/**
 * Check if SpO2 has been consistently below 95% for a given number of days.
 * Returns an alert message or null.
 */
export function checkLowAlert(
  dailyAverages: { date: string; avg: number }[],
  thresholdDays: number = 7,
): string | null {
  if (dailyAverages.length < thresholdDays) return null;

  const recent = dailyAverages.slice(-thresholdDays);
  const allBelow = recent.every((d) => d.avg < 95);
  if (!allBelow) return null;

  return `Your blood oxygen has been below normal for ${thresholdDays} days. Consider consulting a healthcare provider.`;
}

export function analyzeSpo2(
  latestReading: number,
  overnightReadings: number[],
  thirtyDayReadings: number[],
  recentWeek: number[],
  previousWeek: number[],
  dailyAverages: { date: string; avg: number }[],
): Spo2Analysis {
  const overnightAverage = overnightReadings.length > 0
    ? calculateAverage(overnightReadings)
    : null;
  const thirtyDayAverage = calculateAverage(thirtyDayReadings);
  const lowestReading = thirtyDayReadings.length > 0
    ? Math.min(...thirtyDayReadings)
    : latestReading;
  const category = categorizeSpo2(latestReading);
  const trend = determineTrend(recentWeek, previousWeek);
  const alertMessage = checkLowAlert(dailyAverages);

  return {
    latestReading,
    overnightAverage,
    thirtyDayAverage,
    lowestReading,
    category,
    trend,
    alertMessage,
  };
}
