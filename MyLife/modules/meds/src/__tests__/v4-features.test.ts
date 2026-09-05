import { describe, it, expect } from 'vitest';

// -- Caregiver alerts -------------------------------------------------------
import { generateAlertMessage, shouldFireAlert, generateWeeklySummary } from '../caregiver/engine';

describe('caregiver/engine', () => {
  describe('generateAlertMessage', () => {
    it('generates missed dose message', () => {
      const msg = generateAlertMessage('Mom', 'Lisinopril', '08:00', 'missed_dose');
      expect(msg).toContain('Mom');
      expect(msg).toContain('Lisinopril');
      expect(msg).toContain('missed');
    });

    it('generates low adherence message', () => {
      const msg = generateAlertMessage('Dad', 'Metformin', '08:00', 'low_adherence');
      expect(msg).toContain('adherence');
    });

    it('generates low supply message', () => {
      const msg = generateAlertMessage('Mom', 'Aspirin', '', 'low_supply');
      expect(msg).toContain('low');
    });
  });

  describe('shouldFireAlert', () => {
    it('returns true when dose missed beyond delay', () => {
      const scheduled = new Date(Date.now() - 45 * 60000).toISOString();
      expect(shouldFireAlert(scheduled, 30, false, true)).toBe(true);
    });

    it('returns false when dose was logged', () => {
      const scheduled = new Date(Date.now() - 45 * 60000).toISOString();
      expect(shouldFireAlert(scheduled, 30, true, true)).toBe(false);
    });

    it('returns false when caregiver is inactive', () => {
      const scheduled = new Date(Date.now() - 45 * 60000).toISOString();
      expect(shouldFireAlert(scheduled, 30, false, false)).toBe(false);
    });

    it('returns false when within delay window', () => {
      const scheduled = new Date(Date.now() - 10 * 60000).toISOString();
      expect(shouldFireAlert(scheduled, 30, false, true)).toBe(false);
    });
  });

  describe('generateWeeklySummary', () => {
    it('generates summary with overall rate', () => {
      const summary = generateWeeklySummary('Mom', [
        { medName: 'Lisinopril', adherenceRate: 0.85, dosesLogged: 6, dosesMissed: 1 },
        { medName: 'Metformin', adherenceRate: 1.0, dosesLogged: 14, dosesMissed: 0 },
      ]);
      expect(summary).toContain('Mom');
      expect(summary).toContain('Lisinopril');
      expect(summary).toContain('85%');
      expect(summary).toContain('Overall');
    });
  });
});

// -- BP trend visualization -------------------------------------------------
import {
  getBPTrendData, getBPPeriodStats, calculateTrendDirection,
  comparePeriods, aggregateToWeekly,
} from '../bp/trends';
import type { BPReading } from '../models/bp-reading';

function makeBP(overrides: Partial<BPReading> = {}): BPReading {
  return {
    id: 'bp-1', systolic: 120, diastolic: 80, pulse: 72,
    arm: null, position: null, context: null, category: 'normal',
    notes: null, measuredAt: '2026-03-01T10:00:00Z', createdAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

describe('bp/trends', () => {
  describe('getBPTrendData', () => {
    it('returns sorted trend points', () => {
      const readings = [
        makeBP({ measuredAt: '2026-03-03T10:00:00Z' }),
        makeBP({ measuredAt: '2026-03-01T10:00:00Z' }),
      ];
      const trend = getBPTrendData(readings);
      expect(trend[0].date).toBe('2026-03-01T10:00:00Z');
      expect(trend).toHaveLength(2);
    });

    it('returns empty for empty input', () => {
      expect(getBPTrendData([])).toEqual([]);
    });
  });

  describe('getBPPeriodStats', () => {
    it('computes correct stats', () => {
      const readings = [
        makeBP({ systolic: 110, diastolic: 70, category: 'normal' }),
        makeBP({ systolic: 130, diastolic: 85, category: 'hypertension_1' }),
        makeBP({ systolic: 140, diastolic: 90, category: 'hypertension_2' }),
      ];
      const stats = getBPPeriodStats(readings);
      expect(stats.avgSystolic).toBe(127);
      expect(stats.minSystolic).toBe(110);
      expect(stats.maxSystolic).toBe(140);
      expect(stats.readingCount).toBe(3);
    });

    it('handles empty readings', () => {
      const stats = getBPPeriodStats([]);
      expect(stats.readingCount).toBe(0);
      expect(stats.trendDirection).toBe('stable');
    });
  });

  describe('calculateTrendDirection', () => {
    it('detects improving trend', () => {
      const readings = [
        makeBP({ systolic: 150, measuredAt: '2026-03-01T10:00:00Z' }),
        makeBP({ systolic: 145, measuredAt: '2026-03-02T10:00:00Z' }),
        makeBP({ systolic: 130, measuredAt: '2026-03-03T10:00:00Z' }),
        makeBP({ systolic: 120, measuredAt: '2026-03-04T10:00:00Z' }),
      ];
      expect(calculateTrendDirection(readings)).toBe('improving');
    });

    it('detects worsening trend', () => {
      const readings = [
        makeBP({ systolic: 120, measuredAt: '2026-03-01T10:00:00Z' }),
        makeBP({ systolic: 125, measuredAt: '2026-03-02T10:00:00Z' }),
        makeBP({ systolic: 140, measuredAt: '2026-03-03T10:00:00Z' }),
        makeBP({ systolic: 150, measuredAt: '2026-03-04T10:00:00Z' }),
      ];
      expect(calculateTrendDirection(readings)).toBe('worsening');
    });

    it('returns stable for few readings', () => {
      expect(calculateTrendDirection([makeBP(), makeBP()])).toBe('stable');
    });
  });

  describe('comparePeriods', () => {
    it('computes delta between periods', () => {
      const current = [makeBP({ systolic: 120, diastolic: 80 })];
      const previous = [makeBP({ systolic: 140, diastolic: 90 })];
      const comparison = comparePeriods(current, previous);
      expect(comparison).not.toBeNull();
      expect(comparison!.systolicDelta).toBe(-20);
    });

    it('returns null with empty period', () => {
      expect(comparePeriods([], [makeBP()])).toBeNull();
    });
  });

  describe('aggregateToWeekly', () => {
    it('groups readings by week', () => {
      const readings = [
        makeBP({ measuredAt: '2026-03-01T10:00:00Z' }),
        makeBP({ measuredAt: '2026-03-02T10:00:00Z' }),
        makeBP({ measuredAt: '2026-03-08T10:00:00Z' }),
      ];
      const weekly = aggregateToWeekly(readings);
      expect(weekly.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// -- HbA1c calculator -------------------------------------------------------
import { getA1cConfidence, interpretA1c, calculateGMI } from '../glucose/a1c';
import { estimateA1c } from '../glucose/engine';

describe('glucose/a1c', () => {
  describe('estimateA1c (ADAG formula)', () => {
    it('returns 7.0 for avg 154 mg/dL', () => {
      expect(estimateA1c(154)).toBeCloseTo(7.0, 0);
    });

    it('returns ~5.0 for avg 97 mg/dL', () => {
      expect(estimateA1c(97)).toBeCloseTo(5.0, 0);
    });
  });

  describe('getA1cConfidence', () => {
    it('returns high for 30+ readings', () => {
      expect(getA1cConfidence(47)).toBe('high');
    });

    it('returns medium for 15-29 readings', () => {
      expect(getA1cConfidence(20)).toBe('medium');
    });

    it('returns low for <15 readings', () => {
      expect(getA1cConfidence(5)).toBe('low');
    });
  });

  describe('interpretA1c', () => {
    it('classifies normal', () => {
      expect(interpretA1c(5.5)).toEqual({ label: 'Normal', color: '#30D158' });
    });

    it('classifies prediabetes', () => {
      expect(interpretA1c(6.0).label).toBe('Prediabetes Range');
    });

    it('classifies fair control', () => {
      expect(interpretA1c(7.5).label).toBe('Fair Control');
    });

    it('classifies needs improvement', () => {
      expect(interpretA1c(9.0).label).toBe('Needs Improvement');
    });
  });

  describe('calculateGMI', () => {
    it('computes GMI from average glucose', () => {
      // GMI = 3.31 + 0.02392 * 150 = 6.9
      expect(calculateGMI(150)).toBeCloseTo(6.9, 1);
    });

    it('computes GMI for lower glucose', () => {
      // GMI = 3.31 + 0.02392 * 100 = 5.7
      expect(calculateGMI(100)).toBeCloseTo(5.7, 1);
    });
  });
});

// -- FODMAP tracking --------------------------------------------------------
import {
  classifyMealFODMAP, getFODMAPTypes, searchFODMAPFoods,
  calculateTriggerCorrelation,
} from '../fodmap/engine';
import type { FODMAPFood } from '../models/fodmap';

function makeFood(overrides: Partial<FODMAPFood> = {}): FODMAPFood {
  return {
    id: 'ff-1', name: 'test food', category: 'vegetable', fodmapRating: 'low',
    fructose: false, lactose: false, fructan: false, galactan: false, polyol: false,
    servingSize: '1 cup', notes: null, ...overrides,
  };
}

describe('fodmap/engine', () => {
  describe('classifyMealFODMAP', () => {
    it('returns high when any food is high', () => {
      const foods = [makeFood({ fodmapRating: 'low' }), makeFood({ fodmapRating: 'high' })];
      expect(classifyMealFODMAP(foods)).toBe('high');
    });

    it('returns low when all foods are low', () => {
      expect(classifyMealFODMAP([makeFood(), makeFood()])).toBe('low');
    });

    it('returns unknown for empty array', () => {
      expect(classifyMealFODMAP([])).toBe('unknown');
    });
  });

  describe('getFODMAPTypes', () => {
    it('identifies present types', () => {
      const foods = [
        makeFood({ fructose: true, fructan: true }),
        makeFood({ lactose: true }),
      ];
      const types = getFODMAPTypes(foods);
      expect(types.fructose).toBe(true);
      expect(types.fructan).toBe(true);
      expect(types.lactose).toBe(true);
      expect(types.galactan).toBe(false);
      expect(types.polyol).toBe(false);
    });
  });

  describe('searchFODMAPFoods', () => {
    it('finds matching foods case-insensitively', () => {
      const foods = [makeFood({ name: 'Apple' }), makeFood({ name: 'Banana' })];
      expect(searchFODMAPFoods(foods, 'app')).toHaveLength(1);
    });

    it('returns empty for empty query', () => {
      expect(searchFODMAPFoods([makeFood()], '')).toEqual([]);
    });
  });

  describe('calculateTriggerCorrelation', () => {
    it('returns empty with insufficient data', () => {
      expect(calculateTriggerCorrelation([], [])).toEqual([]);
    });

    it('identifies correlations with sufficient data', () => {
      const meals = Array.from({ length: 15 }, (_, i) => ({
        foodItems: 'garlic, rice',
        fodmapRating: 'high',
        eatenAt: new Date(2026, 2, 1 + i, 12, 0).toISOString(),
      }));
      const symptoms = Array.from({ length: 10 }, (_, i) => ({
        severity: 4,
        loggedAt: new Date(2026, 2, 1 + i, 16, 0).toISOString(),
      }));
      const result = calculateTriggerCorrelation(meals, symptoms);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].foodName).toBe('garlic');
    });
  });
});

// -- Weather correlation ----------------------------------------------------
import { pearsonCorrelation, calculateWeatherCorrelation, identifyTriggerProfile, shouldShowForecastAlert } from '../weather/engine';

describe('weather/engine', () => {
  describe('pearsonCorrelation', () => {
    it('returns 1 for perfectly correlated arrays', () => {
      expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1.0, 5);
    });

    it('returns -1 for inversely correlated', () => {
      expect(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for too few points', () => {
      expect(pearsonCorrelation([1], [2])).toBe(0);
    });
  });

  describe('calculateWeatherCorrelation', () => {
    it('returns empty with insufficient data', () => {
      expect(calculateWeatherCorrelation([])).toEqual([]);
    });

    it('computes correlations with 10+ data points', () => {
      const data = Array.from({ length: 15 }, (_, i) => ({
        severity: i % 5 + 1,
        pressure: 1013 - i * 2,
        temperature: 20 + i,
        humidity: 50 + i * 2,
        wind: 10 + i,
      }));
      const results = calculateWeatherCorrelation(data);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].factor).toBeDefined();
    });
  });

  describe('identifyTriggerProfile', () => {
    it('returns null when no significant correlations', () => {
      const correlations = [{ factor: 'pressure' as const, coefficient: 0.1, multiplier: 1.1, sampleSize: 20 }];
      expect(identifyTriggerProfile(correlations)).toBeNull();
    });

    it('returns profile for significant correlations', () => {
      const correlations = [{ factor: 'pressure' as const, coefficient: 0.5, multiplier: 2.8, sampleSize: 30 }];
      const profile = identifyTriggerProfile(correlations);
      expect(profile).not.toBeNull();
      expect(profile!.description).toContain('2.8x');
    });
  });

  describe('shouldShowForecastAlert', () => {
    it('returns true when pressure dropping with strong trigger', () => {
      const profile = {
        topFactors: [{ factor: 'pressure' as const, coefficient: 0.5, multiplier: 2.5, sampleSize: 30 }],
        description: 'test',
      };
      expect(shouldShowForecastAlert(profile, 1005, 1015)).toBe(true);
    });

    it('returns false with no profile', () => {
      expect(shouldShowForecastAlert(null, 1005, 1015)).toBe(false);
    });
  });
});

// -- Pain location map ------------------------------------------------------
import { calculateHeatmap, getActiveZones, getPainMedicationCorrelation } from '../pain/engine';
import type { PainEntry } from '../models/pain';

function makePain(overrides: Partial<PainEntry> = {}): PainEntry {
  return {
    id: 'p-1', bodyZone: 'lower_back', severity: 5, painType: 'aching',
    durationMinutes: 30, radiation: null, notes: null,
    startedAt: '2026-03-01T10:00:00Z', resolvedAt: null,
    createdAt: '2026-03-01T10:00:00Z', ...overrides,
  };
}

describe('pain/engine', () => {
  describe('calculateHeatmap', () => {
    it('returns normalized intensity per zone', () => {
      const entries = [
        makePain({ bodyZone: 'lower_back' }),
        makePain({ bodyZone: 'lower_back' }),
        makePain({ bodyZone: 'lower_back' }),
        makePain({ bodyZone: 'knee_left' }),
        makePain({ bodyZone: 'knee_left' }),
        makePain({ bodyZone: 'knee_left' }),
      ];
      const heatmap = calculateHeatmap(entries);
      const back = heatmap.find((h) => h.zone === 'lower_back');
      expect(back).toBeDefined();
      expect(back!.intensity).toBe(1);
      expect(back!.count).toBe(3);
    });

    it('suppresses zones with fewer than minEntries', () => {
      const entries = [makePain({ bodyZone: 'lower_back' })];
      const heatmap = calculateHeatmap(entries, 3);
      const back = heatmap.find((h) => h.zone === 'lower_back');
      expect(back!.intensity).toBe(0);
    });
  });

  describe('getActiveZones', () => {
    it('returns only unresolved entries', () => {
      const entries = [
        makePain({ resolvedAt: null }),
        makePain({ resolvedAt: '2026-03-02T10:00:00Z' }),
      ];
      expect(getActiveZones(entries)).toHaveLength(1);
    });
  });

  describe('getPainMedicationCorrelation', () => {
    it('computes severity delta', () => {
      const entries = [
        makePain({ severity: 8, startedAt: '2026-02-01T10:00:00Z' }),
        makePain({ severity: 7, startedAt: '2026-02-15T10:00:00Z' }),
        makePain({ severity: 4, startedAt: '2026-03-05T10:00:00Z' }),
        makePain({ severity: 3, startedAt: '2026-03-10T10:00:00Z' }),
        makePain({ severity: 3, startedAt: '2026-03-15T10:00:00Z' }),
      ];
      const meds = [{ name: 'Naproxen', createdAt: '2026-03-01T00:00:00Z' }];
      const result = getPainMedicationCorrelation(entries, meds);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].severityDelta).toBeLessThan(0);
    });

    it('returns empty for insufficient entries', () => {
      expect(getPainMedicationCorrelation([makePain()], [{ name: 'Test', createdAt: '2026-03-01' }])).toEqual([]);
    });
  });
});

// -- CGM integration --------------------------------------------------------
import {
  calculateGMI as cgmGMI, calculateTrendArrow, calculateCV, calculateSD,
  calculateTIRBreakdown, calculateAGP, getCGMStats, deduplicateReadings,
} from '../cgm/engine';
import type { CGMReading } from '../models/cgm';

function makeCGM(overrides: Partial<CGMReading> = {}): CGMReading {
  return {
    id: 'cgm-1', value: 120, unit: 'mg/dL', rangeStatus: 'in_range',
    source: 'healthkit', deviceName: 'Dexcom G7',
    measuredAt: '2026-03-01T10:00:00Z', createdAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

describe('cgm/engine', () => {
  describe('calculateGMI', () => {
    it('computes GMI for 150 mg/dL', () => {
      expect(cgmGMI(150)).toBeCloseTo(6.9, 1);
    });
  });

  describe('calculateTrendArrow', () => {
    it('returns rising for increasing values', () => {
      const readings = [
        makeCGM({ value: 100, measuredAt: '2026-03-01T10:00:00Z' }),
        makeCGM({ value: 130, measuredAt: '2026-03-01T10:05:00Z' }),
        makeCGM({ value: 165, measuredAt: '2026-03-01T10:10:00Z' }),
      ];
      const arrow = calculateTrendArrow(readings);
      expect(['rising_fast', 'rising', 'rising_slow']).toContain(arrow);
    });

    it('returns flat for stable values', () => {
      const readings = [
        makeCGM({ value: 120, measuredAt: '2026-03-01T10:00:00Z' }),
        makeCGM({ value: 121, measuredAt: '2026-03-01T10:05:00Z' }),
        makeCGM({ value: 120, measuredAt: '2026-03-01T10:10:00Z' }),
      ];
      expect(calculateTrendArrow(readings)).toBe('flat');
    });

    it('returns flat for single reading', () => {
      expect(calculateTrendArrow([makeCGM()])).toBe('flat');
    });
  });

  describe('calculateCV', () => {
    it('computes CV% from readings', () => {
      const readings = [
        makeCGM({ value: 100 }),
        makeCGM({ value: 200 }),
        makeCGM({ value: 150 }),
      ];
      const cv = calculateCV(readings);
      expect(cv).toBeGreaterThan(0);
      expect(cv).toBeLessThan(100);
    });

    it('returns 0 for single reading', () => {
      expect(calculateCV([makeCGM()])).toBe(0);
    });
  });

  describe('calculateSD', () => {
    it('computes standard deviation', () => {
      const readings = [makeCGM({ value: 100 }), makeCGM({ value: 200 })];
      expect(calculateSD(readings)).toBeGreaterThan(0);
    });
  });

  describe('calculateTIRBreakdown', () => {
    it('categorizes readings into TIR zones', () => {
      const readings = [
        makeCGM({ value: 50 }),   // very low
        makeCGM({ value: 65 }),   // low
        makeCGM({ value: 120 }),  // in range
        makeCGM({ value: 200 }),  // high
        makeCGM({ value: 300 }),  // very high
      ];
      const tir = calculateTIRBreakdown(readings);
      expect(tir.veryLow).toBe(20);
      expect(tir.low).toBe(20);
      expect(tir.inRange).toBe(20);
      expect(tir.high).toBe(20);
      expect(tir.veryHigh).toBe(20);
    });

    it('returns zeros for empty readings', () => {
      const tir = calculateTIRBreakdown([]);
      expect(tir.inRange).toBe(0);
    });
  });

  describe('calculateAGP', () => {
    it('bins readings into 5-minute intervals', () => {
      const readings = Array.from({ length: 20 }, (_, i) =>
        makeCGM({ value: 100 + i * 5, measuredAt: `2026-03-01T${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00Z` }),
      );
      const agp = calculateAGP(readings);
      expect(agp.length).toBeGreaterThan(0);
      expect(agp[0].p50).toBeDefined();
    });

    it('returns empty for no readings', () => {
      expect(calculateAGP([])).toEqual([]);
    });
  });

  describe('getCGMStats', () => {
    it('computes comprehensive stats', () => {
      const readings = [
        makeCGM({ value: 100 }),
        makeCGM({ value: 150 }),
        makeCGM({ value: 200 }),
      ];
      const stats = getCGMStats(readings);
      expect(stats.averageGlucose).toBeCloseTo(150, 0);
      expect(stats.gmi).toBeGreaterThan(0);
      expect(stats.readingCount).toBe(3);
    });
  });

  describe('deduplicateReadings', () => {
    it('filters readings within threshold', () => {
      const existing = [makeCGM({ measuredAt: '2026-03-01T10:00:00Z' })];
      const incoming = [
        makeCGM({ id: 'new-1', measuredAt: '2026-03-01T10:00:30Z' }), // within 60s -> filtered
        makeCGM({ id: 'new-2', measuredAt: '2026-03-01T10:05:00Z' }), // 5 min later -> kept
      ];
      const result = deduplicateReadings(existing, incoming, 60);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('new-2');
    });
  });
});
