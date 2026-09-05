import type { DatabaseAdapter } from '@mylife/db';
import { SleepDateSchema } from '../../models/schemas';
import {
  SLEEP_STREAK_TYPES,
  SleepStreakTypeSchema,
  rowToStreak,
  rowToStreakHistoryPoint,
  type SleepStreak,
  type SleepStreakHistoryPoint,
  type SleepStreakType,
} from '../../models/goal-schemas';
import { addCalendarDays } from '../../engine/analytics';

function nowIso(): string {
  return new Date().toISOString();
}

function getStreakByType(
  db: DatabaseAdapter,
  type: SleepStreakType,
): SleepStreak | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_streaks WHERE type = ? LIMIT 1`,
    [type],
  );

  return rows.length > 0 ? rowToStreak(rows[0]) : null;
}

function ensureStreak(
  db: DatabaseAdapter,
  type: SleepStreakType,
): SleepStreak {
  const existing = getStreakByType(db, type);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.execute(
    `INSERT INTO sl_streaks
      (id, type, current_count, longest_count, last_date, created_at)
     VALUES (?, ?, 0, 0, NULL, ?)`,
    [id, type, createdAt],
  );

  return rowToStreak({
    id,
    type,
    current_count: 0,
    longest_count: 0,
    last_date: null,
    created_at: createdAt,
  });
}

function recordStreakHistory(
  db: DatabaseAdapter,
  streak: SleepStreak,
  date: string,
  met: boolean,
): void {
  const existing = db.query<{ id: string }>(
    `SELECT id FROM sl_streak_history WHERE type = ? AND date = ?`,
    [streak.type, date],
  )[0];

  db.execute(
    `INSERT INTO sl_streak_history
      (id, type, date, met, current_count, longest_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(type, date) DO UPDATE SET
       met = excluded.met,
       current_count = excluded.current_count,
       longest_count = excluded.longest_count`,
    [
      existing?.id ?? crypto.randomUUID(),
      streak.type,
      date,
      met ? 1 : 0,
      streak.current_count,
      streak.longest_count,
      nowIso(),
    ],
  );
}

export function getStreaks(db: DatabaseAdapter): SleepStreak[] {
  return SLEEP_STREAK_TYPES.map((type) => ensureStreak(db, type));
}

export function updateStreak(
  db: DatabaseAdapter,
  rawType: SleepStreakType,
  met: boolean,
  rawDate: string,
): SleepStreak {
  const type = SleepStreakTypeSchema.parse(rawType);
  const date = SleepDateSchema.parse(rawDate);
  const existing = ensureStreak(db, type);
  const sameDate = existing.last_date === date;
  const isConsecutive =
    existing.last_date !== null && addCalendarDays(existing.last_date, 1) === date;
  const currentCount = met
    ? sameDate
      ? existing.current_count
      : isConsecutive
        ? existing.current_count + 1
        : 1
    : 0;
  const longestCount = Math.max(existing.longest_count, currentCount);

  db.execute(
    `UPDATE sl_streaks
     SET current_count = ?, longest_count = ?, last_date = ?
     WHERE id = ?`,
    [currentCount, longestCount, date, existing.id],
  );

  const updated = {
    ...existing,
    current_count: currentCount,
    longest_count: longestCount,
    last_date: date,
  };
  recordStreakHistory(db, updated, date, met);

  return updated;
}

export function resetStreak(
  db: DatabaseAdapter,
  rawType: SleepStreakType,
): SleepStreak {
  const type = SleepStreakTypeSchema.parse(rawType);
  const existing = ensureStreak(db, type);

  db.execute(
    `UPDATE sl_streaks
     SET current_count = 0, last_date = NULL
     WHERE id = ?`,
    [existing.id],
  );

  return {
    ...existing,
    current_count: 0,
    last_date: null,
  };
}

export function getStreakHistory(
  db: DatabaseAdapter,
  rawType: SleepStreakType,
): SleepStreakHistoryPoint[] {
  const type = SleepStreakTypeSchema.parse(rawType);
  ensureStreak(db, type);
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_streak_history
     WHERE type = ?
     ORDER BY date ASC`,
    [type],
  );

  return rows.map(rowToStreakHistoryPoint);
}
