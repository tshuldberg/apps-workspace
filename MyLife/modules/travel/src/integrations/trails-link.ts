/**
 * MyTravel <-> MyTrails read-only integration.
 *
 * Suggests trails relevant to a trip destination. Best-effort match on the
 * `region` column of `tr_trails`; if no region match exists, falls back to
 * the most recently added trails.
 *
 * Read-only: no schema changes, no writes. Returns `[]` if `tr_trails` is
 * not present (Trails module not installed).
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface TrailLink {
  trailId: string;
  name: string;
  lengthKm?: number;
  difficulty?: string;
}

interface TrailRow {
  id: string;
  name: string | null;
  distance_meters: number | null;
  difficulty: string | null;
}

function toLink(row: TrailRow): TrailLink {
  const link: TrailLink = {
    trailId: row.id,
    name: row.name ?? '',
  };
  if (typeof row.distance_meters === 'number' && row.distance_meters > 0) {
    link.lengthKm = row.distance_meters / 1000;
  }
  if (row.difficulty) {
    link.difficulty = row.difficulty;
  }
  return link;
}

/**
 * Suggest trails for a destination. Tries a LIKE match on `region`; if the
 * match returns nothing (or the column is absent), returns the most recent
 * trails up to `limit`.
 */
export function suggestTrailsForDestination(
  db: DatabaseAdapter,
  destinationName: string,
  limit = 10,
): TrailLink[] {
  const cap = Math.max(1, Math.floor(limit));
  const pattern = '%' + (destinationName ?? '').trim() + '%';
  const hasSearch = destinationName && destinationName.trim().length > 0;

  if (hasSearch) {
    try {
      const matched = db.query<TrailRow>(
        `SELECT id, name, distance_meters, difficulty
         FROM tr_trails
         WHERE region LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [pattern, cap],
      );
      if (matched.length > 0) {
        return matched.map(toLink);
      }
    } catch {
      // fall through to fallback
    }
  }

  try {
    const recent = db.query<TrailRow>(
      `SELECT id, name, distance_meters, difficulty
       FROM tr_trails
       ORDER BY created_at DESC
       LIMIT ?`,
      [cap],
    );
    return recent.map(toLink);
  } catch {
    return [];
  }
}
