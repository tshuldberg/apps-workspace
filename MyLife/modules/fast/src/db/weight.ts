import type { DatabaseAdapter } from '@mylife/db';
import type { WeightEntry } from '../types';

interface WeightRow {
  id: string;
  weight_value: number;
  unit: string;
  date: string;
  notes: string | null;
  source: string;
  created_at: string;
}

function toEntry(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    weightValue: row.weight_value,
    unit: row.unit as 'lbs' | 'kg',
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function createWeightEntry(
  db: DatabaseAdapter,
  id: string,
  value: number,
  unit: 'lbs' | 'kg',
  date?: string,
  notes?: string,
  source: string = 'manual',
): WeightEntry {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO ft_weight_entries (id, weight_value, unit, date, notes, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, value, unit, d, notes ?? null, source, now],
  );
  return { id, weightValue: value, unit, date: d, notes: notes ?? null, createdAt: now };
}

export function getWeightEntries(db: DatabaseAdapter, days?: number): WeightEntry[] {
  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return db
      .query<WeightRow>(
        `SELECT * FROM ft_weight_entries WHERE date >= ? ORDER BY date DESC, created_at DESC`,
        [cutoffStr],
      )
      .map(toEntry);
  }
  return db
    .query<WeightRow>(`SELECT * FROM ft_weight_entries ORDER BY date DESC, created_at DESC LIMIT 500`)
    .map(toEntry);
}

export function deleteWeightEntry(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM ft_weight_entries WHERE id = ?`, [id]);
}
