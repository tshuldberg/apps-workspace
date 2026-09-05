import type { DatabaseAdapter } from '@mylife/db';
import {
  NapCreateSchema,
  NapListOptionsSchema,
  NapSchema,
  type Nap,
  type NapCreateInput,
  type NapListOptions,
} from '../../models/schemas';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToNap(row: Record<string, unknown>): Nap {
  return NapSchema.parse({
    id: row.id,
    date: row.date,
    start_time: row.start_time,
    duration_minutes: row.duration_minutes,
    intentional: (row.intentional as number) === 1,
    quality: row.quality ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
  });
}

export function createNap(
  db: DatabaseAdapter,
  rawInput: NapCreateInput,
): Nap {
  const input = NapCreateSchema.parse(rawInput);
  const id = crypto.randomUUID();
  const created_at = nowIso();

  db.execute(
    `INSERT INTO sl_naps
      (id, date, start_time, duration_minutes, intentional, quality, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.date,
      input.start_time,
      input.duration_minutes,
      input.intentional ? 1 : 0,
      input.quality ?? null,
      input.notes ?? null,
      created_at,
    ],
  );

  return NapSchema.parse({
    id,
    date: input.date,
    start_time: input.start_time,
    duration_minutes: input.duration_minutes,
    intentional: input.intentional,
    quality: input.quality ?? null,
    notes: input.notes ?? null,
    created_at,
  });
}

export function listNaps(
  db: DatabaseAdapter,
  rawOptions?: NapListOptions,
): Nap[] {
  const options = NapListOptionsSchema.parse(rawOptions ?? {});
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.date) {
    where.push('date = ?');
    params.push(options.date);
  }
  if (options.startDate) {
    where.push('date >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    where.push('date <= ?');
    params.push(options.endDate);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_naps
     ${whereClause}
     ORDER BY date DESC, start_time DESC, created_at DESC`,
    params,
  );

  return rows.map(rowToNap);
}

export function deleteNap(db: DatabaseAdapter, id: string): boolean {
  const existing = db.query<{ id: string }>(
    `SELECT id FROM sl_naps WHERE id = ?`,
    [id],
  );
  if (existing.length === 0) return false;

  db.execute(`DELETE FROM sl_naps WHERE id = ?`, [id]);
  return true;
}

export function getNapsByDate(db: DatabaseAdapter, date: string): Nap[] {
  return listNaps(db, { date });
}
