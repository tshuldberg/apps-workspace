/**
 * MyTravel <-> MyDining read-only integration.
 *
 * Fetches dining visits whose `visited_at` falls inside a trip's
 * [start_date, end_date] window. Read-only: no schema changes, no writes.
 *
 * Degrades gracefully if the `dn_visits` / `dn_restaurants` tables do not
 * exist in the current database (dining module not installed).
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface DiningVisitLink {
  visitId: string;
  restaurantName?: string;
  visitedAtIso: string;
  rating?: number;
}

export interface DiningSummary {
  count: number;
  averageRating?: number;
}

interface TripWindowRow {
  start_date: string | null;
  end_date: string | null;
}

interface VisitJoinRow {
  id: string;
  visited_at: string;
  overall_rating: number | null;
  restaurant_name: string | null;
}

/**
 * Fetch dining visits for a trip's date window.
 * Returns `[]` if the trip is missing, has no window, or the dining
 * tables do not exist.
 */
export function getDiningVisitsForTrip(
  db: DatabaseAdapter,
  tripId: string,
): DiningVisitLink[] {
  let tripRows: TripWindowRow[];
  try {
    tripRows = db.query<TripWindowRow>(
      `SELECT start_date, end_date FROM tv_trips WHERE id = ?`,
      [tripId],
    );
  } catch {
    return [];
  }
  if (tripRows.length === 0) return [];
  const { start_date, end_date } = tripRows[0]!;
  if (!start_date || !end_date) return [];

  try {
    const rows = db.query<VisitJoinRow>(
      `SELECT v.id AS id,
              v.visited_at AS visited_at,
              v.overall_rating AS overall_rating,
              r.name AS restaurant_name
       FROM dn_visits v
       LEFT JOIN dn_restaurants r ON r.id = v.restaurant_id
       WHERE date(v.visited_at) >= date(?)
         AND date(v.visited_at) <= date(?)
       ORDER BY v.visited_at ASC`,
      [start_date, end_date],
    );

    return rows.map((row) => {
      const link: DiningVisitLink = {
        visitId: row.id,
        visitedAtIso: row.visited_at,
      };
      if (row.restaurant_name != null) {
        link.restaurantName = row.restaurant_name;
      }
      if (row.overall_rating != null) {
        link.rating = row.overall_rating;
      }
      return link;
    });
  } catch {
    // dn_visits / dn_restaurants not present -- dining module not installed.
    return [];
  }
}

/**
 * Pure summary over a dining-visit link set.
 * `averageRating` is undefined when no links carry a rating.
 */
export function summarizeDining(links: DiningVisitLink[]): DiningSummary {
  const count = links.length;
  const rated = links.filter((l) => typeof l.rating === 'number');
  if (rated.length === 0) {
    return { count };
  }
  const total = rated.reduce((acc, l) => acc + (l.rating ?? 0), 0);
  return { count, averageRating: total / rated.length };
}
