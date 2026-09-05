import { describe, expect, it } from 'vitest';
import {
  generateYearInReview,
  makeCalendarYearWindow,
  makeRollingYearWindow,
  type YearInReviewInput,
  type YearWindow,
} from '../engine/year-in-review';
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

// ─ Factories ──────────────────────────────────────────────────────────

function team(
  overrides: Partial<Team> & Pick<Team, 'id' | 'league'>,
): Team {
  const base: Team = {
    id: overrides.id,
    name: `team-${overrides.id}`,
    league: overrides.league,
    sport: 'generic',
    conference: null,
    division: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    follow_tier: 'casual',
    notify_start: 0,
    notify_end: 0,
    notify_close: 0,
    notify_trades: 0,
    is_rival: 0,
    notes_md: null,
    created_at: 0,
    updated_at: 0,
  };
  return { ...base, ...overrides };
}

function bet(overrides: Partial<Bet> & Pick<Bet, 'id' | 'placed_at'>): Bet {
  const base: Bet = {
    id: overrides.id,
    sport: 'football',
    league: 'nfl',
    game_id: null,
    team_id: null,
    bet_type: 'moneyline',
    description: 'test',
    sportsbook: 'draftkings',
    odds_american: -110,
    stake_cents: 10_000,
    potential_payout_cents: 19_090,
    units: 1,
    result: 'pending',
    profit_loss_cents: 0,
    placed_at: overrides.placed_at,
    settled_at: null,
    notes_md: null,
    created_at: overrides.placed_at,
    updated_at: overrides.placed_at,
  };
  return { ...base, ...overrides };
}

function league(
  overrides: Partial<FantasyLeague> & Pick<FantasyLeague, 'id' | 'created_at'>,
): FantasyLeague {
  const base: FantasyLeague = {
    id: overrides.id,
    platform: 'espn',
    sport: 'football',
    league_name: `league-${overrides.id}`,
    season: '2026',
    format: 'redraft',
    team_name: 'My Team',
    roster: [],
    record_wins: 0,
    record_losses: 0,
    record_ties: 0,
    points_for: 0,
    points_against: 0,
    standings_position: null,
    buy_in_cents: null,
    prize_cents: null,
    notes_md: null,
    created_at: overrides.created_at,
    updated_at: overrides.created_at,
  };
  return { ...base, ...overrides };
}

function tx(
  overrides: Partial<FantasyTransaction> &
    Pick<FantasyTransaction, 'id' | 'league_id' | 'created_at'>,
): FantasyTransaction {
  const base: FantasyTransaction = {
    id: overrides.id,
    league_id: overrides.league_id,
    type: 'waiver_add',
    players_in: [],
    players_out: [],
    description: 'test',
    reasoning_md: null,
    happened_at: overrides.created_at,
    created_at: overrides.created_at,
  };
  return { ...base, ...overrides };
}

function session(
  overrides: Partial<ParticipationSession> &
    Pick<ParticipationSession, 'id' | 'sport' | 'started_at'>,
): ParticipationSession {
  const base: ParticipationSession = {
    id: overrides.id,
    sport: overrides.sport,
    activity: 'pickup',
    started_at: overrides.started_at,
    duration_minutes: null,
    location: null,
    teammates: [],
    stats: {},
    personal_best: false,
    mood_before: null,
    mood_after: null,
    injury_notes: null,
    notes_md: null,
    photo_ids: [],
    created_at: overrides.started_at,
  };
  return { ...base, ...overrides };
}

function att(
  overrides: Partial<Attendance> &
    Pick<Attendance, 'id' | 'venue_name' | 'attended_at'>,
): Attendance {
  const base: Attendance = {
    id: overrides.id,
    game_id: null,
    venue_id: null,
    venue_name: overrides.venue_name,
    section: null,
    row_label: null,
    seat: null,
    companions: [],
    cost_cents: 0,
    tailgate_notes_md: null,
    parking_notes_md: null,
    rating: null,
    notes_md: null,
    photo_ids: [],
    attended_at: overrides.attended_at,
    created_at: overrides.attended_at,
    updated_at: overrides.attended_at,
  };
  return { ...base, ...overrides };
}

function mem(
  overrides: Partial<Memorabilia> & Pick<Memorabilia, 'id'>,
): Memorabilia {
  const base: Memorabilia = {
    id: overrides.id,
    item_type: 'card',
    description: 'test',
    sport: null,
    team: null,
    player: null,
    acquired_at: null,
    purchase_price_cents: 0,
    estimated_value_cents: 0,
    photo_ids: [],
    notes_md: null,
    created_at: 0,
    updated_at: 0,
  };
  return { ...base, ...overrides };
}

function emptyInput(window: YearWindow): YearInReviewInput {
  return {
    window,
    teams: [],
    bets: [],
    fantasyLeagues: [],
    fantasyTransactions: [],
    sessions: [],
    attendance: [],
    venues: [] as readonly Venue[],
    memorabilia: [],
  };
}

// ─ Window helper tests ────────────────────────────────────────────────

describe('makeCalendarYearWindow', () => {
  it('builds a Jan-1-to-Jan-1 UTC half-open window', () => {
    const w = makeCalendarYearWindow(2026);
    expect(w.startMs).toBe(Date.UTC(2026, 0, 1));
    expect(w.endMs).toBe(Date.UTC(2027, 0, 1));
    expect(w.label).toBe('2026');
  });

  it('adjacent years do not overlap', () => {
    const a = makeCalendarYearWindow(2025);
    const b = makeCalendarYearWindow(2026);
    expect(a.endMs).toBe(b.startMs);
  });
});

describe('makeRollingYearWindow', () => {
  it('spans 365 days ending at nowMs', () => {
    const now = 2_000_000_000_000;
    const w = makeRollingYearWindow(now);
    expect(w.endMs).toBe(now);
    expect(w.endMs - w.startMs).toBe(365 * 86_400_000);
    expect(w.label).toBe('Last 365 days');
  });
});

// ─ Engine tests ───────────────────────────────────────────────────────

const WINDOW_2026 = makeCalendarYearWindow(2026);
const IN_WIN = Date.UTC(2026, 5, 1); // June 1, 2026 -- inside 2026 window

describe('generateYearInReview -- empty input', () => {
  it('returns zero everywhere and nulls where appropriate', () => {
    const out = generateYearInReview(emptyInput(WINDOW_2026));
    expect(out.teamsFollowed).toBe(0);
    expect(out.teamsByLeague).toEqual({});
    expect(out.attendance).toEqual({
      gamesAttended: 0,
      uniqueVenues: 0,
      totalSpentCents: 0,
      avgRating: null,
      topVenueByVisits: null,
    });
    expect(out.betting.totalBets).toBe(0);
    expect(out.betting.winRatePct).toBeNull();
    expect(out.betting.roiPct).toBeNull();
    expect(out.betting.biggestWinCents).toBe(0);
    expect(out.betting.biggestLossCents).toBe(0);
    expect(out.fantasy.leagues).toBe(0);
    expect(out.fantasy.bestFinish).toBeNull();
    expect(out.fantasy.totalTransactions).toBe(0);
    expect(out.personal.sessionsLogged).toBe(0);
    expect(out.personal.distinctSports).toBe(0);
    expect(out.personal.personalBestsDetected).toBe(0);
    expect(out.collection.memorabiliaCount).toBe(0);
    expect(out.collection.collectionValueCents).toBe(0);
    expect(out.totals.totalSpentCents).toBe(0);
  });
});

describe('generateYearInReview -- multi-section fixture', () => {
  const input: YearInReviewInput = {
    window: WINDOW_2026,
    teams: [
      team({ id: 't1', league: 'nfl' }),
      team({ id: 't2', league: 'nfl' }),
      team({ id: 't3', league: 'nba' }),
    ],
    bets: [
      bet({
        id: 'b1',
        placed_at: IN_WIN,
        result: 'won',
        profit_loss_cents: 20_000,
        settled_at: IN_WIN + 1,
      }),
      bet({
        id: 'b2',
        placed_at: IN_WIN,
        result: 'won',
        profit_loss_cents: 5_000,
        settled_at: IN_WIN + 1,
      }),
      bet({
        id: 'b3',
        placed_at: IN_WIN,
        result: 'lost',
        profit_loss_cents: -10_000,
        settled_at: IN_WIN + 1,
      }),
      bet({
        id: 'b4',
        placed_at: IN_WIN,
        result: 'lost',
        profit_loss_cents: -30_000,
        settled_at: IN_WIN + 1,
      }),
      bet({
        id: 'b5',
        placed_at: IN_WIN,
        result: 'pending',
      }),
    ],
    fantasyLeagues: [
      league({ id: 'fl1', created_at: IN_WIN, standings_position: 3 }),
      league({ id: 'fl2', created_at: IN_WIN, standings_position: 7 }),
    ],
    fantasyTransactions: [
      tx({ id: 'tx1', league_id: 'fl1', created_at: IN_WIN }),
      tx({ id: 'tx2', league_id: 'fl1', created_at: IN_WIN }),
    ],
    sessions: [
      // Basketball: 3 sessions. Third one is a PB (higher points).
      session({
        id: 's1',
        sport: 'basketball',
        started_at: IN_WIN,
        stats: { points: 10 },
      }),
      session({
        id: 's2',
        sport: 'basketball',
        started_at: IN_WIN + 100,
        stats: { points: 12 },
      }),
      session({
        id: 's3',
        sport: 'basketball',
        started_at: IN_WIN + 200,
        stats: { points: 25 },
      }),
      // Golf: 3 sessions (score = lower is better). Third improves again.
      session({
        id: 's4',
        sport: 'golf',
        started_at: IN_WIN,
        stats: { score: 95 },
      }),
      session({
        id: 's5',
        sport: 'golf',
        started_at: IN_WIN + 100,
        stats: { score: 90 },
      }),
      session({
        id: 's6',
        sport: 'golf',
        started_at: IN_WIN + 200,
        stats: { score: 85 },
      }),
      // Soccer: 2 sessions. First-of-sport is a PB, second is not.
      session({
        id: 's7',
        sport: 'soccer',
        started_at: IN_WIN,
        stats: { goals: 2 },
      }),
      session({
        id: 's8',
        sport: 'soccer',
        started_at: IN_WIN + 100,
        stats: { goals: 1 },
      }),
    ],
    attendance: [
      att({
        id: 'a1',
        venue_id: 'v1',
        venue_name: 'Lambeau Field',
        attended_at: IN_WIN,
        cost_cents: 15_000,
        rating: 5,
      }),
      att({
        id: 'a2',
        venue_id: 'v1',
        venue_name: 'Lambeau Field',
        attended_at: IN_WIN + 1000,
        cost_cents: 10_000,
        rating: 4,
      }),
      att({
        id: 'a3',
        venue_id: 'v2',
        venue_name: 'Wrigley Field',
        attended_at: IN_WIN + 2000,
        cost_cents: 8_000,
        rating: 3,
      }),
      att({
        id: 'a4',
        venue_id: 'v2',
        venue_name: 'Wrigley Field',
        attended_at: IN_WIN + 3000,
        cost_cents: 7_000,
        rating: null,
      }),
    ],
    venues: [],
    memorabilia: [
      mem({
        id: 'm1',
        acquired_at: IN_WIN,
        purchase_price_cents: 5_000,
        estimated_value_cents: 7_500,
      }),
      mem({
        id: 'm2',
        acquired_at: IN_WIN + 500,
        purchase_price_cents: 2_000,
        estimated_value_cents: 2_000,
      }),
      mem({
        id: 'm3',
        acquired_at: IN_WIN + 1000,
        purchase_price_cents: 10_000,
        estimated_value_cents: 15_000,
      }),
    ],
  };
  const out = generateYearInReview(input);

  it('teamsFollowed + teamsByLeague reflect team rows', () => {
    expect(out.teamsFollowed).toBe(3);
    expect(out.teamsByLeague).toEqual({ nfl: 2, nba: 1 });
  });

  it('betting stats reuse computeBetStats and derive biggest win/loss', () => {
    expect(out.betting.totalBets).toBe(5);
    expect(out.betting.settledBets).toBe(4);
    // 2 wins / 4 settled (excluding pending) = 50%
    expect(out.betting.winRatePct).toBe(50);
    expect(out.betting.profitLossCents).toBe(20_000 + 5_000 - 10_000 - 30_000);
    expect(out.betting.biggestWinCents).toBe(20_000);
    expect(out.betting.biggestLossCents).toBe(30_000);
  });

  it('fantasy counts leagues + transactions and picks best finish', () => {
    expect(out.fantasy.leagues).toBe(2);
    expect(out.fantasy.totalTransactions).toBe(2);
    expect(out.fantasy.bestFinish).toEqual({
      leagueId: 'fl1',
      leagueName: 'league-fl1',
      finalPlace: 3,
    });
  });

  it('personal aggregates 8 sessions across 3 sports with 1 PB per sport', () => {
    expect(out.personal.sessionsLogged).toBe(8);
    expect(out.personal.distinctSports).toBe(3);
    // basketball: only s3 (25pts) improves over prior 10->12.
    // golf: s5 improves over s4, s6 improves over s5. Two PBs.
    // soccer: s7 is first-of-sport (PB), s8 regresses (not PB).
    // basketball: s1 first-of-sport (PB), s2 improves (PB), s3 improves (PB).
    // Total = 3 (basketball) + 3 (golf) + 1 (soccer) = 7.
    expect(out.personal.personalBestsDetected).toBe(7);
  });

  it('attendance counts games, unique venues, avg rating', () => {
    expect(out.attendance.gamesAttended).toBe(4);
    expect(out.attendance.uniqueVenues).toBe(2);
    expect(out.attendance.totalSpentCents).toBe(40_000);
    // Ratings: 5, 4, 3 (one null skipped) -> avg = 4.
    expect(out.attendance.avgRating).toBe(4);
    expect(out.attendance.topVenueByVisits).toEqual({
      venueId: 'v1',
      venueName: 'Lambeau Field',
      visits: 2,
    });
  });

  it('collection counts and sums estimated + purchase prices', () => {
    expect(out.collection.memorabiliaCount).toBe(3);
    expect(out.collection.collectionValueCents).toBe(24_500);
  });

  it('totals.totalSpentCents = attendance + stakes + memorabilia purchases', () => {
    // attendance 40_000 + stakes (5 bets x 10_000 = 50_000) + mem 17_000.
    expect(out.totals.totalSpentCents).toBe(40_000 + 50_000 + 17_000);
  });
});

// ─ Window boundary tests ──────────────────────────────────────────────

describe('generateYearInReview -- window boundaries', () => {
  it('excludes attendance 1ms before startMs, includes endMs-1, excludes endMs', () => {
    const input: YearInReviewInput = {
      ...emptyInput(WINDOW_2026),
      attendance: [
        att({
          id: 'before',
          venue_name: 'B',
          attended_at: WINDOW_2026.startMs - 1,
          cost_cents: 100,
        }),
        att({
          id: 'edgeStart',
          venue_name: 'S',
          attended_at: WINDOW_2026.startMs,
          cost_cents: 200,
        }),
        att({
          id: 'edgeEnd',
          venue_name: 'E',
          attended_at: WINDOW_2026.endMs - 1,
          cost_cents: 400,
        }),
        att({
          id: 'after',
          venue_name: 'A',
          attended_at: WINDOW_2026.endMs,
          cost_cents: 800,
        }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.attendance.gamesAttended).toBe(2);
    expect(out.attendance.totalSpentCents).toBe(200 + 400);
  });
});

// ─ Tie-break + null handling ──────────────────────────────────────────

describe('generateYearInReview -- tie-breaks and null skips', () => {
  it('topVenueByVisits tie-breaks lexicographically by earliest venueName', () => {
    const input: YearInReviewInput = {
      ...emptyInput(WINDOW_2026),
      attendance: [
        att({
          id: 'a1',
          venue_name: 'Zzz Stadium',
          attended_at: IN_WIN,
        }),
        att({
          id: 'a2',
          venue_name: 'Aaa Stadium',
          attended_at: IN_WIN + 1,
        }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.attendance.topVenueByVisits).toEqual({
      venueId: null,
      venueName: 'Aaa Stadium',
      visits: 1,
    });
  });

  it('bestFinish skips leagues with null standings_position', () => {
    const input: YearInReviewInput = {
      ...emptyInput(WINDOW_2026),
      fantasyLeagues: [
        league({ id: 'fl1', created_at: IN_WIN, standings_position: null }),
        league({ id: 'fl2', created_at: IN_WIN, standings_position: 5 }),
        league({ id: 'fl3', created_at: IN_WIN, standings_position: null }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.fantasy.bestFinish).toEqual({
      leagueId: 'fl2',
      leagueName: 'league-fl2',
      finalPlace: 5,
    });
  });

  it('bestFinish is null when every league has null final place', () => {
    const input: YearInReviewInput = {
      ...emptyInput(WINDOW_2026),
      fantasyLeagues: [
        league({ id: 'fl1', created_at: IN_WIN, standings_position: null }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.fantasy.bestFinish).toBeNull();
  });

  it('memorabilia with null acquired_at is excluded from in-window totals', () => {
    const input: YearInReviewInput = {
      ...emptyInput(WINDOW_2026),
      memorabilia: [
        mem({
          id: 'm1',
          acquired_at: null,
          purchase_price_cents: 999,
          estimated_value_cents: 999,
        }),
        mem({
          id: 'm2',
          acquired_at: IN_WIN,
          purchase_price_cents: 100,
          estimated_value_cents: 200,
        }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.collection.memorabiliaCount).toBe(1);
    expect(out.collection.collectionValueCents).toBe(200);
    expect(out.totals.totalSpentCents).toBe(100);
  });
});

// ─ Personal-bests all-time priors ─────────────────────────────────────

describe('generateYearInReview -- PB uses all-time priors', () => {
  it('does not count an in-window session as PB when a prior out-of-window session was better', () => {
    const PRIOR = Date.UTC(2025, 5, 1); // out of window
    const input: YearInReviewInput = {
      ...emptyInput(WINDOW_2026),
      sessions: [
        // Prior (2025) session with higher score -- makes the in-window
        // session NOT a personal best.
        session({
          id: 'prior',
          sport: 'basketball',
          started_at: PRIOR,
          stats: { points: 50 },
        }),
        session({
          id: 'in',
          sport: 'basketball',
          started_at: IN_WIN,
          stats: { points: 10 },
        }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.personal.sessionsLogged).toBe(1);
    expect(out.personal.personalBestsDetected).toBe(0);
  });
});

// ─ Rolling window integration ─────────────────────────────────────────

describe('generateYearInReview -- rolling window', () => {
  it('includes rows within the last 365 days and excludes older', () => {
    const now = Date.UTC(2026, 5, 1);
    const win = makeRollingYearWindow(now);
    const input: YearInReviewInput = {
      ...emptyInput(win),
      attendance: [
        att({
          id: 'recent',
          venue_name: 'Fenway',
          attended_at: now - 1_000,
          cost_cents: 5_000,
        }),
        att({
          id: 'oldie',
          venue_name: 'Fenway',
          attended_at: now - 400 * 86_400_000,
          cost_cents: 9_000,
        }),
      ],
    };
    const out = generateYearInReview(input);
    expect(out.attendance.gamesAttended).toBe(1);
    expect(out.attendance.totalSpentCents).toBe(5_000);
  });
});
