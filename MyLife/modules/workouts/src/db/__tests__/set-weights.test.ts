import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutExerciseEntry } from '../../types';
import {
  createWorkout,
  createWorkoutSession,
  recordSetWeight,
  getSetWeightsForSession,
  getSetWeightsForExercise,
  record1RM,
  get1RMHistory,
  getLatest1RM,
  createBodyMeasurement,
  getBodyMeasurements,
  deleteBodyMeasurement,
} from '../crud';

function seedDependencies(db: DatabaseAdapter): void {
  const exercises: WorkoutExerciseEntry[] = [
    {
      exerciseId: 'ex-1',
      name: 'Bench Press',
      category: 'strength',
      sets: 5,
      reps: 5,
      duration: null,
      restAfter: 90,
      order: 0,
    },
    {
      exerciseId: 'ex-2',
      name: 'Squat',
      category: 'strength',
      sets: 5,
      reps: 5,
      duration: null,
      restAfter: 90,
      order: 1,
    },
  ];
  createWorkout(db, 'w-1', {
    title: 'Strength Session',
    difficulty: 'intermediate',
    exercises,
  });
  createWorkoutSession(db, 's-1', {
    workoutId: 'w-1',
    startedAt: '2026-03-01T08:00:00.000Z',
  });
  createWorkoutSession(db, 's-2', {
    workoutId: 'w-1',
    startedAt: '2026-03-02T08:00:00.000Z',
  });
}

describe('@mylife/workouts - set weights', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    seedDependencies(adapter);
  });

  afterEach(() => {
    closeDb();
  });

  // ── recordSetWeight ──

  it('records a set weight entry', () => {
    recordSetWeight(adapter, 'sw-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 135,
      reps: 5,
      unit: 'lbs',
      estimated1rm: 152,
    });

    const weights = getSetWeightsForSession(adapter, 's-1');
    expect(weights).toHaveLength(1);
    expect(weights[0].id).toBe('sw-1');
    expect(weights[0].sessionId).toBe('s-1');
    expect(weights[0].exerciseId).toBe('ex-1');
    expect(weights[0].setNumber).toBe(1);
    expect(weights[0].weight).toBe(135);
    expect(weights[0].reps).toBe(5);
    expect(weights[0].unit).toBe('lbs');
    expect(weights[0].estimated1rm).toBe(152);
  });

  it('records multiple sets for the same exercise', () => {
    for (let i = 1; i <= 5; i++) {
      recordSetWeight(adapter, `sw-set-${i}`, {
        sessionId: 's-1',
        exerciseId: 'ex-1',
        setNumber: i,
        weight: 135,
        reps: 5,
        unit: 'lbs',
      });
    }

    const weights = getSetWeightsForSession(adapter, 's-1');
    expect(weights).toHaveLength(5);
    expect(weights.map((w) => w.setNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('defaults unit to lbs when not explicitly set', () => {
    recordSetWeight(adapter, 'sw-default', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 100,
      reps: 10,
    });

    const weights = getSetWeightsForSession(adapter, 's-1');
    expect(weights[0].unit).toBe('lbs');
  });

  // ── getSetWeightsForSession ──

  it('returns only weights for the specified session', () => {
    recordSetWeight(adapter, 'sw-s1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 135,
      reps: 5,
      unit: 'lbs',
    });
    recordSetWeight(adapter, 'sw-s2', {
      sessionId: 's-2',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 140,
      reps: 5,
      unit: 'lbs',
    });

    const s1Weights = getSetWeightsForSession(adapter, 's-1');
    expect(s1Weights).toHaveLength(1);
    expect(s1Weights[0].weight).toBe(135);

    const s2Weights = getSetWeightsForSession(adapter, 's-2');
    expect(s2Weights).toHaveLength(1);
    expect(s2Weights[0].weight).toBe(140);
  });

  it('returns weights ordered by set_number ASC', () => {
    recordSetWeight(adapter, 'sw-ord-3', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 3,
      weight: 135,
      reps: 5,
      unit: 'lbs',
    });
    recordSetWeight(adapter, 'sw-ord-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 135,
      reps: 5,
      unit: 'lbs',
    });

    const weights = getSetWeightsForSession(adapter, 's-1');
    expect(weights[0].setNumber).toBe(1);
    expect(weights[1].setNumber).toBe(3);
  });

  it('returns empty array for nonexistent session', () => {
    expect(getSetWeightsForSession(adapter, 'nonexistent')).toEqual([]);
  });

  // ── getSetWeightsForExercise ──

  it('returns weights for a specific exercise across sessions', () => {
    recordSetWeight(adapter, 'sw-ex-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 135,
      reps: 5,
      unit: 'lbs',
    });
    recordSetWeight(adapter, 'sw-ex-2', {
      sessionId: 's-2',
      exerciseId: 'ex-1',
      setNumber: 1,
      weight: 140,
      reps: 5,
      unit: 'lbs',
    });
    recordSetWeight(adapter, 'sw-other', {
      sessionId: 's-1',
      exerciseId: 'ex-2',
      setNumber: 1,
      weight: 225,
      reps: 5,
      unit: 'lbs',
    });

    const exWeights = getSetWeightsForExercise(adapter, 'ex-1');
    expect(exWeights).toHaveLength(2);
    expect(exWeights.every((w) => w.exerciseId === 'ex-1')).toBe(true);
  });

  it('respects limit on getSetWeightsForExercise', () => {
    for (let i = 0; i < 10; i++) {
      recordSetWeight(adapter, `sw-lim-${i}`, {
        sessionId: 's-1',
        exerciseId: 'ex-1',
        setNumber: i + 1,
        weight: 135,
        reps: 5,
        unit: 'lbs',
      });
    }

    const limited = getSetWeightsForExercise(adapter, 'ex-1', { limit: 3 });
    expect(limited).toHaveLength(3);
  });
});

describe('@mylife/workouts - 1RM history', () => {
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

  // ── record1RM ──

  it('records a 1RM entry', () => {
    record1RM(adapter, '1rm-1', {
      exerciseId: 'ex-1',
      maxWeight: 225,
      maxReps: 1,
      estimated1rm: 225,
      unit: 'lbs',
      achievedAt: '2026-03-01',
    });

    const history = get1RMHistory(adapter, 'ex-1');
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('1rm-1');
    expect(history[0].exerciseId).toBe('ex-1');
    expect(history[0].maxWeight).toBe(225);
    expect(history[0].maxReps).toBe(1);
    expect(history[0].estimated1rm).toBe(225);
    expect(history[0].unit).toBe('lbs');
    expect(history[0].achievedAt).toBe('2026-03-01');
  });

  it('supports kg unit', () => {
    record1RM(adapter, '1rm-kg', {
      exerciseId: 'ex-1',
      maxWeight: 100,
      maxReps: 1,
      estimated1rm: 100,
      unit: 'kg',
      achievedAt: '2026-03-01',
    });

    const history = get1RMHistory(adapter, 'ex-1');
    expect(history[0].unit).toBe('kg');
  });

  // ── get1RMHistory ──

  it('returns history ordered by achievedAt DESC', () => {
    record1RM(adapter, '1rm-old', {
      exerciseId: 'ex-1',
      maxWeight: 200,
      maxReps: 3,
      estimated1rm: 212,
      unit: 'lbs',
      achievedAt: '2026-01-01',
    });
    record1RM(adapter, '1rm-new', {
      exerciseId: 'ex-1',
      maxWeight: 225,
      maxReps: 1,
      estimated1rm: 225,
      unit: 'lbs',
      achievedAt: '2026-03-01',
    });

    const history = get1RMHistory(adapter, 'ex-1');
    expect(history[0].achievedAt).toBe('2026-03-01');
    expect(history[1].achievedAt).toBe('2026-01-01');
  });

  it('filters by exerciseId', () => {
    record1RM(adapter, '1rm-a', {
      exerciseId: 'ex-1',
      maxWeight: 225,
      maxReps: 1,
      estimated1rm: 225,
      unit: 'lbs',
      achievedAt: '2026-03-01',
    });
    record1RM(adapter, '1rm-b', {
      exerciseId: 'ex-2',
      maxWeight: 315,
      maxReps: 1,
      estimated1rm: 315,
      unit: 'lbs',
      achievedAt: '2026-03-01',
    });

    const history = get1RMHistory(adapter, 'ex-1');
    expect(history).toHaveLength(1);
    expect(history[0].exerciseId).toBe('ex-1');
  });

  it('respects limit on get1RMHistory', () => {
    for (let i = 0; i < 10; i++) {
      record1RM(adapter, `1rm-lim-${i}`, {
        exerciseId: 'ex-1',
        maxWeight: 200 + i,
        maxReps: 1,
        estimated1rm: 200 + i,
        unit: 'lbs',
        achievedAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
      });
    }

    const limited = get1RMHistory(adapter, 'ex-1', { limit: 3 });
    expect(limited).toHaveLength(3);
  });

  // ── getLatest1RM ──

  it('returns the most recent 1RM for an exercise', () => {
    record1RM(adapter, '1rm-first', {
      exerciseId: 'ex-1',
      maxWeight: 200,
      maxReps: 3,
      estimated1rm: 212,
      unit: 'lbs',
      achievedAt: '2026-01-01',
    });
    record1RM(adapter, '1rm-latest', {
      exerciseId: 'ex-1',
      maxWeight: 225,
      maxReps: 1,
      estimated1rm: 225,
      unit: 'lbs',
      achievedAt: '2026-03-01',
    });

    const latest = getLatest1RM(adapter, 'ex-1');
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe('1rm-latest');
    expect(latest!.maxWeight).toBe(225);
  });

  it('returns null when no 1RM exists for the exercise', () => {
    expect(getLatest1RM(adapter, 'nonexistent')).toBeNull();
  });
});

describe('@mylife/workouts - body measurements', () => {
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

  // ── createBodyMeasurement ──

  it('creates a body measurement', () => {
    createBodyMeasurement(adapter, 'bm-1', {
      type: 'weight',
      value: 180.5,
      unit: 'lbs',
      measuredAt: '2026-03-01',
    });

    const measurements = getBodyMeasurements(adapter);
    expect(measurements).toHaveLength(1);
    expect(measurements[0].id).toBe('bm-1');
    expect(measurements[0].type).toBe('weight');
    expect(measurements[0].value).toBe(180.5);
    expect(measurements[0].unit).toBe('lbs');
    expect(measurements[0].measuredAt).toBe('2026-03-01');
  });

  it('creates measurements with different types', () => {
    createBodyMeasurement(adapter, 'bm-weight', {
      type: 'weight',
      value: 180,
      unit: 'lbs',
      measuredAt: '2026-03-01',
    });
    createBodyMeasurement(adapter, 'bm-fat', {
      type: 'body_fat',
      value: 15.0,
      unit: '%',
      measuredAt: '2026-03-01',
    });
    createBodyMeasurement(adapter, 'bm-waist', {
      type: 'waist',
      value: 32,
      unit: 'in',
      measuredAt: '2026-03-01',
    });

    const all = getBodyMeasurements(adapter);
    expect(all).toHaveLength(3);
  });

  // ── getBodyMeasurements ──

  it('filters by type', () => {
    createBodyMeasurement(adapter, 'bm-w1', {
      type: 'weight',
      value: 180,
      unit: 'lbs',
      measuredAt: '2026-03-01',
    });
    createBodyMeasurement(adapter, 'bm-bf', {
      type: 'body_fat',
      value: 15.0,
      unit: '%',
      measuredAt: '2026-03-01',
    });

    const weightOnly = getBodyMeasurements(adapter, { type: 'weight' });
    expect(weightOnly).toHaveLength(1);
    expect(weightOnly[0].type).toBe('weight');
  });

  it('returns measurements ordered by measuredAt DESC', () => {
    createBodyMeasurement(adapter, 'bm-old', {
      type: 'weight',
      value: 185,
      unit: 'lbs',
      measuredAt: '2026-01-01',
    });
    createBodyMeasurement(adapter, 'bm-new', {
      type: 'weight',
      value: 180,
      unit: 'lbs',
      measuredAt: '2026-03-01',
    });

    const measurements = getBodyMeasurements(adapter);
    expect(measurements[0].measuredAt).toBe('2026-03-01');
    expect(measurements[1].measuredAt).toBe('2026-01-01');
  });

  it('respects limit option', () => {
    for (let i = 0; i < 10; i++) {
      createBodyMeasurement(adapter, `bm-lim-${i}`, {
        type: 'weight',
        value: 180 + i,
        unit: 'lbs',
        measuredAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
      });
    }

    const limited = getBodyMeasurements(adapter, { limit: 5 });
    expect(limited).toHaveLength(5);
  });

  // ── deleteBodyMeasurement ──

  it('deletes a measurement by id', () => {
    createBodyMeasurement(adapter, 'bm-del', {
      type: 'weight',
      value: 180,
      unit: 'lbs',
      measuredAt: '2026-03-01',
    });

    deleteBodyMeasurement(adapter, 'bm-del');

    const measurements = getBodyMeasurements(adapter);
    expect(measurements).toHaveLength(0);
  });

  it('delete is a no-op for nonexistent measurement', () => {
    expect(() => deleteBodyMeasurement(adapter, 'nonexistent')).not.toThrow();
  });

  it('deleting one measurement does not affect others', () => {
    createBodyMeasurement(adapter, 'bm-keep', {
      type: 'weight',
      value: 180,
      unit: 'lbs',
      measuredAt: '2026-03-01',
    });
    createBodyMeasurement(adapter, 'bm-remove', {
      type: 'body_fat',
      value: 15.0,
      unit: '%',
      measuredAt: '2026-03-01',
    });

    deleteBodyMeasurement(adapter, 'bm-remove');

    const remaining = getBodyMeasurements(adapter);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('bm-keep');
  });
});
