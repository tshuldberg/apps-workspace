import type { DatabaseAdapter } from '@mylife/db';
import type {
  GlucoseReading,
  CreateGlucoseReadingInput,
  UpdateGlucoseReadingInput,
  GlucoseUnit,
} from '../models/glucose';
import { classifyGlucose, isInRange } from '../glucose/engine';

function rowToGlucoseReading(row: Record<string, unknown>): GlucoseReading {
  return {
    id: row.id as string,
    value: row.value as number,
    unit: row.unit as GlucoseUnit,
    mealContext: (row.meal_context as GlucoseReading['mealContext']) ?? null,
    mealType: (row.meal_type as GlucoseReading['mealType']) ?? null,
    inRange: (row.in_range as number) === 1,
    rangeStatus: row.range_status as GlucoseReading['rangeStatus'],
    notes: (row.notes as string) ?? null,
    measuredAt: row.measured_at as string,
    createdAt: row.created_at as string,
  };
}

export function logGlucoseReading(
  db: DatabaseAdapter,
  id: string,
  input: CreateGlucoseReadingInput,
): GlucoseReading {
  const now = new Date().toISOString();
  const unit = input.unit ?? 'mg/dL';
  const rangeStatus = classifyGlucose(input.value, unit);
  const inRange = isInRange(input.value, unit);

  db.execute(
    `INSERT INTO md_glucose_readings (id, value, unit, meal_context, meal_type, in_range, range_status, notes, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.value,
      unit,
      input.mealContext ?? null,
      input.mealType ?? null,
      inRange ? 1 : 0,
      rangeStatus,
      input.notes ?? null,
      input.measuredAt ?? now,
      now,
    ],
  );

  return {
    id,
    value: input.value,
    unit,
    mealContext: input.mealContext ?? null,
    mealType: input.mealType ?? null,
    inRange,
    rangeStatus,
    notes: input.notes ?? null,
    measuredAt: input.measuredAt ?? now,
    createdAt: now,
  };
}

export function getGlucoseReadingById(
  db: DatabaseAdapter,
  id: string,
): GlucoseReading | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_glucose_readings WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToGlucoseReading(rows[0]) : null;
}

export function getGlucoseReadings(
  db: DatabaseAdapter,
  opts?: { from?: string; to?: string; mealContext?: string; limit?: number },
): GlucoseReading[] {
  let sql = 'SELECT * FROM md_glucose_readings WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.from) {
    sql += ' AND measured_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND measured_at <= ?';
    params.push(opts.to);
  }
  if (opts?.mealContext) {
    sql += ' AND meal_context = ?';
    params.push(opts.mealContext);
  }

  sql += ' ORDER BY measured_at DESC LIMIT ?';
  params.push(opts?.limit ?? 1000);

  return db.query<Record<string, unknown>>(sql, params).map(rowToGlucoseReading);
}

export function getLatestGlucoseReading(
  db: DatabaseAdapter,
  withinMinutes: number = 30,
): GlucoseReading | null {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM md_glucose_readings
     WHERE measured_at >= ?
     ORDER BY measured_at DESC LIMIT 1`,
    [cutoff],
  );
  return rows.length > 0 ? rowToGlucoseReading(rows[0]) : null;
}

export function updateGlucoseReading(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateGlucoseReadingInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.value !== undefined) { sets.push('value = ?'); params.push(updates.value); }
  if (updates.unit !== undefined) { sets.push('unit = ?'); params.push(updates.unit); }
  if (updates.mealContext !== undefined) { sets.push('meal_context = ?'); params.push(updates.mealContext); }
  if (updates.mealType !== undefined) { sets.push('meal_type = ?'); params.push(updates.mealType); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
  if (updates.measuredAt !== undefined) { sets.push('measured_at = ?'); params.push(updates.measuredAt); }

  // Reclassify if value or unit changed
  if (updates.value !== undefined || updates.unit !== undefined) {
    const existing = getGlucoseReadingById(db, id);
    if (existing) {
      const newValue = updates.value ?? existing.value;
      const newUnit = updates.unit ?? existing.unit;
      const newRangeStatus = classifyGlucose(newValue, newUnit);
      const newInRange = isInRange(newValue, newUnit);
      sets.push('range_status = ?');
      params.push(newRangeStatus);
      sets.push('in_range = ?');
      params.push(newInRange ? 1 : 0);
    }
  }

  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE md_glucose_readings SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteGlucoseReading(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_glucose_readings WHERE id = ?', [id]);
}
