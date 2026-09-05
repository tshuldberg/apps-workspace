import type { DatabaseAdapter } from '@mylife/db';
import type { Symptom, SymptomLog } from '../models/symptom';
import { PREDEFINED_SYMPTOMS } from '../models/symptom';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToSymptom(row: Record<string, unknown>): Symptom {
  return {
    id: row.id as string,
    name: row.name as string,
    isCustom: !!(row.is_custom as number),
    createdAt: row.created_at as string,
  };
}

function rowToSymptomLog(row: Record<string, unknown>): SymptomLog {
  return {
    id: row.id as string,
    symptomId: row.symptom_id as string,
    severity: row.severity as number,
    notes: (row.notes as string) ?? null,
    loggedAt: row.logged_at as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Symptom definitions
// ---------------------------------------------------------------------------

/**
 * Seed predefined symptoms into md_symptoms table.
 * Idempotent: uses INSERT OR IGNORE on the UNIQUE name constraint.
 */
export function seedPredefinedSymptoms(db: DatabaseAdapter): void {
  db.transaction(() => {
    for (let i = 0; i < PREDEFINED_SYMPTOMS.length; i++) {
      const name = PREDEFINED_SYMPTOMS[i];
      db.execute(
        `INSERT OR IGNORE INTO md_symptoms (id, name, is_custom, created_at)
         VALUES (?, ?, 0, datetime('now'))`,
        [`symptom-${String(i + 1).padStart(3, '0')}`, name],
      );
    }
  });
}

export function getSymptoms(db: DatabaseAdapter): Symptom[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_symptoms ORDER BY is_custom ASC, name ASC',
    )
    .map(rowToSymptom);
}

export function createCustomSymptom(
  db: DatabaseAdapter,
  id: string,
  name: string,
): void {
  db.execute(
    `INSERT INTO md_symptoms (id, name, is_custom, created_at)
     VALUES (?, ?, 1, datetime('now'))`,
    [id, name],
  );
}

// ---------------------------------------------------------------------------
// Symptom logging
// ---------------------------------------------------------------------------

export function logSymptom(
  db: DatabaseAdapter,
  id: string,
  symptomId: string,
  severity: number,
  notes?: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_symptom_logs (id, symptom_id, severity, notes, logged_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, symptomId, severity, notes ?? null, now, now],
  );
}

export function getSymptomLogs(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
  limit: number = 1000,
): SymptomLog[] {
  let sql = 'SELECT * FROM md_symptom_logs WHERE 1=1';
  const params: unknown[] = [];

  if (from) {
    sql += ' AND logged_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND logged_at <= ?';
    params.push(to);
  }

  sql += ' ORDER BY logged_at DESC LIMIT ?';
  params.push(limit);
  return db.query<Record<string, unknown>>(sql, params).map(rowToSymptomLog);
}

export function getSymptomLogsForSymptom(
  db: DatabaseAdapter,
  symptomId: string,
  from?: string,
  to?: string,
  limit: number = 1000,
): SymptomLog[] {
  let sql = 'SELECT * FROM md_symptom_logs WHERE symptom_id = ?';
  const params: unknown[] = [symptomId];

  if (from) {
    sql += ' AND logged_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND logged_at <= ?';
    params.push(to);
  }

  sql += ' ORDER BY logged_at DESC LIMIT ?';
  params.push(limit);
  return db.query<Record<string, unknown>>(sql, params).map(rowToSymptomLog);
}
