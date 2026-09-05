import { describe, it, expect, vi, afterEach } from 'vitest';
import type {
  ProgressSession,
  ProgressExercise,
  SetWeightRow,
  EngineCompletedExercise,
} from '../../types';
import {
  calculateStreaks,
  calculateVolume,
  calculatePersonalRecords,
  getWeeklySummaries,
  buildHistory,
  calculateWeightPRs,
} from '../../progress';

function makeCompletedExercise(
  overrides: Partial<EngineCompletedExercise> = {},
): EngineCompletedExercise {
  return {
    exercise_id: 'ex-1',
    sets_completed: 3,
    reps_completed: 10,
    duration_actual: 120,
    skipped: false,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ProgressSession> = {}): ProgressSession {
  return {
    id: 'sess-1',
    workout_id: 'wk-1',
    started_at: '2025-01-15T10:00:00.000Z',
    completed_at: '2025-01-15T10:30:00.000Z',
    exercises_completed: [],
    ...overrides,
  };
}

function makeExerciseMap(
  entries: Array<{ id: string; name: string; muscle_groups: ProgressExercise['muscle_groups'] }>,
): Record<string, ProgressExercise> {
  const map: Record<string, ProgressExercise> = {};
  for (const e of entries) {
    map[e.id] = e;
  }
  return map;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateStreaks', () => {
  it('returns 0 for empty sessions', () => {
    const result = calculateStreaks([]);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.lastWorkoutDate).toBeNull();
  });

  it('returns 0 for sessions with no completed_at', () => {
    const sessions = [makeSession({ completed_at: null })];
    const result = calculateStreaks(sessions);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
  });

  it('detects consecutive day streaks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const sessions = [
      makeSession({ id: 's1', completed_at: '2025-01-15T10:00:00.000Z' }),
      makeSession({ id: 's2', completed_at: '2025-01-14T10:00:00.000Z' }),
      makeSession({ id: 's3', completed_at: '2025-01-13T10:00:00.000Z' }),
    ];

    const result = calculateStreaks(sessions);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it('breaks streak on gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const sessions = [
      makeSession({ id: 's1', completed_at: '2025-01-15T10:00:00.000Z' }),
      makeSession({ id: 's2', completed_at: '2025-01-14T10:00:00.000Z' }),
      // Gap: Jan 13 missing
      makeSession({ id: 's3', completed_at: '2025-01-12T10:00:00.000Z' }),
      makeSession({ id: 's4', completed_at: '2025-01-11T10:00:00.000Z' }),
    ];

    const result = calculateStreaks(sessions);
    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
  });

  it('tracks lastWorkoutDate', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const sessions = [
      makeSession({ id: 's1', completed_at: '2025-01-15T10:00:00.000Z' }),
    ];

    const result = calculateStreaks(sessions);
    expect(result.lastWorkoutDate).toBe('2025-01-15');
  });
});

describe('calculateVolume', () => {
  it('sums sessions, exercises, sets, reps, duration', () => {
    const sessions = [
      makeSession({
        id: 's1',
        started_at: '2025-01-15T10:00:00.000Z',
        completed_at: '2025-01-15T10:30:00.000Z',
        exercises_completed: [
          makeCompletedExercise({ exercise_id: 'ex-1', sets_completed: 3, reps_completed: 10 }),
          makeCompletedExercise({ exercise_id: 'ex-2', sets_completed: 4, reps_completed: 8 }),
        ],
      }),
    ];

    const exerciseMap = makeExerciseMap([
      { id: 'ex-1', name: 'Push-up', muscle_groups: ['chest'] },
      { id: 'ex-2', name: 'Squat', muscle_groups: ['quads', 'glutes'] },
    ]);

    const stats = calculateVolume(sessions, exerciseMap);
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalExercises).toBe(2);
    expect(stats.totalSets).toBe(7);
    expect(stats.totalReps).toBe(18);
    expect(stats.totalDurationMinutes).toBe(30);
  });

  it('groups by muscle group', () => {
    const sessions = [
      makeSession({
        exercises_completed: [
          makeCompletedExercise({ exercise_id: 'ex-1' }),
          makeCompletedExercise({ exercise_id: 'ex-2' }),
        ],
      }),
    ];

    const exerciseMap = makeExerciseMap([
      { id: 'ex-1', name: 'Push-up', muscle_groups: ['chest'] },
      { id: 'ex-2', name: 'Pull-up', muscle_groups: ['back', 'biceps'] },
    ]);

    const stats = calculateVolume(sessions, exerciseMap);
    expect(stats.byMuscleGroup['chest']).toBe(1);
    expect(stats.byMuscleGroup['back']).toBe(1);
    expect(stats.byMuscleGroup['biceps']).toBe(1);
  });

  it('skips incomplete sessions', () => {
    const sessions = [makeSession({ completed_at: null })];
    const stats = calculateVolume(sessions, {});
    expect(stats.totalSessions).toBe(0);
  });

  it('skips exercises marked as skipped', () => {
    const sessions = [
      makeSession({
        exercises_completed: [
          makeCompletedExercise({ skipped: true, sets_completed: 5, reps_completed: 20 }),
        ],
      }),
    ];

    const stats = calculateVolume(sessions, {});
    expect(stats.totalExercises).toBe(0);
    expect(stats.totalSets).toBe(0);
    expect(stats.totalReps).toBe(0);
  });
});

describe('calculatePersonalRecords', () => {
  it('tracks max reps, sets, and duration per exercise', () => {
    const exerciseMap = makeExerciseMap([
      { id: 'ex-1', name: 'Push-up', muscle_groups: ['chest'] },
    ]);

    const sessions = [
      makeSession({
        id: 's1',
        completed_at: '2025-01-15T10:30:00.000Z',
        exercises_completed: [
          makeCompletedExercise({ exercise_id: 'ex-1', sets_completed: 3, reps_completed: 10, duration_actual: 60 }),
        ],
      }),
      makeSession({
        id: 's2',
        completed_at: '2025-01-16T10:30:00.000Z',
        exercises_completed: [
          makeCompletedExercise({ exercise_id: 'ex-1', sets_completed: 5, reps_completed: 15, duration_actual: 90 }),
        ],
      }),
    ];

    const records = calculatePersonalRecords(sessions, exerciseMap);
    expect(records).toHaveLength(1);
    expect(records[0].exerciseId).toBe('ex-1');
    expect(records[0].exerciseName).toBe('Push-up');
    expect(records[0].maxReps).toBe(15);
    expect(records[0].maxSets).toBe(5);
    expect(records[0].maxDuration).toBe(90);
  });

  it('skips incomplete sessions', () => {
    const sessions = [
      makeSession({ completed_at: null, exercises_completed: [makeCompletedExercise()] }),
    ];
    const records = calculatePersonalRecords(sessions, {});
    expect(records).toHaveLength(0);
  });

  it('skips skipped exercises', () => {
    const sessions = [
      makeSession({
        exercises_completed: [makeCompletedExercise({ skipped: true })],
      }),
    ];
    const records = calculatePersonalRecords(sessions, {});
    expect(records).toHaveLength(0);
  });

  it('shows "Unknown Exercise" when exercise not in map', () => {
    const sessions = [
      makeSession({
        exercises_completed: [makeCompletedExercise({ exercise_id: 'missing-ex' })],
      }),
    ];
    const records = calculatePersonalRecords(sessions, {});
    expect(records[0].exerciseName).toBe('Unknown Exercise');
  });
});

describe('getWeeklySummaries', () => {
  it('buckets sessions by week', () => {
    vi.useFakeTimers();
    const now = new Date('2025-01-15T12:00:00.000Z');
    vi.setSystemTime(now);

    const sessions = [
      // This week (within 7 days)
      makeSession({
        id: 's1',
        started_at: '2025-01-15T10:00:00.000Z',
        completed_at: '2025-01-15T10:30:00.000Z',
        exercises_completed: [makeCompletedExercise({ reps_completed: 20 })],
      }),
      // Last week (7-14 days ago)
      makeSession({
        id: 's2',
        started_at: '2025-01-08T10:00:00.000Z',
        completed_at: '2025-01-08T10:45:00.000Z',
        exercises_completed: [makeCompletedExercise({ reps_completed: 30 })],
      }),
    ];

    const summaries = getWeeklySummaries(sessions, 4);
    expect(summaries).toHaveLength(4);
    expect(summaries[0].label).toBe('This Week');
    expect(summaries[0].sessions).toBe(1);
    expect(summaries[0].totalReps).toBe(20);
    expect(summaries[1].label).toBe('Last Week');
    expect(summaries[1].sessions).toBe(1);
    expect(summaries[1].totalReps).toBe(30);

    vi.useRealTimers();
  });

  it('returns empty buckets for weeks with no sessions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    const summaries = getWeeklySummaries([], 4);
    expect(summaries).toHaveLength(4);
    for (const s of summaries) {
      expect(s.sessions).toBe(0);
      expect(s.totalReps).toBe(0);
    }

    vi.useRealTimers();
  });
});

describe('buildHistory', () => {
  it('creates one entry per completed session sorted newest first', () => {
    const sessions = [
      makeSession({
        id: 's1',
        workout_id: 'wk-1',
        started_at: '2025-01-14T10:00:00.000Z',
        completed_at: '2025-01-14T10:30:00.000Z',
        exercises_completed: [
          makeCompletedExercise({ reps_completed: 10 }),
          makeCompletedExercise({ exercise_id: 'ex-2', reps_completed: 8, skipped: true }),
        ],
      }),
      makeSession({
        id: 's2',
        workout_id: 'wk-2',
        started_at: '2025-01-15T10:00:00.000Z',
        completed_at: '2025-01-15T11:00:00.000Z',
        exercises_completed: [
          makeCompletedExercise({ reps_completed: 20 }),
        ],
      }),
    ];

    const titles: Record<string, string> = {
      'wk-1': 'Morning Push',
      'wk-2': 'Evening Pull',
    };

    const history = buildHistory(sessions, titles);
    expect(history).toHaveLength(2);
    // Newest first
    expect(history[0].sessionId).toBe('s2');
    expect(history[0].workoutTitle).toBe('Evening Pull');
    expect(history[0].durationMinutes).toBe(60);
    expect(history[0].totalReps).toBe(20);
    expect(history[0].exercisesCompleted).toBe(1);
    expect(history[0].exercisesTotal).toBe(1);

    expect(history[1].sessionId).toBe('s1');
    expect(history[1].workoutTitle).toBe('Morning Push');
    expect(history[1].durationMinutes).toBe(30);
    // Skipped exercises not counted in exercisesCompleted but counted in exercisesTotal
    expect(history[1].exercisesCompleted).toBe(1);
    expect(history[1].exercisesTotal).toBe(2);
    expect(history[1].totalReps).toBe(10);
  });

  it('skips incomplete sessions', () => {
    const sessions = [
      makeSession({ id: 's1', completed_at: null }),
    ];
    const history = buildHistory(sessions, {});
    expect(history).toHaveLength(0);
  });

  it('uses fallback "Workout" title when not in map', () => {
    const sessions = [
      makeSession({ id: 's1', workout_id: 'wk-unknown' }),
    ];
    const history = buildHistory(sessions, {});
    expect(history[0].workoutTitle).toBe('Workout');
  });
});

describe('calculateWeightPRs', () => {
  it('tracks maxWeight and max1RM per exercise', () => {
    const sets: SetWeightRow[] = [
      {
        id: 'set-1',
        sessionId: 'sess-1',
        exerciseId: 'ex-1',
        setNumber: 1,
        weight: 135,
        reps: 10,
        unit: 'lbs',
        estimated1rm: 180,
        createdAt: '2025-01-15T10:00:00.000Z',
      },
      {
        id: 'set-2',
        sessionId: 'sess-1',
        exerciseId: 'ex-1',
        setNumber: 2,
        weight: 155,
        reps: 5,
        unit: 'lbs',
        estimated1rm: 175,
        createdAt: '2025-01-15T10:05:00.000Z',
      },
    ];

    const prs = calculateWeightPRs(sets);
    const pr = prs.get('ex-1');
    expect(pr).toBeDefined();
    expect(pr!.maxWeight).toBe(155);
    expect(pr!.max1RM).toBe(180);
  });

  it('returns empty map for empty sets', () => {
    const prs = calculateWeightPRs([]);
    expect(prs.size).toBe(0);
  });

  it('tracks separate PRs per exercise', () => {
    const sets: SetWeightRow[] = [
      {
        id: 'set-1',
        sessionId: 'sess-1',
        exerciseId: 'ex-1',
        setNumber: 1,
        weight: 200,
        reps: 5,
        unit: 'lbs',
        estimated1rm: 230,
        createdAt: '2025-01-15T10:00:00.000Z',
      },
      {
        id: 'set-2',
        sessionId: 'sess-1',
        exerciseId: 'ex-2',
        setNumber: 1,
        weight: 100,
        reps: 10,
        unit: 'lbs',
        estimated1rm: 133,
        createdAt: '2025-01-15T10:05:00.000Z',
      },
    ];

    const prs = calculateWeightPRs(sets);
    expect(prs.size).toBe(2);
    expect(prs.get('ex-1')!.maxWeight).toBe(200);
    expect(prs.get('ex-2')!.maxWeight).toBe(100);
  });

  it('updates date when PR is beaten', () => {
    const sets: SetWeightRow[] = [
      {
        id: 'set-1',
        sessionId: 'sess-1',
        exerciseId: 'ex-1',
        setNumber: 1,
        weight: 135,
        reps: 10,
        unit: 'lbs',
        estimated1rm: 180,
        createdAt: '2025-01-10T10:00:00.000Z',
      },
      {
        id: 'set-2',
        sessionId: 'sess-2',
        exerciseId: 'ex-1',
        setNumber: 1,
        weight: 185,
        reps: 5,
        unit: 'lbs',
        estimated1rm: 210,
        createdAt: '2025-01-15T10:00:00.000Z',
      },
    ];

    const prs = calculateWeightPRs(sets);
    const pr = prs.get('ex-1');
    expect(pr!.date).toBe('2025-01-15T10:00:00.000Z');
  });
});
