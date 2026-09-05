// Module-scope background task definitions (Plan 42 P5, NC-42.7).
//
// Expo requires TaskManager.defineTask to run at GLOBAL MODULE SCOPE, not inside
// a React lifecycle or a registration function. A headless OS launch (scheduled
// background fetch, or a data push while the app is terminated) boots the JS
// bundle and immediately looks up the task by name BEFORE any React view mounts;
// if the defineTask call only ran inside a component effect or inside
// registerBackgroundSync(), the task would be undefined at headless launch and
// the OS would kill the run. Defining here, at import time, is the fix.
//
// BOOT-ORDER REQUIREMENT (critical): this module must be IMPORTED from the app
// entry path BEFORE React mounts. apps/meerkat/index.ts (the expo-router entry
// shim) imports it for its side effect; see that file. Importing it lazily from
// a component would reintroduce the NC-42.7 bug. The import is side-effect-only:
// evaluating this file registers the task definitions and nothing else.
//
// HONESTY: defining a task claims NOTHING. The OS decides whether/when a headless
// run happens. Each task runs the SAME runBackgroundSyncOnce drain every other
// trigger uses (through the shared coalescer, so concurrent triggers collapse to
// one drain, AC-42.8) and emits a "message received" notification ONLY when the
// drain applied > 0 real events. Every native module is lazy-loaded and absent =>
// the definition is a safe no-op (Expo Go / Node / test path never crash).
//
// This file has NO import-time dependency on expo-task-manager or
// expo-notifications: it lazy-requires them so importing it under Node/vitest
// (to prove the definitions exist without React) never pulls a native module.

import { BACKGROUND_SYNC_TASK, type BackgroundSyncResult } from './background-sync';
import { BackgroundTriggerCoalescer } from './background-coalescer';

/** The Expo Notifications background task name (data-only push while backgrounded). */
export const BACKGROUND_NOTIFICATION_TASK = 'meerkat-background-notification';

interface TaskManagerLike {
  defineTask(taskName: string, task: (body?: unknown) => Promise<unknown> | unknown): void;
}

function loadTaskManager(): TaskManagerLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-task-manager') as TaskManagerLike;
  } catch {
    return null;
  }
}

/**
 * The single coalescing runner shared by EVERY background trigger (scheduled
 * task, data-push notification task, and the foreground-resume path in
 * background-task-registration.ts). Concurrent triggers collapse into one drain
 * plus at most one bounded follow-up (AC-42.8). It lazy-imports the expo wiring
 * so this module stays import-safe under Node/vitest.
 */
export const backgroundDrainCoalescer = new BackgroundTriggerCoalescer<BackgroundSyncResult>(
  async () => {
    const { runBackgroundSyncOnce } = await import('./background-sync');
    const { emitBackgroundNotifications } = await import('./background-notify');
    const result = await runBackgroundSyncOnce();
    const { runBackgroundStorageOnce } = await import('./storage-destinations/storage-scheduler-run');
    try {
      result.storageSchedule = await runBackgroundStorageOnce();
    } catch (error) {
      result.storageSchedule = {
        ran: false,
        decisions: [],
        backups: [],
        retentionDeleted: 0,
        repairedObjects: 0,
        reason: error instanceof Error ? error.message : 'Storage maintenance failed.',
      };
    }
    await emitBackgroundNotifications(result);
    return result;
  },
);

/**
 * Run one coalesced background drain. Every task definition and the foreground
 * resume path calls THIS, never runBackgroundSyncOnce directly, so all triggers
 * share the same mutex + follow-up discipline.
 */
export function runCoalescedBackgroundDrain(): Promise<BackgroundSyncResult> {
  return backgroundDrainCoalescer.trigger().done;
}

// Guard so a hot reload (Metro) that re-evaluates this module does not redefine
// a task twice. Module scope means this runs once per JS context in production.
let defined = false;

/**
 * Define both background tasks at module scope. Called once, at import time,
 * below. Exported so a test can assert it is idempotent and does not require
 * React or a registration call. A no-op when expo-task-manager is absent.
 */
export function defineBackgroundTasks(): void {
  if (defined) return;
  const taskManager = loadTaskManager();
  if (!taskManager) {
    // Expo Go / Node / test path: no native task manager. The definitions are a
    // safe no-op; registration will also no-op with honest copy.
    defined = true;
    return;
  }

  // Scheduled OS background fetch: drain the mailbox (coalesced).
  taskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    const { resolveScheduledTaskResult } = await import('./background-notify');
    return resolveScheduledTaskResult(runCoalescedBackgroundDrain);
  });

  // Data-only push wake while backgrounded/terminated: enqueue a coalesced drain.
  // A notification is emitted by the drain ONLY on applied > 0 (NC-42.4-adjacent
  // honesty: a push is a wake hint, never a delivery claim).
  taskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
    await runCoalescedBackgroundDrain();
  });

  defined = true;
}

// Define at import time. This is the NC-42.7 fix: the side effect runs when the
// app entry imports this module, before React mounts.
defineBackgroundTasks();
