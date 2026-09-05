import type { DatabaseAdapter } from '@mylife/db';

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Export all habits as CSV.
 */
export function exportHabitsCSV(db: DatabaseAdapter): string {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM hb_habits ORDER BY sort_order ASC, name ASC');
  if (rows.length === 0) return '';
  const headers = ['id', 'name', 'description', 'icon', 'color', 'frequency', 'target_count', 'unit', 'habit_type', 'time_of_day', 'specific_days', 'grace_period', 'reminder_time', 'is_archived', 'sort_order', 'created_at', 'updated_at'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => csvEscape(String(row[h] ?? '')));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

/**
 * Export completions as CSV, optionally filtered by habit.
 */
export function exportCompletionsCSV(db: DatabaseAdapter, habitId?: string): string {
  let sql = 'SELECT * FROM hb_completions';
  const params: unknown[] = [];
  if (habitId) {
    sql += ' WHERE habit_id = ?';
    params.push(habitId);
  }
  sql += ' ORDER BY completed_at DESC';
  const rows = db.query<Record<string, unknown>>(sql, params);
  if (rows.length === 0) return '';
  const headers = ['id', 'habit_id', 'completed_at', 'value', 'notes', 'created_at'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => csvEscape(String(row[h] ?? '')));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

/**
 * Export all data (habits + completions) as a combined CSV dump.
 */
export function exportAllCSV(db: DatabaseAdapter): string {
  const parts: string[] = [];

  const habitsCSV = exportHabitsCSV(db);
  if (habitsCSV) {
    parts.push('# Habits');
    parts.push(habitsCSV);
  }

  const completionsCSV = exportCompletionsCSV(db);
  if (completionsCSV) {
    parts.push('');
    parts.push('# Completions');
    parts.push(completionsCSV);
  }

  // Timed sessions
  const sessions = db.query<Record<string, unknown>>('SELECT * FROM hb_timed_sessions ORDER BY started_at DESC');
  if (sessions.length > 0) {
    const headers = ['id', 'habit_id', 'started_at', 'duration_seconds', 'target_seconds', 'completed', 'created_at'];
    parts.push('');
    parts.push('# Timed Sessions');
    parts.push(headers.join(','));
    for (const row of sessions) {
      parts.push(headers.map((h) => csvEscape(String(row[h] ?? ''))).join(','));
    }
  }

  // Measurements
  const measurements = db.query<Record<string, unknown>>('SELECT * FROM hb_measurements ORDER BY measured_at DESC');
  if (measurements.length > 0) {
    const headers = ['id', 'habit_id', 'measured_at', 'value', 'target', 'created_at'];
    parts.push('');
    parts.push('# Measurements');
    parts.push(headers.join(','));
    for (const row of measurements) {
      parts.push(headers.map((h) => csvEscape(String(row[h] ?? ''))).join(','));
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
