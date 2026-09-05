/**
 * HealthKit adapter interface.
 *
 * The module package defines the contract and types. The actual platform
 * implementation lives in apps/mobile/ where react-native and expo-health
 * are available. This file provides the adapter interface and a no-op
 * fallback for non-iOS environments.
 */

import type { HealthKitSample, HealthKitSleepSample } from './types';

/**
 * Adapter interface that platform-specific code must implement.
 */
export interface HealthKitAdapter {
  isAvailable(): Promise<boolean>;
  requestPermissions(readTypes: string[]): Promise<boolean>;
  queryQuantitySamples(
    typeIdentifier: string,
    startDate: Date,
    endDate: Date,
    limit?: number,
  ): Promise<HealthKitSample[]>;
  querySleepSamples(
    startDate: Date,
    endDate: Date,
    limit?: number,
  ): Promise<HealthKitSleepSample[]>;
}

/**
 * No-op adapter for non-iOS platforms.
 * Returns empty results for all queries.
 */
export const NoOpHealthKitAdapter: HealthKitAdapter = {
  async isAvailable() { return false; },
  async requestPermissions() { return false; },
  async queryQuantitySamples() { return []; },
  async querySleepSamples() { return []; },
};
