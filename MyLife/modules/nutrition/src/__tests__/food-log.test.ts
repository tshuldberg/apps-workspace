import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { createFood } from '../db/foods';
import {
  createFoodLogEntry,
  getFoodLogEntries,
  getFoodLogEntryById,
  updateFoodLogEntry,
  deleteFoodLogEntry,
  addFoodLogItem,
  getFoodLogItems,
  updateFoodLogItem,
  deleteFoodLogItem,
  getDailyTotals,
  copyFoodLog,
} from '../db/food-log';
import { addMealTemplateItem, createMealTemplate, logMealTemplate } from '../db/meal-templates';

describe('food log', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    // Create test foods
    createFood(adapter, 'chicken', { name: 'Chicken', servingSize: 100, servingUnit: 'g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    createFood(adapter, 'rice', { name: 'Rice', servingSize: 100, servingUnit: 'g', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });
  });

  afterEach(() => {
    closeDb();
  });

  it('creates and retrieves a log entry', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    const entry = getFoodLogEntryById(adapter, 'log1');
    expect(entry).not.toBeNull();
    expect(entry!.mealType).toBe('lunch');
    expect(entry!.date).toBe('2024-01-15');
  });

  it('lists entries for a date', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'breakfast' });
    createFoodLogEntry(adapter, 'log2', { date: '2024-01-15', mealType: 'lunch' });
    createFoodLogEntry(adapter, 'log3', { date: '2024-01-16', mealType: 'breakfast' });
    const entries = getFoodLogEntries(adapter, '2024-01-15');
    expect(entries).toHaveLength(2);
  });

  it('updates a log entry', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    updateFoodLogEntry(adapter, 'log1', { notes: 'Great meal' });
    const entry = getFoodLogEntryById(adapter, 'log1');
    expect(entry!.notes).toBe('Great meal');
  });

  it('deletes a log entry and cascades to items', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    deleteFoodLogEntry(adapter, 'log1');
    expect(getFoodLogItems(adapter, 'log1')).toHaveLength(0);
  });

  it('adds and retrieves food log items', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', servingCount: 1.5, calories: 248, proteinG: 46.5, carbsG: 0, fatG: 5.4 });
    addFoodLogItem(adapter, 'item2', { logId: 'log1', foodId: 'rice', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });
    const items = getFoodLogItems(adapter, 'log1');
    expect(items).toHaveLength(2);
    expect(items[0].servingCount).toBe(1.5);
  });

  it('updates a food log item', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    updateFoodLogItem(adapter, 'item1', { servingCount: 2, calories: 330 });
    const items = getFoodLogItems(adapter, 'log1');
    expect(items[0].servingCount).toBe(2);
    expect(items[0].calories).toBe(330);
  });

  it('deletes a food log item', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    deleteFoodLogItem(adapter, 'item1');
    expect(getFoodLogItems(adapter, 'log1')).toHaveLength(0);
  });

  it('calculates daily totals correctly', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    createFoodLogEntry(adapter, 'log2', { date: '2024-01-15', mealType: 'dinner' });
    addFoodLogItem(adapter, 'item2', { logId: 'log2', foodId: 'rice', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });
    const totals = getDailyTotals(adapter, '2024-01-15');
    expect(totals.calories).toBe(295);
    expect(totals.proteinG).toBeCloseTo(33.7, 1);
    expect(totals.carbsG).toBe(28);
    expect(totals.fatG).toBeCloseTo(3.9, 1);
  });

  it('returns zero totals for empty date', () => {
    const totals = getDailyTotals(adapter, '2099-01-01');
    expect(totals.calories).toBe(0);
    expect(totals.proteinG).toBe(0);
  });

  it('logs a meal template into an existing meal entry', () => {
    createMealTemplate(adapter, 'template1', 'Lunch Bowl', 'lunch');
    addMealTemplateItem(adapter, 'template-item-1', 'template1', 'chicken', 1);
    addMealTemplateItem(adapter, 'template-item-2', 'template1', 'rice', 2);
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });

    const inserted = logMealTemplate(adapter, 'template1', 'lunch', '2024-01-15');

    expect(inserted).toBe(2);
    expect(getFoodLogItems(adapter, 'log1')).toHaveLength(2);
  });

  it('copies a day of logged meals into another date', () => {
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'breakfast', notes: 'Morning' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    createFoodLogEntry(adapter, 'log2', { date: '2024-01-15', mealType: 'dinner' });
    addFoodLogItem(adapter, 'item2', { logId: 'log2', foodId: 'rice', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });

    const copied = copyFoodLog(adapter, '2024-01-15', '2024-01-16');

    expect(copied).toBe(2);
    const nextEntries = getFoodLogEntries(adapter, '2024-01-16');
    expect(nextEntries).toHaveLength(2);
    expect(nextEntries[0].notes).toBe('Morning');
    const nextTotals = getDailyTotals(adapter, '2024-01-16');
    expect(nextTotals.calories).toBe(295);
    expect(nextTotals.proteinG).toBeCloseTo(33.7, 1);
  });
});
