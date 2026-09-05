// Public API -- backward compatible with fast-health-sync.ts
export { getHealthSyncStatus, probeHealthSyncStatus, syncHealthData } from './sync-engine';

// Types
export type {
  HealthSyncStatus,
  HealthSyncResult,
  HealthDataTypeConfig,
  SyncOptions,
  SyncLogEntry,
} from './types';

// Data type registry (for settings UI)
export { HEALTH_DATA_TYPES, getDataTypeConfig, getReadableDataTypes } from './data-type-registry';

// Utilities (for advanced use)
export { getSyncCursor, recordSyncEvent, isSyncEnabled } from './utils';

// Background sync registration (expo-task-manager)
export {
  registerBackgroundSync,
  unregisterBackgroundSync,
  isBackgroundSyncRegistered,
} from './background';
