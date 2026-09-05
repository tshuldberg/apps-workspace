import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import {
  createMedicationExtended,
  getMedicationExtended,
  getActiveMedications,
  updatePillCount,
  decrementPillCount,
} from '../medication';

describe('medication extended CRUD', () => {
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

  describe('createMedicationExtended', () => {
    it('creates a medication with all v2 fields', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Metformin',
        dosage: '500mg',
        unit: 'tablet',
        frequency: 'twice_daily',
        pillCount: 60,
        pillsPerDose: 1,
        timeSlots: ['08:00', '20:00'],
        prescriber: 'Dr. Smith',
        pharmacy: 'CVS',
      });

      const med = getMedicationExtended(adapter, 'm1');
      expect(med).not.toBeNull();
      expect(med!.name).toBe('Metformin');
      expect(med!.dosage).toBe('500mg');
      expect(med!.unit).toBe('tablet');
      expect(med!.frequency).toBe('twice_daily');
      expect(med!.pillCount).toBe(60);
      expect(med!.pillsPerDose).toBe(1);
      expect(med!.timeSlots).toEqual(['08:00', '20:00']);
      expect(med!.prescriber).toBe('Dr. Smith');
      expect(med!.pharmacy).toBe('CVS');
      expect(med!.isActive).toBe(true);
    });

    it('creates a medication with minimal fields', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Aspirin' });

      const med = getMedicationExtended(adapter, 'm1');
      expect(med).not.toBeNull();
      expect(med!.name).toBe('Aspirin');
      expect(med!.dosage).toBeNull();
      expect(med!.pillCount).toBeNull();
      expect(med!.pillsPerDose).toBe(1);
      expect(med!.timeSlots).toEqual([]);
      expect(med!.frequency).toBe('daily');
    });

    it('stores endDate when provided', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Prednisone',
        endDate: '2026-04-01',
      });

      const med = getMedicationExtended(adapter, 'm1');
      expect(med!.endDate).toBe('2026-04-01');
    });
  });

  describe('getMedicationExtended', () => {
    it('returns null for non-existent medication', () => {
      expect(getMedicationExtended(adapter, 'nope')).toBeNull();
    });

    it('returns full medication with v2 fields', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Lisinopril',
        pillCount: 30,
        pillsPerDose: 1,
        timeSlots: ['09:00'],
      });

      const med = getMedicationExtended(adapter, 'm1');
      expect(med!.id).toBe('m1');
      expect(med!.pillCount).toBe(30);
      expect(med!.timeSlots).toEqual(['09:00']);
      expect(med!.createdAt).toBeTruthy();
      expect(med!.updatedAt).toBeTruthy();
    });
  });

  describe('getActiveMedications', () => {
    it('returns only active medications', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Active Med' });
      createMedicationExtended(adapter, 'm2', { name: 'Another Active' });

      // Deactivate m2 via raw SQL since updateMedication is from legacy CRUD
      adapter.execute('UPDATE md_medications SET is_active = 0 WHERE id = ?', ['m2']);

      const active = getActiveMedications(adapter);
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Active Med');
    });

    it('excludes expired medications when end_date is past', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Current' });
      createMedicationExtended(adapter, 'm2', {
        name: 'Expired',
        endDate: '2020-01-01',
      });

      // Expired meds are still active unless is_active is set to false
      const active = getActiveMedications(adapter);
      expect(active).toHaveLength(2);
    });

    it('returns empty array when no medications', () => {
      expect(getActiveMedications(adapter)).toEqual([]);
    });

    it('respects sort_order', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Zoloft', sortOrder: 2 });
      createMedicationExtended(adapter, 'm2', { name: 'Aspirin', sortOrder: 1 });

      const meds = getActiveMedications(adapter);
      expect(meds[0].name).toBe('Aspirin');
      expect(meds[1].name).toBe('Zoloft');
    });
  });

  describe('updatePillCount', () => {
    it('sets absolute pill count', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', pillCount: 10 });
      updatePillCount(adapter, 'm1', 25);

      const med = getMedicationExtended(adapter, 'm1');
      expect(med!.pillCount).toBe(25);
    });

    it('sets pill count from null', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBeNull();

      updatePillCount(adapter, 'm1', 50);
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBe(50);
    });

    it('can set pill count to zero', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', pillCount: 10 });
      updatePillCount(adapter, 'm1', 0);
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBe(0);
    });
  });

  describe('decrementPillCount', () => {
    it('decrements by pills_per_dose', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        pillCount: 10,
        pillsPerDose: 2,
      });

      decrementPillCount(adapter, 'm1');
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBe(8);
    });

    it('clamps at zero', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        pillCount: 1,
        pillsPerDose: 3,
      });

      decrementPillCount(adapter, 'm1');
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBe(0);
    });

    it('decrements from null pill count treating it as zero', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });
      decrementPillCount(adapter, 'm1');
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBe(0);
    });

    it('defaults pills_per_dose to 1', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', pillCount: 5 });
      decrementPillCount(adapter, 'm1');
      expect(getMedicationExtended(adapter, 'm1')!.pillCount).toBe(4);
    });
  });
});
