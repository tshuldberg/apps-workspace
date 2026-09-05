import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  calculateBMR,
  applyActivityMultiplier,
  getNetCalories,
  upsertEnergyLog,
  getEnergyLog,
  getEnergyBalance,
  getWeeklyEnergyBalance,
  readActiveCaloriesFromHealth,
} from '../sync/energy-balance';
import { createFoodLogEntry, addFoodLogItem } from '../db/food-log';
import { createFood } from '../db/foods';

describe('energy balance', () => {
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

  describe('calculateBMR', () => {
    it('male 80kg, 180cm, 30yo = 1780 kcal', () => {
      const bmr = calculateBMR({
        weightKg: 80,
        heightCm: 180,
        age: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });
      expect(bmr).toBe(1780);
    });

    it('female 60kg, 165cm, 25yo = 1345.25 kcal', () => {
      // Mifflin-St Jeor: (10*60)+(6.25*165)-(5*25)-161 = 1345.25
      const bmr = calculateBMR({
        weightKg: 60,
        heightCm: 165,
        age: 25,
        sex: 'female',
        activityLevel: 'moderate',
      });
      expect(bmr).toBeCloseTo(1345.25, 1);
    });
  });

  describe('applyActivityMultiplier', () => {
    it('sedentary on 1780 = 2136', () => {
      expect(applyActivityMultiplier(1780, 'sedentary')).toBe(2136);
    });

    it('active on 1780 = 3071', () => {
      // 1780 * 1.725 = 3070.5, Math.round = 3071
      expect(applyActivityMultiplier(1780, 'active')).toBe(3071);
    });
  });

  describe('getNetCalories', () => {
    it('2000 in, 2500 out = -500', () => {
      expect(getNetCalories(2000, 2500)).toBe(-500);
    });

    it('2500 in, 2000 out = +500', () => {
      expect(getNetCalories(2500, 2000)).toBe(500);
    });
  });

  describe('upsertEnergyLog', () => {
    it('creates new entry for date with no existing data', () => {
      upsertEnergyLog(db, 'e1', {
        date: '2026-03-22',
        basalCalories: 1780,
        activeCalories: 500,
      });
      const entry = getEnergyLog(db, '2026-03-22');
      expect(entry).not.toBeNull();
      expect(entry!.basalCalories).toBe(1780);
      expect(entry!.activeCalories).toBe(500);
      expect(entry!.totalExpenditure).toBe(2280);
      expect(entry!.source).toBe('calculated');
    });

    it('updates existing entry for same date', () => {
      upsertEnergyLog(db, 'e1', {
        date: '2026-03-22',
        basalCalories: 1780,
        activeCalories: 500,
      });
      upsertEnergyLog(db, 'e2', {
        date: '2026-03-22',
        basalCalories: 1800,
        activeCalories: 600,
        source: 'healthkit',
      });
      const entry = getEnergyLog(db, '2026-03-22');
      expect(entry!.basalCalories).toBe(1800);
      expect(entry!.activeCalories).toBe(600);
      expect(entry!.totalExpenditure).toBe(2400);
      expect(entry!.source).toBe('healthkit');
    });
  });

  describe('getWeeklyEnergyBalance', () => {
    it('returns 7 days of in/out/net data', () => {
      upsertEnergyLog(db, 'e1', {
        date: '2026-03-22',
        basalCalories: 1700,
        activeCalories: 300,
      });

      const weekly = getWeeklyEnergyBalance(db, '2026-03-22');
      expect(weekly).toHaveLength(7);

      const today = weekly.find(d => d.date === '2026-03-22');
      expect(today?.totalExpenditure).toBe(2000);
    });
  });

  describe('readActiveCaloriesFromHealth', () => {
    it('returns null when health module disabled', () => {
      const result = readActiveCaloriesFromHealth(db, '2026-03-22');
      expect(result).toBeNull();
    });
  });

  describe('energy balance with food intake', () => {
    it('calculates net calories correctly', () => {
      // Log energy expenditure
      upsertEnergyLog(db, 'e1', {
        date: '2026-03-22',
        basalCalories: 1700,
        activeCalories: 300,
      });

      // Create a food and log it
      createFood(db, 'f1', {
        name: 'Test Food',
        servingSize: 1,
        servingUnit: 'serving',
        calories: 500,
      });
      createFoodLogEntry(db, 'log1', {
        date: '2026-03-22',
        mealType: 'lunch',
      });
      addFoodLogItem(db, 'item1', {
        logId: 'log1',
        foodId: 'f1',
        calories: 500,
        proteinG: 20,
        carbsG: 50,
        fatG: 15,
      });

      // Check energy balance
      const balance = getEnergyBalance(db, '2026-03-22');
      expect(balance.caloriesIn).toBe(500);
      expect(balance.caloriesOut).toBe(2000);
      expect(balance.net).toBe(-1500);
    });
  });
});
