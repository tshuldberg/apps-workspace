/**
 * CRUD operations for hub notification tables.
 *
 * All queries use parameterized SQL (no string interpolation).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  ScheduledNotification,
  NotificationPreference,
  NotificationStatus,
  RepeatInterval,
} from './types';

// ---------------------------------------------------------------------------
// Row types (SQLite snake_case)
// ---------------------------------------------------------------------------

interface NotificationRow {
  id: string;
  module_id: string;
  title: string;
  body: string;
  trigger_at: string;
  timezone: string;
  repeat_interval: string;
  platform_notification_id: string | null;
  data_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PreferenceRow {
  module_id: string;
  enabled: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function rowToNotification(row: NotificationRow): ScheduledNotification {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    body: row.body,
    triggerAt: row.trigger_at,
    timezone: row.timezone,
    repeatInterval: row.repeat_interval as RepeatInterval,
    platformNotificationId: row.platform_notification_id,
    data: row.data_json ? (JSON.parse(row.data_json) as Record<string, unknown>) : null,
    status: row.status as NotificationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPreference(row: PreferenceRow): NotificationPreference {
  return {
    moduleId: row.module_id,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// hub_scheduled_notifications CRUD
// ---------------------------------------------------------------------------

export function insertNotification(
  db: DatabaseAdapter,
  id: string,
  moduleId: string,
  title: string,
  body: string,
  triggerAt: string,
  timezone: string,
  repeatInterval: RepeatInterval,
  dataJson: string | null,
): ScheduledNotification {
  db.execute(
    `INSERT INTO hub_scheduled_notifications
       (id, module_id, title, body, trigger_at, timezone, repeat_interval, data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, moduleId, title, body, triggerAt, timezone, repeatInterval, dataJson],
  );
  return getNotificationById(db, id)!;
}

export function getNotificationById(
  db: DatabaseAdapter,
  id: string,
): ScheduledNotification | null {
  const rows = db.query<NotificationRow>(
    `SELECT * FROM hub_scheduled_notifications WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToNotification(rows[0]) : null;
}

export function getActiveNotificationsForModule(
  db: DatabaseAdapter,
  moduleId: string,
): ScheduledNotification[] {
  const rows = db.query<NotificationRow>(
    `SELECT * FROM hub_scheduled_notifications
     WHERE module_id = ? AND status = 'active'
     ORDER BY trigger_at ASC`,
    [moduleId],
  );
  return rows.map(rowToNotification);
}

export function getAllActiveNotifications(
  db: DatabaseAdapter,
): ScheduledNotification[] {
  const rows = db.query<NotificationRow>(
    `SELECT * FROM hub_scheduled_notifications
     WHERE status = 'active'
     ORDER BY trigger_at ASC`,
  );
  return rows.map(rowToNotification);
}

export function updateNotification(
  db: DatabaseAdapter,
  id: string,
  fields: {
    title?: string;
    body?: string;
    triggerAt?: string;
    timezone?: string;
    repeatInterval?: RepeatInterval;
    dataJson?: string | null;
    platformNotificationId?: string | null;
    status?: NotificationStatus;
  },
): ScheduledNotification | null {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.title !== undefined) { sets.push('title = ?'); params.push(fields.title); }
  if (fields.body !== undefined) { sets.push('body = ?'); params.push(fields.body); }
  if (fields.triggerAt !== undefined) { sets.push('trigger_at = ?'); params.push(fields.triggerAt); }
  if (fields.timezone !== undefined) { sets.push('timezone = ?'); params.push(fields.timezone); }
  if (fields.repeatInterval !== undefined) { sets.push('repeat_interval = ?'); params.push(fields.repeatInterval); }
  if (fields.dataJson !== undefined) { sets.push('data_json = ?'); params.push(fields.dataJson); }
  if (fields.platformNotificationId !== undefined) { sets.push('platform_notification_id = ?'); params.push(fields.platformNotificationId); }
  if (fields.status !== undefined) { sets.push('status = ?'); params.push(fields.status); }

  if (sets.length === 0) return getNotificationById(db, id);

  sets.push("updated_at = datetime('now')");
  params.push(id);

  db.execute(
    `UPDATE hub_scheduled_notifications SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return getNotificationById(db, id);
}

export function cancelNotification(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE hub_scheduled_notifications
     SET status = 'cancelled', updated_at = datetime('now')
     WHERE id = ?`,
    [id],
  );
}

export function cancelAllForModule(db: DatabaseAdapter, moduleId: string): void {
  db.execute(
    `UPDATE hub_scheduled_notifications
     SET status = 'cancelled', updated_at = datetime('now')
     WHERE module_id = ? AND status = 'active'`,
    [moduleId],
  );
}

export function deleteNotificationsForModule(db: DatabaseAdapter, moduleId: string): void {
  db.execute(
    `DELETE FROM hub_scheduled_notifications WHERE module_id = ?`,
    [moduleId],
  );
}

// ---------------------------------------------------------------------------
// hub_notification_preferences CRUD
// ---------------------------------------------------------------------------

export function getNotificationPreference(
  db: DatabaseAdapter,
  moduleId: string,
): NotificationPreference | null {
  const rows = db.query<PreferenceRow>(
    `SELECT * FROM hub_notification_preferences WHERE module_id = ?`,
    [moduleId],
  );
  return rows.length > 0 ? rowToPreference(rows[0]) : null;
}

export function setNotificationPreference(
  db: DatabaseAdapter,
  moduleId: string,
  enabled: boolean,
): void {
  db.execute(
    `INSERT INTO hub_notification_preferences (module_id, enabled)
     VALUES (?, ?)
     ON CONFLICT (module_id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = datetime('now')`,
    [moduleId, enabled ? 1 : 0],
  );
}

export function getAllNotificationPreferences(
  db: DatabaseAdapter,
): NotificationPreference[] {
  const rows = db.query<PreferenceRow>(
    `SELECT * FROM hub_notification_preferences ORDER BY module_id ASC`,
  );
  return rows.map(rowToPreference);
}

export function deleteNotificationPreference(
  db: DatabaseAdapter,
  moduleId: string,
): void {
  db.execute(
    `DELETE FROM hub_notification_preferences WHERE module_id = ?`,
    [moduleId],
  );
}
