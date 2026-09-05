import type { DatabaseAdapter } from '@mylife/db';
import type { TherapySessionInfo } from './types';

/**
 * Auto-increment session number based on existing therapy entries.
 * Returns MAX(therapy_session_number) + 1, or 1 if no sessions exist.
 */
export function getNextSessionNumber(db: DatabaseAdapter): number {
  const row = db.query<{ max_session: number | null }>(
    `SELECT MAX(therapy_session_number) as max_session
     FROM jn_entries
     WHERE entry_type = 'therapy_prep' AND therapy_session_number IS NOT NULL`,
  )[0];

  return (row?.max_session ?? 0) + 1;
}

/**
 * Calculate the number of days between two date strings (YYYY-MM-DD format).
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(`${dateB}T00:00:00Z`);
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get therapy session info: next session number, days since last session.
 */
export function getTherapySessionInfo(
  db: DatabaseAdapter,
  referenceDate: string,
): TherapySessionInfo {
  const nextNumber = getNextSessionNumber(db);

  const lastSession = db.query<{ entry_date: string }>(
    `SELECT entry_date
     FROM jn_entries
     WHERE entry_type = 'therapy_prep' AND therapy_session_number IS NOT NULL
     ORDER BY therapy_session_number DESC LIMIT 1`,
  )[0];

  if (!lastSession) {
    return {
      sessionNumber: nextNumber,
      daysSinceLastSession: null,
      lastSessionDate: null,
    };
  }

  return {
    sessionNumber: nextNumber,
    daysSinceLastSession: daysBetween(lastSession.entry_date, referenceDate),
    lastSessionDate: lastSession.entry_date,
  };
}

/**
 * Auto-populate mood summary for pre-session prep.
 * Queries entries with mood data since the last therapy session (or last 14 days for first session).
 */
export function autoPopulateMoodSummary(
  db: DatabaseAdapter,
  lastSessionDate: string | null,
): { averageMood: string | null; distribution: Record<string, number> } {
  const lookbackDate = lastSessionDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  })();

  const rows = db.query<{ mood: string; count: number }>(
    `SELECT mood, COUNT(*) as count
     FROM jn_entries
     WHERE mood IS NOT NULL AND entry_date >= ?
     GROUP BY mood
     ORDER BY count DESC`,
    [lookbackDate],
  );

  if (rows.length === 0) {
    return { averageMood: null, distribution: {} };
  }

  const distribution: Record<string, number> = {};
  for (const row of rows) {
    distribution[row.mood] = row.count;
  }

  // Most frequent mood is the first row (ORDER BY count DESC)
  const averageMood = rows[0].mood;

  return { averageMood, distribution };
}

/**
 * Count recent thought records for auto-population in therapy prep.
 * Returns thought records created since the last therapy session.
 */
export function getRecentThoughtRecordCount(
  db: DatabaseAdapter,
  lastSessionDate: string | null,
): number {
  const lookbackDate = lastSessionDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  })();

  const row = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM jn_thought_records
     WHERE status = 'complete' AND created_at >= ?`,
    [lookbackDate],
  )[0];

  return row?.count ?? 0;
}
