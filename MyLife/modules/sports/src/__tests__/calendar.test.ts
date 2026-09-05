import { describe, expect, it } from 'vitest';

import {
  LEAGUE_EVENT_PRESETS,
  STAT_REFERENCE_BASES,
  buildStatReferenceUrl,
  getLeagueCalendar,
  getUpcomingLeagueEvents,
  groupFavoritesByLeague,
  materializeLeagueEvents,
} from '../engine/calendar';
import type { LeagueEventPreset, PlayerFavorite } from '../engine/calendar';

const MS_PER_DAY = 86_400_000;

describe('LEAGUE_EVENT_PRESETS', () => {
  it('has at least the advertised preset count per league', () => {
    expect(LEAGUE_EVENT_PRESETS.nfl.length).toBeGreaterThanOrEqual(6);
    expect(LEAGUE_EVENT_PRESETS.nba.length).toBeGreaterThanOrEqual(6);
    expect(LEAGUE_EVENT_PRESETS.mlb.length).toBeGreaterThanOrEqual(4);
    expect(LEAGUE_EVENT_PRESETS.nhl.length).toBeGreaterThanOrEqual(4);
    expect(LEAGUE_EVENT_PRESETS.mls.length).toBeGreaterThanOrEqual(2);
  });

  it('uses 1-indexed months within valid range', () => {
    for (const leagueId of Object.keys(LEAGUE_EVENT_PRESETS) as (keyof typeof LEAGUE_EVENT_PRESETS)[]) {
      for (const preset of LEAGUE_EVENT_PRESETS[leagueId]) {
        expect(preset.monthUtc).toBeGreaterThanOrEqual(1);
        expect(preset.monthUtc).toBeLessThanOrEqual(12);
        expect(preset.dayUtc).toBeGreaterThanOrEqual(1);
        expect(preset.dayUtc).toBeLessThanOrEqual(31);
      }
    }
  });
});

describe('materializeLeagueEvents', () => {
  it('converts 1-indexed month to 0-indexed UTC epoch', () => {
    const preset: LeagueEventPreset = {
      eventType: 'draft',
      label: 'Test event',
      monthUtc: 3,
      dayUtc: 15,
    };
    const event = materializeLeagueEvents('nba', preset, 2026);
    // March is month index 2 in Date.UTC.
    expect(event.startMs).toBe(Date.UTC(2026, 2, 15));
    expect(event.endMs).toBeUndefined();
    expect(event.leagueId).toBe('nba');
    expect(event.eventType).toBe('draft');
    expect(event.label).toBe('Test event');
  });

  it('computes endMs exactly durationDays * 86_400_000 after startMs', () => {
    const preset: LeagueEventPreset = {
      eventType: 'draft',
      label: 'NFL Draft',
      monthUtc: 4,
      dayUtc: 24,
      durationDays: 30,
    };
    const event = materializeLeagueEvents('nfl', preset, 2026);
    expect(event.startMs).toBe(Date.UTC(2026, 3, 24));
    expect(event.endMs).toBe(event.startMs + 30 * MS_PER_DAY);
  });

  it('preserves notes when present', () => {
    const preset: LeagueEventPreset = {
      eventType: 'championship',
      label: 'Super Bowl',
      monthUtc: 2,
      dayUtc: 9,
      notes: 'Location rotates annually',
    };
    const event = materializeLeagueEvents('nfl', preset, 2027);
    expect(event.notes).toBe('Location rotates annually');
  });
});

describe('getLeagueCalendar', () => {
  it('returns the full union of preset events sorted ascending', () => {
    const events = getLeagueCalendar(['nfl', 'nba'], 2026);
    const expectedCount =
      LEAGUE_EVENT_PRESETS.nfl.length + LEAGUE_EVENT_PRESETS.nba.length;
    expect(events.length).toBe(expectedCount);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].startMs).toBeGreaterThanOrEqual(events[i - 1].startMs);
    }
    // No duplicates on (leagueId, eventType, startMs).
    const keys = events.map((e) => `${e.leagueId}:${e.eventType}:${e.startMs}`);
    expect(new Set(keys).size).toBe(events.length);
  });

  it('returns empty array for empty leagueIds input', () => {
    expect(getLeagueCalendar([], 2026)).toEqual([]);
  });

  it('tags each event with the requested leagueId', () => {
    const events = getLeagueCalendar(['mlb'], 2026);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(e.leagueId).toBe('mlb');
  });
});

describe('getUpcomingLeagueEvents', () => {
  it('includes an event at exactly nowMs (lower bound inclusive)', () => {
    const events = getLeagueCalendar(['nfl'], 2026);
    const target = events[0];
    const upcoming = getUpcomingLeagueEvents(['nfl'], target.startMs, 365);
    expect(upcoming.some((e) => e.startMs === target.startMs && e.eventType === target.eventType)).toBe(true);
  });

  it('excludes an event at exactly nowMs + withinDays * 86_400_000 (upper bound exclusive)', () => {
    const events = getLeagueCalendar(['nfl'], 2026);
    const target = events[events.length - 1];
    const withinDays = 14;
    const nowMs = target.startMs - withinDays * MS_PER_DAY;
    // target.startMs == nowMs + withinDays * MS_PER_DAY -> must be excluded.
    const upcoming = getUpcomingLeagueEvents(['nfl'], nowMs, withinDays);
    expect(upcoming.some((e) => e.startMs === target.startMs && e.eventType === target.eventType)).toBe(false);
  });

  it('returns events sorted ascending and spans year boundaries', () => {
    // Late-December nowMs should surface next-year events.
    const nowMs = Date.UTC(2026, 11, 20);
    const upcoming = getUpcomingLeagueEvents(['nfl', 'nba'], nowMs, 120);
    expect(upcoming.length).toBeGreaterThan(0);
    for (let i = 1; i < upcoming.length; i++) {
      expect(upcoming[i].startMs).toBeGreaterThanOrEqual(upcoming[i - 1].startMs);
    }
    // At least one event should fall in the following calendar year.
    expect(upcoming.some((e) => new Date(e.startMs).getUTCFullYear() === 2027)).toBe(true);
  });
});

describe('STAT_REFERENCE_BASES', () => {
  it('has a base URL for every live LeagueId', () => {
    expect(STAT_REFERENCE_BASES.nfl).toContain('pro-football-reference');
    expect(STAT_REFERENCE_BASES.nba).toContain('basketball-reference');
    expect(STAT_REFERENCE_BASES.mlb).toContain('baseball-reference');
    expect(STAT_REFERENCE_BASES.nhl).toContain('hockey-reference');
    expect(STAT_REFERENCE_BASES.mls).toContain('fbref');
  });
});

describe('buildStatReferenceUrl', () => {
  it('returns a basketball-reference search URL for an nba favorite', () => {
    const fav: PlayerFavorite = {
      id: 'jayson-tatum',
      displayName: 'Jayson Tatum',
      leagueId: 'nba',
    };
    const url = buildStatReferenceUrl(fav);
    expect(url).toBe('https://www.basketball-reference.com/search/search.fcgi?search=Jayson%20Tatum');
  });

  it('URL-encodes whitespace and reserved characters in the display name', () => {
    const fav: PlayerFavorite = {
      id: 'special',
      displayName: 'A&B C',
      leagueId: 'nfl',
    };
    const url = buildStatReferenceUrl(fav);
    expect(url).toContain('A%26B%20C');
  });

  it('returns null only when the league has a null base (none currently)', () => {
    // Defensive guard: if STAT_REFERENCE_BASES is ever extended to include
    // a nullable league, buildStatReferenceUrl must short-circuit.
    const fav: PlayerFavorite = {
      id: 'ghost',
      displayName: 'Ghost Player',
      leagueId: 'mls',
    };
    const url = buildStatReferenceUrl(fav);
    // mls has a base today, so url should be non-null.
    expect(url).not.toBeNull();
    expect(url).toContain('fbref');
  });
});

describe('groupFavoritesByLeague', () => {
  it('buckets each favorite under its leagueId key', () => {
    const favs: PlayerFavorite[] = [
      { id: 'a', displayName: 'A', leagueId: 'nba' },
      { id: 'b', displayName: 'B', leagueId: 'nfl' },
      { id: 'c', displayName: 'C', leagueId: 'nba' },
    ];
    const grouped = groupFavoritesByLeague(favs);
    expect(grouped.nba).toHaveLength(2);
    expect(grouped.nfl).toHaveLength(1);
    expect(grouped.mlb).toEqual([]);
    expect(grouped.nhl).toEqual([]);
    expect(grouped.mls).toEqual([]);
  });

  it('returns all league keys with empty arrays when no favorites are given', () => {
    const grouped = groupFavoritesByLeague([]);
    expect(grouped).toEqual({ nfl: [], nba: [], mlb: [], nhl: [], mls: [] });
  });
});
