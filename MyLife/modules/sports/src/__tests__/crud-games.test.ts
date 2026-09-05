import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  getGameById,
  listGamesForDate,
  listGamesForTeams,
  pruneGamesOlderThan,
  upsertGames,
} from '../db/crud/games';
import type { Game } from '../types';

const DAY_START = Date.parse('2026-04-21T00:00:00.000Z');

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'espn:nfl:1',
    league: 'nfl',
    sport: 'football',
    home: {
      id: 'team-home',
      name: 'Dallas Cowboys',
      abbreviation: 'DAL',
      score: null,
    },
    away: {
      id: 'team-away',
      name: 'Philadelphia Eagles',
      abbreviation: 'PHI',
      score: null,
    },
    status: 'scheduled',
    period: null,
    clock: null,
    startAt: DAY_START + 20 * 60 * 60 * 1000, // 8pm UTC
    venue: 'AT&T Stadium',
    broadcast: null,
    updatedAt: DAY_START,
    ...overrides,
  };
}

describe('sports games CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('upsertGames inserts new rows and returns them via getGameById', () => {
    upsertGames(db.adapter, [game()]);
    const row = getGameById(db.adapter, 'espn:nfl:1');
    expect(row?.home.name).toBe('Dallas Cowboys');
    expect(row?.away.name).toBe('Philadelphia Eagles');
    expect(row?.status).toBe('scheduled');
  });

  it('upsertGames is idempotent and refreshes mutable fields on repeat calls', () => {
    upsertGames(db.adapter, [game()]);
    upsertGames(db.adapter, [
      game({
        status: 'live',
        home: { id: 'team-home', name: 'Dallas Cowboys', abbreviation: 'DAL', score: 17 },
        away: { id: 'team-away', name: 'Philadelphia Eagles', abbreviation: 'PHI', score: 14 },
        period: '2nd Quarter',
        clock: '5:32',
        updatedAt: DAY_START + 60_000,
      }),
    ]);
    const row = getGameById(db.adapter, 'espn:nfl:1');
    expect(row?.status).toBe('live');
    expect(row?.home.score).toBe(17);
    expect(row?.away.score).toBe(14);
    expect(row?.period).toBe('2nd Quarter');
    expect(row?.clock).toBe('5:32');
    expect(row?.updatedAt).toBe(DAY_START + 60_000);
  });

  it('upsertGames is a no-op on an empty input', () => {
    upsertGames(db.adapter, []);
    expect(getGameById(db.adapter, 'missing')).toBeNull();
  });

  it('listGamesForDate returns games that fall inside the UTC day, in start order', () => {
    upsertGames(db.adapter, [
      game({ id: 'espn:nfl:1', startAt: DAY_START + 23 * 60 * 60 * 1000 }),
      game({ id: 'espn:nfl:2', startAt: DAY_START + 2 * 60 * 60 * 1000 }),
      game({ id: 'espn:nfl:3', startAt: DAY_START - 60_000 }),
      game({ id: 'espn:nfl:4', startAt: DAY_START + 24 * 60 * 60 * 1000 }),
    ]);
    const ids = listGamesForDate(db.adapter, '2026-04-21').map((g) => g.id);
    expect(ids).toEqual(['espn:nfl:2', 'espn:nfl:1']);
  });

  it('listGamesForTeams filters on home or away team id match', () => {
    upsertGames(db.adapter, [
      game({
        id: 'espn:nfl:1',
        home: { id: 'A', name: 'A', abbreviation: null, score: null },
        away: { id: 'B', name: 'B', abbreviation: null, score: null },
      }),
      game({
        id: 'espn:nfl:2',
        home: { id: 'C', name: 'C', abbreviation: null, score: null },
        away: { id: 'A', name: 'A', abbreviation: null, score: null },
        startAt: DAY_START + 21 * 60 * 60 * 1000,
      }),
      game({
        id: 'espn:nfl:3',
        home: { id: 'X', name: 'X', abbreviation: null, score: null },
        away: { id: 'Y', name: 'Y', abbreviation: null, score: null },
        startAt: DAY_START + 22 * 60 * 60 * 1000,
      }),
    ]);
    const ids = listGamesForTeams(db.adapter, ['A']).map((g) => g.id);
    expect(ids.sort()).toEqual(['espn:nfl:1', 'espn:nfl:2']);
  });

  it('listGamesForTeams respects since/until windows and is empty when no teams supplied', () => {
    upsertGames(db.adapter, [
      game({
        id: 'espn:nfl:past',
        home: { id: 'A', name: 'A', abbreviation: null, score: null },
        away: { id: 'B', name: 'B', abbreviation: null, score: null },
        startAt: DAY_START - 2 * 60 * 60 * 1000,
      }),
      game({
        id: 'espn:nfl:now',
        home: { id: 'A', name: 'A', abbreviation: null, score: null },
        away: { id: 'B', name: 'B', abbreviation: null, score: null },
        startAt: DAY_START + 60 * 60 * 1000,
      }),
      game({
        id: 'espn:nfl:future',
        home: { id: 'A', name: 'A', abbreviation: null, score: null },
        away: { id: 'B', name: 'B', abbreviation: null, score: null },
        startAt: DAY_START + 48 * 60 * 60 * 1000,
      }),
    ]);
    const windowed = listGamesForTeams(db.adapter, ['A'], {
      since: DAY_START,
      until: DAY_START + 24 * 60 * 60 * 1000,
    });
    expect(windowed.map((g) => g.id)).toEqual(['espn:nfl:now']);

    expect(listGamesForTeams(db.adapter, [])).toEqual([]);
  });

  it('pruneGamesOlderThan removes cached games before the cutoff', () => {
    upsertGames(db.adapter, [
      game({ id: 'espn:nfl:old', startAt: DAY_START - 24 * 60 * 60 * 1000 }),
      game({ id: 'espn:nfl:new', startAt: DAY_START + 60 * 60 * 1000 }),
    ]);
    pruneGamesOlderThan(db.adapter, DAY_START);
    expect(getGameById(db.adapter, 'espn:nfl:old')).toBeNull();
    expect(getGameById(db.adapter, 'espn:nfl:new')).not.toBeNull();
  });
});
