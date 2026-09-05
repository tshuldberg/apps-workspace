/**
 * Shared notification infrastructure types.
 *
 * Modules schedule notifications through this interface rather than
 * calling platform APIs directly. The hub persists all scheduled
 * notifications in SQLite so they survive reboots and reinstalls (R10.5).
 */

export type RepeatInterval = 'none' | 'daily' | 'weekly' | 'monthly';

export type NotificationStatus = 'active' | 'cancelled' | 'fired';

/** A notification scheduled by a module. */
export interface ScheduledNotification {
  id: string;
  moduleId: string;
  title: string;
  body: string;
  /** ISO 8601 UTC datetime for when this should fire. */
  triggerAt: string;
  /** IANA timezone (e.g. 'America/New_York') used for scheduling. */
  timezone: string;
  repeatInterval: RepeatInterval;
  /** Platform-specific notification identifier (expo-notifications ID or browser tag). */
  platformNotificationId: string | null;
  /** Arbitrary JSON payload modules can attach for deep linking. */
  data: Record<string, unknown> | null;
  status: NotificationStatus;
  createdAt: string;
  updatedAt: string;
}

/** Input for scheduling a new notification. */
export interface ScheduleNotificationInput {
  moduleId: string;
  title: string;
  body: string;
  /** ISO 8601 UTC datetime for when this should fire. */
  triggerAt: string;
  /** IANA timezone for display and DST-aware rescheduling. */
  timezone: string;
  repeatInterval?: RepeatInterval;
  /** Arbitrary data for deep linking. */
  data?: Record<string, unknown>;
}

/** Input for updating an existing notification. */
export interface UpdateNotificationInput {
  title?: string;
  body?: string;
  triggerAt?: string;
  timezone?: string;
  repeatInterval?: RepeatInterval;
  data?: Record<string, unknown>;
}

/** Per-module notification preference. */
export interface NotificationPreference {
  moduleId: string;
  enabled: boolean;
  updatedAt: string;
}

/**
 * Platform-specific notification operations.
 * Mobile wraps expo-notifications; web wraps the Notification API.
 */
export interface NotificationPlatformOps {
  /** Request OS-level notification permission. Returns true if granted. */
  requestPermission(): Promise<boolean>;
  /** Check current OS-level permission status. */
  checkPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  /** Schedule a local notification. Returns the platform-specific ID. */
  schedule(notification: ScheduledNotification): Promise<string>;
  /** Cancel a previously scheduled notification by its platform ID. */
  cancel(platformNotificationId: string): Promise<void>;
  /** Cancel all scheduled notifications. */
  cancelAll(): Promise<void>;
}

/**
 * The shared notification service interface (R10.1).
 * Modules call these methods to schedule, edit, cancel, and manage
 * local notifications through a unified API.
 */
export interface NotificationService {
  /** Schedule a new notification. Returns the created notification. */
  schedule(input: ScheduleNotificationInput): Promise<ScheduledNotification>;
  /** Update an existing notification by ID. */
  update(id: string, input: UpdateNotificationInput): Promise<ScheduledNotification>;
  /** Cancel a notification by ID. */
  cancel(id: string): Promise<void>;
  /** Cancel all notifications for a module. */
  cancelAllForModule(moduleId: string): Promise<void>;
  /** Get all active notifications for a module. */
  getForModule(moduleId: string): ScheduledNotification[];
  /** Get a single notification by ID. */
  getById(id: string): ScheduledNotification | null;
  /** Reschedule all active notifications from persisted state (R10.5). */
  rescheduleAll(): Promise<number>;
  /** Get notification preference for a module. */
  getPreference(moduleId: string): NotificationPreference | null;
  /** Set notification preference for a module. */
  setPreference(moduleId: string, enabled: boolean): void;
  /** Get all notification preferences. */
  getAllPreferences(): NotificationPreference[];
}
