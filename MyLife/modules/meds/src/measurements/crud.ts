import type { DatabaseAdapter } from '@mylife/db';
import type {
  HealthMeasurement,
  CreateMeasurementInput,
  UpdateMeasurementInput,
} from '../models/measurement';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToMeasurement(row: Record<string, unknown>): HealthMeasurement {
  return {
    id: row.id as string,
    type: row.type as HealthMeasurement['type'],
    value: row.value as string,
    unit: row.unit as string,
    notes: (row.notes as string) ?? null,
    measuredAt: row.measured_at as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function logMeasurement(
  db: DatabaseAdapter,
  id: string,
  input: CreateMeasurementInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_measurements (id, type, value, unit, notes, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.value,
      input.unit,
      input.notes ?? null,
      input.measuredAt ?? now,
      now,
    ],
  );
}

export function getMeasurementById(
  db: DatabaseAdapter,
  id: string,
): HealthMeasurement | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_measurements WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToMeasurement(rows[0]) : null;
}

export function getMeasurements(
  db: DatabaseAdapter,
  opts?: { type?: string; from?: string; to?: string },
): HealthMeasurement[] {
  let sql = 'SELECT * FROM md_measurements WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.type) {
    sql += ' AND type = ?';
    params.push(opts.type);
  }
  if (opts?.from) {
    sql += ' AND measured_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND measured_at <= ?';
    params.push(opts.to);
  }

  sql += ' ORDER BY measured_at DESC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToMeasurement);
}

export function updateMeasurement(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateMeasurementInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.value !== undefined) { sets.push('value = ?'); params.push(updates.value); }
  if (updates.unit !== undefined) { sets.push('unit = ?'); params.push(updates.unit); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
  if (updates.measuredAt !== undefined) { sets.push('measured_at = ?'); params.push(updates.measuredAt); }

  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE md_measurements SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteMeasurement(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_measurements WHERE id = ?', [id]);
}
