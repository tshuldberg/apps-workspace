/**
 * Background sync task registration for HealthKit / Health Connect.
 *
 * Uses expo-task-manager and expo-background-fetch to periodically
 * sync health data when the app is backgrounded.
 */

import {
  HEALTH_SYNC_TASK_NAME,
  BACKGROUND_SYNC_INTERVAL_SECONDS,
  BackgroundFetchResult,
  type BackgroundSyncConfig,
} from '@mylife/health';

/**
 * Register the background health sync task with expo-task-manager.
 *
 * Must be called at module scope (outside React components) to ensure
 * the task is registered before iOS tries to wake the app.
 *
 * @returns true if registration succeeded, false if task-manager unavailable
 */
export async function registerBackgroundSync(config: BackgroundSyncConfig): Promise<boolean> {
  try {
    const TaskManager = await import('expo-task-manager');
    const BackgroundFetch = await import('expo-background-fetch');

    TaskManager.defineTask(HEALTH_SYNC_TASK_NAME, async () => {
      try {
        const recordsSynced = await config.syncFn();
        return recordsSynced > 0
          ? BackgroundFetchResult.NewData
          : BackgroundFetchResult.NoData;
      } catch (error) {
        config.onError?.(error instanceof Error ? error : new Error(String(error)));
        return BackgroundFetchResult.Failed;
      }
    });

    await BackgroundFetch.registerTaskAsync(HEALTH_SYNC_TASK_NAME, {
      minimumInterval: BACKGROUND_SYNC_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    return true;
  } catch {
    // expo-task-manager not available (Expo Go, web, etc.)
    return false;
  }
}

/**
 * Unregister the background health sync task.
 * Call this when the health module is disabled or user disconnects.
 */
export async function unregisterBackgroundSync(): Promise<boolean> {
  try {
    const TaskManager = await import('expo-task-manager');

    const isRegistered = await TaskManager.isTaskRegisteredAsync(HEALTH_SYNC_TASK_NAME);
    if (isRegistered) {
      await TaskManager.unregisterTaskAsync(HEALTH_SYNC_TASK_NAME);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the background sync task is currently registered.
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
  try {
    const TaskManager = await import('expo-task-manager');
    return await TaskManager.isTaskRegisteredAsync(HEALTH_SYNC_TASK_NAME);
  } catch {
    return false;
  }
}
