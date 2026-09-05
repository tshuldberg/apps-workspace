import { describe, expect, it } from 'vitest';
import {
  LAUNCH_LEAGUES,
  buildTeamIndexUrl,
  getLeagueById,
} from '../engine/leagues';

describe('LAUNCH_LEAGUES', () => {
  it('covers only the five P1-A launch leagues', () => {
    expect(LAUNCH_LEAGUES.map((l) => l.id)).toEqual([
      'nfl',
      'nba',
      'mlb',
      'nhl',
      'mls',
    ]);
  });

  it('each entry has the ESPN slugs required to build endpoint urls', () => {
    for (const league of LAUNCH_LEAGUES) {
      expect(league.espnSport).toMatch(/^[a-z]+$/);
      expect(league.espnLeague.length).toBeGreaterThan(0);
      expect(league.label).toBe(league.id.toUpperCase());
    }
  });

  it('getLeagueById returns metadata or undefined', () => {
    expect(getLeagueById('nfl')?.sport).toBe('football');
    // @ts-expect-error -- intentional: invalid ids return undefined at runtime
    expect(getLeagueById('premier')).toBeUndefined();
  });

  it('buildTeamIndexUrl targets site.api.espn.com', () => {
    const nba = getLeagueById('nba');
    expect(nba).toBeDefined();
    if (!nba) return;
    expect(buildTeamIndexUrl(nba)).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    );
  });

  it('maps MLS onto the ESPN usa.1 slug', () => {
    const mls = getLeagueById('mls');
    expect(mls?.espnLeague).toBe('usa.1');
  });
});
