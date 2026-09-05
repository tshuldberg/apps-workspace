import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CYCLE_MODULE } from '../definition';
import {
  createTemperature,
  getTemperatureByDate,
  getTemperaturesByDateRange,
  updateTemperature,
  upsertTemperature,
  deleteTemperature,
  createCycleDay,
  getCycleDayByDate,
} from '../db/crud';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  calculateCoverline,
  detectTemperatureShift,
  analyzeTemperatures,
} from '../engine/temperature';

// ── Engine Tests ──────────────────────────────────────────────────────

describe('celsiusToFahrenheit', () => {
  it('converts 36.5 C to 97.7 F', () => {
    expect(celsiusToFahrenheit(36.5)).toBe(97.7);
  });

  it('converts 37.0 C to 98.6 F', () => {
    expect(celsiusToFahrenheit(37.0)).toBe(98.6);
  });

  it('converts 35.0 C to 95.0 F', () => {
    expect(celsiusToFahrenheit(35.0)).toBe(95);
  });

  it('converts 42.0 C to 107.6 F', () => {
    expect(celsiusToFahrenheit(42.0)).toBe(107.6);
  });
});

describe('fahrenheitToCelsius', () => {
  it('converts 98.6 F to 37.0 C', () => {
    expect(fahrenheitToCelsius(98.6)).toBe(37);
  });

  it('converts 97.7 F to ~36.5 C', () => {
    expect(fahrenheitToCelsius(97.7)).toBeCloseTo(36.5, 1);
  });

  it('converts 95.0 F to 35.0 C', () => {
    expect(fahrenheitToCelsius(95.0)).toBe(35);
  });
});

describe('calculateCoverline', () => {
  it('returns null with fewer than 6 readings', () => {
    expect(calculateCoverline([36.2, 36.3, 36.1, 36.4, 36.2])).toBeNull();
    expect(calculateCoverline([])).toBeNull();
  });

  it('returns average of 6 lowest temperatures', () => {
    // 6 readings, all are the lowest
    const temps = [36.2, 36.3, 36.1, 36.4, 36.2, 36.3];
    const result = calculateCoverline(temps);
    expect(result).not.toBeNull();
    // avg of [36.1, 36.2, 36.2, 36.3, 36.3, 36.4] = 36.25
    expect(result).toBe(36.25);
  });

  it('picks 6 lowest from a larger dataset', () => {
    // 10 readings, last 4 are higher (post-ovulation)
    const temps = [36.1, 36.2, 36.3, 36.2, 36.1, 36.3, 36.6, 36.7, 36.8, 36.7];
    const result = calculateCoverline(temps);
    expect(result).not.toBeNull();
    // 6 lowest: 36.1, 36.1, 36.2, 36.2, 36.3, 36.3 = avg 36.2
    expect(result).toBe(36.2);
  });
});

describe('detectTemperatureShift', () => {
  it('returns false with fewer than 3 above-coverline readings', () => {
    const temps = [36.2, 36.3, 36.1, 36.4, 36.2, 36.5];
    const result = detectTemperatureShift(temps, 36.3);
    expect(result.shiftDetected).toBe(false);
    expect(result.shiftStartIndex).toBeNull();
  });

  it('returns true with 3 consecutive readings >= coverline + 0.1', () => {
    // coverline = 36.2, threshold = 36.3
    const temps = [36.1, 36.2, 36.1, 36.3, 36.4, 36.5];
    const result = detectTemperatureShift(temps, 36.2);
    expect(result.shiftDetected).toBe(true);
    expect(result.shiftStartIndex).toBe(3);
  });

  it('resets count when a below-threshold reading interrupts', () => {
    // coverline = 36.2, two above then dip then two above
    const temps = [36.3, 36.4, 36.1, 36.3, 36.4];
    const result = detectTemperatureShift(temps, 36.2);
    expect(result.shiftDetected).toBe(false);
  });

  it('detects shift at the end of the array', () => {
    const temps = [36.1, 36.0, 36.2, 36.1, 36.3, 36.5, 36.4, 36.6];
    const result = detectTemperatureShift(temps, 36.2);
    // 36.3 (i=4), 36.5 (i=5), 36.4 (i=6) are all >= 36.3
    expect(result.shiftDetected).toBe(true);
    expect(result.shiftStartIndex).toBe(4);
  });

  it('handles exactly at threshold (>= not >)', () => {
    const temps = [36.1, 36.3, 36.3, 36.3];
    const result = detectTemperatureShift(temps, 36.2);
    expect(result.shiftDetected).toBe(true);
    expect(result.shiftStartIndex).toBe(1);
  });
});

describe('analyzeTemperatures', () => {
  it('returns null with fewer than 6 readings', () => {
    expect(analyzeTemperatures([36.1, 36.2, 36.3])).toBeNull();
  });

  it('returns coverline with no shift when all temps are similar', () => {
    const temps = [36.2, 36.3, 36.1, 36.2, 36.3, 36.2];
    const result = analyzeTemperatures(temps);
    expect(result).not.toBeNull();
    expect(result!.coverline).toBeGreaterThan(36);
    expect(result!.shiftDetected).toBe(false);
  });

  it('detects shift in typical ovulation pattern', () => {
    // Follicular phase temps (low), then post-ovulation shift
    const temps = [36.1, 36.2, 36.0, 36.1, 36.2, 36.1, 36.4, 36.5, 36.6];
    const result = analyzeTemperatures(temps);
    expect(result).not.toBeNull();
    expect(result!.shiftDetected).toBe(true);
    expect(result!.shiftStartIndex).toBe(6);
  });
});

// ── CRUD Tests ────────────────────────────────────────────────────────

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('cycle', CYCLE_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Temperature CRUD', () => {
  it('creates a temperature record', () => {
    const temp = createTemperature(testDb.adapter, 't1', {
      date: '2026-03-01',
      valueCelsius: 36.5,
      method: 'oral',
    });
    expect(temp.id).toBe('t1');
    expect(temp.date).toBe('2026-03-01');
    expect(temp.valueCelsius).toBe(36.5);
    expect(temp.method).toBe('oral');
    expect(temp.cycleDayId).toBeNull();
  });

  it('rejects temperature below 35.0 C', () => {
    expect(() =>
      createTemperature(testDb.adapter, 't-low', {
        date: '2026-03-01',
        valueCelsius: 34.5,
      }),
    ).toThrow();
  });

  it('rejects temperature above 42.0 C', () => {
    expect(() =>
      createTemperature(testDb.adapter, 't-high', {
        date: '2026-03-01',
        valueCelsius: 43.0,
      }),
    ).toThrow();
  });

  it('auto-links to existing cycle_day', () => {
    createCycleDay(testDb.adapter, 'd1', { date: '2026-03-01' });
    const temp = createTemperature(testDb.adapter, 't2', {
      date: '2026-03-01',
      valueCelsius: 36.5,
    });
    expect(temp.cycleDayId).toBe('d1');
  });

  it('gets temperature by date', () => {
    createTemperature(testDb.adapter, 't3', {
      date: '2026-03-05',
      valueCelsius: 36.7,
    });
    const found = getTemperatureByDate(testDb.adapter, '2026-03-05');
    expect(found).not.toBeNull();
    expect(found!.valueCelsius).toBe(36.7);
  });

  it('returns null for unlogged date', () => {
    expect(getTemperatureByDate(testDb.adapter, '2026-04-01')).toBeNull();
  });

  it('gets temperatures by date range', () => {
    createTemperature(testDb.adapter, 't4', { date: '2026-03-01', valueCelsius: 36.1 });
    createTemperature(testDb.adapter, 't5', { date: '2026-03-02', valueCelsius: 36.2 });
    createTemperature(testDb.adapter, 't6', { date: '2026-03-03', valueCelsius: 36.3 });
    createTemperature(testDb.adapter, 't7', { date: '2026-03-10', valueCelsius: 36.8 });

    const range = getTemperaturesByDateRange(testDb.adapter, '2026-03-01', '2026-03-05');
    expect(range).toHaveLength(3);
    expect(range[0].date).toBe('2026-03-01');
    expect(range[2].date).toBe('2026-03-03');
  });

  it('updates a temperature record', () => {
    createTemperature(testDb.adapter, 't8', {
      date: '2026-03-01',
      valueCelsius: 36.5,
      method: 'oral',
    });
    const updated = updateTemperature(testDb.adapter, 't8', {
      valueCelsius: 36.7,
      method: 'vaginal',
    });
    expect(updated).not.toBeNull();
    expect(updated!.valueCelsius).toBe(36.7);
    expect(updated!.method).toBe('vaginal');
  });

  it('returns null when updating nonexistent record', () => {
    expect(updateTemperature(testDb.adapter, 'nope', { valueCelsius: 36.5 })).toBeNull();
  });

  it('upserts: inserts if no record exists', () => {
    const result = upsertTemperature(testDb.adapter, 'u1', {
      date: '2026-03-15',
      valueCelsius: 36.8,
    });
    expect(result.id).toBe('u1');
    expect(result.valueCelsius).toBe(36.8);
  });

  it('upserts: updates if record exists for that date', () => {
    createTemperature(testDb.adapter, 't-orig', {
      date: '2026-03-15',
      valueCelsius: 36.5,
    });
    const result = upsertTemperature(testDb.adapter, 'u2', {
      date: '2026-03-15',
      valueCelsius: 36.9,
    });
    // Should have the original ID, not the new one
    expect(result.id).toBe('t-orig');
    expect(result.valueCelsius).toBe(36.9);

    // Only one record for the date
    const found = getTemperatureByDate(testDb.adapter, '2026-03-15');
    expect(found).not.toBeNull();
    expect(found!.valueCelsius).toBe(36.9);
  });

  it('deletes a temperature record', () => {
    createTemperature(testDb.adapter, 't-del', {
      date: '2026-03-01',
      valueCelsius: 36.5,
    });
    deleteTemperature(testDb.adapter, 't-del');
    expect(getTemperatureByDate(testDb.adapter, '2026-03-01')).toBeNull();
  });

  it('temperature survives cycle_day deletion (ON DELETE SET NULL)', () => {
    const day = createCycleDay(testDb.adapter, 'd-surv', { date: '2026-03-20' });
    createTemperature(testDb.adapter, 't-surv', {
      date: '2026-03-20',
      valueCelsius: 36.5,
    });

    // Verify it's linked
    let temp = getTemperatureByDate(testDb.adapter, '2026-03-20');
    expect(temp!.cycleDayId).toBe('d-surv');

    // Delete the cycle day
    testDb.adapter.execute(`DELETE FROM cy_cycle_days WHERE id = ?`, [day.id]);

    // Temperature should still exist with null cycleDayId
    temp = getTemperatureByDate(testDb.adapter, '2026-03-20');
    expect(temp).not.toBeNull();
    expect(temp!.cycleDayId).toBeNull();
    expect(temp!.valueCelsius).toBe(36.5);
  });

  it('stores optional time and notes', () => {
    const temp = createTemperature(testDb.adapter, 't-opts', {
      date: '2026-03-01',
      valueCelsius: 36.5,
      timeTaken: '07:30',
      method: 'skin_wearable',
      notes: 'Oura ring reading',
    });
    expect(temp.timeTaken).toBe('07:30');
    expect(temp.method).toBe('skin_wearable');
    expect(temp.notes).toBe('Oura ring reading');
  });

  it('auto-creates cycle_day reference correctly when day exists', () => {
    createCycleDay(testDb.adapter, 'day-link', {
      date: '2026-03-10',
      phase: 'follicular',
      flowLevel: 'light',
    });
    const temp = createTemperature(testDb.adapter, 't-link', {
      date: '2026-03-10',
      valueCelsius: 36.3,
    });
    expect(temp.cycleDayId).toBe('day-link');

    // The existing cycle day should not be modified
    const day = getCycleDayByDate(testDb.adapter, '2026-03-10');
    expect(day!.phase).toBe('follicular');
    expect(day!.flowLevel).toBe('light');
  });
});
