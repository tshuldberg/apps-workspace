import type { FuelLog, Maintenance } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostBreakdown {
  fuelCents: number;
  maintenanceCents: number;
  totalCents: number;
}

export interface MonthlyCostTrend {
  month: string; // YYYY-MM
  costPerMileCents: number;
  totalCents: number;
}

import { getMonthKey, monthsAgoKey } from './date-utils';

// ---------------------------------------------------------------------------
// Engine functions
// ---------------------------------------------------------------------------

/**
 * Calculate overall cost per mile in cents.
 * Total costs (fuel + maintenance) / total distance from fuel logs.
 * Distance is computed as max odometer - min odometer from fuel logs.
 * Returns 0 if there is insufficient data.
 */
export function calculateCostPerMile(
  fuelLogs: FuelLog[],
  maintenanceRecords: Maintenance[],
): number {
  if (fuelLogs.length === 0) return 0;

  const odometers = fuelLogs.map((f) => f.odometerAt);
  const maxOdo = Math.max(...odometers);
  const minOdo = Math.min(...odometers);
  const distance = maxOdo - minOdo;

  if (distance <= 0) return 0;

  const fuelCost = fuelLogs.reduce((sum, f) => sum + f.costCents, 0);
  const maintenanceCost = maintenanceRecords.reduce(
    (sum, m) => sum + (m.costCents ?? 0),
    0,
  );
  const totalCost = fuelCost + maintenanceCost;

  return Math.round(totalCost / distance);
}

/**
 * Get a breakdown of fuel costs vs maintenance costs.
 */
export function getCostBreakdown(
  fuelLogs: FuelLog[],
  maintenanceRecords: Maintenance[],
): CostBreakdown {
  const fuelCents = fuelLogs.reduce((sum, f) => sum + f.costCents, 0);
  const maintenanceCents = maintenanceRecords.reduce(
    (sum, m) => sum + (m.costCents ?? 0),
    0,
  );
  return {
    fuelCents,
    maintenanceCents,
    totalCents: fuelCents + maintenanceCents,
  };
}

/**
 * Get monthly cost trend with cost per mile for each month.
 * Groups fuel logs (by loggedAt) and maintenance records (by performedAt).
 * Defaults to last 12 months.
 */
export function getMonthlyCostTrend(
  fuelLogs: FuelLog[],
  maintenanceRecords: Maintenance[],
  months?: number,
): MonthlyCostTrend[] {
  const limitMonths = months ?? 12;
  const cutoff = monthsAgoKey(limitMonths);

  // Group fuel costs and odometer readings by month
  const monthData = new Map<
    string,
    { totalCents: number; minOdo: number; maxOdo: number }
  >();

  for (const log of fuelLogs) {
    const key = getMonthKey(log.loggedAt);
    if (key < cutoff) continue;
    const entry = monthData.get(key) ?? {
      totalCents: 0,
      minOdo: Infinity,
      maxOdo: -Infinity,
    };
    entry.totalCents += log.costCents;
    entry.minOdo = Math.min(entry.minOdo, log.odometerAt);
    entry.maxOdo = Math.max(entry.maxOdo, log.odometerAt);
    monthData.set(key, entry);
  }

  // Add maintenance costs
  for (const rec of maintenanceRecords) {
    const key = getMonthKey(rec.performedAt);
    if (key < cutoff) continue;
    const entry = monthData.get(key) ?? {
      totalCents: 0,
      minOdo: Infinity,
      maxOdo: -Infinity,
    };
    entry.totalCents += rec.costCents ?? 0;
    monthData.set(key, entry);
  }

  // Build sorted result
  const result: MonthlyCostTrend[] = [];
  const sortedKeys = Array.from(monthData.keys()).sort();

  for (const month of sortedKeys) {
    const data = monthData.get(month)!;
    const distance =
      data.maxOdo > data.minOdo && data.minOdo !== Infinity
        ? data.maxOdo - data.minOdo
        : 0;
    result.push({
      month,
      costPerMileCents: distance > 0 ? Math.round(data.totalCents / distance) : 0,
      totalCents: data.totalCents,
    });
  }

  return result;
}
