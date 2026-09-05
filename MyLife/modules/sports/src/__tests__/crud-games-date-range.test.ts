import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import { listByDateRange, upsertGames } from '../db/crud/games';
import type { Game, GameStatus } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_START = Date.parse('2026-04-21T00:00:00.000Z');

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'espn:nfl:1',
    league: 'nfl',
    sport: 'football',
    home: {
      id: 'home',
      name: 'Home',
      abbreviation: null,
      score: null,
    },
    away: {
      id: 'away',
      name: 'Away',
      abbreviation: null,
      score: null,
    },
    status: 'final',
    period: null,
    clock: null,
    startAt: DAY_START,
    venue: null,
    broadcast: null,
    updatedAt: DAY_START,
    ...overrides,
  };
}

describe('listByDateRange', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('returns [] when teamIds is empty', () => {
    upsertGames(db.adapter, [
      game({
        id: 'espn:nfl:1',
        home: { id: 'A', name: 'A', abbreviation: null, score: null },
        away: { id: 'B', name: 'B', abbreviation: null, score: null },
      }),
    ]);
    const rows = listByDateRange(db.adapter, [], {
      since: DAY_START - DAY_MS,
      until: DAY_START + DAY_MS,
    });
    expect(rows).toEqual([]);
  });

  it('filters by [since, until] inclusively on both bounds', () => {
    upsertGames(db.adapter, [
      game({ id: 'espn:nfl:before', startAt: DAY_START - DAY_MS - 1 }),
      game({ id: 'espn:nfl:exact-start', startAt: DAY_START }),
      game({ id: 'espn:nfl:middle', startAt: DAY_START + DAY_MS }),
      game({ id: 'espn:nfl:exact-end', startAt: DAY_START + 2 * DAY_MS }),
      game({ id: 'espn:nfl:after', startAt: DAY_START + 2 * DAY_MS + 1 }),
    ]);
    const rows = listByDateRange(db.adapter, ['home'], {
      since: DAY_START,
      until: DAY_START + 2 * DAY_MS,
    });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('espn:nfl:exact-start');
    expect(ids).toContain('espn:nfl:middle');
    expect(ids).toContain('espn:nfl:exact-end');
    expect(ids).not.toContain('espn:nfl:before');
    expect(ids).not.toContain('espn:nfl:after');
  });

  it('defaults status filter to final only (skips scheduled/live)', () => {
    upsertGames(db.adapter, [
      game({ id: 'espn:nfl:final', status: 'final' }),
      game({ id: 'espn:nfl:live', status: 'live', startAt: DAY_START + 60_000 }),
      game({
        id: 'espn:nfl:scheduled',
        status: 'scheduled',
        startAt: DAY_START + 120_000,
      }),
    ]);
    const rows = listByDateRange(db.adapter, ['home'], {
      since: DAY_START,
      until: DAY_START + DAY_MS,
    });
    expect(rows.map((r) => r.id)).toEqual(['espn:nfl:final']);
  });

  it('accepts a custom statuses list', () => {
    upsertGames(db.adapter, [
      game({ id: 'espn:nfl:final', status: 'final' }),
      game({ id: 'espn:nfl:live', status: 'live', startAt: DAY_START + 60_000 }),
    ]);
    const statuses: GameStatus[] = ['final', 'live'];
    const rows = listByDateRange(db.adapter, ['home'], {
      since: DAY_START,
      until: DAY_START + DAY_MS,
      statuses,
    });
    expect(rows.map((r) => r.id).sort()).toEqual([
      'espn:nfl:final',
      'espn:nfl:live',
    ]);
  });

  it('empty statuses list short-circuits to []', () => {
    upsertGames(db.adapter, [game({ id: 'espn:nfl:final', status: 'final' })]);
    const rows = listByDateRange(db.adapter, ['home'], {
      since: DAY_START - DAY_MS,
      until: DAY_START + DAY_MS,
      statuses: [],
    });
    expect(rows).toEqual([]);
  });

  it('orders rows by start_at DESC (newest first)', () => {
    upsertGames(db.adapter, [
      game({ id: 'espn:nfl:older', startAt: DAY_START }),
      game({ id: 'espn:nfl:middle', startAt: DAY_START + 2 * DAY_MS }),
      game({ id: 'espn:nfl:newest', startAt: DAY_START + 5 * DAY_MS }),
    ]);
    const rows = listByDateRange(db.adapter, ['home'], {
      since: DAY_START,
      until: DAY_START + 10 * DAY_MS,
    });
    expect(rows.map((r) => r.id)).toEqual([
      'espn:nfl:newest',
      'espn:nfl:middle',
      'espn:nfl:older',
    ]);
  });

  it('multi-team IN() binding picks up games where any team matches home or away', () => {
    upsertGames(db.adapter, [
      game({
        id: 'espn:nfl:alpha',
        home: { id: 'A', name: 'A', abbreviation: null, score: null },
        away: { id: 'B', name: 'B', abbreviation: null, score: null },
      }),
      game({
        id: 'espn:nfl:beta',
        home: { id: 'X', name: 'X', abbreviation: null, score: null },
        away: { id: 'C', name: 'C', abbreviation: null, score: null },
        startAt: DAY_START + 60_000,
      }),
      game({
        id: 'espn:nfl:gamma',
        home: { id: 'Y', name: 'Y', abbreviation: null, score: null },
        away: { id: 'Z', name: 'Z', abbreviation: null, score: null },
        startAt: DAY_START + 120_000,
      }),
    ]);
    const rows = listByDateRange(db.adapter, ['A', 'C'], {
      since: DAY_START,
      until: DAY_START + DAY_MS,
    });
    expect(rows.map((r) => r.id).sort()).toEqual([
      'espn:nfl:alpha',
      'espn:nfl:beta',
    ]);
  });

  it('respects a custom limit', () => {
    const rows: Game[] = [];
    for (let i = 0; i < 5; i++) {
      rows.push(
        game({ id: `espn:nfl:${i}`, startAt: DAY_START + i * 60_000 }),
      );
    }
    upsertGames(db.adapter, rows);
    const limited = listByDateRange(db.adapter, ['home'], {
      since: DAY_START,
      until: DAY_START + DAY_MS,
      limit: 2,
    });
    expect(limited.length).toBe(2);
  });
});
