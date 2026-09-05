import type { DatabaseAdapter } from '@mylife/db';

// ---------------------------------------------------------------------------
// Adherence calculations (uses md_dose_logs table)
// ---------------------------------------------------------------------------

/**
 * Calculate adherence rate for a medication over a date range.
 * Rate = taken / (taken + skipped + late) * 100
 * 'late' counts as taken for adherence purposes.
 */
export function getAdherenceRate(
  db: DatabaseAdapter,
  medicationId: string,
  from: string,
  to: string,
): number {
  const rows = db.query<{ status: string }>(
    `SELECT status FROM md_dose_logs
     WHERE medication_id = ? AND scheduled_time >= ? AND scheduled_time <= ?`,
    [medicationId, from, to],
  );
  if (rows.length === 0) return 0;

  let taken = 0;
  let total = 0;
  for (const row of rows) {
    if (row.status === 'snoozed') continue; // snoozed is in-progress, not final
    total++;
    if (row.status === 'taken' || row.status === 'late') taken++;
  }
  if (total === 0) return 0;
  return Math.round((taken / total) * 1000) / 10; // one decimal place
}

/**
 * Current consecutive-day streak where all scheduled doses were taken.
 * Counts backwards from today. A day with zero logs is treated as missed.
 */
export function getStreak(
  db: DatabaseAdapter,
  medicationId: string,
): number {
  // Get the expected doses per day from medication frequency
  const medRows = db.query<Record<string, unknown>>(
    'SELECT frequency FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (medRows.length === 0) return 0;

  const freq = medRows[0].frequency as string;
  if (freq === 'as_needed') return 0;

  // Get dose logs for the last 365 days, ordered by date descending
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const logs = db.query<{ dt: string; status: string }>(
    `SELECT DATE(scheduled_time) as dt, status
     FROM md_dose_logs
     WHERE medication_id = ? AND scheduled_time >= ?
     ORDER BY scheduled_time DESC
     LIMIT 5000`,
    [medicationId, yearAgo.toISOString()],
  );

  if (logs.length === 0) return 0;

  // Group by date
  const byDate = new Map<string, string[]>();
  for (const log of logs) {
    const statuses = byDate.get(log.dt) ?? [];
    statuses.push(log.status);
    byDate.set(log.dt, statuses);
  }

  // Walk backwards from the most recent date
  const sortedDates = [...byDate.keys()].sort().reverse();
  let streak = 0;
  let expectedDate = sortedDates[0];

  for (const date of sortedDates) {
    // Check for gap
    if (date !== expectedDate) break;

    const statuses = byDate.get(date)!;
    // All doses must be taken or late (not skipped)
    const allTaken = statuses.every((s) => s === 'taken' || s === 'late');
    if (!allTaken) break;

    streak++;
    // Move to previous day
    const prev = new Date(date + 'T00:00:00');
    prev.setDate(prev.getDate() - 1);
    expectedDate = prev.toISOString().slice(0, 10);
  }

  return streak;
}

export interface AdherenceStats {
  rate: number;
  streak: number;
  totalTaken: number;
  totalMissed: number;
  totalLate: number;
}

/**
 * Combined adherence stats for a medication over the last N days.
 */
export function getAdherenceStats(
  db: DatabaseAdapter,
  medicationId: string,
  days: number,
): AdherenceStats {
  const to = new Date().toISOString();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString();

  const rows = db.query<{ status: string }>(
    `SELECT status FROM md_dose_logs
     WHERE medication_id = ? AND scheduled_time >= ? AND scheduled_time <= ?`,
    [medicationId, from, to],
  );

  let totalTaken = 0;
  let totalMissed = 0;
  let totalLate = 0;
  let countable = 0;

  for (const row of rows) {
    if (row.status === 'snoozed') continue;
    countable++;
    if (row.status === 'taken') totalTaken++;
    else if (row.status === 'late') totalLate++;
    else if (row.status === 'skipped') totalMissed++;
  }

  const rate = countable === 0 ? 0 : Math.round(((totalTaken + totalLate) / countable) * 1000) / 10;
  const streak = getStreak(db, medicationId);

  return { rate, streak, totalTaken, totalMissed, totalLate };
}
