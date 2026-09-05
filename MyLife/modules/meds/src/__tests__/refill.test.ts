import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import {
  createMedicationExtended,
  getMedicationExtended,
  recordRefill,
  getRefillHistory,
  calculateBurnRate,
  getDaysRemaining,
  getLowSupplyAlerts,
} from '..';

describe('refill tracking', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('recordRefill', () => {
    it('inserts a refill and adds quantity to pill_count', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Lisinopril', pillCount: 5 });

      recordRefill(adapter, 'r1', {
        medicationId: 'm1',
        quantity: 30,
        pharmacy: 'Walgreens',
        notes: 'Monthly refill',
      });

      const med = getMedicationExtended(adapter, 'm1');
      expect(med!.pillCount).toBe(35); // 5 + 30

      const history = getRefillHistory(adapter, 'm1');
      expect(history).toHaveLength(1);
      expect(history[0].quantity).toBe(30);
      expect(history[0].pharmacy).toBe('Walgreens');
      expect(history[0].notes).toBe('Monthly refill');
    });

    it('adds to null pill_count treating it as zero', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      recordRefill(adapter, 'r1', { medicationId: 'm1', quantity: 60 });

      const med = getMedicationExtended(adapter, 'm1');
      expect(med!.pillCount).toBe(60);
    });

    it('records refill with custom refill date', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', pillCount: 0 });

      recordRefill(adapter, 'r1', {
        medicationId: 'm1',
        quantity: 90,
        refillDate: '2026-02-01',
      });

      const history = getRefillHistory(adapter, 'm1');
      expect(history[0].refillDate).toBe('2026-02-01');
    });
  });

  describe('getRefillHistory', () => {
    it('returns newest first', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', pillCount: 0 });

      recordRefill(adapter, 'r1', {
        medicationId: 'm1',
        quantity: 30,
        refillDate: '2026-01-01',
      });
      recordRefill(adapter, 'r2', {
        medicationId: 'm1',
        quantity: 30,
        refillDate: '2026-02-01',
      });

      const history = getRefillHistory(adapter, 'm1');
      expect(history).toHaveLength(2);
      expect(history[0].refillDate).toBe('2026-02-01');
      expect(history[1].refillDate).toBe('2026-01-01');
    });

    it('returns empty array for no refills', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });
      expect(getRefillHistory(adapter, 'm1')).toEqual([]);
    });
  });

  describe('calculateBurnRate', () => {
    it('returns pills_per_dose * doses_per_day for daily', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        pillsPerDose: 2,
      });
      expect(calculateBurnRate(adapter, 'm1')).toBe(2);
    });

    it('returns pills_per_dose * 2 for twice_daily', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'twice_daily',
        pillsPerDose: 1,
      });
      expect(calculateBurnRate(adapter, 'm1')).toBe(2);
    });

    it('returns pills_per_dose / 7 for weekly', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'weekly',
        pillsPerDose: 1,
      });
      expect(calculateBurnRate(adapter, 'm1')).toBeCloseTo(1 / 7);
    });

    it('returns 0 for as_needed', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'as_needed',
      });
      expect(calculateBurnRate(adapter, 'm1')).toBe(0);
    });

    it('returns 0 for non-existent medication', () => {
      expect(calculateBurnRate(adapter, 'nope')).toBe(0);
    });
  });

  describe('getDaysRemaining', () => {
    it('returns pill_count / burn_rate', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        pillsPerDose: 1,
        pillCount: 30,
      });
      expect(getDaysRemaining(adapter, 'm1')).toBe(30);
    });

    it('returns null when no pill count set', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
      });
      expect(getDaysRemaining(adapter, 'm1')).toBeNull();
    });

    it('returns Infinity for as_needed medications', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'as_needed',
        pillCount: 10,
      });
      expect(getDaysRemaining(adapter, 'm1')).toBe(Infinity);
    });

    it('returns null for non-existent medication', () => {
      expect(getDaysRemaining(adapter, 'nope')).toBeNull();
    });

    it('floors the result', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        pillsPerDose: 3,
        pillCount: 10,
      });
      // 10 / 3 = 3.33... floors to 3
      expect(getDaysRemaining(adapter, 'm1')).toBe(3);
    });
  });

  describe('getLowSupplyAlerts', () => {
    it('returns medications below threshold', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Low Med',
        frequency: 'daily',
        pillsPerDose: 1,
        pillCount: 3,
      });
      createMedicationExtended(adapter, 'm2', {
        name: 'Full Med',
        frequency: 'daily',
        pillsPerDose: 1,
        pillCount: 30,
      });

      const alerts = getLowSupplyAlerts(adapter, 7);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].name).toBe('Low Med');
      expect(alerts[0].daysRemaining).toBe(3);
    });

    it('uses default threshold of 7 days', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        pillsPerDose: 1,
        pillCount: 5,
      });

      const alerts = getLowSupplyAlerts(adapter);
      expect(alerts).toHaveLength(1);
    });

    it('skips as_needed medications', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'PRN Med',
        frequency: 'as_needed',
        pillCount: 2,
      });

      const alerts = getLowSupplyAlerts(adapter);
      expect(alerts).toHaveLength(0);
    });

    it('skips medications without pill count', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'No Count',
        frequency: 'daily',
      });

      const alerts = getLowSupplyAlerts(adapter);
      expect(alerts).toHaveLength(0);
    });

    it('skips inactive medications', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Inactive',
        frequency: 'daily',
        pillsPerDose: 1,
        pillCount: 1,
      });
      adapter.execute('UPDATE md_medications SET is_active = 0 WHERE id = ?', ['m1']);

      const alerts = getLowSupplyAlerts(adapter);
      expect(alerts).toHaveLength(0);
    });
  });
});
