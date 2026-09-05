import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../definition';
import {
  createWorkout,
  createWorkoutSession,
  completeWorkoutSession,
  deleteWorkoutSession,
  recordSetWeight,
  createWorkoutFormRecording,
  createGpsRoute,
  getWorkoutSessions,
  getSetWeightsForSession,
} from '../db/crud';
import type { WorkoutExerciseEntry } from '../types';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function makeExercises(count: number): WorkoutExerciseEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    exerciseId: `ex-${i + 1}`,
    name: `Exercise ${i + 1}`,
    category: 'strength' as const,
    sets: 3,
    reps: 10,
    duration: 30,
    restAfter: 60,
    order: i,
  }));
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('deleteWorkoutSession', () => {
  it('removes the session row', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Push Day',
      difficulty: 'intermediate',
      exercises: makeExercises(2),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    completeWorkoutSession(adapter, 's-1', {
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: 30, skipped: false },
      ],
    });

    expect(getWorkoutSessions(adapter)).toHaveLength(1);

    deleteWorkoutSession(adapter, 's-1');

    expect(getWorkoutSessions(adapter)).toHaveLength(0);
  });

  it('cascades delete to set weights and form recordings', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Push Day',
      difficulty: 'intermediate',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    recordSetWeight(adapter, 'sw-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 135,
      reps: 8,
    });
    createWorkoutFormRecording(adapter, 'fr-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file://clip.mp4',
      timestampStart: 0,
      timestampEnd: 10,
    });

    expect(getSetWeightsForSession(adapter, 's-1')).toHaveLength(1);
    expect(
      adapter.query<{ c: number }>('SELECT COUNT(*) as c FROM wk_form_recordings WHERE session_id = ?', ['s-1'])[0]
        ?.c,
    ).toBe(1);

    deleteWorkoutSession(adapter, 's-1');

    expect(getSetWeightsForSession(adapter, 's-1')).toHaveLength(0);
    expect(
      adapter.query<{ c: number }>('SELECT COUNT(*) as c FROM wk_form_recordings WHERE session_id = ?', ['s-1'])[0]
        ?.c,
    ).toBe(0);
  });

  it('detaches a linked GPS route instead of deleting it', () => {
    createWorkout(adapter, 'w-1', {
      title: 'Run',
      difficulty: 'beginner',
      exercises: makeExercises(1),
    });
    createWorkoutSession(adapter, 's-1', { workoutId: 'w-1' });
    createGpsRoute(adapter, 'route-1', {
      sessionId: 's-1',
      activityType: 'run',
      startedAt: new Date().toISOString(),
    });

    deleteWorkoutSession(adapter, 's-1');

    const route = adapter.query<{ session_id: string | null }>(
      'SELECT session_id FROM wk_gps_routes WHERE id = ?',
      ['route-1'],
    )[0];
    expect(route).toBeDefined();
    expect(route?.session_id).toBeNull();
  });

  it('is a no-op for an unknown session id', () => {
    expect(() => deleteWorkoutSession(adapter, 'missing')).not.toThrow();
  });
});
