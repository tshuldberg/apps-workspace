import type { DatabaseAdapter } from '@mylife/db';
import {
  SleepEntryListOptionsSchema,
  SleepEntrySchema,
  SleepEntryCreateSchema,
  SleepEntryUpdateSchema,
  type SleepEntry,
  type SleepEntryCreateInput,
  type SleepEntryListOptions,
  type SleepEntryUpdateInput,
} from '../../models/schemas';
import {
  SLEEP_STREAK_TYPES,
  rowToGoal,
  type SleepGoal,
} from '../../models/goal-schemas';
import {
  calculateDuration,
  calculateSleepLatency,
} from '../../engine/duration';
import { evaluateStreakType } from '../../engine/progress';
import { updateStreak } from './streaks';

function nowIso(): string {
  return new Date().toISOString();
}

function dateFromDateTime(value: string): string {
  return value.slice(0, 10);
}

function rowToEntry(row: Record<string, unknown>): SleepEntry {
  return SleepEntrySchema.parse({
    id: row.id,
    date: row.date,
    bedtime: row.bedtime,
    sleep_onset_time: row.sleep_onset_time ?? null,
    wake_time: row.wake_time,
    duration_minutes: row.duration_minutes,
    quality_rating: row.quality_rating,
    wake_count: row.wake_count,
    sleep_latency_minutes: row.sleep_latency_minutes ?? null,
    alarm_time: row.alarm_time ?? null,
    snooze_count: row.snooze_count,
    wake_feeling: row.wake_feeling,
    notes_md: row.notes_md ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function deriveSleepLatency(
  bedtime: string,
  sleepOnset: string | null,
  fallback: number | null,
): number | null {
  if (!sleepOnset) {
    return fallback;
  }
  return calculateSleepLatency(bedtime, sleepOnset);
}

function syncFactorLinksForEntry(
  db: DatabaseAdapter,
  entryId: string,
  date: string,
): void {
  db.execute(
    `UPDATE sl_factors
     SET date = ?
     WHERE sleep_entry_id = ?`,
    [date, entryId],
  );

  const linkedCount = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM sl_factors
     WHERE sleep_entry_id = ?`,
    [entryId],
  )[0]?.count ?? 0;

  if (linkedCount > 0) {
    return;
  }

  const unlinked = db.query<{ id: string }>(
    `SELECT id
     FROM sl_factors
     WHERE date = ?
       AND sleep_entry_id IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [date],
  )[0];

  if (!unlinked) {
    return;
  }

  db.execute(
    `UPDATE sl_factors
     SET sleep_entry_id = ?
     WHERE id = ?`,
    [entryId, unlinked.id],
  );
}

function readTargetHours(db: DatabaseAdapter): number {
  const raw = db.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    ['sleep.targetHours'],
  )[0]?.value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function getActiveGoalsForEntry(
  db: DatabaseAdapter,
  entryDate: string,
): SleepGoal[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_goals
     WHERE is_active = 1
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY created_at ASC, type ASC`,
    [entryDate, entryDate],
  );

  return rows.map(rowToGoal);
}

function shouldApplyStreakUpdate(
  db: DatabaseAdapter,
  type: string,
  entryDate: string,
): boolean {
  const current = db.query<{ last_date: string | null }>(
    `SELECT last_date FROM sl_streaks WHERE type = ? LIMIT 1`,
    [type],
  )[0];

  return !current?.last_date || entryDate >= current.last_date;
}

function syncStreaksForEntry(
  db: DatabaseAdapter,
  entry: SleepEntry,
): void {
  const goals = getActiveGoalsForEntry(db, entry.date);
  const targetHours = readTargetHours(db);

  for (const type of SLEEP_STREAK_TYPES) {
    if (!shouldApplyStreakUpdate(db, type, entry.date)) {
      continue;
    }

    updateStreak(
      db,
      type,
      evaluateStreakType(entry, type, {
        goals,
        targetHours,
      }),
      entry.date,
    );
  }
}

export function createEntry(
  db: DatabaseAdapter,
  rawInput: SleepEntryCreateInput,
): SleepEntry {
  const input = SleepEntryCreateSchema.parse(rawInput);
  const id = crypto.randomUUID();
  const now = nowIso();
  const date = dateFromDateTime(input.wake_time);
  const duration_minutes = calculateDuration(input.bedtime, input.wake_time);
  const sleep_latency_minutes = deriveSleepLatency(
    input.bedtime,
    input.sleep_onset_time ?? null,
    input.sleep_latency_minutes ?? null,
  );

  db.execute(
    `INSERT INTO sl_sleep_entries
      (id, date, bedtime, sleep_onset_time, wake_time, duration_minutes,
       quality_rating, wake_count, sleep_latency_minutes, alarm_time,
       snooze_count, wake_feeling, notes_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      date,
      input.bedtime,
      input.sleep_onset_time ?? null,
      input.wake_time,
      duration_minutes,
      input.quality_rating,
      input.wake_count,
      sleep_latency_minutes,
      input.alarm_time ?? null,
      input.snooze_count,
      input.wake_feeling,
      input.notes_md ?? null,
      now,
      now,
    ],
  );

  syncFactorLinksForEntry(db, id, date);

  const entry = SleepEntrySchema.parse({
    id,
    date,
    bedtime: input.bedtime,
    sleep_onset_time: input.sleep_onset_time ?? null,
    wake_time: input.wake_time,
    duration_minutes,
    quality_rating: input.quality_rating,
    wake_count: input.wake_count,
    sleep_latency_minutes,
    alarm_time: input.alarm_time ?? null,
    snooze_count: input.snooze_count,
    wake_feeling: input.wake_feeling,
    notes_md: input.notes_md ?? null,
    created_at: now,
    updated_at: now,
  });
  syncStreaksForEntry(db, entry);

  return entry;
}

export function getEntry(db: DatabaseAdapter, id: string): SleepEntry | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_sleep_entries WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export function updateEntry(
  db: DatabaseAdapter,
  id: string,
  rawInput: SleepEntryUpdateInput,
): SleepEntry | null {
  const existing = getEntry(db, id);
  if (!existing) return null;

  const updates = SleepEntryUpdateSchema.parse(rawInput);
  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const bedtime = updates.bedtime ?? existing.bedtime;
  const wake_time = updates.wake_time ?? existing.wake_time;
  const sleep_onset_time =
    updates.sleep_onset_time ?? existing.sleep_onset_time;
  const now = nowIso();
  const next: SleepEntry = {
    ...existing,
    bedtime,
    sleep_onset_time,
    wake_time,
    date: dateFromDateTime(wake_time),
    duration_minutes: calculateDuration(bedtime, wake_time),
    quality_rating: updates.quality_rating ?? existing.quality_rating,
    wake_count: updates.wake_count ?? existing.wake_count,
    sleep_latency_minutes: deriveSleepLatency(
      bedtime,
      sleep_onset_time,
      updates.sleep_latency_minutes ?? existing.sleep_latency_minutes,
    ),
    alarm_time: updates.alarm_time ?? existing.alarm_time,
    snooze_count: updates.snooze_count ?? existing.snooze_count,
    wake_feeling: updates.wake_feeling ?? existing.wake_feeling,
    notes_md: updates.notes_md ?? existing.notes_md,
    updated_at: now,
  };

  db.execute(
    `UPDATE sl_sleep_entries
     SET date = ?, bedtime = ?, sleep_onset_time = ?, wake_time = ?,
         duration_minutes = ?, quality_rating = ?, wake_count = ?,
         sleep_latency_minutes = ?, alarm_time = ?, snooze_count = ?,
         wake_feeling = ?, notes_md = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.date,
      next.bedtime,
      next.sleep_onset_time,
      next.wake_time,
      next.duration_minutes,
      next.quality_rating,
      next.wake_count,
      next.sleep_latency_minutes,
      next.alarm_time,
      next.snooze_count,
      next.wake_feeling,
      next.notes_md,
      next.updated_at,
      id,
    ],
  );

  syncFactorLinksForEntry(db, id, next.date);

  const updated = getEntry(db, id);
  if (updated) {
    syncStreaksForEntry(db, updated);
  }

  return updated;
}

export function deleteEntry(db: DatabaseAdapter, id: string): boolean {
  const existing = getEntry(db, id);
  if (!existing) return false;

  db.execute(`DELETE FROM sl_sleep_entries WHERE id = ?`, [id]);
  return true;
}

export function listEntries(
  db: DatabaseAdapter,
  rawOptions?: SleepEntryListOptions,
): SleepEntry[] {
  const options = SleepEntryListOptionsSchema.parse(rawOptions ?? {});
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.startDate) {
    where.push('date >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    where.push('date <= ?');
    params.push(options.endDate);
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_sleep_entries
     ${whereClause}
     ORDER BY date DESC, wake_time DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map(rowToEntry);
}

export function getLatestEntry(db: DatabaseAdapter): SleepEntry | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_sleep_entries
     ORDER BY date DESC, wake_time DESC, created_at DESC
     LIMIT 1`,
  );
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export function getEntryByDate(
  db: DatabaseAdapter,
  date: string,
): SleepEntry | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_sleep_entries
     WHERE date = ?
     ORDER BY wake_time DESC, created_at DESC
     LIMIT 1`,
    [date],
  );
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export function getEntriesByDateRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): SleepEntry[] {
  return listEntries(db, {
    startDate,
    endDate,
    limit: 500,
    offset: 0,
  });
}
