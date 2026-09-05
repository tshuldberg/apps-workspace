import { describe, it, expect } from 'vitest';
import { estimateCapacityFromSize, mapConfidenceToShape } from '../lib/ai/floor-plan-vision';
import { predictSurge } from '../lib/ai/surge-predictor';
import type { SurgeInputs } from '../lib/ai/surge-predictor';
import { calculateZoneLoad } from '../lib/ai/server-zones';
import { generateJsonExport, generateCsvExport, getExportFilename } from '../lib/diner-export/export';
import { SUSTAINABILITY_TAGS } from '../lib/diner-export/types';
import type { DinerExportData } from '../lib/diner-export/types';

describe('Floor Plan Vision', () => {
  describe('estimateCapacityFromSize', () => {
    it('small table returns 2', () => {
      expect(estimateCapacityFromSize(30, 30, 'square')).toBe(2);
    });

    it('medium table returns 4', () => {
      expect(estimateCapacityFromSize(60, 60, 'square')).toBe(4);
    });

    it('large table returns 6', () => {
      expect(estimateCapacityFromSize(80, 80, 'square')).toBe(6);
    });
  });

  describe('mapConfidenceToShape', () => {
    it('high roundness returns round', () => {
      expect(mapConfidenceToShape(1.0, 0.9)).toBe('round');
    });

    it('high aspect ratio returns bar', () => {
      expect(mapConfidenceToShape(4.0, 0.3)).toBe('bar');
    });

    it('square aspect returns square', () => {
      expect(mapConfidenceToShape(1.0, 0.5)).toBe('square');
    });
  });
});

describe('Surge Predictor', () => {
  const baseInputs: SurgeInputs = {
    dayOfWeek: 3, // Wednesday
    hour: 12,
    weatherCondition: 'clear',
    temperature: 72,
    hasLocalEvent: false,
    historicalAvgWalkIns: 20,
    currentWaitlistSize: 5,
  };

  it('Friday peak hour produces high probability', () => {
    const result = predictSurge({ ...baseInputs, dayOfWeek: 5, hour: 19 });
    expect(result.probability).toBeGreaterThan(0.7);
  });

  it('rainy day reduces probability', () => {
    const clearResult = predictSurge({ ...baseInputs });
    const rainResult = predictSurge({ ...baseInputs, weatherCondition: 'rain' });
    expect(rainResult.probability).toBeLessThan(clearResult.probability);
  });

  it('local event increases probability', () => {
    const noEvent = predictSurge({ ...baseInputs });
    const withEvent = predictSurge({ ...baseInputs, hasLocalEvent: true, eventName: 'Concert' });
    expect(withEvent.probability).toBeGreaterThan(noEvent.probability);
  });

  it('probability stays within 0-1', () => {
    // Extreme high case
    const high = predictSurge({ ...baseInputs, dayOfWeek: 5, hour: 19, hasLocalEvent: true, weatherCondition: 'clear' });
    expect(high.probability).toBeLessThanOrEqual(1);
    expect(high.probability).toBeGreaterThanOrEqual(0);

    // Extreme low case
    const low = predictSurge({ ...baseInputs, dayOfWeek: 0, hour: 10, weatherCondition: 'extreme' });
    expect(low.probability).toBeLessThanOrEqual(1);
    expect(low.probability).toBeGreaterThanOrEqual(0);
  });
});

describe('Server Zones', () => {
  it('high load returns red status', () => {
    const result = calculateZoneLoad({ zone: 'A', activeCovers: 18, capacity: 20, lastCheckTouchMinutes: [3, 4] });
    expect(result.status).toBe('red');
  });

  it('medium load returns yellow status', () => {
    const result = calculateZoneLoad({ zone: 'B', activeCovers: 14, capacity: 20, lastCheckTouchMinutes: [3, 4] });
    expect(result.status).toBe('yellow');
  });

  it('low load returns green status', () => {
    const result = calculateZoneLoad({ zone: 'C', activeCovers: 8, capacity: 20, lastCheckTouchMinutes: [2, 3] });
    expect(result.status).toBe('green');
  });
});

describe('Diner Export', () => {
  const mockData: DinerExportData = {
    profile: { name: 'Test User', email: 'test@example.com' },
    reservations: [
      { restaurantName: 'Cafe Luna', date: '2026-04-20', partySize: 4, status: 'confirmed' },
      { restaurantName: 'Grill, Bar & Co', date: '2026-04-21', partySize: 2, status: 'pending' },
    ],
    preferences: { seating: 'outdoor' },
    allergens: ['Gluten'],
    exportedAt: '2026-04-20T00:00:00Z',
    format: 'json',
  };

  it('generateJsonExport returns valid JSON', () => {
    const result = generateJsonExport(mockData);
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.profile.name).toBe('Test User');
  });

  it('generateCsvExport includes headers', () => {
    const result = generateCsvExport(mockData);
    const lines = result.split('\n');
    expect(lines[0]).toBe('Restaurant,Date,Party Size,Status');
  });

  it('generateCsvExport escapes commas in values', () => {
    const result = generateCsvExport(mockData);
    expect(result).toContain('"Grill, Bar & Co"');
  });

  it('SUSTAINABILITY_TAGS has 7 entries', () => {
    expect(SUSTAINABILITY_TAGS).toHaveLength(7);
  });

  it('getExportFilename includes date and format extension', () => {
    const jsonFilename = getExportFilename('json');
    expect(jsonFilename).toMatch(/mylife-dining-export-\d{4}-\d{2}-\d{2}\.json/);

    const csvFilename = getExportFilename('csv');
    expect(csvFilename).toMatch(/mylife-dining-export-\d{4}-\d{2}-\d{2}\.csv/);
  });
});
