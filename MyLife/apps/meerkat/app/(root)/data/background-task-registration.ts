// Background task SCHEDULING + push-wake wiring (Task 3 + Plan 42 P5).
//
// NC-42.7: the task DEFINITIONS live at module scope in
// background-task-definitions.ts (imported for its side effect from the app
// entry, before React mounts). This file NO LONGER defines a task; it only
// registers/unregisters the OS SCHEDULE and wires push-wake. A headless launch
// finds the task already defined because the entry imported the definitions
// module; registration here is a separate, idempotent step.
//
// This wires expo-background-task (OS-scheduled, best-effort mailbox drain) and
// the push-wake path (native APNs/FCM token -> @mylife/sync PushRelayClient).
// Every native module is loaded lazily and returns null when absent, mirroring
// lan-backend.ts: on Expo Go or a build without these modules, registration
// no-ops with honest copy and NEVER crashes. Enabling background sync still
// requires the user to flip the mk_settings flag (NC-4: this file never flips
// background_sync_enabled itself).
//
// HONESTY:
// - Registration alone claims nothing. The OS decides whether/when the job runs.
// - A push wake only ENQUEUES a coalesced drain. A "message received"
//   notification is emitted ONLY when the drain applied > 0, with the real count.
// - There is no "connected" / peer-count / "always on" surface here.

import { BACKGROUND_SYNC_TASK } from './background-sync';
// Import the module-scope task DEFINITIONS for their side effect. This guarantees
// the definitions module is evaluated (tasks defined) before any registration
// runs. The app entry ALSO imports it before React mounts (the real NC-42.7 fix);
// importing it here too means a call into registration can never precede the
// definitions, even in a test that imports this file directly.
import {
  BACKGROUND_NOTIFICATION_TASK,
  runCoalescedBackgroundDrain,
} from './background-task-definitions';
import {
  registerPushWake as registerPushWakeCore,
  unregisterPushWake as unregisterPushWakeCore,
  type PushNotificationsModule,
  type PushRelayClientCtor,
  type PushWakeRegistration,
  type RegisterPushWakeResult,
} from './push-wake-core';

export type { RegisterPushWakeResult } from './push-wake-core';

interface TaskManagerLike {
  isTaskRegisteredAsync(taskName: string): Promise<boolean>;
}

interface BackgroundTaskLike {
  registerTaskAsync(taskName: string, options?: { minimumInterval?: number }): Promise<void>;
  unregisterTaskAsync(taskName: string): Promise<void>;
}

interface NotificationsRegisterLike {
  registerTaskAsync(taskName: string): Promise<null>;
  unregisterTaskAsync?(taskName: string): Promise<void>;
}

function loadTaskManager(): TaskManagerLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-task-manager') as TaskManagerLike;
  } catch {
    return null;
  }
}

function loadBackgroundTask(): BackgroundTaskLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-background-task') as BackgroundTaskLike;
  } catch {
    return null;
  }
}

function loadNotificationsRegister(): NotificationsRegisterLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsRegisterLike;
  } catch {
    return null;
  }
}

const MINIMUM_INTERVAL_SECONDS = 15 * 60; // 15 min; the OS decides the real cadence.

export interface BackgroundRegistrationResult {
  /** True only when the native modules were present and registration succeeded. */
  registered: boolean;
  /** Honest reason when not registered. */
  reason?: string;
}

/**
 * Register the OS-scheduled background mailbox drain AND the data-push
 * notification task. No-ops (registered:false) when the native modules are
 * absent (Expo Go / a build without them). Idempotent. The task definitions are
 * already present at module scope (background-task-definitions.ts); this only
 * registers the SCHEDULE + notification task.
 */
export async function registerBackgroundSync(): Promise<BackgroundRegistrationResult> {
  const taskManager = loadTaskManager();
  const backgroundTask = loadBackgroundTask();
  if (!taskManager || !backgroundTask) {
    return {
      registered: false,
      reason:
        'Background sync needs a development build with expo-task-manager and '
        + 'expo-background-task. It is not available in Expo Go. Use "Run background '
        + 'sync now" to drain queued messages on demand.',
    };
  }

  try {
    const already = await taskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!already) {
      await backgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: MINIMUM_INTERVAL_SECONDS,
      });
    }
    // Register the data-push notification task with Expo Notifications too, so a
    // data-only push while backgrounded/terminated runs the (already module-scope
    // defined) notification task. Best-effort: a build without expo-notifications
    // still gets scheduled background sync.
    const notifications = loadNotificationsRegister();
    if (notifications) {
      try {
        await notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      } catch {
        // notification task registration is best-effort; scheduled sync still works
      }
    }
    return { registered: true };
  } catch (error) {
    return {
      registered: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  const taskManager = loadTaskManager();
  const backgroundTask = loadBackgroundTask();
  if (taskManager && backgroundTask) {
    try {
      const already = await taskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
      if (already) await backgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    } catch {
      // best-effort: nothing to surface
    }
  }
  const notifications = loadNotificationsRegister();
  try {
    await notifications?.unregisterTaskAsync?.(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // best-effort
  }
}

// --- Push-wake config + expo wiring ------------------------------------------

/** Read the push gateway base URL from app config `extra.pushGatewayUrl`. */
export function pushGatewayUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as {
      pushGatewayUrl?: unknown;
    };
    return typeof extra.pushGatewayUrl === 'string' ? extra.pushGatewayUrl.trim() : '';
  } catch {
    return '';
  }
}

/** Lazy-load expo-notifications as the push-token surface, or null when absent. */
function loadPushNotifications(): PushNotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as Partial<PushNotificationsModule>;
    if (
      typeof mod.getDevicePushTokenAsync === 'function'
      && typeof mod.addNotificationReceivedListener === 'function'
      && typeof mod.addPushTokenListener === 'function'
    ) {
      return mod as PushNotificationsModule;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lazy-load PushRelayClient from @mylife/sync, or null when the running barrel
 * does not export it yet (the client is being replaced in parallel by WP-42A).
 * Kept as a require so an absent export is a clean null, never an import crash.
 */
function loadPushRelayClient(): PushRelayClientCtor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sync = require('@mylife/sync') as { PushRelayClient?: PushRelayClientCtor };
    return typeof sync.PushRelayClient === 'function' ? sync.PushRelayClient : null;
  } catch {
    return null;
  }
}

/**
 * The live push-wake registration for this app session, held so sign-out can
 * revoke it. Module-scoped singleton; a second registerPushWake replaces it
 * after unregistering the prior one.
 */
let activeRegistration: PushWakeRegistration | null = null;

/**
 * Register this device for push wake (Plan 42 P5). Wired into app boot AFTER
 * crypto init. Honest: an absent native token API, absent client, or unconfigured
 * gateway yields an ok:false result and NO registration; nothing is faked.
 *
 * @param registrationHandle An opaque random per-install capability handle. NOT
 *   a Meerkat identity or device pubkey (NC-42.3).
 */
export async function registerPushWake(registrationHandle: string): Promise<RegisterPushWakeResult> {
  // Replace any prior registration cleanly (idempotent boot / re-entry).
  await unregisterPushWakeCore(activeRegistration);
  activeRegistration = null;

  const { result, registration } = await registerPushWakeCore({
    loadNotifications: loadPushNotifications,
    loadPushRelayClient,
    gatewayUrl: pushGatewayUrl(),
    registrationHandle,
    runDrain: runCoalescedBackgroundDrain,
  });
  activeRegistration = registration;
  return result;
}

/**
 * Revoke the push-wake registration and discard the local token (sign-out /
 * delete-my-data). Safe to call when nothing is registered.
 */
export async function unregisterPushWake(): Promise<void> {
  await unregisterPushWakeCore(activeRegistration);
  activeRegistration = null;
}

/** Test/diagnostics: whether a push-wake registration is currently held. */
export function hasActivePushWakeRegistration(): boolean {
  return activeRegistration !== null;
}
