import type { DatabaseAdapter } from '@mylife/db';
import type { BarcodeCache, Food } from '../types';
import { getFoodById } from './foods';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToCache(row: Record<string, unknown>): BarcodeCache {
  return {
    barcode: row.barcode as string,
    foodId: (row.food_id as string) ?? null,
    source: row.source as string,
    rawJson: (row.raw_json as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
  };
}

export interface RecentBarcodeScan {
  barcode: string;
  foodId: string | null;
  source: string;
  rawJson: string | null;
  expiresAt: string | null;
  food: Food | null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getCachedBarcode(db: DatabaseAdapter, barcode: string): BarcodeCache | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM nu_barcode_cache WHERE barcode = ?',
    [barcode],
  );
  if (rows.length === 0) return null;
  const entry = rowToCache(rows[0]);
  // Return null if expired
  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    return null;
  }
  return entry;
}

export function setCachedBarcode(
  db: DatabaseAdapter,
  barcode: string,
  input: { foodId?: string; source: string; rawJson?: string; expiresAt?: string },
): void {
  db.execute(
    `INSERT INTO nu_barcode_cache (barcode, food_id, source, raw_json, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(barcode) DO UPDATE SET
       food_id = excluded.food_id,
       source = excluded.source,
       raw_json = excluded.raw_json,
       expires_at = excluded.expires_at`,
    [barcode, input.foodId ?? null, input.source, input.rawJson ?? null, input.expiresAt ?? null],
  );
}

export function deleteCachedBarcode(db: DatabaseAdapter, barcode: string): void {
  db.execute('DELETE FROM nu_barcode_cache WHERE barcode = ?', [barcode]);
}

export function purgeExpiredCache(db: DatabaseAdapter): number {
  const before = db.query<{ c: number }>('SELECT COUNT(*) as c FROM nu_barcode_cache WHERE expires_at IS NOT NULL AND expires_at < datetime(\'now\')')[0].c;
  db.execute("DELETE FROM nu_barcode_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')");
  return before;
}

export function getRecentBarcodeScans(
  db: DatabaseAdapter,
  limit = 10,
): RecentBarcodeScan[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM nu_barcode_cache
     WHERE food_id IS NOT NULL
     ORDER BY rowid DESC
     LIMIT ?`,
    [limit],
  );

  return rows.map((row) => {
    const entry = rowToCache(row);
    return {
      ...entry,
      food: entry.foodId ? getFoodById(db, entry.foodId) : null,
    };
  });
}
