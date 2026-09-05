import type { DatabaseAdapter } from '@mylife/db';
import type { SmartAlarm, SmartAlarmInsert, AlarmHistory } from '../types';

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- Smart Alarms ---

export function createAlarm(db: DatabaseAdapter, input: SmartAlarmInsert): string {
  const id = createId('alm');
  db.execute(
    `INSERT INTO hl_smart_alarms (id, target_time, wake_window_minutes, is_enabled, days_of_week, sound, vibration, snooze_enabled, snooze_duration_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.target_time,
      input.wake_window_minutes,
      input.is_enabled,
      input.days_of_week,
      input.sound,
      input.vibration,
      input.snooze_enabled,
      input.snooze_duration_minutes,
    ],
  );
  return id;
}

export function getAlarmById(db: DatabaseAdapter, id: string): SmartAlarm | null {
  const rows = db.query<SmartAlarm>(
    'SELECT * FROM hl_smart_alarms WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export function getEnabledAlarms(db: DatabaseAdapter): SmartAlarm[] {
  return db.query<SmartAlarm>(
    'SELECT * FROM hl_smart_alarms WHERE is_enabled = 1 ORDER BY target_time ASC',
  );
}

export function getAllAlarms(db: DatabaseAdapter): SmartAlarm[] {
  return db.query<SmartAlarm>(
    'SELECT * FROM hl_smart_alarms ORDER BY target_time ASC',
  );
}

const ALARM_COLUMNS = new Set([
  'target_time', 'wake_window_minutes', 'is_enabled', 'days_of_week',
  'sound', 'vibration', 'snooze_enabled', 'snooze_duration_minutes',
]);

export function updateAlarm(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<SmartAlarmInsert>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!ALARM_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.execute(
    `UPDATE hl_smart_alarms SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteAlarm(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_smart_alarms WHERE id = ?', [id]);
}

// --- Alarm History ---

export function logAlarmTrigger(
  db: DatabaseAdapter,
  alarmId: string,
  scheduledTime: string,
  actualTriggerTime: string | null,
  triggerReason: string,
  sleepStageAtTrigger: string | null,
): string {
  const id = createId('alh');
  db.execute(
    `INSERT INTO hl_alarm_history (id, alarm_id, scheduled_time, actual_trigger_time, trigger_reason, sleep_stage_at_trigger)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, alarmId, scheduledTime, actualTriggerTime, triggerReason, sleepStageAtTrigger],
  );
  return id;
}

export function updateAlarmSnooze(
  db: DatabaseAdapter,
  historyId: string,
  snoozeCount: number,
): void {
  db.execute(
    'UPDATE hl_alarm_history SET snoozed = 1, snooze_count = ? WHERE id = ?',
    [snoozeCount, historyId],
  );
}

export function dismissAlarmHistory(db: DatabaseAdapter, historyId: string): void {
  db.execute(
    "UPDATE hl_alarm_history SET dismissed_at = datetime('now') WHERE id = ?",
    [historyId],
  );
}

export function getAlarmHistory(
  db: DatabaseAdapter,
  alarmId: string,
  limit = 30,
): AlarmHistory[] {
  return db.query<AlarmHistory>(
    'SELECT * FROM hl_alarm_history WHERE alarm_id = ? ORDER BY scheduled_time DESC LIMIT ?',
    [alarmId, limit],
  );
}

export function getAllAlarmHistory(db: DatabaseAdapter, limit = 30): AlarmHistory[] {
  return db.query<AlarmHistory>(
    'SELECT * FROM hl_alarm_history ORDER BY scheduled_time DESC LIMIT ?',
    [limit],
  );
}

export function deleteAlarmHistory(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_alarm_history WHERE id = ?', [id]);
}
