import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import {
  seedWorkoutExerciseLibrary,
  getWorkoutExercises,
  getWorkoutExerciseById,
  getWorkoutExerciseCount,
  getWorkoutCategoryCounts,
} from '../crud';

describe('@mylife/workouts - exercises', () => {
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

  // ── Seeding ──

  it('seeds the exercise library and returns the count', () => {
    const seeded = seedWorkoutExerciseLibrary(adapter);
    expect(seeded).toBe(50);
  });

  it('is idempotent -- second seed returns 0', () => {
    seedWorkoutExerciseLibrary(adapter);
    const second = seedWorkoutExerciseLibrary(adapter);
    expect(second).toBe(0);
  });

  it('exercise count matches seeded total', () => {
    seedWorkoutExerciseLibrary(adapter);
    expect(getWorkoutExerciseCount(adapter)).toBe(50);
  });

  it('count is 0 before seeding', () => {
    expect(getWorkoutExerciseCount(adapter)).toBe(0);
  });

  // ── getWorkoutExercises filters ──

  it('returns all exercises with no filters', () => {
    seedWorkoutExerciseLibrary(adapter);
    const all = getWorkoutExercises(adapter);
    expect(all.length).toBe(50);
  });

  it('filters by category', () => {
    seedWorkoutExerciseLibrary(adapter);
    const strength = getWorkoutExercises(adapter, { category: 'strength' });
    expect(strength.length).toBeGreaterThan(0);
    expect(strength.every((e) => e.category === 'strength')).toBe(true);
  });

  it('filters by difficulty', () => {
    seedWorkoutExerciseLibrary(adapter);
    const beginner = getWorkoutExercises(adapter, { difficulty: 'beginner' });
    expect(beginner.length).toBeGreaterThan(0);
    expect(beginner.every((e) => e.difficulty === 'beginner')).toBe(true);
  });

  it('filters by search text (case insensitive)', () => {
    seedWorkoutExerciseLibrary(adapter);
    const results = getWorkoutExercises(adapter, { search: 'push' });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (e) =>
          e.name.toLowerCase().includes('push') ||
          e.description.toLowerCase().includes('push'),
      ),
    ).toBe(true);
  });

  it('filters by muscleGroups', () => {
    seedWorkoutExerciseLibrary(adapter);
    const results = getWorkoutExercises(adapter, { muscleGroups: ['chest'] });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.muscleGroups.includes('chest'))).toBe(true);
  });

  it('respects limit option', () => {
    seedWorkoutExerciseLibrary(adapter);
    const limited = getWorkoutExercises(adapter, { limit: 5 });
    expect(limited.length).toBe(5);
  });

  it('combines multiple filters', () => {
    seedWorkoutExerciseLibrary(adapter);
    const results = getWorkoutExercises(adapter, {
      category: 'strength',
      difficulty: 'beginner',
      limit: 3,
    });
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results.every((e) => e.category === 'strength' && e.difficulty === 'beginner')).toBe(
      true,
    );
  });

  // ── getWorkoutExerciseById ──

  it('returns an exercise by id', () => {
    seedWorkoutExerciseLibrary(adapter);
    const all = getWorkoutExercises(adapter, { limit: 1 });
    const exercise = getWorkoutExerciseById(adapter, all[0].id);
    expect(exercise).not.toBeNull();
    expect(exercise!.id).toBe(all[0].id);
    expect(exercise!.name).toBe(all[0].name);
  });

  it('returns null for missing exercise id', () => {
    seedWorkoutExerciseLibrary(adapter);
    expect(getWorkoutExerciseById(adapter, 'nonexistent-id')).toBeNull();
  });

  // ── getWorkoutCategoryCounts ──

  it('returns category counts matching seeded data', () => {
    seedWorkoutExerciseLibrary(adapter);
    const counts = getWorkoutCategoryCounts(adapter);
    expect(counts.length).toBeGreaterThan(0);

    const totalFromCounts = counts.reduce((sum, c) => sum + c.count, 0);
    expect(totalFromCounts).toBe(50);

    // Each count entry has a valid category and positive count
    for (const entry of counts) {
      expect(entry.category).toBeTruthy();
      expect(entry.count).toBeGreaterThan(0);
    }
  });

  it('returns empty array when no exercises exist', () => {
    const counts = getWorkoutCategoryCounts(adapter);
    expect(counts).toEqual([]);
  });
});
