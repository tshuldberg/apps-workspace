/**
 * Background sync task constants and types for HealthKit data.
 *
 * The actual task registration lives in apps/mobile/lib/health-sync/
 * since it depends on expo-task-manager (an Expo-specific package).
 * This file exports the shared constants and types used by both
 * the module layer and the mobile app layer.
 *
 * iOS limitations:
 * - Minimum interval is 15 minutes (iOS controls actual frequency).
 * - Background fetch does NOT run after force-quit.
 * - iOS may throttle or skip background fetch based on user behavior.
 * - Data syncs on next app launch if background fetch was skipped.
 */

/** Task name constant for the background health sync task. */
export const HEALTH_SYNC_TASK_NAME = 'mylife-health-sync';

/** Minimum interval between background syncs (seconds). iOS may override. */
export const BACKGROUND_SYNC_INTERVAL_SECONDS = 15 * 60; // 15 minutes

/**
 * Result codes for background fetch tasks.
 * Maps to BackgroundFetch.BackgroundFetchResult values.
 */
export const BackgroundFetchResult = {
  NewData: 2,
  NoData: 1,
  Failed: 3,
} as const;

export type BackgroundFetchResultValue = typeof BackgroundFetchResult[keyof typeof BackgroundFetchResult];

/**
 * Configuration for registering a background sync task.
 * The caller provides the sync callback since it depends on
 * platform-specific code (react-native-health, expo-sqlite).
 */
export interface BackgroundSyncConfig {
  /** The sync function to execute. Returns count of records synced. */
  syncFn: () => Promise<number>;
  /** Optional: called when task fails */
  onError?: (error: Error) => void;
}
