import type { DatabaseAdapter } from '@mylife/db';

export interface SleepRoutineContextOptions {
  date?: string;
}

export interface SleepRoutineContext {
  sleepDate: string;
  routineDate: string;
  durationMinutes: number;
  durationHours: number;
  qualityRating: number;
  routineHabitCount: number;
  completedRoutineCount: number;
  completionRate: number;
  context: string;
}

interface SleepEntryRow {
  id: string;
  date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number;
  quality_rating: number;
}

interface RoutineHabitRow {
  id: string;
}

interface CountRow {
  count: number;
}

const ROUTINE_NAME_PATTERNS = [
  '%wind%down%',
  '%screen%',
  '%bed%',
  '%sleep%',
  '%read%',
  '%journal%',
  '%meditat%',
  '%stretch%',
  '%relax%',
  '%routine%',
];

function areBridgeModulesEnabled(db: DatabaseAdapter): boolean {
  try {
    const rows = db.query<CountRow>(
      `SELECT COUNT(DISTINCT module_id) as count
       FROM hub_enabled_modules
       WHERE module_id IN (?, ?)`,
      ['sleep', 'habits'],
    );

    return (rows[0]?.count ?? 0) === 2;
  } catch {
    return false;
  }
}

function routineHabitPredicate(): string {
  const nameChecks = ROUTINE_NAME_PATTERNS
    .map(() => `LOWER(name) LIKE ?`)
    .join(' OR ');
  return `(time_of_day = 'evening' OR ${nameChecks})`;
}

function readRoutineHabitIds(db: DatabaseAdapter): string[] | null {
  try {
    const rows = db.query<RoutineHabitRow>(
      `SELECT id
       FROM hb_habits
       WHERE is_archived = 0
         AND ${routineHabitPredicate()}
       ORDER BY sort_order ASC, name ASC
       LIMIT 100`,
      [...ROUTINE_NAME_PATTERNS],
    );
    return rows.map((row) => row.id);
  } catch {
    return null;
  }
}

function readSleepEntry(
  db: DatabaseAdapter,
  options: SleepRoutineContextOptions,
): SleepEntryRow | null {
  const conditions = ['quality_rating IS NOT NULL'];
  const params: unknown[] = [];

  if (options.date) {
    conditions.push('date <= ?');
    params.push(options.date);
  }

  try {
    return db.query<SleepEntryRow>(
      `SELECT id, date, bedtime, wake_time, duration_minutes, quality_rating
       FROM sl_sleep_entries
       WHERE ${conditions.join(' AND ')}
       ORDER BY date DESC, wake_time DESC, created_at DESC
       LIMIT 1`,
      params,
    )[0] ?? null;
  } catch {
    return null;
  }
}

function routineDateForEntry(entry: SleepEntryRow): string {
  if (entry.bedtime && /^\d{4}-\d{2}-\d{2}/.test(entry.bedtime)) {
    return entry.bedtime.slice(0, 10);
  }
  return entry.date;
}

function readCompletedRoutineCount(
  db: DatabaseAdapter,
  routineDate: string,
  routineHabitIds: readonly string[],
): number | null {
  if (routineHabitIds.length === 0) {
    return 0;
  }

  const placeholders = routineHabitIds.map(() => '?').join(', ');
  try {
    return db.query<CountRow>(
      `SELECT COUNT(DISTINCT habit_id) as count
       FROM hb_completions
       WHERE DATE(completed_at) = ?
         AND habit_id IN (${placeholders})`,
      [routineDate, ...routineHabitIds],
    )[0]?.count ?? 0;
  } catch {
    return null;
  }
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatHours(durationMinutes: number): string {
  const hours = durationMinutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

export function getSleepRoutineContext(
  db: DatabaseAdapter,
  options: SleepRoutineContextOptions = {},
): SleepRoutineContext | null {
  if (!areBridgeModulesEnabled(db)) {
    return null;
  }

  const routineHabitIds = readRoutineHabitIds(db);
  if (!routineHabitIds || routineHabitIds.length === 0) {
    return null;
  }

  const entry = readSleepEntry(db, options);
  if (!entry) {
    return null;
  }

  const durationMinutes = Number(entry.duration_minutes);
  const qualityRating = Number(entry.quality_rating);
  if (!Number.isFinite(durationMinutes) || !Number.isFinite(qualityRating)) {
    return null;
  }

  const routineDate = routineDateForEntry(entry);
  const completedRoutineCount = readCompletedRoutineCount(
    db,
    routineDate,
    routineHabitIds,
  );
  if (completedRoutineCount === null) {
    return null;
  }

  const completionRate = round(
    (completedRoutineCount / routineHabitIds.length) * 100,
  );
  const durationLabel = formatHours(durationMinutes);

  return {
    sleepDate: entry.date,
    routineDate,
    durationMinutes,
    durationHours: round(durationMinutes / 60),
    qualityRating,
    routineHabitCount: routineHabitIds.length,
    completedRoutineCount,
    completionRate,
    context: `Sleep context: ${durationLabel}, quality ${qualityRating}/5 after ${completedRoutineCount} of ${routineHabitIds.length} bedtime routine habits.`,
  };
}
