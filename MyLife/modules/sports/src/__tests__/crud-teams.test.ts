import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  countFollowedTeams,
  followTeam,
  getTeamById,
  listFollowedTeams,
  setTeamRival,
  unfollowTeam,
  updateTeam,
  updateTeamNotifications,
  updateTeamTier,
} from '../db/crud/teams';
import type { CreateTeamInput } from '../types';

function sampleTeam(overrides: Partial<CreateTeamInput> = {}): CreateTeamInput {
  return {
    id: 'espn:nfl:12',
    name: 'Dallas Cowboys',
    league: 'nfl',
    sport: 'football',
    conference: 'NFC',
    division: 'NFC East',
    logo_url: 'https://example.test/logo.png',
    primary_color: '#041E42',
    secondary_color: '#869397',
    ...overrides,
  };
}

describe('sports teams CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('followTeam inserts a row with defaults and returns it', () => {
    const team = followTeam(db.adapter, sampleTeam());
    expect(team.id).toBe('espn:nfl:12');
    expect(team.follow_tier).toBe('casual');
    expect(team.notify_start).toBe(1);
    expect(team.notify_close).toBe(0);
    expect(team.is_rival).toBe(0);
    expect(countFollowedTeams(db.adapter)).toBe(1);
  });

  it('followTeam is idempotent on repeat calls', () => {
    followTeam(db.adapter, sampleTeam({ follow_tier: 'diehard' }));
    followTeam(db.adapter, sampleTeam({ follow_tier: 'occasional' }));
    expect(countFollowedTeams(db.adapter)).toBe(1);
    const team = getTeamById(db.adapter, 'espn:nfl:12');
    // INSERT OR IGNORE -- the first tier wins; callers must use updateTeamTier.
    expect(team?.follow_tier).toBe('diehard');
  });

  it('unfollowTeam removes the row', () => {
    followTeam(db.adapter, sampleTeam());
    unfollowTeam(db.adapter, 'espn:nfl:12');
    expect(getTeamById(db.adapter, 'espn:nfl:12')).toBeNull();
    expect(countFollowedTeams(db.adapter)).toBe(0);
  });

  it('updateTeamTier changes tier and bumps updated_at', () => {
    const created = followTeam(db.adapter, sampleTeam());
    // Force a detectable clock advance for updated_at.
    const before = created.updated_at;
    // Busy-wait one ms boundary at most -- tests must stay fast.
    const target = before + 1;
    while (Date.now() <= target) { /* noop */ }
    updateTeamTier(db.adapter, created.id, 'diehard');
    const after = getTeamById(db.adapter, created.id);
    expect(after?.follow_tier).toBe('diehard');
    expect((after?.updated_at ?? 0)).toBeGreaterThan(before);
  });

  it('setTeamRival flips the rival flag', () => {
    followTeam(db.adapter, sampleTeam());
    setTeamRival(db.adapter, 'espn:nfl:12', true);
    expect(getTeamById(db.adapter, 'espn:nfl:12')?.is_rival).toBe(1);
    setTeamRival(db.adapter, 'espn:nfl:12', false);
    expect(getTeamById(db.adapter, 'espn:nfl:12')?.is_rival).toBe(0);
  });

  it('updateTeamNotifications merges partial updates', () => {
    followTeam(db.adapter, sampleTeam());
    updateTeamNotifications(db.adapter, 'espn:nfl:12', {
      notify_close: 1,
      notify_trades: 1,
    });
    const row = getTeamById(db.adapter, 'espn:nfl:12');
    expect(row?.notify_close).toBe(1);
    expect(row?.notify_trades).toBe(1);
    // Untouched fields stay at their defaults.
    expect(row?.notify_start).toBe(1);
    expect(row?.notify_end).toBe(1);
  });

  it('updateTeam applies partial profile updates', () => {
    followTeam(db.adapter, sampleTeam());
    updateTeam(db.adapter, 'espn:nfl:12', {
      notes_md: 'Lifelong fan',
      is_rival: 1,
    });
    const row = getTeamById(db.adapter, 'espn:nfl:12');
    expect(row?.notes_md).toBe('Lifelong fan');
    expect(row?.is_rival).toBe(1);
    expect(row?.follow_tier).toBe('casual');
  });

  it('listFollowedTeams orders by tier (diehard, casual, occasional) then name', () => {
    followTeam(
      db.adapter,
      sampleTeam({ id: 'espn:nba:1', name: 'Bulls', league: 'nba', sport: 'basketball' }),
    );
    followTeam(
      db.adapter,
      sampleTeam({ id: 'espn:nfl:1', name: 'Aardvarks', follow_tier: 'occasional' }),
    );
    followTeam(
      db.adapter,
      sampleTeam({ id: 'espn:mlb:1', name: 'Giants', league: 'mlb', sport: 'baseball', follow_tier: 'diehard' }),
    );
    followTeam(
      db.adapter,
      sampleTeam({ id: 'espn:nfl:2', name: 'Bears', follow_tier: 'diehard' }),
    );

    const ordered = listFollowedTeams(db.adapter).map((t) => t.id);
    // diehard (Bears, Giants -- alphabetical), casual (Bulls), occasional (Aardvarks)
    expect(ordered).toEqual([
      'espn:nfl:2',
      'espn:mlb:1',
      'espn:nba:1',
      'espn:nfl:1',
    ]);
  });

  it('listFollowedTeams filters by league', () => {
    followTeam(db.adapter, sampleTeam({ id: 'espn:nfl:1' }));
    followTeam(
      db.adapter,
      sampleTeam({ id: 'espn:nba:1', league: 'nba', sport: 'basketball' }),
    );
    const nfl = listFollowedTeams(db.adapter, { league: 'nfl' });
    expect(nfl).toHaveLength(1);
    expect(nfl[0].league).toBe('nfl');
  });
});
