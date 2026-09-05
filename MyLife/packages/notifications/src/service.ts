/**
 * Shared notification service (R10.1).
 *
 * Modules schedule, edit, and cancel notifications through this service.
 * All notifications are persisted in hub_scheduled_notifications so they
 * survive reboots and reinstalls (R10.5). Timezone-aware scheduling (R10.2)
 * stores the IANA timezone alongside the UTC trigger time.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  NotificationService,
  NotificationPlatformOps,
  ScheduledNotification,
  ScheduleNotificationInput,
  UpdateNotificationInput,
  NotificationPreference,
} from './types';
import {
  insertNotification,
  getNotificationById,
  getActiveNotificationsForModule,
  getAllActiveNotifications,
  updateNotification,
  cancelNotification as cancelNotificationQuery,
  cancelAllForModule as cancelAllForModuleQuery,
  getNotificationPreference,
  setNotificationPreference,
  getAllNotificationPreferences,
} from './queries';

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `notif_${Date.now()}_${idCounter}`;
}

/**
 * Create a NotificationService backed by SQLite persistence
 * and a platform-specific notification adapter.
 */
export function createNotificationService(
  db: DatabaseAdapter,
  platform: NotificationPlatformOps,
): NotificationService {
  return {
    async schedule(input: ScheduleNotificationInput): Promise<ScheduledNotification> {
      const id = generateId();
      const dataJson = input.data ? JSON.stringify(input.data) : null;

      const notification = insertNotification(
        db,
        id,
        input.moduleId,
        input.title,
        input.body,
        input.triggerAt,
        input.timezone,
        input.repeatInterval ?? 'none',
        dataJson,
      );

      const pref = getNotificationPreference(db, input.moduleId);
      const isEnabled = pref === null || pref.enabled;

      if (isEnabled) {
        try {
          const platformId = await platform.schedule(notification);
          updateNotification(db, id, { platformNotificationId: platformId });
          notification.platformNotificationId = platformId;
        } catch {
          // Platform scheduling failed; notification is still persisted
          // and will be retried on next rescheduleAll().
        }
      }

      return notification;
    },

    async update(id: string, input: UpdateNotificationInput): Promise<ScheduledNotification> {
      const existing = getNotificationById(db, id);
      if (!existing) throw new Error(`Notification ${id} not found`);

      // Cancel the old platform notification
      if (existing.platformNotificationId) {
        try {
          await platform.cancel(existing.platformNotificationId);
        } catch {
          // Best-effort cancel
        }
      }

      const dataJson = input.data !== undefined
        ? (input.data ? JSON.stringify(input.data) : null)
        : undefined;

      const updated = updateNotification(db, id, {
        title: input.title,
        body: input.body,
        triggerAt: input.triggerAt,
        timezone: input.timezone,
        repeatInterval: input.repeatInterval,
        dataJson,
      })!;

      // Reschedule with platform
      const pref = getNotificationPreference(db, existing.moduleId);
      const isEnabled = pref === null || pref.enabled;

      if (isEnabled && updated.status === 'active') {
        try {
          const platformId = await platform.schedule(updated);
          updateNotification(db, id, { platformNotificationId: platformId });
          updated.platformNotificationId = platformId;
        } catch {
          // Will retry on rescheduleAll()
        }
      }

      return updated;
    },

    async cancel(id: string): Promise<void> {
      const existing = getNotificationById(db, id);
      if (!existing) return;

      if (existing.platformNotificationId) {
        try {
          await platform.cancel(existing.platformNotificationId);
        } catch {
          // Best-effort cancel
        }
      }

      cancelNotificationQuery(db, id);
    },

    async cancelAllForModule(moduleId: string): Promise<void> {
      const active = getActiveNotificationsForModule(db, moduleId);
      for (const n of active) {
        if (n.platformNotificationId) {
          try {
            await platform.cancel(n.platformNotificationId);
          } catch {
            // Best-effort
          }
        }
      }
      cancelAllForModuleQuery(db, moduleId);
    },

    getForModule(moduleId: string): ScheduledNotification[] {
      return getActiveNotificationsForModule(db, moduleId);
    },

    getById(id: string): ScheduledNotification | null {
      return getNotificationById(db, id);
    },

    async rescheduleAll(): Promise<number> {
      const active = getAllActiveNotifications(db);
      let count = 0;

      // Cancel all existing platform notifications first
      try {
        await platform.cancelAll();
      } catch {
        // Best-effort
      }

      for (const notification of active) {
        const pref = getNotificationPreference(db, notification.moduleId);
        const isEnabled = pref === null || pref.enabled;
        if (!isEnabled) continue;

        // Skip notifications in the past (non-repeating)
        if (notification.repeatInterval === 'none') {
          const triggerTime = new Date(notification.triggerAt).getTime();
          if (triggerTime <= Date.now()) {
            updateNotification(db, notification.id, { status: 'fired' });
            continue;
          }
        }

        try {
          const platformId = await platform.schedule(notification);
          updateNotification(db, notification.id, { platformNotificationId: platformId });
          count += 1;
        } catch {
          // Skip this one, will retry next boot
        }
      }

      return count;
    },

    getPreference(moduleId: string): NotificationPreference | null {
      return getNotificationPreference(db, moduleId);
    },

    setPreference(moduleId: string, enabled: boolean): void {
      setNotificationPreference(db, moduleId, enabled);
    },

    getAllPreferences(): NotificationPreference[] {
      return getAllNotificationPreferences(db);
    },
  };
}
