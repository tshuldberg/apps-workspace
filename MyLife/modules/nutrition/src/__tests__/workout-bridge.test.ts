import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { getWorkoutDays } from '../engine/data-bridge';

const SESSIONS_TABLE = `CREATE TABLE IF NOT EXISTS wk_workout_sessions (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
)`;

const LOGS_TABLE = `CREATE TABLE IF NOT EXISTS wk_workout_logs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  completed_at TEXT NOT NULL
)`;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('workout data bridge', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns [] when no workouts tables exist', () => {
    expect(getWorkoutDays(adapter, 7)).toEqual([]);
  });

  it('reads the real wk_workout_sessions table (regression: was querying nonexistent wo_sessions)', () => {
    adapter.execute(SESSIONS_TABLE);
    adapter.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at) VALUES ('s1', 'w1', ?)`,
      [isoDaysAgo(0)],
    );

    const days = getWorkoutDays(adapter, 7);
    expect(days).toHaveLength(7);
    const today = new Date().toISOString().slice(0, 10);
    const todayRow = days.find((d) => d.date === today);
    expect(todayRow).toBeDefined();
    expect(todayRow!.didWorkout).toBe(true);
  });

  it('counts quick logs from wk_workout_logs when sessions table is absent', () => {
    adapter.execute(LOGS_TABLE);
    adapter.execute(
      `INSERT INTO wk_workout_logs (id, name, completed_at) VALUES ('l1', 'Push day', ?)`,
      [isoDaysAgo(1)],
    );

    const days = getWorkoutDays(adapter, 7);
    expect(days).toHaveLength(7);
    const trained = days.filter((d) => d.didWorkout).map((d) => d.date);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(trained).toContain(yesterday);
  });

  it('unions both tables when both exist', () => {
    adapter.execute(SESSIONS_TABLE);
    adapter.execute(LOGS_TABLE);
    adapter.execute(
      `INSERT INTO wk_workout_sessions (id, workout_id, started_at) VALUES ('s1', 'w1', ?)`,
      [isoDaysAgo(0)],
    );
    adapter.execute(
      `INSERT INTO wk_workout_logs (id, name, completed_at) VALUES ('l1', 'Legs', ?)`,
      [isoDaysAgo(2)],
    );

    const days = getWorkoutDays(adapter, 7);
    expect(days.filter((d) => d.didWorkout)).toHaveLength(2);
  });
});
