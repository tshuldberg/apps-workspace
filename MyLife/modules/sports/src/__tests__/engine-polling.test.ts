import { describe, expect, it } from 'vitest';
import {
  IDLE_INTERVAL_MS,
  LIVE_INTERVAL_MS,
  SOON_INTERVAL_MS,
  SOON_WINDOW_MS,
  pickInterval,
} from '../engine/polling';
import type { Game } from '../types';

const NOW = 1_700_000_000_000;

function game(overrides: Partial<Game>): Game {
  return {
    id: 'espn:nfl:1',
    league: 'nfl',
    sport: 'football',
    home: { id: '1', name: 'Home', abbreviation: null, score: null },
    away: { id: '2', name: 'Away', abbreviation: null, score: null },
    status: 'scheduled',
    period: null,
    clock: null,
    startAt: NOW + 10 * 60 * 1000,
    venue: null,
    broadcast: null,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('pickInterval', () => {
  it('returns IDLE_INTERVAL_MS when given no games', () => {
    expect(pickInterval([], { now: NOW })).toBe(IDLE_INTERVAL_MS);
  });

  it('returns IDLE_INTERVAL_MS when all games are final', () => {
    const games: Game[] = [
      game({ status: 'final', startAt: NOW - 3 * 60 * 60 * 1000 }),
      game({ id: 'espn:nba:2', status: 'final', startAt: NOW - 4 * 60 * 60 * 1000 }),
    ];
    expect(pickInterval(games, { now: NOW })).toBe(IDLE_INTERVAL_MS);
  });

  it('returns SOON_INTERVAL_MS when an upcoming game starts inside the 2h window', () => {
    const games: Game[] = [
      game({ status: 'scheduled', startAt: NOW + 60 * 60 * 1000 }),
    ];
    expect(pickInterval(games, { now: NOW })).toBe(SOON_INTERVAL_MS);
  });

  it('does NOT promote to SOON when the next game is beyond the 2h window', () => {
    const games: Game[] = [
      game({ status: 'scheduled', startAt: NOW + SOON_WINDOW_MS + 60_000 }),
    ];
    expect(pickInterval(games, { now: NOW })).toBe(IDLE_INTERVAL_MS);
  });

  it('ignores scheduled games in the past', () => {
    const games: Game[] = [
      game({ status: 'scheduled', startAt: NOW - 60_000 }),
    ];
    expect(pickInterval(games, { now: NOW })).toBe(IDLE_INTERVAL_MS);
  });

  it('returns LIVE_INTERVAL_MS if any game is live, even with upcoming ones', () => {
    const games: Game[] = [
      game({ status: 'scheduled', startAt: NOW + 30 * 60 * 1000 }),
      game({ id: 'espn:nba:5', status: 'live' }),
      game({ id: 'espn:mlb:9', status: 'final', startAt: NOW - 2 * 60 * 60 * 1000 }),
    ];
    expect(pickInterval(games, { now: NOW })).toBe(LIVE_INTERVAL_MS);
  });

  it('defaults `now` to Date.now when omitted', () => {
    // Live always short-circuits so we don't depend on the real clock.
    expect(pickInterval([game({ status: 'live' })])).toBe(LIVE_INTERVAL_MS);
  });
});
