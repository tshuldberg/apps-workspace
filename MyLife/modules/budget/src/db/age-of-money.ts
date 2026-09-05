/**
 * CRUD operations for Age of Money snapshots.
 * Table: bg_age_of_money_snapshots
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { AoMSnapshot, AoMSnapshotInsert } from '../types';

function generateId(): string {
  return `aom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create an AoM snapshot. Silently skips if a snapshot for that date exists.
 */
export function createAoMSnapshot(
  db: DatabaseAdapter,
  data: AoMSnapshotInsert,
): AoMSnapshot | null {
  const id = generateId();
  try {
    db.execute(
      `INSERT INTO bg_age_of_money_snapshots (id, date, age_days, sample_size)
       VALUES (?, ?, ?, ?)`,
      [id, data.date, data.age_days, data.sample_size],
    );
  } catch {
    // UNIQUE(date) violation means snapshot already exists
    return getAoMSnapshotByDate(db, data.date) ?? null;
  }
  return getAoMSnapshotById(db, id) ?? null;
}

/**
 * Get an AoM snapshot by ID.
 */
export function getAoMSnapshotById(
  db: DatabaseAdapter,
  id: string,
): AoMSnapshot | null {
  const rows = db.query<AoMSnapshot>(
    `SELECT * FROM bg_age_of_money_snapshots WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Get an AoM snapshot by date.
 */
export function getAoMSnapshotByDate(
  db: DatabaseAdapter,
  date: string,
): AoMSnapshot | null {
  const rows = db.query<AoMSnapshot>(
    `SELECT * FROM bg_age_of_money_snapshots WHERE date = ?`,
    [date],
  );
  return rows[0] ?? null;
}

/**
 * Get the most recent N snapshots, ordered by date descending.
 */
export function getRecentAoMSnapshots(
  db: DatabaseAdapter,
  limit = 30,
): AoMSnapshot[] {
  return db.query<AoMSnapshot>(
    `SELECT * FROM bg_age_of_money_snapshots ORDER BY date DESC LIMIT ?`,
    [limit],
  );
}

/**
 * Get snapshots within a date range, ordered by date ascending.
 */
export function getAoMSnapshotRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): AoMSnapshot[] {
  return db.query<AoMSnapshot>(
    `SELECT * FROM bg_age_of_money_snapshots WHERE date >= ? AND date <= ? ORDER BY date ASC`,
    [startDate, endDate],
  );
}

/**
 * Delete an AoM snapshot by ID.
 */
export function deleteAoMSnapshot(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_age_of_money_snapshots WHERE id = ?`, [id]);
}
