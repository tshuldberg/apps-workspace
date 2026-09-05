import type { LeagueId } from '../types';

/**
 * Sports calendar + player-favorites + stat-reference engine.
 *
 * Pure TypeScript. No DB access, no network calls, no React imports, no
 * `Date.now()` -- callers pass `nowMs`. Month/day constants in the preset
 * table are 1-indexed for human readability; conversion to JavaScript's
 * 0-indexed month happens inside `materializeLeagueEvents`.
 *
 * Design decisions:
 *   1. Presets are approximate placeholder dates -- the real draft/free-
 *      agency windows shift year to year. A future card will let users
 *      override individual materialized events. For now these are good
 *      enough to drive a month / week / agenda UI.
 *   2. Player favorites are NOT persisted in this card. The helpers here
 *      are pure data mappers. A future card will wire them to
 *      `hub_settings` JSON or a new `sp_players` table.
 *   3. `buildStatReferenceUrl` returns a search-URL variant for MVP rather
 *      than guessing the exact reference-site slug. The UI can still
 *      deep-link users to the right reference-site team/player page via
 *      the search result.
 *   4. `LeagueId` is the live enum (`nfl|nba|mlb|nhl|mls`, no `other`) --
 *      a change from the original P7-C card, which assumed an `other`
 *      variant. All helpers honor the live enum.
 */

export type LeagueEventType =
  | 'draft'
  | 'free_agency_open'
  | 'trade_deadline'
  | 'season_opener'
  | 'playoffs_start'
  | 'championship'
  | 'transfer_window_open'
  | 'transfer_window_close';

export interface LeagueEvent {
  leagueId: LeagueId;
  eventType: LeagueEventType;
  label: string;
  startMs: number;
  endMs?: number;
  notes?: string;
}

/** Month / day template for a recurring league event. */
export interface LeagueEventPreset {
  eventType: LeagueEventType;
  label: string;
  /** 1-indexed month (1 = January). Converted to 0-indexed inside materializeLeagueEvents. */
  monthUtc: number;
  /** 1-indexed day of month. */
  dayUtc: number;
  /** When set, endMs = startMs + durationDays * 86_400_000. */
  durationDays?: number;
  notes?: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Preset event templates per league. Month/day values are approximate --
 * real-world dates shift by a few days year to year. Rationale for the
 * specific events:
 *   * NFL: draft (late April), free agency (mid March), trade deadline
 *     (early November), season opener (Thursday after Labor Day), playoffs
 *     (mid January), Super Bowl (early February).
 *   * NBA: draft (late June), free agency (early July), trade deadline
 *     (early February), season opener (mid October), playoffs (mid April),
 *     Finals start (early June).
 *   * MLB: trade deadline (end of July), season opener (late March),
 *     playoffs (early October), World Series (late October).
 *   * NHL: trade deadline (early March), season opener (early October),
 *     playoffs (mid April), Stanley Cup Final (early June).
 *   * MLS: transfer windows (mid Feb -> late April summer window opens
 *     mid July and closes mid August -- we encode the primary summer
 *     window here).
 */
export const LEAGUE_EVENT_PRESETS: Record<LeagueId, ReadonlyArray<LeagueEventPreset>> = Object.freeze({
  nfl: Object.freeze([
    { eventType: 'free_agency_open' as const, label: 'NFL Free Agency opens', monthUtc: 3, dayUtc: 12 },
    { eventType: 'draft' as const, label: 'NFL Draft', monthUtc: 4, dayUtc: 24, durationDays: 3 },
    { eventType: 'season_opener' as const, label: 'NFL season opener', monthUtc: 9, dayUtc: 5 },
    { eventType: 'trade_deadline' as const, label: 'NFL Trade Deadline', monthUtc: 11, dayUtc: 4 },
    { eventType: 'playoffs_start' as const, label: 'NFL Playoffs begin', monthUtc: 1, dayUtc: 13 },
    { eventType: 'championship' as const, label: 'Super Bowl', monthUtc: 2, dayUtc: 9 },
  ]),
  nba: Object.freeze([
    { eventType: 'trade_deadline' as const, label: 'NBA Trade Deadline', monthUtc: 2, dayUtc: 6 },
    { eventType: 'playoffs_start' as const, label: 'NBA Playoffs begin', monthUtc: 4, dayUtc: 19 },
    { eventType: 'championship' as const, label: 'NBA Finals begin', monthUtc: 6, dayUtc: 5 },
    { eventType: 'draft' as const, label: 'NBA Draft', monthUtc: 6, dayUtc: 25 },
    { eventType: 'free_agency_open' as const, label: 'NBA Free Agency opens', monthUtc: 7, dayUtc: 1 },
    { eventType: 'season_opener' as const, label: 'NBA season opener', monthUtc: 10, dayUtc: 21 },
  ]),
  mlb: Object.freeze([
    { eventType: 'season_opener' as const, label: 'MLB Opening Day', monthUtc: 3, dayUtc: 27 },
    { eventType: 'trade_deadline' as const, label: 'MLB Trade Deadline', monthUtc: 7, dayUtc: 31 },
    { eventType: 'playoffs_start' as const, label: 'MLB Postseason begins', monthUtc: 10, dayUtc: 1 },
    { eventType: 'championship' as const, label: 'World Series begins', monthUtc: 10, dayUtc: 24 },
  ]),
  nhl: Object.freeze([
    { eventType: 'trade_deadline' as const, label: 'NHL Trade Deadline', monthUtc: 3, dayUtc: 7 },
    { eventType: 'playoffs_start' as const, label: 'NHL Playoffs begin', monthUtc: 4, dayUtc: 19 },
    { eventType: 'championship' as const, label: 'Stanley Cup Final begins', monthUtc: 6, dayUtc: 4 },
    { eventType: 'season_opener' as const, label: 'NHL season opener', monthUtc: 10, dayUtc: 8 },
  ]),
  mls: Object.freeze([
    { eventType: 'transfer_window_open' as const, label: 'MLS Secondary Transfer Window opens', monthUtc: 7, dayUtc: 18 },
    { eventType: 'transfer_window_close' as const, label: 'MLS Secondary Transfer Window closes', monthUtc: 8, dayUtc: 21 },
  ]),
});

/**
 * Convert a preset template into a concrete `LeagueEvent` for a specific
 * UTC calendar year. Month is converted from 1-indexed to 0-indexed for
 * `Date.UTC`. When `durationDays` is set, `endMs = startMs + durationDays
 * * 86_400_000`.
 */
export function materializeLeagueEvents(
  leagueId: LeagueId,
  preset: LeagueEventPreset,
  year: number,
): LeagueEvent {
  const startMs = Date.UTC(year, preset.monthUtc - 1, preset.dayUtc);
  const event: LeagueEvent = {
    leagueId,
    eventType: preset.eventType,
    label: preset.label,
    startMs,
  };
  if (preset.durationDays !== undefined) {
    event.endMs = startMs + preset.durationDays * MS_PER_DAY;
  }
  if (preset.notes !== undefined) {
    event.notes = preset.notes;
  }
  return event;
}

/**
 * Materialized union of preset events for the requested leagues + calendar
 * year, sorted ascending by `startMs`. Duplicates are not possible because
 * each (leagueId, eventType, year) tuple is unique by construction.
 */
export function getLeagueCalendar(
  leagueIds: readonly LeagueId[],
  year: number,
): LeagueEvent[] {
  const out: LeagueEvent[] = [];
  for (const leagueId of leagueIds) {
    const presets = LEAGUE_EVENT_PRESETS[leagueId];
    if (!presets) continue;
    for (const preset of presets) {
      out.push(materializeLeagueEvents(leagueId, preset, year));
    }
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

/**
 * Return all preset events for `leagueIds` that fall in the half-open
 * window `[nowMs, nowMs + withinDays * 86_400_000)`. Current and next
 * calendar year are both materialized to cover year-boundary rollovers.
 * Sorted ascending by `startMs`.
 */
export function getUpcomingLeagueEvents(
  leagueIds: readonly LeagueId[],
  nowMs: number,
  withinDays: number,
): LeagueEvent[] {
  const windowEnd = nowMs + withinDays * MS_PER_DAY;
  const thisYear = new Date(nowMs).getUTCFullYear();
  const combined: LeagueEvent[] = [
    ...getLeagueCalendar(leagueIds, thisYear),
    ...getLeagueCalendar(leagueIds, thisYear + 1),
  ];
  return combined
    .filter((e) => e.startMs >= nowMs && e.startMs < windowEnd)
    .sort((a, b) => a.startMs - b.startMs);
}

// ── Player favorites (pure helpers, no persistence) ───────────────────

export interface PlayerFavorite {
  /** Stable slug (caller supplied). Used as the map key and display key. */
  id: string;
  displayName: string;
  leagueId: LeagueId;
  teamId?: string;
  note?: string;
}

/**
 * Base URLs for sports-reference sites per league. `null` for leagues we
 * do not have a partner site for. MLS uses fbref.com because there is no
 * soccer-reference.com equivalent at the league level.
 */
export const STAT_REFERENCE_BASES: Record<LeagueId, string | null> = Object.freeze({
  nfl: 'https://www.pro-football-reference.com',
  nba: 'https://www.basketball-reference.com',
  mlb: 'https://www.baseball-reference.com',
  nhl: 'https://www.hockey-reference.com',
  mls: 'https://fbref.com',
});

/**
 * Produce a deep-link URL to a reference-site search results page for
 * the given favorite. Returns `null` when the league has no partner
 * reference site. The UI is responsible for opening the link externally.
 */
export function buildStatReferenceUrl(favorite: PlayerFavorite): string | null {
  const base = STAT_REFERENCE_BASES[favorite.leagueId];
  if (!base) return null;
  const q = encodeURIComponent(favorite.displayName);
  return `${base}/search/search.fcgi?search=${q}`;
}

/**
 * Bucket favorites by league. Every live `LeagueId` gets a key in the
 * return value, even when it has no favorites (empty array). This lets
 * UIs render a stable section list without guarding for undefined.
 */
export function groupFavoritesByLeague(
  favorites: readonly PlayerFavorite[],
): Record<LeagueId, PlayerFavorite[]> {
  const out: Record<LeagueId, PlayerFavorite[]> = {
    nfl: [],
    nba: [],
    mlb: [],
    nhl: [],
    mls: [],
  };
  for (const favorite of favorites) {
    out[favorite.leagueId].push(favorite);
  }
  return out;
}
