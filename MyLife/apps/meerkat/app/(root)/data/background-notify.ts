// Background-run notification + battery gate + result mapping (Plan 42 P5).
//
// Extracted from background-task-registration.ts so the MODULE-SCOPE task
// definitions (background-task-definitions.ts) and the registration/foreground
// paths share ONE implementation and cannot drift. Nothing here fabricates a
// notification: emitBackgroundNotifications forwards only the honest
// per-community content runBackgroundSyncOnce already built from a real
// applied > 0 tally (Plan 38 C.10). A run that applied nothing emits nothing.
//
// Every native module is lazy-required and absent => a safe no-op, so Node/vitest
// and Expo Go never crash.

import type { BackgroundSyncResult } from './background-sync';
import type { CommunityNotificationContent } from './notification-identity-core';

interface NotificationsLike {
  scheduleNotificationAsync(request: {
    content: {
      title: string;
      body: string;
      sound?: string | boolean;
      color?: string;
    };
    trigger: null;
  }): Promise<string>;
}

interface BatteryLike {
  getBatteryLevelAsync(): Promise<number>;
  getBatteryStateAsync(): Promise<number>;
  BatteryState?: { UNKNOWN: number; UNPLUGGED: number; CHARGING: number; FULL: number };
}

interface BackgroundTaskResultLike {
  BackgroundTaskResult?: { Success: unknown; Failed: unknown };
}

function loadNotifications(): NotificationsLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsLike;
  } catch {
    return null;
  }
}

function loadBattery(): BatteryLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-battery') as BatteryLike;
  } catch {
    return null;
  }
}

function loadBackgroundTask(): BackgroundTaskResultLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-background-task') as BackgroundTaskResultLike;
  } catch {
    return null;
  }
}

/** Below this charge, a scheduled run is skipped unless the device is charging. */
export const LOW_BATTERY_SKIP_THRESHOLD = 0.15;

/**
 * True when a scheduled background run should be SKIPPED because the battery is
 * critically low and the device is not charging. When expo-battery is absent
 * (Expo Go / a build without it) this never blocks a run (returns false), so
 * behavior degrades honestly rather than silently skipping.
 */
export async function shouldSkipForLowBattery(): Promise<boolean> {
  const battery = loadBattery();
  if (!battery) return false;
  try {
    const [level, state] = await Promise.all([
      battery.getBatteryLevelAsync(),
      battery.getBatteryStateAsync(),
    ]);
    const charging = state === (battery.BatteryState?.CHARGING ?? 2)
      || state === (battery.BatteryState?.FULL ?? 3);
    return !charging && level >= 0 && level < LOW_BATTERY_SKIP_THRESHOLD;
  } catch {
    return false;
  }
}

/**
 * Resolve a scheduled background task's OS result. Applies the low-battery gate
 * (skipping is a Success so the OS does not aggressively retry), runs the
 * provided coalesced drain, and maps success/failure to the expo-background-task
 * result enum. `runDrain` is injected so this stays testable and shares the one
 * coalescer.
 */
export async function resolveScheduledTaskResult(
  runDrain: () => Promise<BackgroundSyncResult>,
): Promise<unknown> {
  const backgroundTask = loadBackgroundTask();
  const success = backgroundTask?.BackgroundTaskResult?.Success ?? undefined;
  const failed = backgroundTask?.BackgroundTaskResult?.Failed ?? undefined;
  try {
    if (await shouldSkipForLowBattery()) {
      // Skipped for battery: a Success (nothing failed), nothing claimed synced.
      return success;
    }
    await runDrain();
    return success;
  } catch {
    return failed;
  }
}

/**
 * Emit user-visible notifications ONLY after real events were applied (Plan 38
 * C.10). runBackgroundSyncOnce already built the honest per-community content in
 * result.notifications (applied > 0, non-muted, verified identity + selected
 * bundled sound); this only forwards it to the OS. Nothing fires when the run
 * applied nothing.
 */
export async function emitBackgroundNotifications(result: BackgroundSyncResult): Promise<void> {
  const contents = result.notifications ?? [];
  if (contents.length === 0) return;
  const notifications = loadNotifications();
  if (!notifications) return;
  for (const content of contents) {
    await emitCommunityNotification(notifications, content);
  }
}

async function emitCommunityNotification(
  notifications: NotificationsLike,
  content: CommunityNotificationContent,
): Promise<void> {
  try {
    await notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        // A bundled sound id plays that tone; null selects silent; the OS default
        // tone is used when a preset maps to 'default'.
        sound: content.sound === null ? false : content.sound,
        ...(content.color ? { color: content.color } : {}),
      },
      trigger: null,
    });
  } catch {
    // a missing notification permission must not break the drain result
  }
}
