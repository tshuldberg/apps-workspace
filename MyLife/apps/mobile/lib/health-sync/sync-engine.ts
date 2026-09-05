import { Platform } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import type { HealthSyncStatus, HealthSyncResult } from './types';
import { HEALTH_DATA_TYPES } from './data-type-registry';
import { isSyncEnabled, normalizeError } from './utils';
import { getAppleHealthStatus, syncAppleHealth } from './apple-health-adapter';
import { getAndroidHealthStatus, syncAndroidHealthConnect } from './health-connect-adapter';

/**
 * Synchronous check of whether health sync is supported on this platform.
 */
export function getHealthSyncStatus(): HealthSyncStatus {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      available: false,
      platform: 'unsupported',
      reason: 'Health sync is only available on iOS and Android devices.',
    };
  }

  return {
    available: true,
    platform: Platform.OS,
    reason: 'Health sync requires a custom development or production build.',
  };
}

/**
 * Async probe that checks native SDK availability.
 */
export async function probeHealthSyncStatus(): Promise<HealthSyncStatus> {
  if (Platform.OS === 'android') return getAndroidHealthStatus();
  if (Platform.OS === 'ios') return getAppleHealthStatus();
  return getHealthSyncStatus();
}

/**
 * Resolve which data types to sync based on hl_settings toggles.
 * If specific keys are provided, use only those.
 */
function resolveEnabledTypes(db: DatabaseAdapter, requestedKeys?: string[]) {
  if (requestedKeys && requestedKeys.length > 0) {
    return HEALTH_DATA_TYPES.filter((dt) => requestedKeys.includes(dt.key));
  }

  return HEALTH_DATA_TYPES.filter((dt) => {
    // Check hl_settings for the toggle state
    return isSyncEnabled(db, dt.key);
  });
}

/**
 * Main sync entry point. Dispatches to the appropriate platform adapter.
 *
 * Backward compatible: when called with legacy { readWeight, writeFasts }
 * options, it enables weight and fast sync accordingly.
 */
export async function syncHealthData(
  db: DatabaseAdapter,
  options?: {
    readWeight?: boolean;
    writeFasts?: boolean;
    dataTypeKeys?: string[];
  },
): Promise<HealthSyncResult> {
  const writeFasts = options?.writeFasts ?? false;

  // Resolve enabled data types
  let enabledTypes = resolveEnabledTypes(db, options?.dataTypeKeys);

  // Legacy backward compat: if readWeight is explicitly set, ensure weight is included/excluded
  if (options?.readWeight === true && !enabledTypes.some((dt) => dt.key === 'weight')) {
    const weightType = HEALTH_DATA_TYPES.find((dt) => dt.key === 'weight');
    if (weightType) enabledTypes = [...enabledTypes, weightType];
  }
  if (options?.readWeight === false) {
    enabledTypes = enabledTypes.filter((dt) => dt.key !== 'weight');
  }

  if (enabledTypes.length === 0 && !writeFasts) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      importedVitals: 0,
      importedSleepSessions: 0,
      message: 'No data types enabled for sync.',
    };
  }

  try {
    if (Platform.OS === 'android') {
      return await syncAndroidHealthConnect(db, { enabledTypes, writeFasts });
    }

    if (Platform.OS === 'ios') {
      return await syncAppleHealth(db, { enabledTypes, writeFasts });
    }

    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      importedVitals: 0,
      importedSleepSessions: 0,
      message: 'Health sync is only available on iOS and Android devices.',
    };
  } catch (error) {
    return {
      importedWeightEntries: 0,
      exportedFasts: 0,
      importedVitals: 0,
      importedSleepSessions: 0,
      message: normalizeError(error),
    };
  }
}
