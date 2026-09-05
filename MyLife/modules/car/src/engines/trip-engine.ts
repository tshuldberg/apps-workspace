import type { Trip, TripPurpose } from '../types';

/**
 * Calculate the distance of a trip from odometer readings.
 * Throws if endOdometer < startOdometer.
 */
export function calculateTripDistance(startOdometer: number, endOdometer: number): number {
  if (endOdometer < startOdometer) {
    throw new Error(
      `End odometer (${endOdometer}) cannot be less than start odometer (${startOdometer})`,
    );
  }
  return endOdometer - startOdometer;
}

export interface TripPurposeSummary {
  count: number;
  totalMiles: number;
}

/**
 * Aggregate trips by purpose, optionally filtered to a date range.
 * Returns a record keyed by TripPurpose with count and totalMiles.
 */
export function getTripSummaryByPurpose(
  trips: Trip[],
  dateRange?: { start: string; end: string },
): Record<TripPurpose, TripPurposeSummary> {
  const filtered = dateRange ? getTripsByDateRange(trips, dateRange.start, dateRange.end) : trips;

  const result = {} as Record<TripPurpose, TripPurposeSummary>;
  for (const trip of filtered) {
    if (!result[trip.purpose]) {
      result[trip.purpose] = { count: 0, totalMiles: 0 };
    }
    result[trip.purpose].count += 1;
    result[trip.purpose].totalMiles += trip.distance;
  }
  return result;
}

// IRS standard mileage rates (cents per mile)
const IRS_RATES: Record<number, number> = {
  2025: 70,
  2024: 67,
  2023: 65.5,
};

/**
 * Estimate IRS mileage deduction for business miles.
 * Uses $0.70/mile for 2025 by default. Returns value in cents.
 */
export function estimateIrsDeduction(businessMiles: number, year?: number): number {
  const rateYear = year ?? 2025;
  const ratePerMile = IRS_RATES[rateYear] ?? IRS_RATES[2025];
  return Math.round(businessMiles * ratePerMile);
}

/**
 * Filter trips to those whose startedAt falls within the given date range (inclusive).
 */
export function getTripsByDateRange(trips: Trip[], start: string, end: string): Trip[] {
  return trips.filter((trip) => {
    const tripDate = trip.startedAt.slice(0, 10);
    return tripDate >= start.slice(0, 10) && tripDate <= end.slice(0, 10);
  });
}
