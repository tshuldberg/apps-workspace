import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import {
  createMedication,
  getMedications,
  getMedicationById,
  updateMedication,
  deleteMedication,
  countMedications,
  recordDose,
  getDoses,
  getDosesForDate,
  deleteDose,
  getAdherenceRate,
  getSetting,
  setSetting,
} from '../db/crud';

describe('@mylife/meds', () => {
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

  describe('MEDS_MODULE definition', () => {
    it('has correct metadata', () => {
      expect(MEDS_MODULE.id).toBe('meds');
      expect(MEDS_MODULE.tier).toBe('premium');
      expect(MEDS_MODULE.storageType).toBe('sqlite');
      expect(MEDS_MODULE.tablePrefix).toBe('md_');
    });

    it('has 5 navigation tabs', () => {
      expect(MEDS_MODULE.navigation.tabs).toHaveLength(5);
    });
  });

  describe('seeded data', () => {
    it('has default settings', () => {
      expect(getSetting(adapter, 'reminderTime')).toBe('08:00');
    });
  });

  describe('medications CRUD', () => {
    it('starts empty', () => {
      expect(countMedications(adapter)).toBe(0);
    });

    it('creates and retrieves a medication', () => {
      createMedication(adapter, 'm1', { name: 'Ibuprofen', dosage: '200mg', unit: 'tablet' });
      expect(countMedications(adapter)).toBe(1);
      const m = getMedicationById(adapter, 'm1');
      expect(m).not.toBeNull();
      expect(m!.name).toBe('Ibuprofen');
      expect(m!.frequency).toBe('daily');
      expect(m!.isActive).toBe(true);
    });

    it('lists medications filtering by active', () => {
      createMedication(adapter, 'm1', { name: 'Active Med' });
      createMedication(adapter, 'm2', { name: 'Inactive Med' });
      updateMedication(adapter, 'm2', { isActive: false });
      expect(getMedications(adapter, { isActive: true })).toHaveLength(1);
      expect(getMedications(adapter, { isActive: false })).toHaveLength(1);
      expect(getMedications(adapter)).toHaveLength(2);
    });

    it('updates a medication', () => {
      createMedication(adapter, 'm1', { name: 'Old' });
      updateMedication(adapter, 'm1', { name: 'New', dosage: '400mg' });
      const m = getMedicationById(adapter, 'm1');
      expect(m!.name).toBe('New');
      expect(m!.dosage).toBe('400mg');
    });

    it('deletes a medication', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      deleteMedication(adapter, 'm1');
      expect(countMedications(adapter)).toBe(0);
    });
  });

  describe('doses', () => {
    it('records and retrieves doses', () => {
      createMedication(adapter, 'm1', { name: 'Vitamin D' });
      recordDose(adapter, 'd1', 'm1', '2026-01-15T08:00:00Z');
      recordDose(adapter, 'd2', 'm1', '2026-01-16T08:00:00Z');
      const doses = getDoses(adapter, 'm1');
      expect(doses).toHaveLength(2);
      expect(doses[0].skipped).toBe(false);
    });

    it('records a skipped dose', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      recordDose(adapter, 'd1', 'm1', '2026-01-15T08:00:00Z', true);
      const doses = getDoses(adapter, 'm1');
      expect(doses[0].skipped).toBe(true);
    });

    it('filters doses by date range', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      recordDose(adapter, 'd1', 'm1', '2026-01-10T08:00:00Z');
      recordDose(adapter, 'd2', 'm1', '2026-01-20T08:00:00Z');
      const results = getDoses(adapter, 'm1', { from: '2026-01-15' });
      expect(results).toHaveLength(1);
    });

    it('gets doses for a specific date', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      recordDose(adapter, 'd1', 'm1', '2026-01-15T08:00:00Z');
      recordDose(adapter, 'd2', 'm1', '2026-01-16T08:00:00Z');
      const results = getDosesForDate(adapter, '2026-01-15');
      expect(results).toHaveLength(1);
    });

    it('deletes a dose', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      recordDose(adapter, 'd1', 'm1', '2026-01-15T08:00:00Z');
      deleteDose(adapter, 'd1');
      expect(getDoses(adapter, 'm1')).toHaveLength(0);
    });
  });

  describe('adherence rate', () => {
    it('returns 0 for no doses', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      expect(getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31')).toBe(0);
    });

    it('calculates correct adherence rate', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      recordDose(adapter, 'd1', 'm1', '2026-01-15T08:00:00Z'); // taken
      recordDose(adapter, 'd2', 'm1', '2026-01-16T08:00:00Z'); // taken
      recordDose(adapter, 'd3', 'm1', '2026-01-17T08:00:00Z', true); // skipped
      const rate = getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31');
      expect(rate).toBe(67); // 2/3 = 66.67 -> 67
    });

    it('returns 100 when all doses taken', () => {
      createMedication(adapter, 'm1', { name: 'Test' });
      recordDose(adapter, 'd1', 'm1', '2026-01-15T08:00:00Z');
      recordDose(adapter, 'd2', 'm1', '2026-01-16T08:00:00Z');
      expect(getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31')).toBe(100);
    });
  });

  describe('settings', () => {
    it('updates a setting', () => {
      setSetting(adapter, 'reminderTime', '09:00');
      expect(getSetting(adapter, 'reminderTime')).toBe('09:00');
    });
  });
});
