/**
 * HealthKit-to-habit bridge.
 * Handles auto-completion logic, threshold checking, and progress tracking.
 * Uses a provider interface so it can be mocked for testing.
 */

import type { AutoTrackProgress, ComparisonOperator } from '../types';

/** Interface for reading HealthKit data. Allows mocking in tests. */
export interface HealthKitDataProvider {
  /** Read today's value for a given HealthKit identifier. */
  getTodayValue(healthKitIdentifier: string): Promise<number>;
  /** Check if HealthKit is available on this platform. */
  isAvailable(): boolean;
}

/** Check if a value meets a threshold with the given comparison operator. */
export function checkThreshold(
  value: number,
  threshold: number,
  comparison: ComparisonOperator,
): boolean {
  switch (comparison) {
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
  }
}

/** Calculate auto-track progress for a habit. */
export function getAutoTrackProgress(
  current: number,
  target: number,
  comparison: ComparisonOperator,
): AutoTrackProgress {
  let percentage: number;
  if (comparison === 'lte' || comparison === 'lt') {
    // For "less than" comparisons, progress is inverted
    // If target is 70bpm and current is 65bpm, that's 100% (met)
    percentage = current <= target ? 100 : Math.max(0, Math.round(((2 * target - current) / target) * 100));
  } else {
    percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  }

  return {
    current,
    target,
    percentage,
    isComplete: checkThreshold(current, target, comparison),
  };
}

/** Stub for platform detection. Real implementation uses Platform.OS. */
export function isHealthKitAvailable(): boolean {
  // In module code, this is always false. The mobile app overrides this
  // with actual Platform.OS === 'ios' check.
  return false;
}
