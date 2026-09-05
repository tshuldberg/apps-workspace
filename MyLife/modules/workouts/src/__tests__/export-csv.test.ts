import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../definition';
import { exportWorkoutHistoryCSV, exportSetWeightsCSV } from '../export/csv';

describe('workouts CSV export', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('exports headers only for an empty database', () => {
    expect(exportWorkoutHistoryCSV(adapter)).toBe(
      'Date,Source,Workout,Duration (min),Exercises,Sets,Reps,RPE,Notes',
    );
    expect(exportSetWeightsCSV(adapter)).toBe(
      'Date,Session,Exercise,Set,Weight,Reps,Unit,Est. 1RM',
    );
  });

  it('exports completed sessions with parsed set/rep totals', () => {
    adapter.execute(`INSERT INTO wk_workouts (id, title) VALUES ('w1', 'Push Day')`);
    adapter.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at, completed_at, exercises_completed_json)
       VALUES ('s1', 'w1', '2026-07-04T10:00:00.000Z', '2026-07-04T11:05:00.000Z',
               '[{"setsCompleted":3,"repsCompleted":24},{"setsCompleted":4,"repsCompleted":32}]')`,
    );

    const csv = exportWorkoutHistoryCSV(adapter);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-07-04,session,Push Day,65,2,7,56,,');
  });

  it('exports quick logs and guards formula injection in names', () => {
    adapter.execute(
      `INSERT INTO wk_workout_logs (id, name, focus, duration_min, calories, rpe, completed_at, notes)
       VALUES ('l1', '=SUM(A1)', 'full_body', 30, 200, 7, '2026-07-03T18:00:00.000Z', 'legs, easy')`,
    );

    const csv = exportWorkoutHistoryCSV(adapter);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('\t=SUM(A1)');
    expect(lines[1]).toContain('"legs, easy"');
  });

  it('exports recorded set weights', () => {
    adapter.execute(`INSERT INTO wk_workouts (id, title) VALUES ('w1', 'Push Day')`);
    adapter.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at) VALUES ('s1', 'w1', '2026-07-04T10:00:00.000Z')`,
    );
    adapter.execute(
      `INSERT INTO wk_workout_set_weights (id, session_id, exercise_id, set_number, weight, reps, unit, estimated_1rm)
       VALUES ('sw1', 's1', 'bench-press', 1, 185, 5, 'lbs', 216)`,
    );

    const csv = exportSetWeightsCSV(adapter);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('s1,bench-press,1,185,5,lbs,216');
  });
});
