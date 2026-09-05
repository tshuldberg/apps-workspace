import type { DatabaseAdapter } from '@mylife/db';
import type { BPReading, CreateBPReadingInput, UpdateBPReadingInput } from '../models/bp-reading';
import { classifyBP } from '../bp/engine';

function rowToBPReading(row: Record<string, unknown>): BPReading {
  return {
    id: row.id as string,
    systolic: row.systolic as number,
    diastolic: row.diastolic as number,
    pulse: (row.pulse as number) ?? null,
    arm: (row.arm as BPReading['arm']) ?? null,
    position: (row.position as BPReading['position']) ?? null,
    context: (row.context as BPReading['context']) ?? null,
    category: row.category as BPReading['category'],
    notes: (row.notes as string) ?? null,
    measuredAt: row.measured_at as string,
    createdAt: row.created_at as string,
  };
}

export function logBPReading(
  db: DatabaseAdapter,
  id: string,
  input: CreateBPReadingInput,
): BPReading {
  const now = new Date().toISOString();
  const category = classifyBP(input.systolic, input.diastolic);

  db.execute(
    `INSERT INTO md_bp_readings (id, systolic, diastolic, pulse, arm, position, context, category, notes, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.systolic,
      input.diastolic,
      input.pulse ?? null,
      input.arm ?? null,
      input.position ?? null,
      input.context ?? null,
      category,
      input.notes ?? null,
      input.measuredAt ?? now,
      now,
    ],
  );

  return {
    id,
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse ?? null,
    arm: input.arm ?? null,
    position: input.position ?? null,
    context: input.context ?? null,
    category,
    notes: input.notes ?? null,
    measuredAt: input.measuredAt ?? now,
    createdAt: now,
  };
}

export function getBPReadingById(
  db: DatabaseAdapter,
  id: string,
): BPReading | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_bp_readings WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToBPReading(rows[0]) : null;
}

export function getBPReadings(
  db: DatabaseAdapter,
  opts?: { from?: string; to?: string; context?: string; limit?: number },
): BPReading[] {
  let sql = 'SELECT * FROM md_bp_readings WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.from) {
    sql += ' AND measured_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND measured_at <= ?';
    params.push(opts.to);
  }
  if (opts?.context) {
    sql += ' AND context = ?';
    params.push(opts.context);
  }

  sql += ' ORDER BY measured_at DESC LIMIT ?';
  params.push(opts?.limit ?? 1000);

  return db.query<Record<string, unknown>>(sql, params).map(rowToBPReading);
}

export function updateBPReading(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateBPReadingInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.systolic !== undefined) { sets.push('systolic = ?'); params.push(updates.systolic); }
  if (updates.diastolic !== undefined) { sets.push('diastolic = ?'); params.push(updates.diastolic); }
  if (updates.pulse !== undefined) { sets.push('pulse = ?'); params.push(updates.pulse); }
  if (updates.arm !== undefined) { sets.push('arm = ?'); params.push(updates.arm); }
  if (updates.position !== undefined) { sets.push('position = ?'); params.push(updates.position); }
  if (updates.context !== undefined) { sets.push('context = ?'); params.push(updates.context); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
  if (updates.measuredAt !== undefined) { sets.push('measured_at = ?'); params.push(updates.measuredAt); }

  // Reclassify if systolic or diastolic changed
  if (updates.systolic !== undefined || updates.diastolic !== undefined) {
    const existing = getBPReadingById(db, id);
    if (existing) {
      const newCategory = classifyBP(
        updates.systolic ?? existing.systolic,
        updates.diastolic ?? existing.diastolic,
      );
      sets.push('category = ?');
      params.push(newCategory);
    }
  }

  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE md_bp_readings SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteBPReading(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_bp_readings WHERE id = ?', [id]);
}
