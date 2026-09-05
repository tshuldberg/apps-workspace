import { describe, it, expect } from 'vitest';
import { buildWatchWorkoutSummary, isValidWatchMessage } from '../sync-protocol';
import type { WorkoutExerciseEntry, WeightUnit } from '../../types';

describe('buildWatchWorkoutSummary', () => {
  it('builds summary with previous performance', () => {
    const exercises: WorkoutExerciseEntry[] = [
      { exerciseId: 'ex-1', name: 'Bench Press', category: 'strength', sets: 3, reps: 10, duration: null, restAfter: 90, order: 0 },
      { exerciseId: 'ex-2', name: 'Squat', category: 'strength', sets: 3, reps: 8, duration: null, restAfter: 120, order: 1 },
    ];

    const prevPerf = new Map<string, { weight: number; reps: number; unit: WeightUnit }>();
    prevPerf.set('ex-1', { weight: 135, reps: 10, unit: 'lbs' });

    const summary = buildWatchWorkoutSummary(
      'w-1', 'Test Workout', 'intermediate', exercises, 1800, prevPerf,
    );

    expect(summary.id).toBe('w-1');
    expect(summary.exercises.length).toBe(2);
    expect(summary.exercises[0].previousWeight).toBe(135);
    expect(summary.exercises[0].previousReps).toBe(10);
    expect(summary.exercises[1].previousWeight).toBeNull();
  });

  it('builds summary without previous performance', () => {
    const exercises: WorkoutExerciseEntry[] = [
      { exerciseId: 'ex-1', name: 'Bench Press', category: 'strength', sets: 3, reps: 10, duration: null, restAfter: 90, order: 0 },
    ];

    const summary = buildWatchWorkoutSummary(
      'w-1', 'Test', 'beginner', exercises, 900,
    );

    expect(summary.exercises[0].previousWeight).toBeNull();
  });
});

describe('isValidWatchMessage', () => {
  it('accepts valid set_completed message', () => {
    expect(isValidWatchMessage({ type: 'set_completed', sessionId: 's1' })).toBe(true);
  });

  it('accepts valid session_started message', () => {
    expect(isValidWatchMessage({ type: 'session_started', sessionId: 's1' })).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(isValidWatchMessage({ type: 'unknown' })).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidWatchMessage(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidWatchMessage('string')).toBe(false);
  });
});
