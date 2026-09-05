import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutExerciseEntry, CompletedExercise } from '../../types';
import {
  getWorkoutMetrics,
  getWorkoutDashboard,
  seedWorkoutExerciseLibrary,
  createWorkout,
  createWorkoutSession,
  completeWorkoutSession,
} from '../crud';

function makeExercises(): WorkoutExerciseEntry[] {
  return [
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
  ];
}

function recentIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

describe('@mylife/workouts - dashboard', () => {
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

  // ── getWorkoutMetrics ──

  it('returns zeros with no data', () => {
    const metrics = getWorkoutMetrics(adapter);
    expect(metrics.workouts).toBe(0);
    expect(metrics.totalMinutes).toBe(0);
    // totalCalories is estimated from totalMinutes when no logs, so also 0
    expect(metrics.totalCalories).toBe(0);
    // averageRpe defaults to 7 when no logs
    expect(metrics.averageRpe).toBe(7);
  });

  it('counts completed sessions in metrics', () => {
    createWorkout(adapter, 'w-m1', {
      title: 'Metrics Workout',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    const startedAt = recentIso(60);
    const completedAt = recentIso(30);

    createWorkoutSession(adapter, 's-m1', {
      workoutId: 'w-m1',
      startedAt,
      completedAt,
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    const metrics = getWorkoutMetrics(adapter);
    expect(metrics.workouts).toBe(1);
    expect(metrics.totalMinutes).toBeGreaterThan(0);
  });

  it('excludes incomplete sessions from metrics', () => {
    createWorkout(adapter, 'w-m2', {
      title: 'Incomplete',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    createWorkoutSession(adapter, 's-m2', {
      workoutId: 'w-m2',
      startedAt: recentIso(30),
    });

    const metrics = getWorkoutMetrics(adapter);
    expect(metrics.workouts).toBe(0);
  });

  it('calculates estimated calories from session minutes', () => {
    createWorkout(adapter, 'w-cal', {
      title: 'Calorie Test',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    createWorkoutSession(adapter, 's-cal', {
      workoutId: 'w-cal',
      startedAt: recentIso(120),
      completedAt: recentIso(60),
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    const metrics = getWorkoutMetrics(adapter);
    // totalCalories = totalMinutes * 8.2 (rounded) when no legacy logs
    expect(metrics.totalCalories).toBe(Math.round(metrics.totalMinutes * 8.2));
  });

  // ── getWorkoutDashboard ──

  it('returns dashboard with all zeros when empty', () => {
    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.workouts).toBe(0);
    expect(dashboard.exercises).toBe(0);
    expect(dashboard.sessions).toBe(0);
    expect(dashboard.streakDays).toBe(0);
    expect(dashboard.totalMinutes30d).toBe(0);
  });

  it('aggregates exercise count from seeded library', () => {
    seedWorkoutExerciseLibrary(adapter);
    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.exercises).toBe(50);
  });

  it('aggregates workout count', () => {
    createWorkout(adapter, 'w-d1', {
      title: 'Dashboard Workout 1',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });
    createWorkout(adapter, 'w-d2', {
      title: 'Dashboard Workout 2',
      difficulty: 'intermediate',
      exercises: makeExercises(),
    });

    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.workouts).toBe(2);
  });

  it('aggregates session count', () => {
    createWorkout(adapter, 'w-ds', {
      title: 'Session Count',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    createWorkoutSession(adapter, 's-ds1', { workoutId: 'w-ds' });
    createWorkoutSession(adapter, 's-ds2', { workoutId: 'w-ds' });
    createWorkoutSession(adapter, 's-ds3', { workoutId: 'w-ds' });

    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.sessions).toBe(3);
  });

  it('includes totalMinutes30d from completed sessions', () => {
    createWorkout(adapter, 'w-30d', {
      title: '30 Day Test',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    createWorkoutSession(adapter, 's-30d', {
      workoutId: 'w-30d',
      startedAt: recentIso(120),
      completedAt: recentIso(60),
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.totalMinutes30d).toBeGreaterThan(0);
  });

  it('streakDays reflects consecutive completed sessions', () => {
    createWorkout(adapter, 'w-streak', {
      title: 'Streak',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    createWorkoutSession(adapter, 's-today', {
      workoutId: 'w-streak',
      startedAt: `${today}T08:00:00.000Z`,
      completedAt: `${today}T09:00:00.000Z`,
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    createWorkoutSession(adapter, 's-yesterday', {
      workoutId: 'w-streak',
      startedAt: `${yesterday}T08:00:00.000Z`,
      completedAt: `${yesterday}T09:00:00.000Z`,
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.streakDays).toBe(2);
  });

  it('streakDays is 0 when no recent completed sessions', () => {
    createWorkout(adapter, 'w-no-streak', {
      title: 'No Streak',
      difficulty: 'beginner',
      exercises: makeExercises(),
    });

    // Session from 10 days ago -- should not count as a current streak
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    createWorkoutSession(adapter, 's-old', {
      workoutId: 'w-no-streak',
      startedAt: `${tenDaysAgo}T08:00:00.000Z`,
      completedAt: `${tenDaysAgo}T09:00:00.000Z`,
      exercisesCompleted: [
        { exerciseId: 'ex-1', setsCompleted: 3, repsCompleted: 10, durationActual: null, skipped: false },
      ],
    });

    const dashboard = getWorkoutDashboard(adapter);
    expect(dashboard.streakDays).toBe(0);
  });
});
