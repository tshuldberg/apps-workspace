import type { DatabaseAdapter } from '@mylife/db';
import type { WaterEntry } from './types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToWaterEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    amountMl: row.amount_ml as number,
    source: row.source as WaterEntry['source'],
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createWaterEntry(
  db: DatabaseAdapter,
  id: string,
  input: { date: string; amountMl: number; source?: WaterEntry['source'] },
): void {
  db.execute(
    `INSERT INTO nu_water_log (id, date, amount_ml, source, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, input.date, input.amountMl, input.source ?? 'manual'],
  );
}

export function getWaterEntriesForDate(db: DatabaseAdapter, date: string): WaterEntry[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_water_log WHERE date = ? ORDER BY created_at ASC',
      [date],
    )
    .map(rowToWaterEntry);
}

export function deleteWaterEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_water_log WHERE id = ?', [id]);
}

export function updateWaterEntry(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ date: string; amountMl: number; source: WaterEntry['source'] }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.date !== undefined) {
    sets.push('date = ?');
    params.push(updates.date);
  }
  if (updates.amountMl !== undefined) {
    sets.push('amount_ml = ?');
    params.push(updates.amountMl);
  }
  if (updates.source !== undefined) {
    sets.push('source = ?');
    params.push(updates.source);
  }

  if (sets.length === 0) {
    return;
  }

  params.push(id);
  db.execute(`UPDATE nu_water_log SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function getDailyWaterTotal(db: DatabaseAdapter, date: string): number {
  const rows = db.query<{ total: number }>(
    'SELECT COALESCE(SUM(amount_ml), 0) as total FROM nu_water_log WHERE date = ?',
    [date],
  );
  return rows[0]?.total ?? 0;
}

export function getWaterEntriesInRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): WaterEntry[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT *
       FROM nu_water_log
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, created_at ASC`,
      [startDate, endDate],
    )
    .map(rowToWaterEntry);
}
