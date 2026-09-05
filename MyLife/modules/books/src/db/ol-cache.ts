/**
 * Open Library cache operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { OLCache } from '../models/schemas';

export function cacheResponse(
  db: DatabaseAdapter,
  isbn: string,
  responseJson: string,
): void {
  db.execute(
    `INSERT OR REPLACE INTO bk_ol_cache (isbn, response_json, cover_downloaded, fetched_at)
     VALUES (?, ?, 0, ?)`,
    [isbn, responseJson, new Date().toISOString()],
  );
}

export function getCachedResponse(db: DatabaseAdapter, isbn: string): OLCache | null {
  const rows = db.query<OLCache>(
    `SELECT * FROM bk_ol_cache WHERE isbn = ?`,
    [isbn],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function isCached(db: DatabaseAdapter, isbn: string): boolean {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_ol_cache WHERE isbn = ?`,
    [isbn],
  );
  return (rows[0]?.count ?? 0) > 0;
}

export function markCoverDownloaded(db: DatabaseAdapter, isbn: string): void {
  db.execute(
    `UPDATE bk_ol_cache SET cover_downloaded = 1 WHERE isbn = ?`,
    [isbn],
  );
}

/**
 * Remove cache entries older than the given number of days.
 */
export function clearOldCache(db: DatabaseAdapter, olderThanDays = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const before = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_ol_cache WHERE fetched_at < ?`,
    [cutoff.toISOString()],
  );
  const count = before[0]?.count ?? 0;

  db.execute(
    `DELETE FROM bk_ol_cache WHERE fetched_at < ?`,
    [cutoff.toISOString()],
  );

  return count;
}
