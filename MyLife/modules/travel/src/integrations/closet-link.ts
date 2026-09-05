/**
 * MyTravel <-> MyCloset read-only integration.
 *
 * Suggests packing candidates from the user's owned closet items, filtered by
 * a simple season heuristic computed from the trip's date window. Read-only:
 * no schema changes, no writes to closet tables.
 *
 * Degrades gracefully if the `cl_items` table does not exist in the current
 * database (closet module not installed).
 */

import type { DatabaseAdapter } from '@mylife/db';

export type ClosetSuggestionReason =
  | 'season-match'
  | 'weather-match'
  | 'versatile';

export interface ClosetSuggestion {
  itemId: string;
  name: string;
  category?: string;
  reason: ClosetSuggestionReason;
}

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

const MAX_SUGGESTIONS = 20;

interface ClosetItemRow {
  id: string;
  name: string;
  category: string | null;
  seasons_json: string | null;
  status: string | null;
}

/**
 * Rough season inference from a trip's date window.
 *
 * Uses the starting month as the anchor. Northern-hemisphere defaults:
 *   Dec/Jan/Feb -> winter
 *   Mar/Apr/May -> spring
 *   Jun/Jul/Aug -> summer
 *   Sep/Oct/Nov -> fall
 */
export function inferSeasonFromDates(
  startDate: string,
  _endDate: string,
): Season {
  // YYYY-MM-DD parsing is tolerant; default to summer if malformed.
  const parts = startDate.split('-');
  const month = parts.length >= 2 ? Number.parseInt(parts[1]!, 10) : NaN;
  if (!Number.isFinite(month)) return 'summer';
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'fall';
}

function parseSeasons(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Suggest packing candidates drawn from the user's closet.
 *
 * Strategy:
 *   1. Infer a season from the trip window.
 *   2. Pull closet items where `status = 'active'`.
 *   3. Prefer items tagged with the inferred season; items with no season
 *      tag are treated as versatile and included after season-matched ones.
 *   4. Cap output at 20 items.
 *
 * Returns [] when the closet module is not installed.
 */
export function suggestPackingFromCloset(
  db: DatabaseAdapter,
  tripParams: {
    start_date: string;
    end_date: string;
    destination_name?: string | null;
  },
): ClosetSuggestion[] {
  if (!tripParams.start_date || !tripParams.end_date) return [];

  const season = inferSeasonFromDates(tripParams.start_date, tripParams.end_date);

  let rows: ClosetItemRow[];
  try {
    rows = db.query<ClosetItemRow>(
      `SELECT id, name, category, seasons_json, status
       FROM cl_items
       WHERE status = 'active'
       ORDER BY times_worn DESC, name ASC`,
      [],
    );
  } catch {
    return [];
  }

  const seasonMatched: ClosetSuggestion[] = [];
  const versatile: ClosetSuggestion[] = [];

  for (const row of rows) {
    const seasons = parseSeasons(row.seasons_json);
    const suggestion: ClosetSuggestion = {
      itemId: row.id,
      name: row.name,
      reason: 'season-match',
    };
    if (row.category != null) {
      suggestion.category = row.category;
    }

    if (seasons.length === 0) {
      versatile.push({ ...suggestion, reason: 'versatile' });
    } else if (seasons.indexOf(season) !== -1) {
      seasonMatched.push(suggestion);
    }
    // Items tagged for other seasons are excluded.
  }

  const combined = seasonMatched.concat(versatile);
  return combined.slice(0, MAX_SUGGESTIONS);
}
