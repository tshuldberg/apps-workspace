import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended } from '../medication';
import {
  logMeasurement,
  getMeasurements,
  getMeasurementById,
  updateMeasurement,
  deleteMeasurement,
  getMeasurementTrend,
  getMeasurementTrendWithMedMarkers,
} from '../measurements';

describe('health measurements', () => {
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

  describe('logMeasurement', () => {
    it('inserts a measurement', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'blood_pressure',
        value: '120/80',
        unit: 'mmHg',
        notes: 'Morning reading',
        measuredAt: '2026-01-15T08:00:00Z',
      });

      const m = getMeasurementById(adapter, 'ms1');
      expect(m).not.toBeNull();
      expect(m!.type).toBe('blood_pressure');
      expect(m!.value).toBe('120/80');
      expect(m!.unit).toBe('mmHg');
      expect(m!.notes).toBe('Morning reading');
    });

    it('auto-sets measuredAt when not provided', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
      });

      const m = getMeasurementById(adapter, 'ms1');
      expect(m!.measuredAt).toBeTruthy();
    });
  });

  describe('getMeasurements', () => {
    it('returns all measurements ordered by date descending', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
        measuredAt: '2026-01-10T08:00:00Z',
      });
      logMeasurement(adapter, 'ms2', {
        type: 'weight',
        value: '164',
        unit: 'lbs',
        measuredAt: '2026-01-15T08:00:00Z',
      });

      const all = getMeasurements(adapter);
      expect(all).toHaveLength(2);
      expect(all[0].value).toBe('164'); // newest first
    });

    it('filters by type', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
        measuredAt: '2026-01-10T08:00:00Z',
      });
      logMeasurement(adapter, 'ms2', {
        type: 'blood_pressure',
        value: '120/80',
        unit: 'mmHg',
        measuredAt: '2026-01-10T08:00:00Z',
      });

      const weights = getMeasurements(adapter, { type: 'weight' });
      expect(weights).toHaveLength(1);
      expect(weights[0].type).toBe('weight');
    });

    it('filters by date range', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
        measuredAt: '2026-01-05T08:00:00Z',
      });
      logMeasurement(adapter, 'ms2', {
        type: 'weight',
        value: '164',
        unit: 'lbs',
        measuredAt: '2026-01-15T08:00:00Z',
      });

      const filtered = getMeasurements(adapter, { from: '2026-01-10' });
      expect(filtered).toHaveLength(1);
    });
  });

  describe('getMeasurementById', () => {
    it('returns null for non-existent ID', () => {
      expect(getMeasurementById(adapter, 'nope')).toBeNull();
    });
  });

  describe('updateMeasurement', () => {
    it('modifies measurement fields', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
      });

      updateMeasurement(adapter, 'ms1', { value: '163', notes: 'After workout' });

      const m = getMeasurementById(adapter, 'ms1');
      expect(m!.value).toBe('163');
      expect(m!.notes).toBe('After workout');
    });

    it('does nothing when no updates provided', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
      });

      updateMeasurement(adapter, 'ms1', {});
      expect(getMeasurementById(adapter, 'ms1')!.value).toBe('165');
    });
  });

  describe('deleteMeasurement', () => {
    it('removes a measurement', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
      });

      deleteMeasurement(adapter, 'ms1');
      expect(getMeasurementById(adapter, 'ms1')).toBeNull();
    });
  });

  describe('getMeasurementTrend', () => {
    it('returns time-series of values', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
        measuredAt: '2026-01-01T08:00:00Z',
      });
      logMeasurement(adapter, 'ms2', {
        type: 'weight',
        value: '163',
        unit: 'lbs',
        measuredAt: '2026-01-15T08:00:00Z',
      });
      logMeasurement(adapter, 'ms3', {
        type: 'blood_pressure',
        value: '120/80',
        unit: 'mmHg',
        measuredAt: '2026-01-10T08:00:00Z',
      });

      const trend = getMeasurementTrend(adapter, 'weight', '2026-01-01', '2026-01-31');
      expect(trend).toHaveLength(2);
      expect(trend[0].date).toBe('2026-01-01T08:00:00Z');
      expect(trend[0].value).toBe('165');
      expect(trend[1].value).toBe('163');
    });

    it('returns empty for no matching data', () => {
      const trend = getMeasurementTrend(adapter, 'weight', '2026-01-01', '2026-01-31');
      expect(trend).toEqual([]);
    });
  });

  describe('getMeasurementTrendWithMedMarkers', () => {
    it('includes medication start/stop markers', () => {
      // Insert medication with a known created_at within the query range
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, pill_count, pills_per_dose, time_slots, end_date, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        ['m1', 'Metformin', 'daily', 30, 1, '[]', '2026-01-20', '2026-01-10T00:00:00Z', '2026-01-10T00:00:00Z'],
      );

      logMeasurement(adapter, 'ms1', {
        type: 'blood_sugar',
        value: '150',
        unit: 'mg/dL',
        measuredAt: '2026-01-05T08:00:00Z',
      });

      const result = getMeasurementTrendWithMedMarkers(
        adapter,
        'blood_sugar',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.points).toHaveLength(1);
      expect(result.markers.length).toBeGreaterThanOrEqual(2);

      const startMarker = result.markers.find((m) => m.event === 'started');
      expect(startMarker).toBeDefined();
      expect(startMarker!.medName).toBe('Metformin');

      const stopMarker = result.markers.find((m) => m.event === 'stopped');
      expect(stopMarker).toBeDefined();
      expect(stopMarker!.date).toBe('2026-01-20');
    });

    it('works with no markers in range', () => {
      logMeasurement(adapter, 'ms1', {
        type: 'weight',
        value: '165',
        unit: 'lbs',
        measuredAt: '2026-01-05T08:00:00Z',
      });

      const result = getMeasurementTrendWithMedMarkers(
        adapter,
        'weight',
        '2020-01-01',
        '2020-01-31',
      );

      expect(result.points).toHaveLength(0);
      expect(result.markers).toHaveLength(0);
    });
  });
});
