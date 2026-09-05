import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  addScheduleEntry,
  createRecLeague,
  deleteRecLeague,
  getRecLeague,
  getUpcomingGames,
  listRecLeagues,
  updateRecLeague,
  updateRecLeagueRecord,
  type CreateRecLeagueInput,
} from '../db/crud';

function baseLeague(
  overrides: Partial<CreateRecLeagueInput> = {},
): CreateRecLeagueInput {
  return {
    sport: 'softball',
    league_name: 'Tuesday Night Swings',
    team_name: 'The Dingers',
    season: '2026 Spring',
    ...overrides,
  };
}

describe('sports rec-leagues CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('createRecLeague + getRecLeague round-trip with roster + defaults', () => {
    const created = createRecLeague(
      db.adapter,
      baseLeague({ roster: ['Alice', 'Bob', 'Carl'] }),
    );
    expect(created.id).toBeTruthy();
    expect(created.record_wins).toBe(0);
    expect(created.record_losses).toBe(0);
    expect(created.schedule).toEqual([]);

    const fetched = getRecLeague(db.adapter, created.id);
    expect(fetched?.roster).toEqual(['Alice', 'Bob', 'Carl']);
    expect(fetched?.team_name).toBe('The Dingers');
  });

  it('listRecLeagues filters by sport and season', () => {
    createRecLeague(
      db.adapter,
      baseLeague({ sport: 'softball', season: '2026 Spring' }),
    );
    createRecLeague(
      db.adapter,
      baseLeague({ sport: 'softball', season: '2026 Fall' }),
    );
    createRecLeague(
      db.adapter,
      baseLeague({ sport: 'volleyball', season: '2026 Spring' }),
    );

    expect(listRecLeagues(db.adapter)).toHaveLength(3);
    expect(listRecLeagues(db.adapter, { sport: 'softball' })).toHaveLength(2);
    expect(listRecLeagues(db.adapter, { season: '2026 Spring' })).toHaveLength(
      2,
    );
    expect(
      listRecLeagues(db.adapter, {
        sport: 'volleyball',
        season: '2026 Spring',
      }),
    ).toHaveLength(1);
  });

  it('updateRecLeague partial preserves untouched fields and bumps updated_at', async () => {
    const created = createRecLeague(
      db.adapter,
      baseLeague({ roster: ['Alice'] }),
    );
    await new Promise((r) => setTimeout(r, 5));

    const updated = updateRecLeague(db.adapter, created.id, {
      team_name: 'The Sluggers',
    });
    expect(updated?.team_name).toBe('The Sluggers');
    expect(updated?.roster).toEqual(['Alice']);
    expect((updated?.updated_at ?? 0) > created.updated_at).toBe(true);
  });

  it('updateRecLeagueRecord writes wins/losses/ties and bumps updated_at', async () => {
    const created = createRecLeague(db.adapter, baseLeague());
    await new Promise((r) => setTimeout(r, 5));

    const updated = updateRecLeagueRecord(db.adapter, created.id, {
      wins: 5,
      losses: 2,
      ties: 1,
    });
    expect(updated?.record_wins).toBe(5);
    expect(updated?.record_losses).toBe(2);
    expect(updated?.record_ties).toBe(1);
    expect((updated?.updated_at ?? 0) > created.updated_at).toBe(true);
  });

  it('addScheduleEntry appends + getUpcomingGames filters and sorts ASC', () => {
    const created = createRecLeague(db.adapter, baseLeague());
    const NOW = 1_700_000_000_000;
    addScheduleEntry(db.adapter, created.id, {
      opponent: 'Past Team',
      starts_at: NOW - 1_000_000,
      result: 'won',
    });
    addScheduleEntry(db.adapter, created.id, {
      opponent: 'Later Team',
      starts_at: NOW + 2_000_000,
    });
    addScheduleEntry(db.adapter, created.id, {
      opponent: 'Sooner Team',
      starts_at: NOW + 1_000_000,
      location: 'Field 2',
    });

    const fetched = getRecLeague(db.adapter, created.id);
    expect(fetched?.schedule).toHaveLength(3);

    const upcoming = getUpcomingGames(db.adapter, created.id, NOW);
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].opponent).toBe('Sooner Team');
    expect(upcoming[0].location).toBe('Field 2');
    expect(upcoming[1].opponent).toBe('Later Team');
  });

  it('schedule JSON round-trips through Zod on read with result enum', () => {
    const created = createRecLeague(
      db.adapter,
      baseLeague({
        schedule: [
          { opponent: 'Rivals', starts_at: 100, result: 'won' },
          { opponent: 'Newbies', starts_at: 200, result: 'tied' },
        ],
      }),
    );
    const fetched = getRecLeague(db.adapter, created.id);
    expect(fetched?.schedule).toEqual([
      { opponent: 'Rivals', starts_at: 100, result: 'won' },
      { opponent: 'Newbies', starts_at: 200, result: 'tied' },
    ]);
  });

  it('deleteRecLeague removes row and returns true; missing id returns false', () => {
    const created = createRecLeague(db.adapter, baseLeague());
    expect(deleteRecLeague(db.adapter, created.id)).toBe(true);
    expect(getRecLeague(db.adapter, created.id)).toBeNull();
    expect(deleteRecLeague(db.adapter, 'missing_id')).toBe(false);
  });

  it('getUpcomingGames returns [] for missing league', () => {
    expect(getUpcomingGames(db.adapter, 'nonexistent_id', 0)).toEqual([]);
  });
});
