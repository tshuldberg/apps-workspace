import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  createFantasyLeague,
  deleteFantasyLeague,
  deleteFantasyTransaction,
  getFantasyDraftLog,
  getFantasyLeague,
  getFantasyTradeHistory,
  listFantasyLeagues,
  listFantasyTransactions,
  logFantasyTransaction,
  updateFantasyLeague,
  updateFantasyLeagueRecord,
  type CreateFantasyLeagueInput,
} from '../db/crud';
import type { FantasyPlayer } from '../types';

function baseLeague(
  overrides: Partial<CreateFantasyLeagueInput> = {},
): CreateFantasyLeagueInput {
  return {
    platform: 'espn',
    sport: 'football',
    league_name: 'Friday Night Lights',
    season: '2026',
    format: 'redraft',
    team_name: 'Cowboy Dynasty',
    ...overrides,
  };
}

const ROSTER: FantasyPlayer[] = [
  { name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
  { name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
  { name: 'Tyreek Hill', position: 'WR', team: null },
];

describe('sports fantasy CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('runs V1-V5 migrations end-to-end on a fresh DB', () => {
    // beforeEach already ran all 5 migrations. Confirm both V5 tables exist.
    const rows = db.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sp_fantasy_%' ORDER BY name`,
    );
    expect(rows.map((r) => r.name)).toEqual([
      'sp_fantasy_leagues',
      'sp_fantasy_transactions',
    ]);
  });

  it('createFantasyLeague + getFantasyLeague round-trip', () => {
    const created = createFantasyLeague(db.adapter, baseLeague({ roster: ROSTER }));
    expect(created.id).toBeTruthy();
    expect(created.platform).toBe('espn');
    expect(created.roster).toHaveLength(3);
    expect(created.record_wins).toBe(0);
    expect(created.points_for).toBe(0);

    const fetched = getFantasyLeague(db.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.roster).toEqual(ROSTER);
    expect(fetched?.team_name).toBe('Cowboy Dynasty');
  });

  it('listFantasyLeagues filters by platform, sport, season, and combined', () => {
    createFantasyLeague(db.adapter, baseLeague({ platform: 'espn', season: '2026', sport: 'football' }));
    createFantasyLeague(db.adapter, baseLeague({ platform: 'yahoo', season: '2026', sport: 'football' }));
    createFantasyLeague(db.adapter, baseLeague({ platform: 'sleeper', season: '2025-26', sport: 'basketball' }));
    createFantasyLeague(db.adapter, baseLeague({ platform: 'espn', season: '2025-26', sport: 'basketball' }));

    expect(listFantasyLeagues(db.adapter)).toHaveLength(4);
    expect(listFantasyLeagues(db.adapter, { platform: 'espn' })).toHaveLength(2);
    expect(listFantasyLeagues(db.adapter, { sport: 'basketball' })).toHaveLength(2);
    expect(listFantasyLeagues(db.adapter, { season: '2026' })).toHaveLength(2);
    expect(
      listFantasyLeagues(db.adapter, { platform: 'espn', season: '2025-26' }),
    ).toHaveLength(1);
  });

  it('updateFantasyLeague partial -- changing only team_name preserves record + roster', async () => {
    const created = createFantasyLeague(db.adapter, baseLeague({ roster: ROSTER }));
    updateFantasyLeagueRecord(db.adapter, created.id, {
      wins: 3,
      losses: 1,
      ties: 0,
      pointsFor: 420.5,
      pointsAgainst: 300.1,
      standingsPosition: 2,
    });

    // Ensure updated_at strictly advances.
    await new Promise((r) => setTimeout(r, 5));

    const updated = updateFantasyLeague(db.adapter, created.id, {
      team_name: 'Dynasty Warriors',
    });
    expect(updated).not.toBeNull();
    expect(updated?.team_name).toBe('Dynasty Warriors');
    expect(updated?.record_wins).toBe(3);
    expect(updated?.points_for).toBeCloseTo(420.5);
    expect(updated?.standings_position).toBe(2);
    expect(updated?.roster).toEqual(ROSTER);
    expect((updated?.updated_at ?? 0) > created.updated_at).toBe(true);
  });

  it('updateFantasyLeagueRecord writes numerics and bumps updated_at', async () => {
    const created = createFantasyLeague(db.adapter, baseLeague());
    await new Promise((r) => setTimeout(r, 5));

    const updated = updateFantasyLeagueRecord(db.adapter, created.id, {
      wins: 7,
      losses: 2,
      ties: 1,
      pointsFor: 1234.5,
      pointsAgainst: 900.0,
      standingsPosition: 1,
    });
    expect(updated?.record_wins).toBe(7);
    expect(updated?.record_losses).toBe(2);
    expect(updated?.record_ties).toBe(1);
    expect(updated?.points_for).toBeCloseTo(1234.5);
    expect(updated?.points_against).toBeCloseTo(900.0);
    expect(updated?.standings_position).toBe(1);
    expect((updated?.updated_at ?? 0) > created.updated_at).toBe(true);
  });

  it('roster JSON round-trips through Zod on read', () => {
    const roster: FantasyPlayer[] = [
      { name: 'Lamar Jackson', position: 'QB', team: 'BAL' },
      { name: 'Rookie Pickup', position: 'WR' }, // no team field
    ];
    const created = createFantasyLeague(db.adapter, baseLeague({ roster }));
    const fetched = getFantasyLeague(db.adapter, created.id);
    expect(fetched?.roster[0]).toEqual({ name: 'Lamar Jackson', position: 'QB', team: 'BAL' });
    expect(fetched?.roster[1].name).toBe('Rookie Pickup');
    expect(fetched?.roster[1].position).toBe('WR');
  });

  it('deleteFantasyLeague cascades to sp_fantasy_transactions', () => {
    const league = createFantasyLeague(db.adapter, baseLeague());
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'draft',
      description: 'Pick 1',
      happened_at: 1000,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'trade',
      description: 'Traded QB for RB',
      happened_at: 2000,
    });
    expect(listFantasyTransactions(db.adapter, league.id)).toHaveLength(2);

    deleteFantasyLeague(db.adapter, league.id);
    expect(getFantasyLeague(db.adapter, league.id)).toBeNull();
    expect(listFantasyTransactions(db.adapter, league.id)).toHaveLength(0);
  });

  it('logFantasyTransaction + listFantasyTransactions orders by happened_at DESC', () => {
    const league = createFantasyLeague(db.adapter, baseLeague());
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'fa_add',
      description: 'First add',
      happened_at: 100,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'fa_add',
      description: 'Third add',
      happened_at: 300,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'fa_add',
      description: 'Second add',
      happened_at: 200,
    });

    const rows = listFantasyTransactions(db.adapter, league.id);
    expect(rows.map((r) => r.description)).toEqual([
      'Third add',
      'Second add',
      'First add',
    ]);
  });

  it('listFantasyTransactions filters by type', () => {
    const league = createFantasyLeague(db.adapter, baseLeague());
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'draft',
      description: 'Pick 1',
      happened_at: 100,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'trade',
      description: 'Trade 1',
      happened_at: 200,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'waiver_add',
      description: 'Waiver 1',
      happened_at: 300,
    });

    expect(
      listFantasyTransactions(db.adapter, league.id, { type: 'trade' }),
    ).toHaveLength(1);
    expect(
      listFantasyTransactions(db.adapter, league.id, { type: 'draft' }),
    ).toHaveLength(1);
  });

  it('getFantasyDraftLog filters to draft and orders ASC', () => {
    const league = createFantasyLeague(db.adapter, baseLeague());
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'trade',
      description: 'Trade noise',
      happened_at: 50,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'draft',
      description: 'Pick 3',
      happened_at: 300,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'draft',
      description: 'Pick 1',
      happened_at: 100,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'draft',
      description: 'Pick 2',
      happened_at: 200,
    });

    const log = getFantasyDraftLog(db.adapter, league.id);
    expect(log).toHaveLength(3);
    expect(log.map((r) => r.description)).toEqual(['Pick 1', 'Pick 2', 'Pick 3']);
  });

  it('getFantasyTradeHistory filters to trade and orders DESC', () => {
    const league = createFantasyLeague(db.adapter, baseLeague());
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'draft',
      description: 'Noise draft',
      happened_at: 10,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'trade',
      description: 'Early trade',
      players_in: [{ name: 'In Guy', position: 'RB' }],
      players_out: [{ name: 'Out Guy', position: 'WR' }],
      reasoning_md: 'needed RB depth',
      happened_at: 100,
    });
    logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'trade',
      description: 'Late trade',
      happened_at: 500,
    });

    const trades = getFantasyTradeHistory(db.adapter, league.id);
    expect(trades).toHaveLength(2);
    expect(trades[0].description).toBe('Late trade');
    expect(trades[1].description).toBe('Early trade');
    expect(trades[1].players_in).toEqual([{ name: 'In Guy', position: 'RB' }]);
    expect(trades[1].reasoning_md).toBe('needed RB depth');
  });

  it('CHECK constraints reject invalid platform, format, and transaction type', () => {
    expect(() =>
      createFantasyLeague(db.adapter, baseLeague({ platform: 'bogus' as never })),
    ).toThrow();
    expect(() =>
      createFantasyLeague(db.adapter, baseLeague({ format: 'auction' as never })),
    ).toThrow();

    const league = createFantasyLeague(db.adapter, baseLeague());
    expect(() =>
      logFantasyTransaction(db.adapter, {
        league_id: league.id,
        type: 'commissioner_veto' as never,
        description: 'nope',
      }),
    ).toThrow();
  });

  it('deleteFantasyTransaction removes a single transaction without touching siblings', () => {
    const league = createFantasyLeague(db.adapter, baseLeague());
    const a = logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'fa_add',
      description: 'Keep me',
      happened_at: 100,
    });
    const b = logFantasyTransaction(db.adapter, {
      league_id: league.id,
      type: 'fa_add',
      description: 'Delete me',
      happened_at: 200,
    });

    deleteFantasyTransaction(db.adapter, b.id);
    const remaining = listFantasyTransactions(db.adapter, league.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(a.id);
  });
});
