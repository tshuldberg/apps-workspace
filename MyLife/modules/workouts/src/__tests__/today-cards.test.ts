import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../definition';
import { workoutsCrossModule } from '../cross-module';

const NOW = new Date('2026-07-04T15:00:00.000Z');

function seedWorkout(db: DatabaseAdapter): void {
  db.execute(`INSERT INTO wk_workouts (id, title) VALUES ('w1', 'Push Day')`);
}

function seedSession(db: DatabaseAdapter, id: string, completedAt: string): void {
  db.execute(
    `INSERT INTO wk_workout_sessions (id, workout_id, started_at, completed_at)
     VALUES (?, 'w1', ?, ?)`,
    [id, completedAt, completedAt],
  );
}

describe('workouts getTodayCards', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    seedWorkout(adapter);
  });

  afterEach(() => {
    closeDb();
  });

  it('prompts to train when no session is completed today', () => {
    const cards = workoutsCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('action');
    expect(cards[0]!.title).toBe('Train today');
    expect(cards[0]!.moduleId).toBe('workouts');
    expect(cards[0]!.cta?.route).toBe('/workouts');
  });

  it('shows a progress card when a session was completed today', () => {
    seedSession(adapter, 's1', '2026-07-04T10:00:00.000Z');
    const cards = workoutsCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('progress');
    expect(cards[0]!.title).toBe('Workout logged today');
    expect(cards[0]!.subtitle).toContain('1 training day');
  });

  it('counts distinct training days in the trailing week', () => {
    seedSession(adapter, 's1', '2026-07-02T10:00:00.000Z');
    seedSession(adapter, 's2', '2026-07-03T10:00:00.000Z');
    const cards = workoutsCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards[0]!.kind).toBe('action');
    expect(cards[0]!.subtitle).toBe('2 of the last 7 days trained');
  });

  it('expires the card at the end of the UTC day', () => {
    const cards = workoutsCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards[0]!.expiresAt).toBe('2026-07-05T00:00:00.000Z');
  });
});
