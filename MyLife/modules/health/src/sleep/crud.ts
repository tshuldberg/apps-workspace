import type { DatabaseAdapter } from '@mylife/db';
import type { SleepSession, LogSleepInput } from './types';
import { DEFAULT_SLEEP_TARGET_HOURS } from './types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_slp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function computeDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / 60000);
}

/**
 * Compute a 0-100 sleep quality score.
 * Weighted: 40% duration, 30% deep sleep, 20% REM, 10% awake penalty.
 */
export function computeQualityScore(
  durationMinutes: number,
  deepMinutes: number | null,
  remMinutes: number | null,
  awakeMinutes: number | null,
  targetHours = DEFAULT_SLEEP_TARGET_HOURS,
): number {
  const targetMinutes = targetHours * 60;

  // Duration score (0-100): hitting target = 100, half = 50, over by 50% caps at 90
  const durationRatio = durationMinutes / targetMinutes;
  const durationScore = durationRatio >= 1
    ? Math.max(90, 100 - (durationRatio - 1) * 20)
    : durationRatio * 100;

  // If no stage breakdown, use duration only
  if (deepMinutes == null && remMinutes == null) {
    return Math.round(Math.min(100, Math.max(0, durationScore)));
  }

  const sleepMinutes = durationMinutes - (awakeMinutes ?? 0);
  if (sleepMinutes <= 0) return 0;

  // Deep sleep score: ~20% of sleep time is optimal
  const deepPct = (deepMinutes ?? 0) / sleepMinutes;
  const deepScore = Math.min(100, (deepPct / 0.2) * 100);

  // REM score: ~25% of sleep time is optimal
  const remPct = (remMinutes ?? 0) / sleepMinutes;
  const remScore = Math.min(100, (remPct / 0.25) * 100);

  // Awake penalty: less than 10% is ideal
  const awakePct = durationMinutes > 0 ? (awakeMinutes ?? 0) / durationMinutes : 0;
  const awakeScore = Math.max(0, 100 - awakePct * 200);

  const weighted = durationScore * 0.4 + deepScore * 0.3 + remScore * 0.2 + awakeScore * 0.1;
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

export function logSleep(db: DatabaseAdapter, input: LogSleepInput): string {
  const id = createId();
  const durationMinutes = computeDurationMinutes(input.start_time, input.end_time);
  const qualityScore = computeQualityScore(
    durationMinutes,
    input.deep_minutes ?? null,
    input.rem_minutes ?? null,
    input.awake_minutes ?? null,
  );

  db.execute(
    `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, deep_minutes, rem_minutes, light_minutes, awake_minutes, quality_score, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.start_time,
      input.end_time,
      durationMinutes,
      input.deep_minutes ?? null,
      input.rem_minutes ?? null,
      input.light_minutes ?? null,
      input.awake_minutes ?? null,
      qualityScore,
      input.source ?? 'manual',
      input.notes ?? null,
    ],
  );
  return id;
}

export function getSleepSessions(db: DatabaseAdapter, limit = 30): SleepSession[] {
  return db.query<SleepSession>(
    'SELECT * FROM hl_sleep_sessions ORDER BY start_time DESC LIMIT ?',
    [limit],
  );
}

export function getSleepByDateRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): SleepSession[] {
  return db.query<SleepSession>(
    'SELECT * FROM hl_sleep_sessions WHERE start_time >= ? AND start_time <= ? ORDER BY start_time ASC',
    [startDate, endDate],
  );
}

export function getLastNightSleep(db: DatabaseAdapter): SleepSession | null {
  const rows = db.query<SleepSession>(
    'SELECT * FROM hl_sleep_sessions ORDER BY start_time DESC LIMIT 1',
  );
  return rows[0] ?? null;
}

export function deleteSleepSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_sleep_sessions WHERE id = ?', [id]);
}
