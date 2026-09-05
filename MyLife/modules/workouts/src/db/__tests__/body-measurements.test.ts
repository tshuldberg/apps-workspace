import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import {
  createBodyMeasurement,
  getBodyMeasurements,
  deleteBodyMeasurement,
} from '../crud';

describe('@mylife/workouts - body measurements', () => {
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

  it('creates and retrieves a body measurement', () => {
    createBodyMeasurement(adapter, 'bm-1', {
      type: 'weight',
      value: 185.5,
      unit: 'lbs',
      measuredAt: '2026-03-01T08:00:00Z',
    });

    const measurements = getBodyMeasurements(adapter);
    expect(measurements).toHaveLength(1);
    expect(measurements[0].id).toBe('bm-1');
    expect(measurements[0].type).toBe('weight');
    expect(measurements[0].value).toBe(185.5);
    expect(measurements[0].unit).toBe('lbs');
    expect(measurements[0].measuredAt).toBe('2026-03-01T08:00:00Z');
    expect(measurements[0].createdAt).toBeTruthy();
  });

  it('filters by type', () => {
    createBodyMeasurement(adapter, 'bm-1', {
      type: 'weight',
      value: 185,
      unit: 'lbs',
      measuredAt: '2026-03-01T08:00:00Z',
    });
    createBodyMeasurement(adapter, 'bm-2', {
      type: 'body_fat',
      value: 15.5,
      unit: '%',
      measuredAt: '2026-03-01T08:00:00Z',
    });
    createBodyMeasurement(adapter, 'bm-3', {
      type: 'weight',
      value: 184,
      unit: 'lbs',
      measuredAt: '2026-03-02T08:00:00Z',
    });

    const weights = getBodyMeasurements(adapter, { type: 'weight' });
    expect(weights).toHaveLength(2);
    expect(weights.every((m) => m.type === 'weight')).toBe(true);

    const bodyFat = getBodyMeasurements(adapter, { type: 'body_fat' });
    expect(bodyFat).toHaveLength(1);
    expect(bodyFat[0].type).toBe('body_fat');
  });

  it('orders by measured_at DESC', () => {
    createBodyMeasurement(adapter, 'bm-1', {
      type: 'weight',
      value: 185,
      unit: 'lbs',
      measuredAt: '2026-03-01T08:00:00Z',
    });
    createBodyMeasurement(adapter, 'bm-2', {
      type: 'weight',
      value: 184,
      unit: 'lbs',
      measuredAt: '2026-03-05T08:00:00Z',
    });
    createBodyMeasurement(adapter, 'bm-3', {
      type: 'weight',
      value: 183,
      unit: 'lbs',
      measuredAt: '2026-03-03T08:00:00Z',
    });

    const measurements = getBodyMeasurements(adapter);
    expect(measurements[0].measuredAt).toBe('2026-03-05T08:00:00Z');
    expect(measurements[1].measuredAt).toBe('2026-03-03T08:00:00Z');
    expect(measurements[2].measuredAt).toBe('2026-03-01T08:00:00Z');
  });

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      createBodyMeasurement(adapter, `bm-${i}`, {
        type: 'weight',
        value: 180 + i,
        unit: 'lbs',
        measuredAt: `2026-03-0${i + 1}T08:00:00Z`,
      });
    }

    const limited = getBodyMeasurements(adapter, { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('deletes a measurement', () => {
    createBodyMeasurement(adapter, 'bm-del', {
      type: 'weight',
      value: 185,
      unit: 'lbs',
      measuredAt: '2026-03-01T08:00:00Z',
    });

    expect(getBodyMeasurements(adapter)).toHaveLength(1);
    deleteBodyMeasurement(adapter, 'bm-del');
    expect(getBodyMeasurements(adapter)).toHaveLength(0);
  });

  it('returns empty array when no measurements exist', () => {
    expect(getBodyMeasurements(adapter)).toEqual([]);
  });

  it('delete removes only the targeted measurement', () => {
    createBodyMeasurement(adapter, 'bm-keep', {
      type: 'weight',
      value: 185,
      unit: 'lbs',
      measuredAt: '2026-03-01T08:00:00Z',
    });
    createBodyMeasurement(adapter, 'bm-remove', {
      type: 'weight',
      value: 180,
      unit: 'lbs',
      measuredAt: '2026-03-02T08:00:00Z',
    });

    deleteBodyMeasurement(adapter, 'bm-remove');

    const remaining = getBodyMeasurements(adapter);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('bm-keep');
  });

  it('combines type filter and limit', () => {
    for (let i = 0; i < 5; i++) {
      createBodyMeasurement(adapter, `bm-w-${i}`, {
        type: 'weight',
        value: 180 + i,
        unit: 'lbs',
        measuredAt: `2026-03-0${i + 1}T08:00:00Z`,
      });
    }
    createBodyMeasurement(adapter, 'bm-bf-1', {
      type: 'body_fat',
      value: 15,
      unit: '%',
      measuredAt: '2026-03-06T08:00:00Z',
    });

    const result = getBodyMeasurements(adapter, { type: 'weight', limit: 3 });
    expect(result).toHaveLength(3);
    for (const m of result) {
      expect(m.type).toBe('weight');
    }
  });
});
