/**
 * Year-in-review aggregation engine for MySports.
 *
 * Pure TypeScript -- zero DB access, zero React imports. Accepts already-
 * fetched readonly arrays of domain types so it is trivially unit-testable
 * without a DB fixture. Mirrors the pure-engine precedent set by
 * `computeBetStats(bets)` in bet-analytics.ts and `detectPersonalBest` in
 * personal-bests.ts.
 *
 * Design decisions:
 *   1. The caller supplies the time window (`YearWindow`). The engine
 *      never reads `Date.now()` so the same inputs always produce the
 *      same output. UI picks whether to pass a calendar year (Jan 1 ->
 *      Jan 1 UTC) or a rolling 365-day window.
 *   2. Filtering uses half-open intervals `[startMs, endMs)`. A row at
 *      `endMs` is excluded; a row at `endMs - 1` is included. This makes
 *      the calendar-year window for "2026" produce no overlap with the
 *      "2027" window.
 *   3. Betting reuses `computeBetStats` for win-rate/ROI/settled counts.
 *      Biggest-win and biggest-loss cents are derived by scanning the
 *      in-window bets directly because `computeBetStats` doesn't surface
 *      per-bet extremes.
 *   4. Personal-best detection uses ALL-TIME prior sessions (not just
 *      in-window history) so a "first session ever in sport X" logged
 *      during the window still correctly counts as a PB.
 *   5. `topVenueByVisits` groups attendance by `venue_id ?? venue_name`.
 *      This lets pre-registry venues (no `venue_id`) still tally, while
 *      registered venues dedupe across naming variants. Ties break
 *      lexicographically by `venue_name` for determinism.
 *   6. `bestFinish` uses `FantasyLeague.standings_position` as the
 *      finishing place. The card's "`record.final_place`" name does not
 *      exist on the live schema -- `standings_position` is the actual
 *      column that carries final standing on a settled league.
 *   7. "Best moments" and shareable-image generation are intentionally
 *      out of scope. Best-moments would need a schema flag to mark
 *      standouts; shareables are a UI concern for P7-D.
 */

import type {
  Attendance,
  Bet,
  FantasyLeague,
  FantasyTransaction,
  Memorabilia,
  ParticipationSession,
  Team,
  Venue,
} from '../types';
import { computeBetStats } from './bet-analytics';
import { METRICS_BY_SPORT, detectPersonalBest } from './personal-bests';

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

/**
 * Half-open time window `[startMs, endMs)`. `label` is a human-facing
 * string (e.g. "2026" or "Last 365 days").
 */
export interface YearWindow {
  startMs: number;
  endMs: number;
  label: string;
}

/**
 * Build a calendar-year window: `[Jan 1 00:00 UTC, Jan 1 next year 00:00 UTC)`.
 * The label is the numeric year rendered as a string.
 */
export function makeCalendarYearWindow(year: number): YearWindow {
  const startMs = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const endMs = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0);
  return { startMs, endMs, label: String(year) };
}

/**
 * Build a rolling 365-day window ending at `nowMs`. The label is
 * "Last 365 days". `nowMs` is exclusive (matches half-open convention).
 */
export function makeRollingYearWindow(nowMs: number): YearWindow {
  const DAY_MS = 86_400_000;
  return {
    startMs: nowMs - 365 * DAY_MS,
    endMs: nowMs,
    label: 'Last 365 days',
  };
}

// ---------------------------------------------------------------------------
// Input + Output shape
// ---------------------------------------------------------------------------

/**
 * Already-fetched rows the aggregator operates on. All arrays are readonly
 * so the engine cannot mutate caller-owned data. `sessions` is the
 * ALL-TIME list so first-of-sport PB detection works; in-window filtering
 * is applied internally.
 */
export interface YearInReviewInput {
  window: YearWindow;
  teams: readonly Team[];
  bets: readonly Bet[];
  fantasyLeagues: readonly FantasyLeague[];
  fantasyTransactions: readonly FantasyTransaction[];
  sessions: readonly ParticipationSession[];
  attendance: readonly Attendance[];
  venues: readonly Venue[];
  memorabilia: readonly Memorabilia[];
}

/**
 * Aggregated year-in-review summary. All money values are cents. Counts
 * are non-negative integers. Nullable fields indicate "no data in window".
 */
export interface YearInReviewSummary {
  window: YearWindow;
  teamsFollowed: number;
  teamsByLeague: Record<string, number>;
  attendance: {
    gamesAttended: number;
    uniqueVenues: number;
    totalSpentCents: number;
    avgRating: number | null;
    topVenueByVisits: {
      venueId: string | null;
      venueName: string;
      visits: number;
    } | null;
  };
  betting: {
    totalBets: number;
    settledBets: number;
    winRatePct: number | null;
    roiPct: number | null;
    profitLossCents: number;
    biggestWinCents: number;
    biggestLossCents: number;
  };
  fantasy: {
    leagues: number;
    bestFinish: {
      leagueId: string;
      leagueName: string;
      finalPlace: number;
    } | null;
    totalTransactions: number;
  };
  personal: {
    sessionsLogged: number;
    totalDurationMinutes: number;
    distinctSports: number;
    personalBestsDetected: number;
  };
  collection: {
    memorabiliaCount: number;
    collectionValueCents: number;
  };
  totals: {
    totalSpentCents: number;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function inWindow(ts: number, window: YearWindow): boolean {
  return ts >= window.startMs && ts < window.endMs;
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

/**
 * Compute the year-in-review summary from the supplied input. Deterministic:
 * same inputs produce the same output. No network, no clock reads, no
 * mutation of input arrays.
 *
 * Future work (not shipped in P7-A):
 *   * Best moments -- requires a schema flag marking stand-out rows.
 *   * Shareable image generation -- belongs to the UI layer (P7-D).
 *   * Photo aggregation -- photos pipeline is deferred phase-wide.
 */
export function generateYearInReview(
  input: YearInReviewInput,
): YearInReviewSummary {
  const { window } = input;

  // ─ Teams (no time filter; teams are "currently followed") ───────────
  const teamsFollowed = input.teams.length;
  const teamsByLeague: Record<string, number> = {};
  for (const t of input.teams) {
    teamsByLeague[t.league] = (teamsByLeague[t.league] ?? 0) + 1;
  }

  // ─ Attendance ────────────────────────────────────────────────────────
  const attendedInWindow = input.attendance.filter((a) =>
    inWindow(a.attended_at, window),
  );
  const gamesAttended = attendedInWindow.length;
  const attendanceSpentCents = attendedInWindow.reduce(
    (sum, a) => sum + a.cost_cents,
    0,
  );

  // Unique venues + visits tally keyed by venue_id ?? venue_name.
  const venueVisits = new Map<
    string,
    { venueId: string | null; venueName: string; visits: number }
  >();
  for (const a of attendedInWindow) {
    const key = a.venue_id ?? a.venue_name;
    const existing = venueVisits.get(key);
    if (existing) {
      existing.visits += 1;
    } else {
      venueVisits.set(key, {
        venueId: a.venue_id,
        venueName: a.venue_name,
        visits: 1,
      });
    }
  }
  const uniqueVenues = venueVisits.size;

  // topVenueByVisits: highest visits, ties broken by earliest venueName.
  let topVenueByVisits: YearInReviewSummary['attendance']['topVenueByVisits'] =
    null;
  for (const entry of venueVisits.values()) {
    if (topVenueByVisits === null) {
      topVenueByVisits = { ...entry };
      continue;
    }
    if (entry.visits > topVenueByVisits.visits) {
      topVenueByVisits = { ...entry };
    } else if (
      entry.visits === topVenueByVisits.visits &&
      entry.venueName < topVenueByVisits.venueName
    ) {
      topVenueByVisits = { ...entry };
    }
  }

  // Average rating across attendance rows that supplied a rating.
  let ratingSum = 0;
  let ratingCount = 0;
  for (const a of attendedInWindow) {
    if (a.rating !== null) {
      ratingSum += a.rating;
      ratingCount += 1;
    }
  }
  const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

  // ─ Betting ───────────────────────────────────────────────────────────
  const betsInWindow = input.bets.filter((b) => inWindow(b.placed_at, window));
  const betStats = computeBetStats(betsInWindow);
  let biggestWinCents = 0;
  let biggestLossCents = 0;
  for (const bet of betsInWindow) {
    if (bet.result === 'won' && bet.profit_loss_cents > biggestWinCents) {
      biggestWinCents = bet.profit_loss_cents;
    }
    if (bet.result === 'lost') {
      // profit_loss_cents is negative for a loss; track largest magnitude.
      const loss = Math.abs(bet.profit_loss_cents);
      if (loss > biggestLossCents) {
        biggestLossCents = loss;
      }
    }
  }
  const betStakeCentsInWindow = betsInWindow.reduce(
    (sum, b) => sum + b.stake_cents,
    0,
  );

  // ─ Fantasy ───────────────────────────────────────────────────────────
  const leaguesInWindow = input.fantasyLeagues.filter((l) =>
    inWindow(l.created_at, window),
  );
  const txInWindow = input.fantasyTransactions.filter((t) =>
    inWindow(t.created_at, window),
  );
  let bestFinish: YearInReviewSummary['fantasy']['bestFinish'] = null;
  for (const l of leaguesInWindow) {
    if (l.standings_position === null) continue;
    if (bestFinish === null || l.standings_position < bestFinish.finalPlace) {
      bestFinish = {
        leagueId: l.id,
        leagueName: l.league_name,
        finalPlace: l.standings_position,
      };
    }
  }

  // ─ Personal (participation) ──────────────────────────────────────────
  const sessionsInWindow = input.sessions.filter((s) =>
    inWindow(s.started_at, window),
  );
  const sessionsLogged = sessionsInWindow.length;
  const totalDurationMinutes = sessionsInWindow.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0,
  );
  const distinctSports = new Set(sessionsInWindow.map((s) => s.sport)).size;

  // Personal-bests: ALL-TIME priors (not just in-window) so a first-of-
  // sport session still detects as a PB. For each in-window session, the
  // priors are every other session in the same sport that happened strictly
  // before it (by `started_at`; ties broken by id for determinism).
  let personalBestsDetected = 0;
  for (const candidate of sessionsInWindow) {
    const priors = input.sessions.filter(
      (s) =>
        s.id !== candidate.id &&
        s.sport === candidate.sport &&
        (s.started_at < candidate.started_at ||
          (s.started_at === candidate.started_at && s.id < candidate.id)),
    );
    const metrics = METRICS_BY_SPORT[candidate.sport] ?? [];
    const result = detectPersonalBest(candidate, priors, metrics);
    if (result.isPB) personalBestsDetected += 1;
  }

  // ─ Collection (memorabilia) ──────────────────────────────────────────
  // acquired_at is nullable; skip rows without a known acquisition date.
  const memorabiliaInWindow = input.memorabilia.filter(
    (m) => m.acquired_at !== null && inWindow(m.acquired_at, window),
  );
  const memorabiliaCount = memorabiliaInWindow.length;
  const collectionValueCents = memorabiliaInWindow.reduce(
    (sum, m) => sum + m.estimated_value_cents,
    0,
  );
  const memorabiliaSpentCents = memorabiliaInWindow.reduce(
    (sum, m) => sum + m.purchase_price_cents,
    0,
  );

  // ─ Totals ────────────────────────────────────────────────────────────
  const totalSpentCents =
    attendanceSpentCents + betStakeCentsInWindow + memorabiliaSpentCents;

  return {
    window,
    teamsFollowed,
    teamsByLeague,
    attendance: {
      gamesAttended,
      uniqueVenues,
      totalSpentCents: attendanceSpentCents,
      avgRating,
      topVenueByVisits,
    },
    betting: {
      totalBets: betStats.totalBets,
      settledBets: betStats.settledBets,
      winRatePct: betStats.winRatePct,
      roiPct: betStats.roiPct,
      profitLossCents: betStats.profitLossCents,
      biggestWinCents,
      biggestLossCents,
    },
    fantasy: {
      leagues: leaguesInWindow.length,
      bestFinish,
      totalTransactions: txInWindow.length,
    },
    personal: {
      sessionsLogged,
      totalDurationMinutes,
      distinctSports,
      personalBestsDetected,
    },
    collection: {
      memorabiliaCount,
      collectionValueCents,
    },
    totals: {
      totalSpentCents,
    },
  };
}
