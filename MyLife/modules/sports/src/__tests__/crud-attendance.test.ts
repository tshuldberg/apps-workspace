import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  deleteAttendance,
  getAttendance,
  getAttendanceStats,
  listAttendance,
  logAttendance,
  updateAttendance,
  type LogAttendanceInput,
} from '../db/crud';

function baseAttendance(
  overrides: Partial<LogAttendanceInput> = {},
): LogAttendanceInput {
  return {
    venue_name: 'AT&T Stadium',
    attended_at: Date.UTC(2026, 5, 1),
    ...overrides,
  };
}

describe('sports attendance CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('runs V1-V7 migrations and exposes sp_attendance', () => {
    const rows = db.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='sp_attendance'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('logAttendance + getAttendance round-trip parses JSON columns', () => {
    const created = logAttendance(
      db.adapter,
      baseAttendance({
        companions: ['Alice', 'Bob'],
        section: '120',
        row_label: 'C',
        seat: '12',
        cost_cents: 15_000,
        rating: 5,
        photo_ids: ['photo_1', 'photo_2'],
        tailgate_notes_md: 'Great brisket',
      }),
    );
    expect(created.id.startsWith('atn_')).toBe(true);

    const fetched = getAttendance(db.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.companions).toEqual(['Alice', 'Bob']);
    expect(fetched?.section).toBe('120');
    expect(fetched?.row_label).toBe('C');
    expect(fetched?.cost_cents).toBe(15_000);
    expect(fetched?.rating).toBe(5);
    expect(fetched?.photo_ids).toEqual(['photo_1', 'photo_2']);
    expect(fetched?.tailgate_notes_md).toBe('Great brisket');
  });

  it('rating CHECK constraint rejects out-of-range values', () => {
    expect(() =>
      logAttendance(db.adapter, baseAttendance({ rating: 0 as never })),
    ).toThrow();
    expect(() =>
      logAttendance(db.adapter, baseAttendance({ rating: 6 as never })),
    ).toThrow();
    const ok = logAttendance(db.adapter, baseAttendance({ rating: 3 }));
    expect(ok.rating).toBe(3);
  });

  it('JSON columns default to empty arrays when not provided', () => {
    const created = logAttendance(db.adapter, baseAttendance());
    const fetched = getAttendance(db.adapter, created.id);
    expect(fetched?.companions).toEqual([]);
    expect(fetched?.photo_ids).toEqual([]);
    expect(fetched?.cost_cents).toBe(0);
    expect(fetched?.rating).toBeNull();
  });

  it('listAttendance filters by sinceMs and venueId', () => {
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_name: 'A',
        venue_id: 'vn_A',
        attended_at: 100,
      }),
    );
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_name: 'B',
        venue_id: 'vn_B',
        attended_at: 200,
      }),
    );
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_name: 'C',
        venue_id: 'vn_B',
        attended_at: 300,
      }),
    );

    expect(listAttendance(db.adapter)).toHaveLength(3);
    expect(listAttendance(db.adapter, { sinceMs: 200 })).toHaveLength(2);
    expect(
      listAttendance(db.adapter, { venueId: 'vn_B' }),
    ).toHaveLength(2);
    expect(listAttendance(db.adapter, { limit: 1 })).toHaveLength(1);
  });

  it('listAttendance with teamId joins sp_games and filters', () => {
    // Seed a game in sp_games with Cowboys on the home side.
    db.adapter.execute(
      `INSERT INTO sp_games (
        id, league, sport, home_team_id, home_team_name,
        away_team_id, away_team_name,
        start_at, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'game_1',
        'nfl',
        'football',
        'espn:nfl:6',
        'Cowboys',
        'espn:nfl:21',
        'Eagles',
        1_700_000_000_000,
        'final',
        1,
      ],
    );
    // One attendance linked to the game, one without a game_id.
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_name: 'AT&T',
        game_id: 'game_1',
        attended_at: 1_700_000_000_000,
      }),
    );
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_name: 'Bar',
        attended_at: 1_700_000_000_001,
      }),
    );

    const forCowboys = listAttendance(db.adapter, { teamId: 'espn:nfl:6' });
    expect(forCowboys).toHaveLength(1);
    expect(forCowboys[0].venue_name).toBe('AT&T');

    const forEagles = listAttendance(db.adapter, { teamId: 'espn:nfl:21' });
    expect(forEagles).toHaveLength(1);

    const forRandom = listAttendance(db.adapter, { teamId: 'espn:nfl:99' });
    expect(forRandom).toHaveLength(0);
  });

  it('listAttendance orders by attended_at DESC', () => {
    logAttendance(db.adapter, baseAttendance({ attended_at: 100 }));
    logAttendance(db.adapter, baseAttendance({ attended_at: 300 }));
    logAttendance(db.adapter, baseAttendance({ attended_at: 200 }));
    const rows = listAttendance(db.adapter);
    expect(rows.map((r) => r.attended_at)).toEqual([300, 200, 100]);
  });

  it('updateAttendance partial bumps updated_at and preserves created_at', async () => {
    const created = logAttendance(db.adapter, baseAttendance({ rating: 3 }));
    await new Promise((r) => setTimeout(r, 2));

    const updated = updateAttendance(db.adapter, created.id, {
      rating: 5,
      notes_md: 'upgraded seats',
    });
    expect(updated).not.toBeNull();
    expect(updated?.rating).toBe(5);
    expect(updated?.notes_md).toBe('upgraded seats');
    expect(updated?.created_at).toBe(created.created_at);
    expect(updated!.updated_at).toBeGreaterThan(created.updated_at);
  });

  it('deleteAttendance returns true, then false on missing', () => {
    const created = logAttendance(db.adapter, baseAttendance());
    expect(deleteAttendance(db.adapter, created.id)).toBe(true);
    expect(getAttendance(db.adapter, created.id)).toBeNull();
    expect(deleteAttendance(db.adapter, 'atn_missing')).toBe(false);
  });

  it('getAttendanceStats aggregates games, cost, avg rating, unique venues', () => {
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_id: 'vn_A',
        venue_name: 'A',
        cost_cents: 10_000,
        rating: 4,
        attended_at: Date.UTC(2026, 0, 15),
      }),
    );
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_id: 'vn_A',
        venue_name: 'A',
        cost_cents: 5_000,
        rating: 2,
        attended_at: Date.UTC(2026, 5, 10),
      }),
    );
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_name: 'Random Bar',
        cost_cents: 2_000,
        rating: null,
        attended_at: Date.UTC(2026, 11, 31),
      }),
    );
    // Prior-year row that should be excluded when filtering by 2026.
    logAttendance(
      db.adapter,
      baseAttendance({
        venue_id: 'vn_B',
        venue_name: 'B',
        cost_cents: 99_999,
        rating: 1,
        attended_at: Date.UTC(2024, 6, 1),
      }),
    );

    const all = getAttendanceStats(db.adapter);
    expect(all.gamesAttended).toBe(4);
    expect(all.totalSpentCents).toBe(10_000 + 5_000 + 2_000 + 99_999);

    const in2026 = getAttendanceStats(db.adapter, { year: 2026 });
    expect(in2026.gamesAttended).toBe(3);
    expect(in2026.totalSpentCents).toBe(17_000);
    // avg of 4 and 2 (third row has null rating, excluded)
    expect(in2026.avgRating).toBe(3);
    // Unique venues: vn_A and denormalized "Random Bar" -> 2.
    expect(in2026.uniqueVenues).toBe(2);

    const in2099 = getAttendanceStats(db.adapter, { year: 2099 });
    expect(in2099.gamesAttended).toBe(0);
    expect(in2099.avgRating).toBeNull();
    expect(in2099.uniqueVenues).toBe(0);
  });
});
