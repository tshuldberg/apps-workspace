/**
 * @mylife/notifications - Shared notification infrastructure.
 *
 * Provides a unified API for modules to schedule, edit, cancel,
 * and manage local notifications across mobile and web platforms.
 */

// Types
export type {
  ScheduledNotification,
  ScheduleNotificationInput,
  UpdateNotificationInput,
  NotificationPreference,
  NotificationPlatformOps,
  NotificationService,
  RepeatInterval,
  NotificationStatus,
} from './types';

// Service factory
export { createNotificationService } from './service';

// No-op platform for SSR/tests
export { noopPlatform } from './noop-platform';

// CRUD queries (for direct DB access when needed)
export {
  insertNotification,
  getNotificationById,
  getActiveNotificationsForModule,
  getAllActiveNotifications,
  updateNotification,
  cancelNotification,
  cancelAllForModule,
  deleteNotificationsForModule,
  getNotificationPreference,
  setNotificationPreference,
  getAllNotificationPreferences,
  deleteNotificationPreference,
} from './queries';
