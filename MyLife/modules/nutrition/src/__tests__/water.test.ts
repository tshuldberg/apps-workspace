import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  createWaterEntry,
  getWaterEntriesForDate,
  getDailyWaterTotal,
  deleteWaterEntry,
  getWaterEntriesInRange,
  updateWaterEntry,
} from '../water/crud';
import {
  convertMlToOz,
  convertOzToMl,
  getWaterGoalMl,
  getWaterContainers,
  getWeeklyWaterTotals,
} from '../water/goals';
import { setSetting } from '../db/settings';

describe('water tracking', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('createWaterEntry', () => {
    it('stores amount_ml, date, and source', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 250, source: 'quick_add' });
      const entries = getWaterEntriesForDate(db, '2026-03-22');
      expect(entries).toHaveLength(1);
      expect(entries[0].amountMl).toBe(250);
      expect(entries[0].source).toBe('quick_add');
      expect(entries[0].date).toBe('2026-03-22');
    });

    it('defaults source to manual', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 500 });
      const entries = getWaterEntriesForDate(db, '2026-03-22');
      expect(entries[0].source).toBe('manual');
    });
  });

  describe('getWaterEntriesForDate', () => {
    it('returns all entries for a given date', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 250 });
      createWaterEntry(db, 'w2', { date: '2026-03-22', amountMl: 500 });
      createWaterEntry(db, 'w3', { date: '2026-03-23', amountMl: 750 });

      const entries = getWaterEntriesForDate(db, '2026-03-22');
      expect(entries).toHaveLength(2);
    });

    it('returns empty array for date with no entries', () => {
      const entries = getWaterEntriesForDate(db, '2026-01-01');
      expect(entries).toHaveLength(0);
    });
  });

  describe('getDailyWaterTotal', () => {
    it('sums amount_ml correctly', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 250 });
      createWaterEntry(db, 'w2', { date: '2026-03-22', amountMl: 500 });
      expect(getDailyWaterTotal(db, '2026-03-22')).toBe(750);
    });

    it('returns 0 for date with no entries', () => {
      expect(getDailyWaterTotal(db, '2026-01-01')).toBe(0);
    });
  });

  describe('deleteWaterEntry', () => {
    it('removes entry and total recalculates', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 250 });
      createWaterEntry(db, 'w2', { date: '2026-03-22', amountMl: 500 });
      expect(getDailyWaterTotal(db, '2026-03-22')).toBe(750);

      deleteWaterEntry(db, 'w1');
      expect(getDailyWaterTotal(db, '2026-03-22')).toBe(500);
      expect(getWaterEntriesForDate(db, '2026-03-22')).toHaveLength(1);
    });
  });

  describe('updateWaterEntry', () => {
    it('updates the amount for an existing entry', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 250 });
      updateWaterEntry(db, 'w1', { amountMl: 750, source: 'quick_add' });

      const entries = getWaterEntriesForDate(db, '2026-03-22');
      expect(entries[0].amountMl).toBe(750);
      expect(entries[0].source).toBe('quick_add');
    });
  });

  describe('unit conversion', () => {
    it('convertMlToOz: 250ml is approximately 8.45oz', () => {
      expect(convertMlToOz(250)).toBeCloseTo(8.45, 1);
    });

    it('convertOzToMl: 8oz is approximately 236.59ml', () => {
      expect(convertOzToMl(8)).toBeCloseTo(236.59, 0);
    });
  });

  describe('getWaterGoalMl', () => {
    it('returns default 2500 from seeded settings', () => {
      expect(getWaterGoalMl(db)).toBe(2500);
    });

    it('returns custom goal after update', () => {
      setSetting(db, 'waterGoalMl', '3000');
      expect(getWaterGoalMl(db)).toBe(3000);
    });

    it('enforces minimum 500ml', () => {
      setSetting(db, 'waterGoalMl', '100');
      expect(getWaterGoalMl(db)).toBe(2500);
    });
  });

  describe('getWaterContainers', () => {
    it('returns default containers from seeded settings', () => {
      expect(getWaterContainers(db)).toEqual([250, 500, 750]);
    });

    it('returns custom containers after update', () => {
      setSetting(db, 'waterContainersMl', '[200, 350, 500, 1000]');
      expect(getWaterContainers(db)).toEqual([200, 350, 500, 1000]);
    });
  });

  describe('getWeeklyWaterTotals', () => {
    it('returns 7 daily totals for the past week', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-22', amountMl: 2000 });
      createWaterEntry(db, 'w2', { date: '2026-03-21', amountMl: 1500 });

      const weekly = getWeeklyWaterTotals(db, '2026-03-22');
      expect(weekly.days).toHaveLength(7);
      expect(weekly.goalMl).toBe(2500);

      const today = weekly.days.find(d => d.date === '2026-03-22');
      expect(today?.totalMl).toBe(2000);

      const yesterday = weekly.days.find(d => d.date === '2026-03-21');
      expect(yesterday?.totalMl).toBe(1500);
    });
  });

  describe('getWaterEntriesInRange', () => {
    it('returns entries across an inclusive date range', () => {
      createWaterEntry(db, 'w1', { date: '2026-03-20', amountMl: 200 });
      createWaterEntry(db, 'w2', { date: '2026-03-21', amountMl: 300 });
      createWaterEntry(db, 'w3', { date: '2026-03-24', amountMl: 400 });

      const range = getWaterEntriesInRange(db, '2026-03-20', '2026-03-21');
      expect(range.map((entry) => entry.id)).toEqual(['w1', 'w2']);
    });
  });
});
