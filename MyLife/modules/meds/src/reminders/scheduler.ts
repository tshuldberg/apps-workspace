import type { DatabaseAdapter } from '@mylife/db';
import type { MedReminder } from '../models/reminder';
import type { DoseLog, CreateDoseLogInput } from '../models/dose-log';
import { escapeLike } from '../db/crud';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToReminder(row: Record<string, unknown>): MedReminder {
  return {
    id: row.id as string,
    medicationId: row.medication_id as string,
    time: row.time as string,
    daysOfWeek: JSON.parse(row.days_of_week as string),
    isActive: !!(row.is_active as number),
    snoozeUntil: (row.snooze_until as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToDoseLog(row: Record<string, unknown>): DoseLog {
  return {
    id: row.id as string,
    medicationId: row.medication_id as string,
    scheduledTime: row.scheduled_time as string,
    actualTime: (row.actual_time as string) ?? null,
    status: row.status as DoseLog['status'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Reminder scheduling
// ---------------------------------------------------------------------------

/**
 * Create reminders for a medication based on its frequency and time_slots.
 * Deletes existing reminders for this medication first.
 *
 * - daily: one reminder per time slot (all 7 days)
 * - twice_daily: expects 2 time slots, one reminder each (all 7 days)
 * - weekly: one reminder per time slot (only the current day of week)
 * - as_needed / custom: no auto-reminders created
 */
export function createRemindersForMedication(
  db: DatabaseAdapter,
  medicationId: string,
  idGenerator: () => string,
): void {
  const rows = db.query<Record<string, unknown>>(
    'SELECT frequency, time_slots FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (rows.length === 0) return;

  const frequency = rows[0].frequency as string;
  const timeSlotsRaw = rows[0].time_slots as string | null;
  const timeSlots: string[] = timeSlotsRaw ? JSON.parse(timeSlotsRaw) : [];

  // No auto-scheduling for as_needed or custom
  if (frequency === 'as_needed' || frequency === 'custom') return;
  if (timeSlots.length === 0) return;

  const now = new Date().toISOString();

  db.transaction(() => {
    // Remove old reminders for this medication
    db.execute('DELETE FROM md_reminders WHERE medication_id = ?', [medicationId]);

    let daysOfWeek: number[];
    if (frequency === 'weekly') {
      // Default to current day of week
      daysOfWeek = [new Date().getDay()];
    } else {
      // daily or twice_daily: all 7 days
      daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    }

    for (const time of timeSlots) {
      db.execute(
        `INSERT INTO md_reminders (id, medication_id, time, days_of_week, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [idGenerator(), medicationId, time, JSON.stringify(daysOfWeek), now],
      );
    }
  });
}

/**
 * Get all active reminders that are due within the next `withinMinutes` minutes.
 * Also respects snooze_until (skips snoozed reminders that haven't expired).
 */
export function getActiveReminders(
  db: DatabaseAdapter,
  withinMinutes: number = 60,
): MedReminder[] {
  const now = new Date();
  const currentDay = now.getDay();

  // Get all active reminders
  const rows = db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_reminders WHERE is_active = 1`,
    )
    .map(rowToReminder);

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const futureTime = new Date(now.getTime() + withinMinutes * 60 * 1000);
  const futureTimeStr = `${String(futureTime.getHours()).padStart(2, '0')}:${String(futureTime.getMinutes()).padStart(2, '0')}`;

  return rows.filter((r) => {
    // Check day of week
    if (!r.daysOfWeek.includes(currentDay)) return false;
    // Check time window
    if (r.time < currentTime || r.time > futureTimeStr) return false;
    // Check snooze
    if (r.snoozeUntil && r.snoozeUntil > now.toISOString()) return false;
    return true;
  });
}

/**
 * Snooze a reminder for N minutes.
 */
export function snoozeReminder(
  db: DatabaseAdapter,
  id: string,
  minutes: number,
): void {
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  db.execute('UPDATE md_reminders SET snooze_until = ? WHERE id = ?', [snoozeUntil, id]);
}

/**
 * Dismiss (deactivate) a reminder.
 */
export function dismissReminder(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE md_reminders SET is_active = 0 WHERE id = ?', [id]);
}

/**
 * Get all reminders for a medication.
 */
export function getRemindersForMedication(
  db: DatabaseAdapter,
  medicationId: string,
): MedReminder[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_reminders WHERE medication_id = ? ORDER BY time ASC',
      [medicationId],
    )
    .map(rowToReminder);
}

// ---------------------------------------------------------------------------
// Dose logging (uses md_dose_logs table)
// ---------------------------------------------------------------------------

/**
 * Log a dose event.
 *
 * This only writes the dose-log row. Supply decrement is intentionally NOT
 * handled here: callers that record a taken/late dose decrement the
 * medication's remaining supply explicitly via `decrementPillCount` at the call
 * site (the established pattern on both the mobile and web take handlers).
 * Folding the decrement into `logDose` would double-count on surfaces that
 * already call `decrementPillCount` after it.
 */
export function logDose(
  db: DatabaseAdapter,
  id: string,
  input: CreateDoseLogInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, actual_time, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.medicationId,
      input.scheduledTime,
      input.actualTime ?? null,
      input.status,
      input.notes ?? null,
      now,
    ],
  );
}

/**
 * Get all dose logs for a given date (YYYY-MM-DD).
 */
export function getDoseLogsForDate(
  db: DatabaseAdapter,
  date: string,
): DoseLog[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_dose_logs WHERE scheduled_time LIKE ? ESCAPE '\\' ORDER BY scheduled_time ASC`,
      [`${escapeLike(date)}%`],
    )
    .map(rowToDoseLog);
}

/**
 * Get dose logs for a specific medication with optional date range.
 */
export function getDoseLogsForMedication(
  db: DatabaseAdapter,
  medicationId: string,
  opts?: { from?: string; to?: string },
): DoseLog[] {
  let sql = 'SELECT * FROM md_dose_logs WHERE medication_id = ?';
  const params: unknown[] = [medicationId];
  if (opts?.from) {
    sql += ' AND scheduled_time >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND scheduled_time <= ?';
    params.push(opts.to);
  }
  sql += ' ORDER BY scheduled_time DESC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToDoseLog);
}

/**
 * Delete a dose log entry.
 */
export function undoDoseLog(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_dose_logs WHERE id = ?', [id]);
}
