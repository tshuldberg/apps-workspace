import type { DatabaseAdapter } from '@mylife/db';
import type { BodyMeasurement } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_bm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logBodyMeasurement(
  db: DatabaseAdapter,
  data: Omit<BodyMeasurement, 'id' | 'created_at'>,
): BodyMeasurement {
  const id = createId();
  db.execute(
    `INSERT INTO hl_body_measurements
     (id, date, weight_kg, body_fat_percent, lean_mass_kg, bmi, waist_cm, hip_cm, chest_cm, height_cm, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.date, data.weight_kg ?? null, data.body_fat_percent ?? null, data.lean_mass_kg ?? null,
     data.bmi ?? null, data.waist_cm ?? null, data.hip_cm ?? null, data.chest_cm ?? null,
     data.height_cm ?? null, data.source, data.notes ?? null],
  );
  return getBodyMeasurementById(db, id)!;
}

export function getBodyMeasurementById(db: DatabaseAdapter, id: string): BodyMeasurement | null {
  const rows = db.query<BodyMeasurement>('SELECT * FROM hl_body_measurements WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getWeightHistory(db: DatabaseAdapter, limit = 90): BodyMeasurement[] {
  return db.query<BodyMeasurement>(
    'SELECT * FROM hl_body_measurements WHERE weight_kg IS NOT NULL ORDER BY date DESC LIMIT ?',
    [limit],
  );
}

export function getLatestMeasurement(db: DatabaseAdapter): BodyMeasurement | null {
  const rows = db.query<BodyMeasurement>(
    'SELECT * FROM hl_body_measurements ORDER BY date DESC LIMIT 1',
  );
  return rows[0] ?? null;
}

export function deleteBodyMeasurement(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_body_measurements WHERE id = ?', [id]);
}
