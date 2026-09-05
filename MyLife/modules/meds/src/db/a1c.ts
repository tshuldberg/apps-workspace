import type { DatabaseAdapter } from '@mylife/db';
import type { A1cRecord, A1cSource, CreateA1cRecordInput } from '../models/a1c';

function rowToA1cRecord(row: Record<string, unknown>): A1cRecord {
  return {
    id: row.id as string,
    value: row.value as number,
    source: row.source as A1cSource,
    averageGlucose: (row.average_glucose as number) ?? null,
    readingCount: (row.reading_count as number) ?? null,
    periodDays: (row.period_days as number) ?? null,
    notes: (row.notes as string) ?? null,
    recordedAt: row.recorded_at as string,
    createdAt: row.created_at as string,
  };
}

export function createA1cRecord(
  db: DatabaseAdapter,
  id: string,
  input: CreateA1cRecordInput,
): A1cRecord {
  const now = new Date().toISOString();
  const recordedAt = input.recordedAt ?? now;

  db.execute(
    `INSERT INTO md_a1c_records (id, value, source, average_glucose, reading_count, period_days, notes, recorded_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.value,
      input.source,
      input.averageGlucose ?? null,
      input.readingCount ?? null,
      input.periodDays ?? null,
      input.notes ?? null,
      recordedAt,
      now,
    ],
  );

  return {
    id,
    value: input.value,
    source: input.source,
    averageGlucose: input.averageGlucose ?? null,
    readingCount: input.readingCount ?? null,
    periodDays: input.periodDays ?? null,
    notes: input.notes ?? null,
    recordedAt,
    createdAt: now,
  };
}

export function getA1cRecords(
  db: DatabaseAdapter,
  opts?: { source?: A1cSource; limit?: number },
): A1cRecord[] {
  let sql = 'SELECT * FROM md_a1c_records WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.source) {
    sql += ' AND source = ?';
    params.push(opts.source);
  }

  sql += ' ORDER BY recorded_at DESC LIMIT ?';
  params.push(opts?.limit ?? 100);

  return db.query<Record<string, unknown>>(sql, params).map(rowToA1cRecord);
}
