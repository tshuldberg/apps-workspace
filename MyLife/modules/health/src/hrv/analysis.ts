/**
 * HRV trend analysis engine.
 * Analyzes existing hl_vitals HRV data for baseline, percentile, trend, and insights.
 * Pure functions, no side effects.
 */

import type { HrvAnalysis, HrvCategory } from '../types';

export function calculateBaseline(readings: number[]): number {
  if (readings.length === 0) return 40; // Population default
  return Math.round(readings.reduce((a, b) => a + b, 0) / readings.length);
}

export function calculatePercentileRank(current: number, readings: number[]): number {
  if (readings.length === 0) return 50;
  const sorted = [...readings].sort((a, b) => a - b);
  const below = sorted.filter((r) => r < current).length;
  return Math.round((below / sorted.length) * 100);
}

export function categorizeHrv(current: number, baseline: number): HrvCategory {
  if (baseline <= 0) return 'average';
  const ratio = current / baseline;
  if (ratio > 1.2) return 'high';
  if (ratio > 1.0) return 'above_average';
  if (ratio > 0.8) return 'average';
  if (ratio > 0.6) return 'below_average';
  return 'low';
}

export function calculateTrendDelta(
  recentWeek: number[],
  previousWeek: number[],
): { delta: number; trend: 'improving' | 'stable' | 'declining' } {
  if (recentWeek.length === 0 || previousWeek.length === 0) {
    return { delta: 0, trend: 'stable' };
  }
  const avgRecent = recentWeek.reduce((a, b) => a + b, 0) / recentWeek.length;
  const avgPrevious = previousWeek.reduce((a, b) => a + b, 0) / previousWeek.length;
  const delta = Math.round(avgRecent - avgPrevious);
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (delta > 3) trend = 'improving';
  else if (delta < -3) trend = 'declining';
  return { delta, trend };
}

export function generateInsight(category: HrvCategory, trend: string): string {
  const messages: Record<HrvCategory, string> = {
    high: 'Your HRV is excellent. Great recovery today.',
    above_average: 'Your HRV is above your baseline. You are recovering well.',
    average: 'Your HRV is within your normal range.',
    below_average: 'Your HRV is below average. Consider light activity today.',
    low: 'Your HRV is low. Rest and recovery recommended.',
  };
  let msg = messages[category];
  if (trend === 'improving') msg += ' Your trend is improving.';
  else if (trend === 'declining') msg += ' Watch your trend over the coming days.';
  return msg;
}

export function analyzeHrv(
  currentValue: number,
  thirtyDayReadings: number[],
  recentWeek: number[],
  previousWeek: number[],
): HrvAnalysis {
  const baseline = calculateBaseline(thirtyDayReadings);
  const percentileRank = calculatePercentileRank(currentValue, thirtyDayReadings);
  const category = categorizeHrv(currentValue, baseline);
  const { delta: trendDelta, trend } = calculateTrendDelta(recentWeek, previousWeek);
  const insight = generateInsight(category, trend);

  return {
    currentValue,
    baseline,
    percentileRank,
    trend,
    trendDelta,
    category,
    insight,
  };
}
