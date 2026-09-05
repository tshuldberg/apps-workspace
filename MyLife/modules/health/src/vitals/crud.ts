import type { DatabaseAdapter } from '@mylife/db';
import type { Vital, LogVitalInput, VitalAggregate, VitalType } from './types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_vit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logVital(db: DatabaseAdapter, input: LogVitalInput): string {
  const id = createId();
  db.execute(
    `INSERT INTO hl_vitals (id, vital_type, value, value_secondary, unit, source, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vital_type,
      input.value,
      input.value_secondary ?? null,
      input.unit,
      input.source ?? 'manual',
      input.recorded_at ?? new Date().toISOString(),
    ],
  );
  return id;
}

export function getVitals(db: DatabaseAdapter, limit = 100): Vital[] {
  return db.query<Vital>(
    'SELECT * FROM hl_vitals ORDER BY recorded_at DESC LIMIT ?',
    [limit],
  );
}

export function getVitalsByType(
  db: DatabaseAdapter,
  vitalType: VitalType,
  limit = 100,
): Vital[] {
  return db.query<Vital>(
    'SELECT * FROM hl_vitals WHERE vital_type = ? ORDER BY recorded_at DESC LIMIT ?',
    [vitalType, limit],
  );
}

export function getVitalsByDateRange(
  db: DatabaseAdapter,
  vitalType: VitalType,
  startDate: string,
  endDate: string,
): Vital[] {
  return db.query<Vital>(
    'SELECT * FROM hl_vitals WHERE vital_type = ? AND recorded_at >= ? AND recorded_at <= ? ORDER BY recorded_at ASC',
    [vitalType, startDate, endDate],
  );
}

export function getVitalAggregates(
  db: DatabaseAdapter,
  vitalType: VitalType,
  days = 30,
): VitalAggregate[] {
  return db.query<VitalAggregate>(
    `SELECT vital_type, DATE(recorded_at) as date,
            AVG(value) as avg, MIN(value) as min, MAX(value) as max, COUNT(*) as count
     FROM hl_vitals
     WHERE vital_type = ? AND recorded_at >= datetime('now', ? || ' days')
     GROUP BY DATE(recorded_at)
     ORDER BY date ASC`,
    [vitalType, -days],
  );
}

export function getLatestVital(
  db: DatabaseAdapter,
  vitalType: VitalType,
): Vital | null {
  const rows = db.query<Vital>(
    'SELECT * FROM hl_vitals WHERE vital_type = ? ORDER BY recorded_at DESC LIMIT 1',
    [vitalType],
  );
  return rows[0] ?? null;
}

export function deleteVital(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_vitals WHERE id = ?', [id]);
}
