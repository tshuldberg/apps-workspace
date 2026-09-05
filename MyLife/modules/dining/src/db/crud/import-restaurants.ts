/**
 * Bulk import restaurants from parsed CSV rows.
 * Handles deduplication and error tracking.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { CsvRow, ImportResult } from '../../engine/csv-importer';
import type { CreateRestaurantInput } from '../../models/schemas';
import { createRestaurant } from './restaurants';

let _idCounter = 0;

function genId(): string {
  _idCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `imp-${ts}-${rand}-${_idCounter}`;
}

/**
 * Check if a restaurant with the same name+city already exists.
 */
function isDuplicate(
  db: DatabaseAdapter,
  name: string,
  city: string | null,
): boolean {
  const sql = city
    ? `SELECT COUNT(*) as cnt FROM dn_restaurants WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)`
    : `SELECT COUNT(*) as cnt FROM dn_restaurants WHERE LOWER(name) = LOWER(?) AND city IS NULL`;
  const params = city ? [name, city] : [name];
  const rows = db.query<{ cnt: number }>(sql, params);
  return rows.length > 0 && rows[0].cnt > 0;
}

/**
 * Import parsed CSV rows into the database.
 * Skips duplicates (same name+city). Returns result summary.
 */
export function importCsvRows(
  db: DatabaseAdapter,
  rows: CsvRow[],
): ImportResult {
  const result: ImportResult = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      if (!row.name || row.name.trim() === '') {
        result.errors.push({ row: i + 1, reason: 'Missing restaurant name' });
        continue;
      }

      const city = row.city?.trim() || null;

      if (isDuplicate(db, row.name.trim(), city)) {
        result.skipped += 1;
        continue;
      }

      const cuisines = row.cuisines
        ? JSON.stringify(
            row.cuisines
              .split(/[,;]/)
              .map((c) => c.trim())
              .filter(Boolean),
          )
        : undefined;

      const input: CreateRestaurantInput = {
        name: row.name.trim(),
        address: row.address?.trim() || null,
        city,
        neighborhood: row.neighborhood?.trim() || null,
        cuisines: cuisines || null,
        price_tier: row.priceTier ?? null,
        website_url: row.websiteUrl?.trim() || null,
        notes_md: row.notes?.trim() || null,
        is_wishlist: row.isWishlist ? 1 : 0,
      };

      createRestaurant(db, genId(), input);
      result.imported += 1;
    } catch (err) {
      result.errors.push({
        row: i + 1,
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}
