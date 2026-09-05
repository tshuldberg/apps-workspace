import type { DatabaseAdapter } from '@mylife/db';

export interface LastNightSleepOptions {
  referenceDate?: string;
}

export interface LastNightSleepSummary {
  date: string;
  durationMinutes: number;
  durationHours: number;
  qualityRating: number;
  wakeFeeling: string;
  context: string;
}

interface LastNightSleepRow {
  date: string;
  duration_minutes: number;
  quality_rating: number;
  wake_feeling: string;
}

function areBridgeModulesEnabled(db: DatabaseAdapter): boolean {
  try {
    const rows = db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT module_id) as count
       FROM hub_enabled_modules
       WHERE module_id IN (?, ?)`,
      ['sleep', 'mood'],
    );

    return (rows[0]?.count ?? 0) === 2;
  } catch {
    return false;
  }
}

function formatHours(durationMinutes: number): string {
  const hours = durationMinutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

export function getLastNightSleep(
  db: DatabaseAdapter,
  options: LastNightSleepOptions = {},
): LastNightSleepSummary | null {
  if (!areBridgeModulesEnabled(db)) {
    return null;
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.referenceDate) {
    conditions.push('date <= ?');
    params.push(options.referenceDate);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const row = db.query<LastNightSleepRow>(
      `SELECT date, duration_minutes, quality_rating, wake_feeling
       FROM sl_sleep_entries
       ${whereClause}
       ORDER BY date DESC, wake_time DESC, created_at DESC
       LIMIT 1`,
      params,
    )[0];

    if (!row) {
      return null;
    }

    const durationMinutes = Number(row.duration_minutes);
    const qualityRating = Number(row.quality_rating);
    if (!Number.isFinite(durationMinutes) || !Number.isFinite(qualityRating)) {
      return null;
    }

    const durationLabel = formatHours(durationMinutes);
    return {
      date: row.date,
      durationMinutes,
      durationHours: Math.round((durationMinutes / 60) * 10) / 10,
      qualityRating,
      wakeFeeling: row.wake_feeling,
      context: `Sleep context: ${durationLabel}, quality ${qualityRating}/5`,
    };
  } catch {
    return null;
  }
}
