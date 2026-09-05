import { describe, it, expect } from 'vitest';
import type { HealthKitSample, HealthKitSleepSample } from '../types';
import {
  mapQuantitySampleToVital,
  mapQuantitySamplesToVitals,
  mapSleepSamplesToSession,
  mapHKUnitToMyHealthUnit,
  isValidSample,
} from '../data-mappers';

// ---------------------------------------------------------------------------
// mapQuantitySampleToVital
// ---------------------------------------------------------------------------

describe('mapQuantitySampleToVital', () => {
  function makeSample(overrides: Partial<HealthKitSample> = {}): HealthKitSample {
    return {
      uuid: 'test-uuid-001',
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 72,
      unit: 'bpm',
      startDate: '2026-03-20T10:00:00Z',
      endDate: '2026-03-20T10:00:01Z',
      ...overrides,
    };
  }

  it('maps heart rate sample to LogVitalInput', () => {
    const result = mapQuantitySampleToVital(makeSample());
    expect(result).not.toBeNull();
    expect(result!.vital_type).toBe('heart_rate');
    expect(result!.value).toBe(72);
    expect(result!.unit).toBe('bpm');
    expect(result!.source).toBe('apple_health');
    expect(result!.recorded_at).toBe('2026-03-20T10:00:00Z');
  });

  it('maps steps sample correctly', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierStepCount',
      value: 8500,
      unit: 'count',
    }));
    expect(result!.vital_type).toBe('steps');
    expect(result!.value).toBe(8500);
    expect(result!.unit).toBe('count');
  });

  it('maps HRV sample correctly', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      value: 45,
      unit: 'ms',
    }));
    expect(result!.vital_type).toBe('hrv');
    expect(result!.value).toBe(45);
  });

  it('maps blood oxygen sample correctly', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierOxygenSaturation',
      value: 98,
      unit: '%',
    }));
    expect(result!.vital_type).toBe('blood_oxygen');
    expect(result!.value).toBe(98);
  });

  it('maps blood pressure with secondary value', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierBloodPressureSystolic',
      value: 120,
      valueSecondary: 80,
      unit: 'mmHg',
    }));
    expect(result!.vital_type).toBe('blood_pressure');
    expect(result!.value).toBe(120);
    expect(result!.value_secondary).toBe(80);
  });

  it('maps active energy correctly', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierActiveEnergyBurned',
      value: 350,
      unit: 'kcal',
    }));
    expect(result!.vital_type).toBe('active_energy');
    expect(result!.value).toBe(350);
    expect(result!.unit).toBe('kcal');
  });

  it('returns null for unsupported HK type', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierUnknown',
    }));
    expect(result).toBeNull();
  });

  it('returns null for NaN value', () => {
    const result = mapQuantitySampleToVital(makeSample({ value: NaN }));
    expect(result).toBeNull();
  });

  it('returns null for Infinity value', () => {
    const result = mapQuantitySampleToVital(makeSample({ value: Infinity }));
    expect(result).toBeNull();
  });

  it('handles nil secondary value gracefully', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierHeartRate',
      valueSecondary: undefined,
    }));
    expect(result!.value_secondary).toBeUndefined();
  });

  it('uses canonical unit when sample unit is empty', () => {
    const result = mapQuantitySampleToVital(makeSample({
      type: 'HKQuantityTypeIdentifierHeartRate',
      unit: '',
    }));
    expect(result!.unit).toBe('bpm');
  });
});

// ---------------------------------------------------------------------------
// mapQuantitySamplesToVitals
// ---------------------------------------------------------------------------

describe('mapQuantitySamplesToVitals', () => {
  it('filters out invalid samples', () => {
    const samples: HealthKitSample[] = [
      {
        uuid: '1',
        type: 'HKQuantityTypeIdentifierHeartRate',
        value: 72,
        unit: 'bpm',
        startDate: '2026-03-20T10:00:00Z',
        endDate: '2026-03-20T10:00:01Z',
      },
      {
        uuid: '2',
        type: 'HKQuantityTypeIdentifierUnknown',
        value: 99,
        unit: '',
        startDate: '2026-03-20T10:01:00Z',
        endDate: '2026-03-20T10:01:01Z',
      },
      {
        uuid: '3',
        type: 'HKQuantityTypeIdentifierStepCount',
        value: 5000,
        unit: 'count',
        startDate: '2026-03-20T10:02:00Z',
        endDate: '2026-03-20T10:02:01Z',
      },
    ];
    const results = mapQuantitySamplesToVitals(samples);
    expect(results.length).toBe(2);
    expect(results[0].vital_type).toBe('heart_rate');
    expect(results[1].vital_type).toBe('steps');
  });

  it('handles empty array', () => {
    expect(mapQuantitySamplesToVitals([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapSleepSamplesToSession
// ---------------------------------------------------------------------------

describe('mapSleepSamplesToSession', () => {
  function makeSleepSample(overrides: Partial<HealthKitSleepSample> = {}): HealthKitSleepSample {
    return {
      uuid: `slp-${Math.random().toString(36).slice(2)}`,
      startDate: '2026-03-20T22:00:00Z',
      endDate: '2026-03-20T22:30:00Z',
      value: 3, // ASLEEP_CORE (light)
      ...overrides,
    };
  }

  it('returns null for empty array', () => {
    expect(mapSleepSamplesToSession([])).toBeNull();
  });

  it('aggregates sleep stages correctly', () => {
    const samples: HealthKitSleepSample[] = [
      makeSleepSample({
        startDate: '2026-03-20T22:00:00Z',
        endDate: '2026-03-20T23:00:00Z',
        value: 3, // Light
      }),
      makeSleepSample({
        startDate: '2026-03-20T23:00:00Z',
        endDate: '2026-03-21T01:00:00Z',
        value: 4, // Deep
      }),
      makeSleepSample({
        startDate: '2026-03-21T01:00:00Z',
        endDate: '2026-03-21T02:30:00Z',
        value: 5, // REM
      }),
      makeSleepSample({
        startDate: '2026-03-21T02:30:00Z',
        endDate: '2026-03-21T02:45:00Z',
        value: 2, // Awake
      }),
    ];

    const session = mapSleepSamplesToSession(samples);
    expect(session).not.toBeNull();
    expect(session!.start_time).toBe('2026-03-20T22:00:00Z');
    expect(session!.end_time).toBe('2026-03-21T02:45:00Z');
    expect(session!.light_minutes).toBe(60);
    expect(session!.deep_minutes).toBe(120);
    expect(session!.rem_minutes).toBe(90);
    expect(session!.awake_minutes).toBe(15);
    expect(session!.source).toBe('apple_health');
  });

  it('handles unspecified sleep stage as light', () => {
    const samples: HealthKitSleepSample[] = [
      makeSleepSample({
        startDate: '2026-03-20T22:00:00Z',
        endDate: '2026-03-21T06:00:00Z',
        value: 1, // ASLEEP_UNSPECIFIED
      }),
    ];

    const session = mapSleepSamplesToSession(samples);
    expect(session!.light_minutes).toBe(480);
    expect(session!.deep_minutes).toBe(0);
  });

  it('ignores IN_BED samples for stage breakdown', () => {
    const samples: HealthKitSleepSample[] = [
      makeSleepSample({
        startDate: '2026-03-20T21:30:00Z',
        endDate: '2026-03-20T22:00:00Z',
        value: 0, // IN_BED
      }),
      makeSleepSample({
        startDate: '2026-03-20T22:00:00Z',
        endDate: '2026-03-21T06:00:00Z',
        value: 4, // Deep
      }),
    ];

    const session = mapSleepSamplesToSession(samples);
    expect(session!.deep_minutes).toBe(480);
    // IN_BED contributes to time range but not stage breakdown
    expect(session!.start_time).toBe('2026-03-20T21:30:00Z');
  });

  it('filters out invalid date samples', () => {
    const samples: HealthKitSleepSample[] = [
      makeSleepSample({
        startDate: 'invalid',
        endDate: '2026-03-21T06:00:00Z',
        value: 4,
      }),
      makeSleepSample({
        startDate: '2026-03-20T22:00:00Z',
        endDate: '2026-03-21T06:00:00Z',
        value: 4,
      }),
    ];

    const session = mapSleepSamplesToSession(samples);
    expect(session).not.toBeNull();
    expect(session!.deep_minutes).toBe(480);
  });

  it('returns null when all samples are invalid', () => {
    const samples: HealthKitSleepSample[] = [
      makeSleepSample({ startDate: 'bad', endDate: 'bad' }),
    ];
    expect(mapSleepSamplesToSession(samples)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapHKUnitToMyHealthUnit
// ---------------------------------------------------------------------------

describe('mapHKUnitToMyHealthUnit', () => {
  it('returns canonical unit for heart rate', () => {
    expect(mapHKUnitToMyHealthUnit('count/min', 'heart_rate')).toBe('bpm');
  });

  it('returns canonical unit for HRV', () => {
    expect(mapHKUnitToMyHealthUnit('milliseconds', 'hrv')).toBe('ms');
  });

  it('returns canonical unit for blood oxygen', () => {
    expect(mapHKUnitToMyHealthUnit('percent', 'blood_oxygen')).toBe('%');
  });

  it('returns canonical unit for steps', () => {
    expect(mapHKUnitToMyHealthUnit('count', 'steps')).toBe('count');
  });
});

// ---------------------------------------------------------------------------
// isValidSample
// ---------------------------------------------------------------------------

describe('isValidSample', () => {
  it('returns true for a complete valid sample', () => {
    expect(isValidSample({
      uuid: 'abc',
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 72,
      startDate: '2026-03-20T10:00:00Z',
      endDate: '2026-03-20T10:00:01Z',
    })).toBe(true);
  });

  it('returns false when uuid is missing', () => {
    expect(isValidSample({
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 72,
      startDate: '2026-03-20T10:00:00Z',
      endDate: '2026-03-20T10:00:01Z',
    })).toBe(false);
  });

  it('returns false when value is NaN', () => {
    expect(isValidSample({
      uuid: 'abc',
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: NaN,
      startDate: '2026-03-20T10:00:00Z',
      endDate: '2026-03-20T10:00:01Z',
    })).toBe(false);
  });

  it('returns false when startDate is invalid', () => {
    expect(isValidSample({
      uuid: 'abc',
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 72,
      startDate: 'not-a-date',
      endDate: '2026-03-20T10:00:01Z',
    })).toBe(false);
  });
});
