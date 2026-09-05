/**
 * HealthKit Sync Engine
 *
 * Pure TypeScript logic for weight import/export with HealthKit.
 * No native HealthKit API calls here -- those live in the mobile hook.
 * This separation allows full unit testing without native dependencies.
 */

import type {
  Fast,
  HealthKitWeightSample,
  HealthKitFastSample,
  WeightSource,
} from '../types';

// ── Weight Conversion ──

const LBS_PER_KG = 2.20462;

/** Convert a weight value between lbs and kg. */
export function convertWeight(
  value: number,
  from: 'lbs' | 'kg',
  to: 'lbs' | 'kg',
): number {
  if (from === to) return value;
  if (from === 'lbs' && to === 'kg') {
    return Math.round((value / LBS_PER_KG) * 10) / 10;
  }
  // kg -> lbs
  return Math.round(value * LBS_PER_KG * 10) / 10;
}

// ── Import Decision ──

/**
 * Determine whether a HealthKit weight sample should be imported.
 *
 * Rules:
 * - No existing entry for date: import (insert)
 * - Existing entry with source="manual": skip (manual wins)
 * - Existing entry with source="healthkit": import (update)
 */
export function shouldImportWeight(
  existingSource: WeightSource | null,
): 'insert' | 'update' | 'skip' {
  if (existingSource === null) return 'insert';
  if (existingSource === 'manual') return 'skip';
  return 'update'; // existing healthkit entry, overwrite with latest
}

// ── Merge Multiple Samples ──

/**
 * Given multiple HealthKit weight samples, pick the latest one per date.
 * Returns a map from date string to the winning sample.
 */
export function mergeWeightEntries(
  samples: HealthKitWeightSample[],
): Map<string, HealthKitWeightSample> {
  const byDate = new Map<string, HealthKitWeightSample>();

  for (const sample of samples) {
    const existing = byDate.get(sample.date);
    if (!existing || sample.timestamp > existing.timestamp) {
      byDate.set(sample.date, sample);
    }
  }

  return byDate;
}

// ── Sync Window ──

/**
 * Calculate the time window to query HealthKit for weight samples.
 * First sync: last 30 days. Subsequent: from last sync timestamp.
 */
export function calculateSyncWindow(
  lastSyncTimestamp: string | null,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = now;

  if (!lastSyncTimestamp) {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from, to };
  }

  return { from: new Date(lastSyncTimestamp), to };
}

// ── Fast Export ──

/**
 * Format a completed fast for writing to HealthKit as a dietary energy sample.
 */
export function formatFastForHealthKit(fast: Fast): HealthKitFastSample | null {
  if (!fast.endedAt) return null;

  return {
    startDate: fast.startedAt,
    endDate: fast.endedAt,
    metadata: {
      protocol: fast.protocol,
      targetHours: fast.targetHours,
      hitTarget: fast.hitTarget === true,
      app: 'MyFast',
    },
  };
}

// ── Platform Check ──

/**
 * Check if HealthKit is available on the current platform.
 * Returns false on Android and web. On iOS, checks for the native module.
 */
export function isHealthKitAvailable(
  platform: string,
  hasNativeModule: boolean = false,
): boolean {
  if (platform !== 'ios') return false;
  return hasNativeModule;
}
