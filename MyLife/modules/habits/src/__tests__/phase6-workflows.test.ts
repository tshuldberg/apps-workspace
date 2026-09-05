import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HABITS_MODULE } from '../definition';
import { createHabit, getHabitById, recordCompletion } from '../db/crud';
import {
  createHabitStack,
  getHabitStacks,
  getStackAnalytics,
  getStackSuggestions,
  updateHabitStack,
} from '../db/stacking';
import {
  enrollInProgram,
  getEnrolledPrograms,
  getProgramProgress,
  getPrograms,
  unenrollFromProgram,
} from '../db/challenges';

describe('Phase 6 workflows', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates, updates, and analyzes habit stacks', () => {
    createHabit(adapter, 'coffee', { name: 'Brew coffee', timeOfDay: 'morning', icon: '☕' });
    createHabit(adapter, 'journal', { name: 'Journal', timeOfDay: 'morning', icon: '📓' });
    createHabit(adapter, 'vitamins', { name: 'Take vitamins', timeOfDay: 'morning', icon: '💊' });
    createHabit(adapter, 'stretch', { name: 'Stretch', timeOfDay: 'morning', icon: '🤸' });
    createHabit(adapter, 'read', { name: 'Read', timeOfDay: 'morning', icon: '📚' });

    createHabitStack(adapter, {
      habitIds: ['coffee', 'journal', 'vitamins'],
    });

    let stacks = getHabitStacks(adapter);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].habitIds).toEqual(['coffee', 'journal', 'vitamins']);

    updateHabitStack(adapter, 'coffee', {
      habitIds: ['coffee', 'vitamins', 'journal'],
    });

    stacks = getHabitStacks(adapter);
    expect(stacks[0].habitIds).toEqual(['coffee', 'vitamins', 'journal']);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    recordCompletion(adapter, 'c1', 'coffee', `${today}T07:00:00Z`, 1);
    recordCompletion(adapter, 'c2', 'coffee', `${yesterday}T07:00:00Z`, 1);
    recordCompletion(adapter, 'c3', 'vitamins', `${today}T07:15:00Z`, 1);

    const analytics = getStackAnalytics(adapter);
    expect(analytics).toHaveLength(1);
    expect(analytics[0].chainBreaks).toHaveLength(2);
    expect(analytics[0].chainBreaks[0].completionRate).toBe(50);

    const suggestions = getStackSuggestions(adapter);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].habitIds.length).toBeGreaterThanOrEqual(2);
  });

  it('enrolls in built-in programs and tracks progress', () => {
    const programs = getPrograms(adapter);
    expect(programs).toHaveLength(8);

    const enrollment = enrollInProgram(adapter, 'builtin_morning_routine');
    expect(enrollment).not.toBeNull();

    const enrolledPrograms = getEnrolledPrograms(adapter);
    expect(enrolledPrograms).toHaveLength(1);
    expect(enrolledPrograms[0].status).toBe('active');
    expect(enrolledPrograms[0].habitIds).toHaveLength(4);

    const firstHabit = getHabitById(adapter, enrolledPrograms[0].habitIds[0]);
    expect(firstHabit?.name).toBe('Drink Water');

    recordCompletion(
      adapter,
      'complete-1',
      enrolledPrograms[0].habitIds[0],
      `${new Date().toISOString().slice(0, 10)}T08:00:00Z`,
      1,
    );

    const progress = getProgramProgress(adapter, 'builtin_morning_routine');
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe('active');
    expect(progress?.days).toHaveLength(28);
    expect(progress?.completedDays).toBeGreaterThanOrEqual(1);

    unenrollFromProgram(adapter, 'builtin_morning_routine');

    const afterUnenroll = getEnrolledPrograms(adapter);
    expect(afterUnenroll).toHaveLength(1);
    expect(afterUnenroll[0].status).toBe('abandoned');
  });
});
