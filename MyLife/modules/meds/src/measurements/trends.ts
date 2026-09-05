import type { DatabaseAdapter } from '@mylife/db';
import type { MeasurementTrendPoint, MedMarker } from '../models/measurement';

/**
 * Get a time-series of measurement values for a given type and date range.
 */
export function getMeasurementTrend(
  db: DatabaseAdapter,
  type: string,
  from: string,
  to: string,
): MeasurementTrendPoint[] {
  const rows = db.query<{ measured_at: string; value: string }>(
    `SELECT measured_at, value FROM md_measurements
     WHERE type = ? AND measured_at >= ? AND measured_at <= ?
     ORDER BY measured_at ASC`,
    [type, from, to],
  );

  return rows.map((row) => ({
    date: row.measured_at,
    value: row.value,
  }));
}

/**
 * Same as getMeasurementTrend, but includes medication start/stop dates as markers.
 * Markers are derived from md_medications created_at (start) and end_date (stop).
 */
export function getMeasurementTrendWithMedMarkers(
  db: DatabaseAdapter,
  type: string,
  from: string,
  to: string,
): { points: MeasurementTrendPoint[]; markers: MedMarker[] } {
  const points = getMeasurementTrend(db, type, from, to);

  // Get medication start events (created_at within range)
  const startRows = db.query<{ name: string; created_at: string }>(
    `SELECT name, created_at FROM md_medications
     WHERE created_at >= ? AND created_at <= ?
     ORDER BY created_at ASC`,
    [from, to],
  );

  // Get medication stop events (end_date within range)
  const stopRows = db.query<{ name: string; end_date: string }>(
    `SELECT name, end_date FROM md_medications
     WHERE end_date IS NOT NULL AND end_date >= ? AND end_date <= ?
     ORDER BY end_date ASC`,
    [from, to],
  );

  const markers: MedMarker[] = [
    ...startRows.map((row) => ({
      medName: row.name,
      event: 'started' as const,
      date: row.created_at,
    })),
    ...stopRows.map((row) => ({
      medName: row.name,
      event: 'stopped' as const,
      date: row.end_date,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { points, markers };
}
