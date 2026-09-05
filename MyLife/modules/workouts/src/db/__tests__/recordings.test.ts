import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import type { WorkoutExerciseEntry } from '../../types';
import {
  createWorkout,
  createWorkoutSession,
  createWorkoutFormRecording,
  getWorkoutFormRecordings,
  deleteWorkoutFormRecording,
} from '../crud';

function seedDependencies(db: DatabaseAdapter): void {
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
  ];
  createWorkout(db, 'w-1', {
    title: 'Test Workout',
    difficulty: 'beginner',
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

describe('@mylife/workouts - recordings', () => {
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

  // ── createWorkoutFormRecording ──

  it('creates a form recording', () => {
    createWorkoutFormRecording(adapter, 'r-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///videos/pushup.mp4',
      timestampStart: 0,
      timestampEnd: 30,
    });

    const recordings = getWorkoutFormRecordings(adapter);
    expect(recordings).toHaveLength(1);
    expect(recordings[0].id).toBe('r-1');
    expect(recordings[0].sessionId).toBe('s-1');
    expect(recordings[0].exerciseId).toBe('ex-1');
    expect(recordings[0].videoUrl).toBe('file:///videos/pushup.mp4');
    expect(recordings[0].timestampStart).toBe(0);
    expect(recordings[0].timestampEnd).toBe(30);
  });

  it('creates a recording with coach feedback', () => {
    createWorkoutFormRecording(adapter, 'r-feedback', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///videos/squat.mp4',
      timestampStart: 10,
      timestampEnd: 45,
      coachFeedback: [
        {
          timestamp: 15,
          comment: 'Keep your back straight',
          coachId: 'coach-1',
          createdAt: '2026-03-01T09:00:00.000Z',
        },
      ],
    });

    const recordings = getWorkoutFormRecordings(adapter);
    expect(recordings[0].coachFeedback).toHaveLength(1);
    expect(recordings[0].coachFeedback[0].comment).toBe('Keep your back straight');
  });

  it('defaults coachFeedback to empty array', () => {
    createWorkoutFormRecording(adapter, 'r-no-feedback', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///videos/lunge.mp4',
      timestampStart: 0,
      timestampEnd: 20,
    });

    const recordings = getWorkoutFormRecordings(adapter);
    expect(recordings[0].coachFeedback).toEqual([]);
  });

  // ── getWorkoutFormRecordings filters ──

  it('filters recordings by sessionId', () => {
    createWorkoutFormRecording(adapter, 'r-s1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///a.mp4',
      timestampStart: 0,
      timestampEnd: 10,
    });
    createWorkoutFormRecording(adapter, 'r-s2', {
      sessionId: 's-2',
      exerciseId: 'ex-1',
      videoUrl: 'file:///b.mp4',
      timestampStart: 0,
      timestampEnd: 10,
    });

    const s1Recordings = getWorkoutFormRecordings(adapter, { sessionId: 's-1' });
    expect(s1Recordings).toHaveLength(1);
    expect(s1Recordings[0].sessionId).toBe('s-1');
  });

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      createWorkoutFormRecording(adapter, `r-lim-${i}`, {
        sessionId: 's-1',
        exerciseId: 'ex-1',
        videoUrl: `file:///vid-${i}.mp4`,
        timestampStart: 0,
        timestampEnd: 10,
      });
    }

    const limited = getWorkoutFormRecordings(adapter, { limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('returns all recordings with no filters', () => {
    createWorkoutFormRecording(adapter, 'r-all-1', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///x.mp4',
      timestampStart: 0,
      timestampEnd: 15,
    });
    createWorkoutFormRecording(adapter, 'r-all-2', {
      sessionId: 's-2',
      exerciseId: 'ex-1',
      videoUrl: 'file:///y.mp4',
      timestampStart: 0,
      timestampEnd: 15,
    });

    const all = getWorkoutFormRecordings(adapter);
    expect(all).toHaveLength(2);
  });

  // ── deleteWorkoutFormRecording ──

  it('deletes a recording by id', () => {
    createWorkoutFormRecording(adapter, 'r-del', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///delete-me.mp4',
      timestampStart: 0,
      timestampEnd: 10,
    });

    deleteWorkoutFormRecording(adapter, 'r-del');

    const recordings = getWorkoutFormRecordings(adapter);
    expect(recordings).toHaveLength(0);
  });

  it('delete is a no-op for nonexistent recording', () => {
    expect(() => deleteWorkoutFormRecording(adapter, 'nonexistent')).not.toThrow();
  });

  it('deleting one recording does not affect others', () => {
    createWorkoutFormRecording(adapter, 'r-keep', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///keep.mp4',
      timestampStart: 0,
      timestampEnd: 10,
    });
    createWorkoutFormRecording(adapter, 'r-remove', {
      sessionId: 's-1',
      exerciseId: 'ex-1',
      videoUrl: 'file:///remove.mp4',
      timestampStart: 10,
      timestampEnd: 20,
    });

    deleteWorkoutFormRecording(adapter, 'r-remove');

    const remaining = getWorkoutFormRecordings(adapter);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('r-keep');
  });
});
