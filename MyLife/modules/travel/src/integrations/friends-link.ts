/**
 * MyTravel <-> MyFriends read-only integration.
 *
 * Surfaces companion-suggestion data from the friends module. Read-only: no
 * schema changes, no writes to friends tables.
 *
 * Degrades gracefully if the `fn_people` / `fn_hangouts` tables do not exist
 * in the current database (friends module not installed).
 *
 * NOTE: MyTravel does not yet have a `tv_trip_companions` join table, so
 * `getTripCompanions` is a forward-wired stub. A future schema migration can
 * add the join table; the surface contract is established here.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface FriendLink {
  friendId: string;
  name: string;
  recentInteractionAt?: string;
}

interface PersonRow {
  id: string;
  display_name: string;
  created_at: string;
}

interface PersonInteractionRow {
  id: string;
  display_name: string;
  created_at: string;
  last_interaction_at: string | null;
}

/**
 * Placeholder: returns companions explicitly linked to the trip.
 *
 * Currently always returns []; MyTravel has no `tv_trip_companions` join
 * table yet. A future schema migration can add one; this integration is
 * forward-wired so callers can start rendering the surface.
 */
export function getTripCompanions(
  _db: DatabaseAdapter,
  _tripId: string,
): FriendLink[] {
  return [];
}

/**
 * Suggest up to `limit` friends as trip companions, ordered by most-recent
 * hangout (fallback: most-recently-created person).
 *
 * Returns [] when the friends module is not installed.
 */
export function suggestTripCompanions(
  db: DatabaseAdapter,
  _tripId: string,
  limit = 5,
): FriendLink[] {
  const cappedLimit = Math.max(0, Math.floor(limit));
  if (cappedLimit === 0) return [];

  // Prefer joining hangouts for a true "recent interaction" ranking; fall back
  // to most-recently-created people when hangouts table is absent.
  try {
    const rows = db.query<PersonInteractionRow>(
      `SELECT p.id AS id,
              p.display_name AS display_name,
              p.created_at AS created_at,
              (
                SELECT MAX(h.happened_at)
                FROM fn_hangouts h
                WHERE h.people_ids LIKE '%"' || p.id || '"%'
              ) AS last_interaction_at
       FROM fn_people p
       WHERE p.is_archived = 0
       ORDER BY
         CASE WHEN last_interaction_at IS NULL THEN 1 ELSE 0 END ASC,
         last_interaction_at DESC,
         p.created_at DESC
       LIMIT ?`,
      [cappedLimit],
    );
    return rows.map((row) => {
      const link: FriendLink = {
        friendId: row.id,
        name: row.display_name,
      };
      if (row.last_interaction_at != null) {
        link.recentInteractionAt = row.last_interaction_at;
      }
      return link;
    });
  } catch {
    // fn_hangouts missing -- retry with people-only fallback.
  }

  try {
    const rows = db.query<PersonRow>(
      `SELECT id, display_name, created_at
       FROM fn_people
       WHERE is_archived = 0
       ORDER BY created_at DESC
       LIMIT ?`,
      [cappedLimit],
    );
    return rows.map((row) => ({
      friendId: row.id,
      name: row.display_name,
    }));
  } catch {
    // fn_people missing -- friends module not installed.
    return [];
  }
}
