import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  createDailyGoals,
  getDailyGoals,
  getActiveGoals,
  updateDailyGoals,
  deleteDailyGoals,
} from '../db/goals';

describe('daily goals', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates and retrieves goals', () => {
    createDailyGoals(adapter, 'g1', { calories: 2000, proteinG: 150, carbsG: 250, fatG: 67, effectiveDate: '2024-01-01' });
    const goals = getDailyGoals(adapter);
    expect(goals).toHaveLength(1);
    expect(goals[0].calories).toBe(2000);
  });

  it('gets active goals for a date', () => {
    createDailyGoals(adapter, 'g1', { calories: 2000, proteinG: 150, carbsG: 250, fatG: 67, effectiveDate: '2024-01-01' });
    createDailyGoals(adapter, 'g2', { calories: 2500, proteinG: 180, carbsG: 300, fatG: 80, effectiveDate: '2024-06-01' });
    const active = getActiveGoals(adapter, '2024-03-15');
    expect(active).not.toBeNull();
    expect(active!.calories).toBe(2000);

    const active2 = getActiveGoals(adapter, '2024-08-01');
    expect(active2).not.toBeNull();
    expect(active2!.calories).toBe(2500);
  });

  it('returns null when no goals exist', () => {
    expect(getActiveGoals(adapter, '2024-01-01')).toBeNull();
  });

  it('updates goals', () => {
    createDailyGoals(adapter, 'g1', { calories: 2000, proteinG: 150, carbsG: 250, fatG: 67, effectiveDate: '2024-01-01' });
    updateDailyGoals(adapter, 'g1', { calories: 2200, proteinG: 170 });
    const goals = getDailyGoals(adapter);
    expect(goals[0].calories).toBe(2200);
    expect(goals[0].proteinG).toBe(170);
  });

  it('deletes goals', () => {
    createDailyGoals(adapter, 'g1', { calories: 2000, proteinG: 150, carbsG: 250, fatG: 67, effectiveDate: '2024-01-01' });
    deleteDailyGoals(adapter, 'g1');
    expect(getDailyGoals(adapter)).toHaveLength(0);
  });
});
