import type { FuelLog } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StationStats {
  station: string;
  avgPricePerGallon: number; // dollars
  fillCount: number;
  lastVisit: string;
}

export interface PriceTrendPoint {
  month: string; // YYYY-MM
  avgPricePerGallon: number;
  totalGallons: number;
}

import { getMonthKey, monthsAgoKey } from './date-utils';

// ---------------------------------------------------------------------------
// Engine functions
// ---------------------------------------------------------------------------

/**
 * Calculate the average price per gallon across all fuel logs.
 * Returns dollars (costCents converted). Returns 0 if no logs.
 */
export function getAveragePricePerGallon(fuelLogs: FuelLog[]): number {
  if (fuelLogs.length === 0) return 0;

  const totalCents = fuelLogs.reduce((sum, f) => sum + f.costCents, 0);
  const totalGallons = fuelLogs.reduce((sum, f) => sum + f.gallons, 0);

  if (totalGallons <= 0) return 0;

  return totalCents / 100 / totalGallons;
}

/**
 * Get monthly price trend. Groups fuel logs by month (loggedAt),
 * computes average price per gallon and total gallons for each month.
 * Defaults to last 12 months.
 */
export function getPriceTrend(fuelLogs: FuelLog[], months?: number): PriceTrendPoint[] {
  const limitMonths = months ?? 12;
  const cutoff = monthsAgoKey(limitMonths);

  const monthData = new Map<string, { totalCents: number; totalGallons: number }>();

  for (const log of fuelLogs) {
    const key = getMonthKey(log.loggedAt);
    if (key < cutoff) continue;
    const entry = monthData.get(key) ?? { totalCents: 0, totalGallons: 0 };
    entry.totalCents += log.costCents;
    entry.totalGallons += log.gallons;
    monthData.set(key, entry);
  }

  const result: PriceTrendPoint[] = [];
  const sortedKeys = Array.from(monthData.keys()).sort();

  for (const month of sortedKeys) {
    const data = monthData.get(month)!;
    result.push({
      month,
      avgPricePerGallon:
        data.totalGallons > 0 ? data.totalCents / 100 / data.totalGallons : 0,
      totalGallons: data.totalGallons,
    });
  }

  return result;
}

/**
 * Analyze fuel logs by station. Groups by station name, computes
 * average price per gallon, fill count, and last visit date.
 * Skips logs with null stations. Sorted by fill count descending.
 */
export function getStationAnalysis(fuelLogs: FuelLog[]): StationStats[] {
  const stationMap = new Map<
    string,
    { totalCents: number; totalGallons: number; count: number; lastVisit: string }
  >();

  for (const log of fuelLogs) {
    if (log.station === null) continue;
    const entry = stationMap.get(log.station) ?? {
      totalCents: 0,
      totalGallons: 0,
      count: 0,
      lastVisit: '',
    };
    entry.totalCents += log.costCents;
    entry.totalGallons += log.gallons;
    entry.count += 1;
    if (log.loggedAt > entry.lastVisit) {
      entry.lastVisit = log.loggedAt;
    }
    stationMap.set(log.station, entry);
  }

  const results: StationStats[] = [];
  for (const [station, data] of stationMap.entries()) {
    results.push({
      station,
      avgPricePerGallon:
        data.totalGallons > 0 ? data.totalCents / 100 / data.totalGallons : 0,
      fillCount: data.count,
      lastVisit: data.lastVisit,
    });
  }

  // Sort by fill count descending
  results.sort((a, b) => b.fillCount - a.fillCount);
  return results;
}

/**
 * Find the station with the lowest average price per gallon.
 * Returns null if no station data is available.
 */
export function getCheapestStation(fuelLogs: FuelLog[]): StationStats | null {
  const stations = getStationAnalysis(fuelLogs);
  if (stations.length === 0) return null;

  let cheapest = stations[0];
  for (const s of stations) {
    if (s.avgPricePerGallon < cheapest.avgPricePerGallon) {
      cheapest = s;
    }
  }
  return cheapest;
}

/**
 * Project monthly fuel cost in cents based on recent fuel economy
 * and average price per gallon.
 *
 * Calculation: (milesPerMonth / avgMPG) * avgPricePerGallon * 100
 * Returns 0 if insufficient data.
 */
export function getFuelCostProjection(fuelLogs: FuelLog[], milesPerMonth: number): number {
  if (fuelLogs.length < 2) return 0;

  const odometers = fuelLogs.map((f) => f.odometerAt);
  const totalDistance = Math.max(...odometers) - Math.min(...odometers);
  const totalGallons = fuelLogs.reduce((sum, f) => sum + f.gallons, 0);

  if (totalDistance <= 0 || totalGallons <= 0) return 0;

  const avgMPG = totalDistance / totalGallons;
  const avgPricePerGallonDollars = getAveragePricePerGallon(fuelLogs);

  // gallons needed per month * price per gallon in cents
  const gallonsNeeded = milesPerMonth / avgMPG;
  return Math.round(gallonsNeeded * avgPricePerGallonDollars * 100);
}
