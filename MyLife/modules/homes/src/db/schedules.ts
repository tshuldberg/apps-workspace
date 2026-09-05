import type { DatabaseAdapter } from '@mylife/db';
import type { MaintenanceSchedule, TaskType, Season } from '../types';

function rowToSchedule(row: Record<string, unknown>): MaintenanceSchedule {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    taskType: row.task_type as TaskType,
    taskTypeCustom: (row.task_type_custom as string) ?? null,
    intervalMonths: row.interval_months as number,
    seasonPreference: (row.season_preference as Season) ?? null,
    lastCompletedDate: (row.last_completed_date as string) ?? null,
    nextDueDate: (row.next_due_date as string) ?? null,
    isActive: !!(row.is_active as number),
    snoozeDays: row.snooze_days as number,
    snoozeCount: row.snooze_count as number,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createSchedule(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    taskType: TaskType;
    taskTypeCustom?: string;
    intervalMonths: number;
    seasonPreference?: Season | null;
    lastCompletedDate?: string;
    nextDueDate?: string;
    notes?: string;
  },
): MaintenanceSchedule {
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO hm_maintenance_schedules (
      id, property_id, task_type, task_type_custom, interval_months,
      season_preference, last_completed_date, next_due_date,
      is_active, snooze_days, snooze_count, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.taskType,
      input.taskTypeCustom ?? null,
      input.intervalMonths,
      input.seasonPreference ?? null,
      input.lastCompletedDate ?? null,
      input.nextDueDate ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId,
    taskType: input.taskType,
    taskTypeCustom: input.taskTypeCustom ?? null,
    intervalMonths: input.intervalMonths,
    seasonPreference: input.seasonPreference ?? null,
    lastCompletedDate: input.lastCompletedDate ?? null,
    nextDueDate: input.nextDueDate ?? null,
    isActive: true,
    snoozeDays: 0,
    snoozeCount: 0,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSchedule(
  db: DatabaseAdapter,
  id: string,
): MaintenanceSchedule | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_maintenance_schedules WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToSchedule(rows[0]) : null;
}

export function getSchedulesForProperty(
  db: DatabaseAdapter,
  propertyId: string,
  activeOnly = true,
): MaintenanceSchedule[] {
  const activeClause = activeOnly ? ' AND is_active = 1' : '';
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_maintenance_schedules
       WHERE property_id = ?${activeClause}
       ORDER BY next_due_date ASC
       LIMIT 200`,
      [propertyId],
    )
    .map(rowToSchedule);
}

export function getAllActiveSchedules(
  db: DatabaseAdapter,
): MaintenanceSchedule[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_maintenance_schedules
       WHERE is_active = 1
       ORDER BY next_due_date ASC
       LIMIT 200`,
    )
    .map(rowToSchedule);
}

export function updateSchedule(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    taskType: TaskType;
    taskTypeCustom: string | null;
    intervalMonths: number;
    seasonPreference: Season | null;
    lastCompletedDate: string | null;
    nextDueDate: string | null;
    snoozeDays: number;
    snoozeCount: number;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.taskType !== undefined) { sets.push('task_type = ?'); params.push(input.taskType); }
  if (input.taskTypeCustom !== undefined) { sets.push('task_type_custom = ?'); params.push(input.taskTypeCustom); }
  if (input.intervalMonths !== undefined) { sets.push('interval_months = ?'); params.push(input.intervalMonths); }
  if (input.seasonPreference !== undefined) { sets.push('season_preference = ?'); params.push(input.seasonPreference); }
  if (input.lastCompletedDate !== undefined) { sets.push('last_completed_date = ?'); params.push(input.lastCompletedDate); }
  if (input.nextDueDate !== undefined) { sets.push('next_due_date = ?'); params.push(input.nextDueDate); }
  if (input.snoozeDays !== undefined) { sets.push('snooze_days = ?'); params.push(input.snoozeDays); }
  if (input.snoozeCount !== undefined) { sets.push('snooze_count = ?'); params.push(input.snoozeCount); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_maintenance_schedules SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deactivateSchedule(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE hm_maintenance_schedules SET is_active = 0, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function deleteSchedulesByProperty(
  db: DatabaseAdapter,
  propertyId: string,
): void {
  db.execute(
    'DELETE FROM hm_maintenance_schedules WHERE property_id = ?',
    [propertyId],
  );
}
