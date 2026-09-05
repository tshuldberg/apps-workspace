import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import type { FuelLog, Maintenance } from '../types';
import {
  calculateCostPerMile,
  getCostBreakdown,
  getMonthlyCostTrend,
} from '../engines/cost-engine';

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
    gallons: 12.5,
    costCents: 4500,
    odometerAt: 10000,
    station: 'Shell',
    isFullTank: true,
    loggedAt: '2025-06-15T08:00:00Z',
    createdAt: '2025-06-15T08:00:00Z',
    ...overrides,
  };
}

function makeMaintenance(overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    id: 'm1',
    vehicleId: 'v1',
    type: 'oil_change',
    description: null,
    costCents: 5000,
    odometerAt: 10000,
    performedAt: '2025-06-15T08:00:00Z',
    nextDueDate: null,
    nextDueOdometer: null,
    notes: null,
    createdAt: '2025-06-15T08:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateCostPerMile
// ---------------------------------------------------------------------------

describe('calculateCostPerMile', () => {
  it('calculates cost per mile from fuel logs and maintenance', () => {
    const fuelLogs: FuelLog[] = [
      makeFuelLog({ id: 'f1', odometerAt: 10000, costCents: 4000 }),
      makeFuelLog({ id: 'f2', odometerAt: 10500, costCents: 4500 }),
    ];
    const maintenance: Maintenance[] = [
      makeMaintenance({ id: 'm1', costCents: 5000 }),
    ];
    // Distance = 10500 - 10000 = 500 miles
    // Total cost = 4000 + 4500 + 5000 = 13500 cents
    // Cost per mile = 13500 / 500 = 27 cents
    expect(calculateCostPerMile(fuelLogs, maintenance)).toBe(27);
  });

  it('returns 0 for empty fuel logs', () => {
    expect(calculateCostPerMile([], [makeMaintenance()])).toBe(0);
  });

  it('returns 0 for a single fuel log (no distance)', () => {
    const fuelLogs = [makeFuelLog({ odometerAt: 10000, costCents: 4000 })];
    expect(calculateCostPerMile(fuelLogs, [])).toBe(0);
  });

  it('handles fuel-only cost (no maintenance)', () => {
    const fuelLogs: FuelLog[] = [
      makeFuelLog({ id: 'f1', odometerAt: 20000, costCents: 3000 }),
      makeFuelLog({ id: 'f2', odometerAt: 20300, costCents: 3000 }),
    ];
    // Distance = 300 miles, total = 6000 cents, cost/mile = 20
    expect(calculateCostPerMile(fuelLogs, [])).toBe(20);
  });

  it('handles maintenance with null costCents', () => {
    const fuelLogs: FuelLog[] = [
      makeFuelLog({ id: 'f1', odometerAt: 5000, costCents: 2000 }),
      makeFuelLog({ id: 'f2', odometerAt: 5200, costCents: 2000 }),
    ];
    const maintenance = [makeMaintenance({ costCents: null })];
    // Distance = 200, total fuel = 4000, maintenance = 0
    expect(calculateCostPerMile(fuelLogs, maintenance)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// getCostBreakdown
// ---------------------------------------------------------------------------

describe('getCostBreakdown', () => {
  it('sums fuel and maintenance costs separately', () => {
    const fuelLogs: FuelLog[] = [
      makeFuelLog({ id: 'f1', costCents: 3000 }),
      makeFuelLog({ id: 'f2', costCents: 4000 }),
    ];
    const maintenance: Maintenance[] = [
      makeMaintenance({ id: 'm1', costCents: 5000 }),
      makeMaintenance({ id: 'm2', costCents: 2500 }),
    ];
    const breakdown = getCostBreakdown(fuelLogs, maintenance);
    expect(breakdown.fuelCents).toBe(7000);
    expect(breakdown.maintenanceCents).toBe(7500);
    expect(breakdown.totalCents).toBe(14500);
  });

  it('returns zeros for empty inputs', () => {
    const breakdown = getCostBreakdown([], []);
    expect(breakdown.fuelCents).toBe(0);
    expect(breakdown.maintenanceCents).toBe(0);
    expect(breakdown.totalCents).toBe(0);
  });

  it('handles maintenance with null costCents gracefully', () => {
    const fuelLogs = [makeFuelLog({ costCents: 1000 })];
    const maintenance = [
      makeMaintenance({ id: 'm1', costCents: 500 }),
      makeMaintenance({ id: 'm2', costCents: null }),
    ];
    const breakdown = getCostBreakdown(fuelLogs, maintenance);
    expect(breakdown.maintenanceCents).toBe(500);
    expect(breakdown.totalCents).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// getMonthlyCostTrend
// ---------------------------------------------------------------------------

describe('getMonthlyCostTrend', () => {
  it('groups costs by month and computes cost per mile', () => {
    const fuelLogs: FuelLog[] = [
      makeFuelLog({ id: 'f1', loggedAt: '2025-06-01T08:00:00Z', odometerAt: 10000, costCents: 3000 }),
      makeFuelLog({ id: 'f2', loggedAt: '2025-06-15T08:00:00Z', odometerAt: 10300, costCents: 3200 }),
      makeFuelLog({ id: 'f3', loggedAt: '2025-07-01T08:00:00Z', odometerAt: 10600, costCents: 3100 }),
      makeFuelLog({ id: 'f4', loggedAt: '2025-07-15T08:00:00Z', odometerAt: 10900, costCents: 3300 }),
    ];
    const trend = getMonthlyCostTrend(fuelLogs, [], 12);
    expect(trend).toHaveLength(2);
    expect(trend[0].month).toBe('2025-06');
    expect(trend[1].month).toBe('2025-07');
    // June: distance 300, cost 6200 => 21 cents/mile (rounded)
    expect(trend[0].costPerMileCents).toBe(21);
    expect(trend[0].totalCents).toBe(6200);
  });

  it('includes maintenance costs in monthly totals', () => {
    const fuelLogs: FuelLog[] = [
      makeFuelLog({ id: 'f1', loggedAt: '2025-06-01T08:00:00Z', odometerAt: 10000, costCents: 3000 }),
      makeFuelLog({ id: 'f2', loggedAt: '2025-06-20T08:00:00Z', odometerAt: 10500, costCents: 3000 }),
    ];
    const maintenance: Maintenance[] = [
      makeMaintenance({ id: 'm1', performedAt: '2025-06-10T08:00:00Z', costCents: 5000 }),
    ];
    const trend = getMonthlyCostTrend(fuelLogs, maintenance, 12);
    expect(trend).toHaveLength(1);
    // Total: 3000 + 3000 + 5000 = 11000, distance = 500
    expect(trend[0].totalCents).toBe(11000);
    expect(trend[0].costPerMileCents).toBe(22);
  });

  it('returns empty array for no data', () => {
    expect(getMonthlyCostTrend([], [], 12)).toEqual([]);
  });

  it('sets costPerMileCents to 0 when only maintenance (no odometer data)', () => {
    const maintenance: Maintenance[] = [
      makeMaintenance({ id: 'm1', performedAt: '2025-06-10T08:00:00Z', costCents: 5000 }),
    ];
    const trend = getMonthlyCostTrend([], maintenance, 12);
    expect(trend).toHaveLength(1);
    expect(trend[0].costPerMileCents).toBe(0);
    expect(trend[0].totalCents).toBe(5000);
  });
});
