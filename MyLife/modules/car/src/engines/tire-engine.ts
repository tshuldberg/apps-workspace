/**
 * Tire analytics engine for MyCar module.
 * Pure functions, no platform dependencies.
 */

import type { TireMeasurement } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export type TireHealth = 'good' | 'fair' | 'low' | 'replace';

export interface TirePositionHealth {
  position: string; // FL, FR, RL, RR, spare
  treadDepth32nds: number;
  health: TireHealth;
}

export interface WearRateResult {
  rate32ndsPerThousandMiles: number;
  dataPoints: number;
}

// ── Health assessment ──────────────────────────────────────────────────────

/**
 * Determine tire health based on tread depth in 32nds of an inch.
 * - replace: <= 2/32
 * - low: <= 4/32
 * - fair: <= 6/32
 * - good: > 6/32
 */
export function getTireHealth(treadDepth32nds: number): TireHealth {
  if (treadDepth32nds <= 2) return 'replace';
  if (treadDepth32nds <= 4) return 'low';
  if (treadDepth32nds <= 6) return 'fair';
  return 'good';
}

/**
 * Get health status for each tire position based on the latest measurement.
 * Groups measurements by position and uses the most recent one (by measuredAt).
 */
export function getPositionHealth(measurements: TireMeasurement[]): TirePositionHealth[] {
  const latestByPosition = new Map<string, TireMeasurement>();

  for (const m of measurements) {
    const existing = latestByPosition.get(m.position);
    if (!existing || m.measuredAt > existing.measuredAt) {
      latestByPosition.set(m.position, m);
    }
  }

  const result: TirePositionHealth[] = [];
  for (const [position, measurement] of latestByPosition) {
    result.push({
      position,
      treadDepth32nds: measurement.treadDepth32nds,
      health: getTireHealth(measurement.treadDepth32nds),
    });
  }

  // Sort by position for deterministic output: FL, FR, RL, RR, spare
  const order = ['FL', 'FR', 'RL', 'RR', 'spare'];
  result.sort((a, b) => {
    const ai = order.indexOf(a.position);
    const bi = order.indexOf(b.position);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return result;
}

// ── Wear rate calculation ──────────────────────────────────────────────────

/**
 * Calculate tread wear rate in 32nds per 1000 miles using linear regression
 * over measurements that include odometer readings.
 *
 * Requires at least 2 measurements with different odometer values.
 * Returns rate of 0 with the data point count if insufficient data.
 */
export function calculateWearRate(measurements: TireMeasurement[]): WearRateResult {
  // Filter to measurements with odometer data
  const withOdo = measurements.filter(
    (m) => m.odometerAt !== null && m.odometerAt !== undefined,
  );

  if (withOdo.length < 2) {
    return { rate32ndsPerThousandMiles: 0, dataPoints: withOdo.length };
  }

  // Check that we have at least 2 different odometer values
  const uniqueOdos = new Set(withOdo.map((m) => m.odometerAt));
  if (uniqueOdos.size < 2) {
    return { rate32ndsPerThousandMiles: 0, dataPoints: withOdo.length };
  }

  // Linear regression: tread depth (y) vs odometer miles (x)
  // Wear rate is the negative slope (depth decreases as miles increase)
  const n = withOdo.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const m of withOdo) {
    const x = m.odometerAt as number;
    const y = m.treadDepth32nds;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { rate32ndsPerThousandMiles: 0, dataPoints: n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // Slope is depth change per mile; we want loss per 1000 miles (positive)
  const ratePerThousand = Math.abs(slope) * 1000;

  return {
    rate32ndsPerThousandMiles: Math.round(ratePerThousand * 100) / 100,
    dataPoints: n,
  };
}

// ── Prediction ─────────────────────────────────────────────────────────────

/**
 * Predict miles remaining until tread reaches the replacement threshold (2/32).
 * Returns 0 if current depth is already at or below 2/32, or if wear rate is 0.
 */
export function predictReplacementMiles(
  currentDepth32nds: number,
  wearRate32ndsPerThousandMiles: number,
): number {
  if (currentDepth32nds <= 2) return 0;
  if (wearRate32ndsPerThousandMiles <= 0) return 0;
  const remaining32nds = currentDepth32nds - 2;
  return Math.round((remaining32nds / wearRate32ndsPerThousandMiles) * 1000);
}

// ── Rotation schedule ──────────────────────────────────────────────────────

/**
 * Calculate the recommended next rotation odometer reading.
 * Default interval is 7500 miles.
 * Returns null if no last rotation odometer is available.
 */
export function getRecommendedRotationOdometer(
  lastRotationOdometer: number | null,
  intervalMiles = 7500,
): number | null {
  if (lastRotationOdometer === null) return null;
  return lastRotationOdometer + intervalMiles;
}

// ── Cost analysis ──────────────────────────────────────────────────────────

/**
 * Calculate tire cost per mile in cents.
 * Returns 0 if no distance has been driven.
 */
export function getTireCostPerMile(
  purchasePriceCents: number,
  purchaseOdometer: number,
  currentOdometer: number,
): number {
  const distance = currentOdometer - purchaseOdometer;
  if (distance <= 0) return 0;
  return Math.round((purchasePriceCents / distance) * 100) / 100;
}
