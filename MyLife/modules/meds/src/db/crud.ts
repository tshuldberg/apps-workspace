import type { DatabaseAdapter } from '@mylife/db';
import type { Medication, Dose } from '../types';

/** Escape LIKE wildcard characters so user input is treated as literal text. */
export function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToMedication(row: Record<string, unknown>): Medication {
  return {
    id: row.id as string,
    name: row.name as string,
    dosage: (row.dosage as string) ?? null,
    unit: (row.unit as string) ?? null,
    frequency: row.frequency as Medication['frequency'],
    instructions: (row.instructions as string) ?? null,
    prescriber: (row.prescriber as string) ?? null,
    pharmacy: (row.pharmacy as string) ?? null,
    refillDate: (row.refill_date as string) ?? null,
    pillCount: (row.pill_count as number) ?? null,
    pillsPerDose: (row.pills_per_dose as number) ?? 1,
    timeSlots: row.time_slots ? JSON.parse(row.time_slots as string) : [],
    endDate: (row.end_date as string) ?? null,
    isActive: !!(row.is_active as number),
    sortOrder: row.sort_order as number,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToDose(row: Record<string, unknown>): Dose {
  return {
    id: row.id as string,
    medicationId: row.medication_id as string,
    takenAt: row.taken_at as string,
    skipped: !!(row.skipped as number),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export function createMedication(
  db: DatabaseAdapter,
  id: string,
  input: { name: string; dosage?: string; unit?: string; frequency?: string },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_medications (id, name, dosage, unit, frequency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.dosage ?? null, input.unit ?? null, input.frequency ?? 'daily', now, now],
  );
}

export function getMedications(db: DatabaseAdapter, opts?: { isActive?: boolean; limit?: number }): Medication[] {
  const limit = opts?.limit ?? 500;
  if (opts?.isActive !== undefined) {
    return db.query<Record<string, unknown>>(
      'SELECT * FROM md_medications WHERE is_active = ? ORDER BY sort_order ASC, name ASC LIMIT ?',
      [opts.isActive ? 1 : 0, limit],
    ).map(rowToMedication);
  }
  return db.query<Record<string, unknown>>('SELECT * FROM md_medications ORDER BY sort_order ASC, name ASC LIMIT ?', [limit]).map(rowToMedication);
}

export function getMedicationById(db: DatabaseAdapter, id: string): Medication | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM md_medications WHERE id = ?', [id]);
  return rows.length > 0 ? rowToMedication(rows[0]) : null;
}

export function updateMedication(db: DatabaseAdapter, id: string, updates: Partial<{ name: string; dosage: string; unit: string; frequency: string; isActive: boolean; sortOrder: number }>): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.dosage !== undefined) { sets.push('dosage = ?'); params.push(updates.dosage); }
  if (updates.unit !== undefined) { sets.push('unit = ?'); params.push(updates.unit); }
  if (updates.frequency !== undefined) { sets.push('frequency = ?'); params.push(updates.frequency); }
  if (updates.isActive !== undefined) { sets.push('is_active = ?'); params.push(updates.isActive ? 1 : 0); }
  if (updates.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(updates.sortOrder); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE md_medications SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteMedication(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_medications WHERE id = ?', [id]);
}

export function countMedications(db: DatabaseAdapter): number {
  return (db.query<{ c: number }>('SELECT COUNT(*) as c FROM md_medications')[0]).c;
}

// ---------------------------------------------------------------------------
// Doses
// ---------------------------------------------------------------------------

export function recordDose(
  db: DatabaseAdapter,
  id: string,
  medicationId: string,
  takenAt: string,
  skipped?: boolean,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_doses (id, medication_id, taken_at, skipped, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, medicationId, takenAt, skipped ? 1 : 0, now],
  );
}

export function getDoses(db: DatabaseAdapter, medicationId: string, opts?: { from?: string; to?: string; limit?: number }): Dose[] {
  let sql = 'SELECT * FROM md_doses WHERE medication_id = ?';
  const params: unknown[] = [medicationId];
  if (opts?.from) { sql += ' AND taken_at >= ?'; params.push(opts.from); }
  if (opts?.to) { sql += ' AND taken_at <= ?'; params.push(opts.to); }
  sql += ' ORDER BY taken_at DESC LIMIT ?';
  params.push(opts?.limit ?? 1000);
  return db.query<Record<string, unknown>>(sql, params).map(rowToDose);
}

export function getDosesForDate(db: DatabaseAdapter, date: string): Dose[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM md_doses WHERE taken_at LIKE ? ESCAPE '\\' ORDER BY taken_at ASC LIMIT 200`,
    [`${escapeLike(date)}%`],
  ).map(rowToDose);
}

export function deleteDose(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_doses WHERE id = ?', [id]);
}

export function getAdherenceRate(db: DatabaseAdapter, medicationId: string, from: string, to: string): number {
  const total = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM md_doses WHERE medication_id = ? AND taken_at >= ? AND taken_at <= ?',
    [medicationId, from, to],
  )[0].c;
  if (total === 0) return 0;
  const taken = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM md_doses WHERE medication_id = ? AND taken_at >= ? AND taken_at <= ? AND skipped = 0',
    [medicationId, from, to],
  )[0].c;
  return Math.round((taken / total) * 100);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSetting(db: DatabaseAdapter, key: string): string | undefined {
  const rows = db.query<{ value: string }>('SELECT value FROM md_settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : undefined;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO md_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}
