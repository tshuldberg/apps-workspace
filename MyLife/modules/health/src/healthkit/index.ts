// HealthKit integration barrel export

// Adapter interface
export type { HealthKitAdapter } from './adapter';
export { NoOpHealthKitAdapter } from './adapter';

// Type mappings and constants
export {
  HK_TYPE_MAP,
  VITAL_TO_HK_MAP,
  VITAL_UNIT_MAP,
  SYNC_DATA_TYPES,
  SYNC_TYPE_LABELS,
  SYNC_BATCH_SIZE,
  INITIAL_SYNC_DAYS,
} from './types';
export type {
  SyncDataType,
  HealthKitSample,
  HealthKitSleepSample,
  SyncLogEntry,
} from './types';

// Sync engine
export {
  mapHKTypeToVitalType,
  mapVitalTypeToHK,
  bulkInsertVitals,
  bulkInsertSleep,
  getSyncLog,
  getAllSyncLogs,
  updateSyncAnchor,
  getLastSyncAnchor,
  deleteSyncedVitals,
  deleteSyncedSleep,
  deleteAllSyncedData,
  computeSyncStartDate,
} from './sync';

// Permission helpers
export {
  getRequiredPermissions,
  getEnabledVitalTypes,
  isSleepSyncEnabled,
  getHKIdentifier,
} from './permissions';

// Data mappers
export {
  mapQuantitySampleToVital,
  mapQuantitySamplesToVitals,
  mapSleepSamplesToSession,
  mapHKUnitToMyHealthUnit,
  isValidSample,
} from './data-mappers';

// Background task constants
export {
  HEALTH_SYNC_TASK_NAME,
  BACKGROUND_SYNC_INTERVAL_SECONDS,
  BackgroundFetchResult,
} from './background-task';
export type { BackgroundSyncConfig, BackgroundFetchResultValue } from './background-task';
