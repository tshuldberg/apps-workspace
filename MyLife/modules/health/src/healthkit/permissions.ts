/**
 * HealthKit permission helpers.
 * Translates enabled sync data types into HK type identifiers for the permission request.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { isHealthSyncEnabled } from '../settings';
import { SYNC_DATA_TYPES, VITAL_TO_HK_MAP, type SyncDataType } from './types';
import type { VitalType } from '../vitals/types';

/** Map sync data type key to HK identifiers for permission request. */
const SYNC_KEY_TO_HK_TYPES: Record<SyncDataType, string[]> = {
  heartRate: ['HKQuantityTypeIdentifierHeartRate'],
  restingHeartRate: ['HKQuantityTypeIdentifierRestingHeartRate'],
  hrv: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'],
  bloodOxygen: ['HKQuantityTypeIdentifierOxygenSaturation'],
  bloodPressure: [
    'HKQuantityTypeIdentifierBloodPressureSystolic',
    'HKQuantityTypeIdentifierBloodPressureDiastolic',
  ],
  bodyTemperature: ['HKQuantityTypeIdentifierBodyTemperature'],
  steps: ['HKQuantityTypeIdentifierStepCount'],
  activeEnergy: ['HKQuantityTypeIdentifierActiveEnergyBurned'],
  sleep: ['HKCategoryTypeIdentifierSleepAnalysis'],
  respiratoryRate: ['HKQuantityTypeIdentifierRespiratoryRate'],
  weight: ['HKQuantityTypeIdentifierBodyMass'],
};

/**
 * Get the list of HK type identifiers that should be requested based on
 * which sync toggles are enabled in hl_settings.
 */
export function getRequiredPermissions(db: DatabaseAdapter): string[] {
  const permissions: string[] = [];

  for (const dataType of SYNC_DATA_TYPES) {
    if (isHealthSyncEnabled(db, dataType)) {
      const hkTypes = SYNC_KEY_TO_HK_TYPES[dataType];
      if (hkTypes) {
        permissions.push(...hkTypes);
      }
    }
  }

  // Deduplicate
  return [...new Set(permissions)];
}

/**
 * Get the list of VitalTypes that are enabled for sync.
 * Excludes 'sleep' (handled separately).
 */
export function getEnabledVitalTypes(db: DatabaseAdapter): VitalType[] {
  const types: VitalType[] = [];

  const keyToVital: Record<string, VitalType> = {
    heartRate: 'heart_rate',
    restingHeartRate: 'resting_heart_rate',
    hrv: 'hrv',
    bloodOxygen: 'blood_oxygen',
    bloodPressure: 'blood_pressure',
    bodyTemperature: 'body_temperature',
    steps: 'steps',
    activeEnergy: 'active_energy',
    respiratoryRate: 'respiratory_rate',
  };

  for (const [key, vitalType] of Object.entries(keyToVital)) {
    if (isHealthSyncEnabled(db, key)) {
      types.push(vitalType);
    }
  }

  return types;
}

/**
 * Check if sleep sync is enabled.
 */
export function isSleepSyncEnabled(db: DatabaseAdapter): boolean {
  return isHealthSyncEnabled(db, 'sleep');
}

/**
 * Get HK type identifier for a VitalType.
 */
export function getHKIdentifier(vitalType: VitalType): string | null {
  return VITAL_TO_HK_MAP[vitalType] ?? null;
}
