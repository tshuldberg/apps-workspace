import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutExerciseEntry, CompletedExercise } from '../../types';
import {
  createWorkout,
  createWorkoutSession,
  completeWorkoutSession,
  annotateWorkoutSession,
  getWorkoutSessions,
  deleteWorkoutSession,
  recordSetWeight,
  getSetWeightsForSession,
  createWorkoutFormRecording,
  getWorkoutFormRecordings,
} from '../crud';

function seedWorkout(db: DatabaseAdapter, id = 'w-1'): void {
  const exercises: WorkoutExerciseEntry[] = [
    {
      exerciseId: 'ex-1',
      name: 'Push-up',
      category: 'strength',
      sets: 3,
      reps: 10,
      duration: null,
      restAfter: 60,
      order: 0,
    },
    {
      exerciseId: 'ex-2',
      name: 'Squat',
      category: 'strength',
      sets: 3,
      reps: 12,
      duration: null,
      restAfter: 60,
      order: 1,
    },
  ];
  createWorkout(db, id, {
    title: 'Test Workout',
    difficulty: 'beginner',
    exercises,
  });
}

describe('@mylife/workouts - sessions', () => {
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

  // ── createWorkoutSession ──

  it('creates a session linked to a workout', () => {
    createWorkoutSession(adapter, 's-1', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T08:00:00.000Z',
    });

    const sessions = getWorkoutSessions(adapter);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('s-1');
    expect(sessions[0].workoutId).toBe('w-1');
    expect(sessions[0].startedAt).toBe('2026-03-01T08:00:00.000Z');
    expect(sessions[0].completedAt).toBeNull();
  });

  it('creates a session with default startedAt', () => {
    createWorkoutSession(adapter, 's-default', {
      workoutId: 'w-1',
    });

    const sessions = getWorkoutSessions(adapter);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startedAt).toBeTruthy();
  });

  it('creates a session with initial exercisesCompleted', () => {
    const completed: CompletedExercise[] = [
      { exerciseId: 'ex-1', setsCompleted: 2, repsCompleted: 10, durationActual: null, skipped: false },
    ];
    createWorkoutSession(adapter, 's-init', {
      workoutId: 'w-1',
      exercisesCompleted: completed,
    });

    const sessions = getWorkoutSessions(adapter);
    expect(sessions[0].exercisesCompleted).toHaveLength(1);
    expect(sessions[0].exercisesCompleted[0].exerciseId).toBe('ex-1');
    expect(sessions[0].exercisesCompleted[0].setsCompleted).toBe(2);
  });

  // ── completeWorkoutSession ──

  it('completes a session with exercisesCompleted array', () => {
    createWorkoutSession(adapter, 's-complete', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T08:00:00.000Z',
    });

    const completed: CompletedExercise[] = [
      { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      { exerciseId: 'ex-2', setsCompleted: 3, repsCompleted: 12, durationActual: null, skipped: false },
    ];

    completeWorkoutSession(adapter, 's-complete', {
      completedAt: '2026-03-01T08:45:00.000Z',
      exercisesCompleted: completed,
    });

    const sessions = getWorkoutSessions(adapter, { onlyCompleted: true });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].completedAt).toBe('2026-03-01T08:45:00.000Z');
    expect(sessions[0].exercisesCompleted).toHaveLength(2);
  });

  it('completes a session with voice commands and pace adjustments', () => {
    createWorkoutSession(adapter, 's-voice', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T09:00:00.000Z',
    });

    completeWorkoutSession(adapter, 's-voice', {
      completedAt: '2026-03-01T09:30:00.000Z',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
      voiceCommandsUsed: [
        { command: 'next', timestamp: 120, recognized: true },
      ],
      paceAdjustments: [
        { timestamp: 60, speed: 1.5, source: 'voice' },
      ],
    });

    const sessions = getWorkoutSessions(adapter);
    expect(sessions[0].voiceCommandsUsed).toHaveLength(1);
    expect(sessions[0].voiceCommandsUsed[0].command).toBe('next');
    expect(sessions[0].paceAdjustments).toHaveLength(1);
    expect(sessions[0].paceAdjustments[0].speed).toBe(1.5);
  });

  // ── getWorkoutSessions filters ──

  it('filters sessions by workoutId', () => {
    seedWorkout(adapter, 'w-2');
    createWorkoutSession(adapter, 's-w1', { workoutId: 'w-1' });
    createWorkoutSession(adapter, 's-w2', { workoutId: 'w-2' });

    const w1Sessions = getWorkoutSessions(adapter, { workoutId: 'w-1' });
    expect(w1Sessions).toHaveLength(1);
    expect(w1Sessions[0].workoutId).toBe('w-1');
  });

  it('filters sessions by onlyCompleted', () => {
    createWorkoutSession(adapter, 's-incomplete', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T10:00:00.000Z',
    });
    createWorkoutSession(adapter, 's-done', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T11:00:00.000Z',
      completedAt: '2026-03-01T11:30:00.000Z',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    const completedOnly = getWorkoutSessions(adapter, { onlyCompleted: true });
    expect(completedOnly).toHaveLength(1);
    expect(completedOnly[0].id).toBe('s-done');
  });

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      createWorkoutSession(adapter, `s-lim-${i}`, { workoutId: 'w-1' });
    }

    const limited = getWorkoutSessions(adapter, { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('returns sessions ordered by most recent first', () => {
    createWorkoutSession(adapter, 's-old', {
      workoutId: 'w-1',
      startedAt: '2026-01-01T08:00:00.000Z',
    });
    createWorkoutSession(adapter, 's-new', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T08:00:00.000Z',
      completedAt: '2026-03-01T09:00:00.000Z',
    });

    const sessions = getWorkoutSessions(adapter);
    expect(sessions[0].id).toBe('s-new');
    expect(sessions[1].id).toBe('s-old');
  });

  // ── migration V7: title/notes columns ──

  it('exposes nullable title and notes columns on new sessions', () => {
    createWorkoutSession(adapter, 's-cols', { workoutId: 'w-1' });

    const session = getWorkoutSessions(adapter)[0];
    expect(session.title).toBeNull();
    expect(session.notes).toBeNull();
  });

  it('title/notes columns exist in the migrated schema', () => {
    const columns = adapter
      .query<{ name: string }>('PRAGMA table_info(wk_workout_sessions)')
      .map((c) => c.name);
    expect(columns).toContain('title');
    expect(columns).toContain('notes');
  });

  // ── annotateWorkoutSession ──

  it('annotates a session with title and notes', () => {
    createWorkoutSession(adapter, 's-annotate', { workoutId: 'w-1' });

    annotateWorkoutSession(adapter, 's-annotate', {
      title: 'Leg Day',
      notes: 'Felt strong, hit a squat PR.',
    });

    const session = getWorkoutSessions(adapter)[0];
    expect(session.title).toBe('Leg Day');
    expect(session.notes).toBe('Felt strong, hit a squat PR.');
  });

  it('annotates only the title when notes are omitted', () => {
    createWorkoutSession(adapter, 's-title-only', { workoutId: 'w-1' });

    annotateWorkoutSession(adapter, 's-title-only', { title: 'Morning Push' });

    const session = getWorkoutSessions(adapter)[0];
    expect(session.title).toBe('Morning Push');
    expect(session.notes).toBeNull();
  });

  it('clears a previously set annotation with null', () => {
    createWorkoutSession(adapter, 's-clear', { workoutId: 'w-1' });
    annotateWorkoutSession(adapter, 's-clear', { title: 'Draft', notes: 'temp' });
    annotateWorkoutSession(adapter, 's-clear', { title: null, notes: null });

    const session = getWorkoutSessions(adapter)[0];
    expect(session.title).toBeNull();
    expect(session.notes).toBeNull();
  });

  it('preserves other session fields when annotating', () => {
    createWorkoutSession(adapter, 's-preserve', {
      workoutId: 'w-1',
      startedAt: '2026-03-01T08:00:00.000Z',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    annotateWorkoutSession(adapter, 's-preserve', { title: 'Kept' });

    const session = getWorkoutSessions(adapter)[0];
    expect(session.title).toBe('Kept');
    expect(session.startedAt).toBe('2026-03-01T08:00:00.000Z');
    expect(session.exercisesCompleted).toHaveLength(1);
  });

  it('is a no-op when no fields are provided', () => {
    createWorkoutSession(adapter, 's-noop', { workoutId: 'w-1' });
    annotateWorkoutSession(adapter, 's-noop', {});

    const session = getWorkoutSessions(adapter)[0];
    expect(session.title).toBeNull();
    expect(session.notes).toBeNull();
  });

  // ── deleteWorkoutSession ──

  it('deletes a session by id', () => {
    createWorkoutSession(adapter, 's-del', { workoutId: 'w-1' });
    createWorkoutSession(adapter, 's-keep', { workoutId: 'w-1' });

    deleteWorkoutSession(adapter, 's-del');

    const sessions = getWorkoutSessions(adapter);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('s-keep');
  });

  it('removes set-weight rows tied to the deleted session', () => {
    createWorkoutSession(adapter, 's-weights', { workoutId: 'w-1' });
    recordSetWeight(adapter, 'sw-1', {
      sessionId: 's-weights',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 100,
      reps: 10,
      unit: 'lbs',
      estimated1rm: 133,
    });
    recordSetWeight(adapter, 'sw-2', {
      sessionId: 's-weights',
      exerciseId: 'ex-1',
      setNumber: 2,
      weight: 105,
      reps: 8,
      unit: 'lbs',
      estimated1rm: 133,
    });
    expect(getSetWeightsForSession(adapter, 's-weights')).toHaveLength(2);

    deleteWorkoutSession(adapter, 's-weights');

    expect(getSetWeightsForSession(adapter, 's-weights')).toHaveLength(0);
    expect(getWorkoutSessions(adapter)).toHaveLength(0);
  });

  it('removes form recordings tied to the deleted session', () => {
    createWorkoutSession(adapter, 's-rec', { workoutId: 'w-1' });
    createWorkoutFormRecording(adapter, 'rec-1', {
      sessionId: 's-rec',
      exerciseId: 'ex-1',
      videoUrl: 'file:///clip.mp4',
      timestampStart: 0,
      timestampEnd: 5,
    });
    expect(getWorkoutFormRecordings(adapter, { sessionId: 's-rec' })).toHaveLength(1);

    deleteWorkoutSession(adapter, 's-rec');

    expect(getWorkoutFormRecordings(adapter, { sessionId: 's-rec' })).toHaveLength(0);
  });

  it('leaves other sessions and their set weights intact', () => {
    createWorkoutSession(adapter, 's-a', { workoutId: 'w-1' });
    createWorkoutSession(adapter, 's-b', { workoutId: 'w-1' });
    recordSetWeight(adapter, 'sw-a', {
      sessionId: 's-a', exerciseId: 'ex-1', setNumber: 1, weight: 50, reps: 5, unit: 'lbs', estimated1rm: 58,
    });
    recordSetWeight(adapter, 'sw-b', {
      sessionId: 's-b', exerciseId: 'ex-1', setNumber: 1, weight: 60, reps: 5, unit: 'lbs', estimated1rm: 70,
    });

    deleteWorkoutSession(adapter, 's-a');

    expect(getWorkoutSessions(adapter)).toHaveLength(1);
    expect(getSetWeightsForSession(adapter, 's-a')).toHaveLength(0);
    expect(getSetWeightsForSession(adapter, 's-b')).toHaveLength(1);
  });

  it('is a safe no-op for an unknown session id', () => {
    createWorkoutSession(adapter, 's-only', { workoutId: 'w-1' });

    expect(() => deleteWorkoutSession(adapter, 's-missing')).not.toThrow();
    expect(getWorkoutSessions(adapter)).toHaveLength(1);
  });

  it('session has properly parsed JSON arrays', () => {
    createWorkoutSession(adapter, 's-json', {
      workoutId: 'w-1',
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
      voiceCommandsUsed: [{ command: 'pause', timestamp: 30, recognized: true }],
      paceAdjustments: [{ timestamp: 45, speed: 0.8, source: 'manual' }],
    });

    const session = getWorkoutSessions(adapter)[0];
    expect(Array.isArray(session.exercisesCompleted)).toBe(true);
    expect(Array.isArray(session.voiceCommandsUsed)).toBe(true);
    expect(Array.isArray(session.paceAdjustments)).toBe(true);
    expect(session.exercisesCompleted[0].exerciseId).toBe('ex-1');
  });
});
