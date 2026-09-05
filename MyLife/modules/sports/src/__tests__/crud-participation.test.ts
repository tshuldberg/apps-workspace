import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  deleteSession,
  getPersonalBests,
  getSession,
  listSessions,
  logSession,
  updateSession,
  type LogSessionInput,
} from '../db/crud';

function baseSession(
  overrides: Partial<LogSessionInput> = {},
): LogSessionInput {
  return {
    sport: 'basketball',
    activity: 'pickup',
    started_at: 1_700_000_000_000,
    ...overrides,
  };
}

describe('sports participation CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('runs V1-V6 migrations end-to-end on a fresh DB', () => {
    const rows = db.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sp_participation_sessions','sp_rec_leagues') ORDER BY name`,
    );
    expect(rows.map((r) => r.name)).toEqual([
      'sp_participation_sessions',
      'sp_rec_leagues',
    ]);
  });

  it('logSession + getSession round-trip parses JSON columns through Zod', () => {
    const created = logSession(
      db.adapter,
      baseSession({
        teammates: ['Alice', 'Bob'],
        stats: { points: 18, rebounds: 7 },
        photo_ids: ['photo_1', 'photo_2'],
        duration_minutes: 45,
        location: 'Rec Center Court 3',
        notes_md: 'Strong night',
      }),
    );
    expect(created.id).toBeTruthy();
    expect(created.personal_best).toBe(false);

    const fetched = getSession(db.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.teammates).toEqual(['Alice', 'Bob']);
    expect(fetched?.stats).toEqual({ points: 18, rebounds: 7 });
    expect(fetched?.photo_ids).toEqual(['photo_1', 'photo_2']);
    expect(fetched?.duration_minutes).toBe(45);
    expect(fetched?.location).toBe('Rec Center Court 3');
    expect(fetched?.notes_md).toBe('Strong night');
  });

  it('mood CHECK constraint rejects values outside 1..5', () => {
    expect(() =>
      logSession(db.adapter, baseSession({ mood_before: 0 as never })),
    ).toThrow();
    expect(() =>
      logSession(db.adapter, baseSession({ mood_after: 6 as never })),
    ).toThrow();
    // Valid bounds succeed.
    const ok = logSession(
      db.adapter,
      baseSession({ mood_before: 1, mood_after: 5 }),
    );
    expect(ok.mood_before).toBe(1);
    expect(ok.mood_after).toBe(5);
  });

  it('activity CHECK constraint rejects unknown values', () => {
    expect(() =>
      logSession(db.adapter, baseSession({ activity: 'scrimmage' as never })),
    ).toThrow();
  });

  it('listSessions filters by sport, activity, and date range', () => {
    logSession(
      db.adapter,
      baseSession({
        sport: 'basketball',
        activity: 'pickup',
        started_at: 100,
      }),
    );
    logSession(
      db.adapter,
      baseSession({ sport: 'basketball', activity: 'game', started_at: 200 }),
    );
    logSession(
      db.adapter,
      baseSession({ sport: 'soccer', activity: 'game', started_at: 300 }),
    );
    logSession(
      db.adapter,
      baseSession({
        sport: 'running',
        activity: 'training',
        started_at: 400,
      }),
    );

    expect(listSessions(db.adapter)).toHaveLength(4);
    expect(listSessions(db.adapter, { sport: 'basketball' })).toHaveLength(2);
    expect(listSessions(db.adapter, { activity: 'game' })).toHaveLength(2);
    expect(
      listSessions(db.adapter, { since: 200, until: 300 }),
    ).toHaveLength(2);
    expect(listSessions(db.adapter, { sport: 'running' })).toHaveLength(1);
  });

  it('listSessions orders by started_at DESC and honors limit + offset', () => {
    logSession(db.adapter, baseSession({ started_at: 100, sport: 's' }));
    logSession(db.adapter, baseSession({ started_at: 200, sport: 's' }));
    logSession(db.adapter, baseSession({ started_at: 300, sport: 's' }));

    const all = listSessions(db.adapter, { sport: 's' });
    expect(all.map((r) => r.started_at)).toEqual([300, 200, 100]);

    const page = listSessions(db.adapter, { sport: 's', limit: 1, offset: 1 });
    expect(page).toHaveLength(1);
    expect(page[0].started_at).toBe(200);
  });

  it('updateSession partial preserves created_at and untouched fields', async () => {
    const created = logSession(
      db.adapter,
      baseSession({
        stats: { points: 10 },
        teammates: ['Alice'],
        notes_md: 'original',
      }),
    );
    await new Promise((r) => setTimeout(r, 2));

    const updated = updateSession(db.adapter, created.id, {
      notes_md: 'revised',
    });
    expect(updated).not.toBeNull();
    expect(updated?.notes_md).toBe('revised');
    expect(updated?.stats).toEqual({ points: 10 });
    expect(updated?.teammates).toEqual(['Alice']);
    expect(updated?.created_at).toBe(created.created_at);
  });

  it('getPersonalBests returns only pb=1 rows for the requested sport', () => {
    logSession(
      db.adapter,
      baseSession({ sport: 'basketball', personal_best: true, started_at: 1 }),
    );
    logSession(
      db.adapter,
      baseSession({ sport: 'basketball', personal_best: false, started_at: 2 }),
    );
    logSession(
      db.adapter,
      baseSession({ sport: 'basketball', personal_best: true, started_at: 3 }),
    );
    logSession(
      db.adapter,
      baseSession({ sport: 'soccer', personal_best: true, started_at: 4 }),
    );

    const hoops = getPersonalBests(db.adapter, 'basketball');
    expect(hoops).toHaveLength(2);
    // Ordered by started_at DESC.
    expect(hoops[0].started_at).toBe(3);
    expect(hoops[1].started_at).toBe(1);

    const soccer = getPersonalBests(db.adapter, 'soccer');
    expect(soccer).toHaveLength(1);
    expect(soccer[0].started_at).toBe(4);
  });

  it('deleteSession removes the row and returns true; missing id returns false', () => {
    const created = logSession(db.adapter, baseSession());
    expect(deleteSession(db.adapter, created.id)).toBe(true);
    expect(getSession(db.adapter, created.id)).toBeNull();
    expect(deleteSession(db.adapter, 'missing_id')).toBe(false);
  });

  it('JSON columns default to empty arrays / object when not provided', () => {
    const created = logSession(db.adapter, baseSession());
    const fetched = getSession(db.adapter, created.id);
    expect(fetched?.teammates).toEqual([]);
    expect(fetched?.stats).toEqual({});
    expect(fetched?.photo_ids).toEqual([]);
  });
});
