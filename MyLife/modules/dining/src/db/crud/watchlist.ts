/**
 * Watchlist CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateWatchlistSchema,
  UpdateWatchlistSchema,
  WatchlistFilterSchema,
} from '../../models/schemas';
import type {
  WatchlistEntry,
  WatchlistEntryWithRestaurant,
  CreateWatchlistInput,
  UpdateWatchlistInput,
  WatchlistFilter,
} from '../../models/schemas';

const WATCHLIST_COLUMNS = [
  'id',
  'restaurant_id',
  'party_size',
  'date_range_start',
  'date_range_end',
  'notify_enabled',
  'notes',
  'status',
  'created_at',
  'updated_at',
].join(', ');

export function createWatchlistEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreateWatchlistInput,
): WatchlistEntry {
  const parsed = CreateWatchlistSchema.parse(input);
  const now = new Date().toISOString();

  const entry: WatchlistEntry = {
    id,
    restaurant_id: parsed.restaurant_id,
    party_size: parsed.party_size,
    date_range_start: parsed.date_range_start ?? null,
    date_range_end: parsed.date_range_end ?? null,
    notify_enabled: parsed.notify_enabled ?? 1,
    notes: parsed.notes ?? null,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO dn_watchlist (${WATCHLIST_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.restaurant_id,
      entry.party_size,
      entry.date_range_start,
      entry.date_range_end,
      entry.notify_enabled,
      entry.notes,
      entry.status,
      entry.created_at,
      entry.updated_at,
    ],
  );

  return entry;
}

export function getWatchlistEntry(
  db: DatabaseAdapter,
  id: string,
): WatchlistEntryWithRestaurant | null {
  const cols = WATCHLIST_COLUMNS.split(', ').map((c) => `w.${c}`).join(', ');
  const rows = db.query<WatchlistEntryWithRestaurant>(
    `SELECT ${cols}, r.name AS restaurant_name
     FROM dn_watchlist w
     INNER JOIN dn_restaurants r ON w.restaurant_id = r.id
     WHERE w.id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export function updateWatchlistEntry(
  db: DatabaseAdapter,
  id: string,
  input: UpdateWatchlistInput,
): void {
  const parsed = UpdateWatchlistSchema.parse(input);
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    party_size: parsed.party_size,
    date_range_start: parsed.date_range_start,
    date_range_end: parsed.date_range_end,
    notify_enabled: parsed.notify_enabled,
    notes: parsed.notes,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE dn_watchlist SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteWatchlistEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_watchlist WHERE id = ?', [id]);
}

export function listWatchlistEntries(
  db: DatabaseAdapter,
  filters?: WatchlistFilter,
): WatchlistEntryWithRestaurant[] {
  const parsed = filters ? WatchlistFilterSchema.parse(filters) : {};
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (parsed.status) {
    conditions.push('w.status = ?');
    params.push(parsed.status);
  }

  if (parsed.restaurant_id) {
    conditions.push('w.restaurant_id = ?');
    params.push(parsed.restaurant_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const cols = WATCHLIST_COLUMNS.split(', ').map((c) => `w.${c}`).join(', ');

  return db.query<WatchlistEntryWithRestaurant>(
    `SELECT ${cols}, r.name AS restaurant_name
     FROM dn_watchlist w
     INNER JOIN dn_restaurants r ON w.restaurant_id = r.id
     ${where}
     ORDER BY w.created_at DESC`,
    params,
  );
}

export function fulfillWatchlistEntry(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_watchlist SET status = 'fulfilled', updated_at = ? WHERE id = ?`,
    [now, id],
  );
}

export function expireStaleEntries(db: DatabaseAdapter): number {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_watchlist
     SET status = 'expired', updated_at = ?
     WHERE status = 'active'
       AND date_range_end IS NOT NULL
       AND date_range_end < ?`,
    [now, today],
  );

  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM dn_watchlist WHERE status = 'expired' AND updated_at = ?`,
    [now],
  );
  return rows[0]?.count ?? 0;
}
