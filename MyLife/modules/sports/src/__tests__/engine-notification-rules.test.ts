import { describe, expect, it } from 'vitest';
import type { Game, Team } from '../types';
import {
  CLOSE_GAME_THRESHOLDS,
  decideNotifications,
  isCloseGame,
  isOvertime,
} from '../engine/notification-rules';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'espn:nfl:6',
    name: 'Cowboys',
    league: 'nfl',
    sport: 'football',
    conference: null,
    division: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    follow_tier: 'diehard',
    notify_start: 1,
    notify_end: 1,
    notify_close: 1,
    notify_trades: 0,
    is_rival: 0,
    notes_md: null,
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'espn:nfl:g1',
    league: 'nfl',
    sport: 'football',
    home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: null },
    away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: null },
    status: 'scheduled',
    period: null,
    clock: null,
    startAt: Date.parse('2026-04-21T20:00:00.000Z'),
    venue: 'AT&T Stadium',
    broadcast: null,
    updatedAt: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Thresholds sanity
// ---------------------------------------------------------------------------

describe('CLOSE_GAME_THRESHOLDS', () => {
  it('exports a threshold for each of the five launch leagues', () => {
    expect(Object.keys(CLOSE_GAME_THRESHOLDS).sort()).toEqual(
      ['mlb', 'mls', 'nba', 'nfl', 'nhl'].sort(),
    );
  });

  it('nfl is within 8 in Q4 with under 5:00', () => {
    expect(CLOSE_GAME_THRESHOLDS.nfl.marginAtMost).toBe(8);
    expect(CLOSE_GAME_THRESHOLDS.nfl.periodIncludes).toBe('q4');
    expect(CLOSE_GAME_THRESHOLDS.nfl.clockMaxSeconds).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// isCloseGame per-league
// ---------------------------------------------------------------------------

describe('isCloseGame (per-league)', () => {
  it('NFL: true within 8 in Q4 under 5:00', () => {
    expect(
      isCloseGame(
        game({
          status: 'live',
          period: 'Q4',
          clock: '3:42',
          home: { id: 'H', name: 'H', abbreviation: null, score: 21 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 17 },
        }),
      ),
    ).toBe(true);
  });

  it('NFL: false when margin is 9+', () => {
    expect(
      isCloseGame(
        game({
          status: 'live',
          period: 'Q4',
          clock: '2:00',
          home: { id: 'H', name: 'H', abbreviation: null, score: 28 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 17 },
        }),
      ),
    ).toBe(false);
  });

  it('NFL: false in Q3', () => {
    expect(
      isCloseGame(
        game({
          status: 'live',
          period: 'Q3',
          clock: '2:00',
          home: { id: 'H', name: 'H', abbreviation: null, score: 10 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 7 },
        }),
      ),
    ).toBe(false);
  });

  it('NBA: true within 6 in Q4 under 3:00', () => {
    expect(
      isCloseGame(
        game({
          league: 'nba',
          sport: 'basketball',
          status: 'live',
          period: 'Q4',
          clock: '2:45',
          home: { id: 'H', name: 'H', abbreviation: null, score: 100 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 95 },
        }),
      ),
    ).toBe(true);
  });

  it('MLB: true within 2 in 9th or later (no clock)', () => {
    expect(
      isCloseGame(
        game({
          league: 'mlb',
          sport: 'baseball',
          status: 'live',
          period: 'Bottom 9th',
          clock: null,
          home: { id: 'H', name: 'H', abbreviation: null, score: 4 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 3 },
        }),
      ),
    ).toBe(true);
  });

  it('NHL: true within 1 in 3rd under 5:00', () => {
    expect(
      isCloseGame(
        game({
          league: 'nhl',
          sport: 'hockey',
          status: 'live',
          period: '3rd Period',
          clock: '4:30',
          home: { id: 'H', name: 'H', abbreviation: null, score: 2 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 2 },
        }),
      ),
    ).toBe(true);
  });

  it('MLS: true within 1 past minute 80', () => {
    expect(
      isCloseGame(
        game({
          league: 'mls',
          sport: 'soccer',
          status: 'live',
          period: "85'",
          clock: null,
          home: { id: 'H', name: 'H', abbreviation: null, score: 1 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 0 },
        }),
      ),
    ).toBe(true);
  });

  it('MLS: false before minute 80', () => {
    expect(
      isCloseGame(
        game({
          league: 'mls',
          sport: 'soccer',
          status: 'live',
          period: "60'",
          clock: null,
          home: { id: 'H', name: 'H', abbreviation: null, score: 1 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 0 },
        }),
      ),
    ).toBe(false);
  });

  it('returns false when status is not live', () => {
    expect(
      isCloseGame(
        game({
          status: 'scheduled',
          home: { id: 'H', name: 'H', abbreviation: null, score: 21 },
          away: { id: 'A', name: 'A', abbreviation: null, score: 17 },
        }),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOvertime
// ---------------------------------------------------------------------------

describe('isOvertime', () => {
  it('NBA OT', () => {
    expect(
      isOvertime(
        game({
          league: 'nba',
          sport: 'basketball',
          status: 'live',
          period: 'OT',
        }),
      ),
    ).toBe(true);
  });

  it('NFL Overtime', () => {
    expect(
      isOvertime(
        game({
          status: 'live',
          period: 'Overtime',
        }),
      ),
    ).toBe(true);
  });

  it('MLB 10th inning', () => {
    expect(
      isOvertime(
        game({
          league: 'mlb',
          sport: 'baseball',
          status: 'live',
          period: 'Top 10th',
        }),
      ),
    ).toBe(true);
  });

  it('regular period returns false', () => {
    expect(
      isOvertime(
        game({
          status: 'live',
          period: 'Q4',
        }),
      ),
    ).toBe(false);
  });

  it('final games are not overtime even with OT in the period', () => {
    expect(
      isOvertime(
        game({
          status: 'final',
          period: 'OT',
        }),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// decideNotifications
// ---------------------------------------------------------------------------

describe('decideNotifications', () => {
  it('emits nothing when the team is not a participant', () => {
    const t = team({ id: 'espn:nfl:99' });
    const g = game({ status: 'live' });
    expect(decideNotifications({ team: t, nextGame: g })).toEqual([]);
  });

  it('emits a start intent on scheduled -> live with notify_start=1', () => {
    const t = team({ notify_start: 1 });
    const prev = game({ status: 'scheduled' });
    const next = game({ status: 'live' });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    const types = out.map((i) => i.eventType);
    expect(types).toContain('start');
  });

  it('does NOT emit start when notify_start=0', () => {
    const t = team({ notify_start: 0 });
    const prev = game({ status: 'scheduled' });
    const next = game({ status: 'live' });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    expect(out.map((i) => i.eventType)).not.toContain('start');
  });

  it('does NOT emit start when prev was already live', () => {
    const t = team({ notify_start: 1 });
    const prev = game({ status: 'live' });
    const next = game({ status: 'live' });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    expect(out.map((i) => i.eventType)).not.toContain('start');
  });

  it('emits a final intent on any non-final -> final transition with notify_end=1', () => {
    const t = team({ notify_end: 1 });
    const prev = game({
      status: 'live',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 21 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const next = game({
      status: 'final',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 24 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    const finalIntent = out.find((i) => i.eventType === 'final');
    expect(finalIntent).toBeDefined();
    expect(finalIntent?.title).toContain('Win');
  });

  it('emits a close intent on live tight games with notify_close=1', () => {
    const t = team({ notify_close: 1 });
    const next = game({
      status: 'live',
      period: 'Q4',
      clock: '2:30',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 21 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const out = decideNotifications({
      team: t,
      prevGame: next,
      nextGame: next,
    });
    expect(out.map((i) => i.eventType)).toContain('close');
  });

  it('does NOT emit close when notify_close=0 even if the game is tight', () => {
    const t = team({ notify_close: 0 });
    const next = game({
      status: 'live',
      period: 'Q4',
      clock: '2:30',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 21 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const out = decideNotifications({
      team: t,
      prevGame: next,
      nextGame: next,
    });
    expect(out.map((i) => i.eventType)).not.toContain('close');
  });

  it('emits overtime intent when notify_end=1 + live OT period', () => {
    const t = team({ notify_end: 1 });
    const next = game({
      status: 'live',
      period: 'OT',
      league: 'nba',
      sport: 'basketball',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: null, score: 100 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: null, score: 100 },
    });
    const out = decideNotifications({
      team: t,
      prevGame: next,
      nextGame: next,
    });
    expect(out.map((i) => i.eventType)).toContain('overtime');
  });

  it('emits rival_loss intent when rival loses at final', () => {
    const t = team({ is_rival: 1 });
    const prev = game({
      status: 'live',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 14 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const next = game({
      status: 'final',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 14 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 21 },
    });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    expect(out.map((i) => i.eventType)).toContain('rival_loss');
  });

  it('does NOT emit rival_loss when the rival wins', () => {
    const t = team({ is_rival: 1 });
    const prev = game({
      status: 'live',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 24 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const next = game({
      status: 'final',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 24 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    expect(out.map((i) => i.eventType)).not.toContain('rival_loss');
  });

  it('emits no intents when all toggles are off and team is not a rival', () => {
    const t = team({
      notify_start: 0,
      notify_end: 0,
      notify_close: 0,
      notify_trades: 0,
      is_rival: 0,
    });
    const prev = game({ status: 'scheduled' });
    const next = game({
      status: 'live',
      period: 'Q4',
      clock: '2:30',
      home: { id: 'espn:nfl:6', name: 'Cowboys', abbreviation: 'DAL', score: 21 },
      away: { id: 'espn:nfl:21', name: 'Eagles', abbreviation: 'PHI', score: 17 },
    });
    const out = decideNotifications({ team: t, prevGame: prev, nextGame: next });
    expect(out).toEqual([]);
  });
});
