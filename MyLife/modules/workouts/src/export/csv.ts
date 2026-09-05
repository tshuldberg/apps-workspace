import type { DatabaseAdapter } from '@mylife/db';

function escapeCsvField(value: string): string {
  // Guard against CSV formula injection: prefix dangerous leading chars with a tab
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = '\t' + safe;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

interface SessionExportRow {
  date: string;
  title: string;
  started_at: string;
  completed_at: string | null;
  exercises_completed_json: string;
}

interface QuickLogExportRow {
  completed_at: string;
  name: string;
  focus: string;
  duration_min: number;
  calories: number;
  rpe: number;
  notes: string | null;
}

interface SetWeightExportRow {
  date: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  unit: string;
  estimated_1rm: number;
}

function durationMinutes(startedAt: string, completedAt: string | null): number {
  if (!completedAt) return 0;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

/**
 * Export the full training history (live sessions + quick logs) as CSV.
 * Columns: Date, Source, Workout, Duration (min), Exercises, Sets, Reps, RPE, Notes
 */
export function exportWorkoutHistoryCSV(db: DatabaseAdapter): string {
  const sessions = db.query<SessionExportRow>(
    `SELECT date(s.completed_at) as date, w.title, s.started_at, s.completed_at,
            s.exercises_completed_json
     FROM wk_workout_sessions s
     JOIN wk_workouts w ON w.id = s.workout_id
     WHERE s.completed_at IS NOT NULL
     ORDER BY s.completed_at ASC`,
  );

  const quickLogs = db.query<QuickLogExportRow>(
    `SELECT completed_at, name, focus, duration_min, calories, rpe, notes
     FROM wk_workout_logs
     ORDER BY completed_at ASC`,
  );

  const lines = ['Date,Source,Workout,Duration (min),Exercises,Sets,Reps,RPE,Notes'];

  for (const row of sessions) {
    let exercises = 0;
    let sets = 0;
    let reps = 0;
    try {
      const parsed = JSON.parse(row.exercises_completed_json) as Array<{
        setsCompleted?: number;
        repsCompleted?: number | null;
      }>;
      exercises = parsed.length;
      for (const entry of parsed) {
        sets += entry.setsCompleted ?? 0;
        reps += entry.repsCompleted ?? 0;
      }
    } catch {
      /* unreadable JSON: leave zeros rather than guessing */
    }
    lines.push(
      [
        escapeCsvField(row.date ?? ''),
        'session',
        escapeCsvField(row.title),
        String(durationMinutes(row.started_at, row.completed_at)),
        String(exercises),
        String(sets),
        String(reps),
        '',
        '',
      ].join(','),
    );
  }

  for (const row of quickLogs) {
    lines.push(
      [
        escapeCsvField(row.completed_at.slice(0, 10)),
        'quick_log',
        escapeCsvField(row.name),
        String(row.duration_min),
        '',
        '',
        '',
        String(row.rpe),
        escapeCsvField(row.notes ?? ''),
      ].join(','),
    );
  }

  return lines.join('\n');
}

/**
 * Export every recorded working set as CSV.
 * Columns: Date, Session, Exercise, Set, Weight, Reps, Unit, Est. 1RM
 */
export function exportSetWeightsCSV(db: DatabaseAdapter): string {
  const rows = db.query<SetWeightExportRow>(
    `SELECT date(sw.created_at) as date, sw.session_id, sw.exercise_id,
            sw.set_number, sw.weight, sw.reps, sw.unit, sw.estimated_1rm
     FROM wk_workout_set_weights sw
     ORDER BY sw.created_at ASC, sw.set_number ASC`,
  );

  const lines = ['Date,Session,Exercise,Set,Weight,Reps,Unit,Est. 1RM'];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.date ?? ''),
        escapeCsvField(row.session_id),
        escapeCsvField(row.exercise_id),
        String(row.set_number),
        String(row.weight),
        String(row.reps),
        escapeCsvField(row.unit),
        String(row.estimated_1rm),
      ].join(','),
    );
  }
  return lines.join('\n');
}
