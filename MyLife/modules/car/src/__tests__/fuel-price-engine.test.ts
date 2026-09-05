import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import type { FuelLog } from '../types';
import {
  getAveragePricePerGallon,
  getPriceTrend,
  getStationAnalysis,
  getCheapestStation,
  getFuelCostProjection,
} from '../engines/fuel-price-engine';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-09-15T12:00:00Z'));
});

afterAll(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeFuelLog(overrides: Partial<FuelLog> = {}): FuelLog {
  return {
    id: 'f1',
    vehicleId: 'v1',
    gallons: 10,
    costCents: 4000, // $40.00 => $4.00/gal
    odometerAt: 10000,
    station: 'Shell',
    isFullTank: true,
    loggedAt: '2025-06-15T08:00:00Z',
    createdAt: '2025-06-15T08:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getAveragePricePerGallon
// ---------------------------------------------------------------------------

describe('getAveragePricePerGallon', () => {
  it('calculates weighted average price per gallon in dollars', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', gallons: 10, costCents: 4000 }), // $4.00/gal
      makeFuelLog({ id: 'f2', gallons: 10, costCents: 3600 }), // $3.60/gal
    ];
    // Total cost = $76.00, total gallons = 20 => $3.80/gal
    expect(getAveragePricePerGallon(logs)).toBeCloseTo(3.8, 2);
  });

  it('returns 0 for empty array', () => {
    expect(getAveragePricePerGallon([])).toBe(0);
  });

  it('handles single log correctly', () => {
    const logs = [makeFuelLog({ gallons: 12, costCents: 4800 })];
    // $48 / 12 gal = $4.00/gal
    expect(getAveragePricePerGallon(logs)).toBeCloseTo(4.0, 2);
  });
});

// ---------------------------------------------------------------------------
// getPriceTrend
// ---------------------------------------------------------------------------

describe('getPriceTrend', () => {
  it('groups fuel logs by month and computes avg price', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', loggedAt: '2025-06-01T08:00:00Z', gallons: 10, costCents: 4000 }),
      makeFuelLog({ id: 'f2', loggedAt: '2025-06-15T08:00:00Z', gallons: 10, costCents: 3600 }),
      makeFuelLog({ id: 'f3', loggedAt: '2025-07-01T08:00:00Z', gallons: 12, costCents: 5040 }),
    ];
    const trend = getPriceTrend(logs, 12);
    expect(trend).toHaveLength(2);
    expect(trend[0].month).toBe('2025-06');
    // June: $76 / 20 gal = $3.80/gal
    expect(trend[0].avgPricePerGallon).toBeCloseTo(3.8, 2);
    expect(trend[0].totalGallons).toBe(20);
    // July: $50.40 / 12 gal = $4.20/gal
    expect(trend[1].month).toBe('2025-07');
    expect(trend[1].avgPricePerGallon).toBeCloseTo(4.2, 2);
    expect(trend[1].totalGallons).toBe(12);
  });

  it('returns empty array for no logs', () => {
    expect(getPriceTrend([], 12)).toEqual([]);
  });

  it('sorts months chronologically', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', loggedAt: '2025-08-01T08:00:00Z', gallons: 10, costCents: 4000 }),
      makeFuelLog({ id: 'f2', loggedAt: '2025-06-01T08:00:00Z', gallons: 10, costCents: 3500 }),
    ];
    const trend = getPriceTrend(logs, 12);
    expect(trend[0].month).toBe('2025-06');
    expect(trend[1].month).toBe('2025-08');
  });
});

// ---------------------------------------------------------------------------
// getStationAnalysis
// ---------------------------------------------------------------------------

describe('getStationAnalysis', () => {
  it('groups by station with correct stats', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', station: 'Shell', gallons: 10, costCents: 4000, loggedAt: '2025-06-01T08:00:00Z' }),
      makeFuelLog({ id: 'f2', station: 'Shell', gallons: 10, costCents: 3800, loggedAt: '2025-06-15T08:00:00Z' }),
      makeFuelLog({ id: 'f3', station: 'Costco', gallons: 15, costCents: 5250, loggedAt: '2025-06-10T08:00:00Z' }),
    ];
    const stations = getStationAnalysis(logs);
    expect(stations).toHaveLength(2);

    // Shell has more fills, so it comes first
    expect(stations[0].station).toBe('Shell');
    expect(stations[0].fillCount).toBe(2);
    // ($40 + $38) / 20 gal = $3.90/gal
    expect(stations[0].avgPricePerGallon).toBeCloseTo(3.9, 2);
    expect(stations[0].lastVisit).toBe('2025-06-15T08:00:00Z');

    expect(stations[1].station).toBe('Costco');
    expect(stations[1].fillCount).toBe(1);
    // $52.50 / 15 gal = $3.50/gal
    expect(stations[1].avgPricePerGallon).toBeCloseTo(3.5, 2);
  });

  it('skips logs with null station', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', station: 'Shell', gallons: 10, costCents: 4000 }),
      makeFuelLog({ id: 'f2', station: null, gallons: 10, costCents: 3500 }),
    ];
    const stations = getStationAnalysis(logs);
    expect(stations).toHaveLength(1);
    expect(stations[0].station).toBe('Shell');
  });

  it('returns empty for no logs', () => {
    expect(getStationAnalysis([])).toEqual([]);
  });

  it('sorts by fill count descending', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', station: 'Chevron', gallons: 10, costCents: 4000, loggedAt: '2025-06-01T08:00:00Z' }),
      makeFuelLog({ id: 'f2', station: 'Costco', gallons: 10, costCents: 3500, loggedAt: '2025-06-05T08:00:00Z' }),
      makeFuelLog({ id: 'f3', station: 'Costco', gallons: 10, costCents: 3600, loggedAt: '2025-06-10T08:00:00Z' }),
      makeFuelLog({ id: 'f4', station: 'Costco', gallons: 10, costCents: 3400, loggedAt: '2025-06-15T08:00:00Z' }),
    ];
    const stations = getStationAnalysis(logs);
    expect(stations[0].station).toBe('Costco');
    expect(stations[0].fillCount).toBe(3);
    expect(stations[1].station).toBe('Chevron');
    expect(stations[1].fillCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCheapestStation
// ---------------------------------------------------------------------------

describe('getCheapestStation', () => {
  it('returns the station with the lowest avg price', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', station: 'Shell', gallons: 10, costCents: 4000 }),
      makeFuelLog({ id: 'f2', station: 'Costco', gallons: 10, costCents: 3200 }),
      makeFuelLog({ id: 'f3', station: 'Chevron', gallons: 10, costCents: 4200 }),
    ];
    const cheapest = getCheapestStation(logs);
    expect(cheapest).not.toBeNull();
    expect(cheapest!.station).toBe('Costco');
    // $32 / 10 gal = $3.20/gal
    expect(cheapest!.avgPricePerGallon).toBeCloseTo(3.2, 2);
  });

  it('returns null for empty logs', () => {
    expect(getCheapestStation([])).toBeNull();
  });

  it('returns null when all logs have null station', () => {
    const logs = [makeFuelLog({ station: null })];
    expect(getCheapestStation(logs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getFuelCostProjection
// ---------------------------------------------------------------------------

describe('getFuelCostProjection', () => {
  it('projects monthly fuel cost in cents', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', odometerAt: 10000, gallons: 10, costCents: 4000 }),
      makeFuelLog({ id: 'f2', odometerAt: 10300, gallons: 10, costCents: 4000 }),
    ];
    // Distance = 300 miles, total gallons = 20, avgMPG = 15
    // Avg price = $80 / 20 gal = $4.00/gal
    // 1000 miles/month / 15 mpg = 66.67 gal * $4.00 = $266.67 => 26667 cents
    const projection = getFuelCostProjection(logs, 1000);
    expect(projection).toBe(26667);
  });

  it('returns 0 with fewer than 2 fuel logs', () => {
    expect(getFuelCostProjection([makeFuelLog()], 1000)).toBe(0);
  });

  it('returns 0 when distance is 0', () => {
    const logs: FuelLog[] = [
      makeFuelLog({ id: 'f1', odometerAt: 10000 }),
      makeFuelLog({ id: 'f2', odometerAt: 10000 }),
    ];
    expect(getFuelCostProjection(logs, 1000)).toBe(0);
  });
});
