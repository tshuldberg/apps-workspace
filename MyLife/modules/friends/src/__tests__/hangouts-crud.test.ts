import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import {
  createHangout,
  getHangout,
  updateHangout,
  deleteHangout,
  listHangouts,
  listHangoutsForPerson,
  getLastHangoutDate,
} from '../db/crud/hangouts';

let db: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ── Create ────────────────────────────────────────────────────────────

describe('createHangout', () => {
  it('creates a hangout and returns the full record', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1', 'p2'],
      happened_at: '2026-04-15T18:00:00.000Z',
      duration_minutes: 90,
      location_name: 'Central Perk',
      activity_tags: ['coffee'],
      quality_rating: 5,
      notes_md: 'Great catch-up',
    });

    expect(hangout.id).toBeTruthy();
    expect(hangout.people_ids).toEqual(['p1', 'p2']);
    expect(hangout.happened_at).toBe('2026-04-15T18:00:00.000Z');
    expect(hangout.duration_minutes).toBe(90);
    expect(hangout.location_name).toBe('Central Perk');
    expect(hangout.activity_tags).toEqual(['coffee']);
    expect(hangout.quality_rating).toBe(5);
    expect(hangout.notes_md).toBe('Great catch-up');
    expect(hangout.photo_ids).toEqual([]);
    expect(hangout.created_at).toBeTruthy();
  });

  it('creates a minimal hangout with defaults', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
    });

    expect(hangout.people_ids).toEqual(['p1']);
    expect(hangout.duration_minutes).toBeNull();
    expect(hangout.location_name).toBeNull();
    expect(hangout.activity_tags).toEqual([]);
    expect(hangout.quality_rating).toBeNull();
    expect(hangout.photo_ids).toEqual([]);
  });

  it('rejects empty people_ids', () => {
    expect(() =>
      createHangout(db, {
        people_ids: [],
        happened_at: '2026-04-10T12:00:00.000Z',
      }),
    ).toThrow();
  });
});

// ── Read ──────────────────────────────────────────────────────────────

describe('getHangout', () => {
  it('returns hangout with deserialized JSON arrays', () => {
    const created = createHangout(db, {
      people_ids: ['p1', 'p2'],
      happened_at: '2026-04-15T18:00:00.000Z',
      activity_tags: ['dinner', 'drinks'],
      photo_ids: ['photo-1', 'photo-2'],
    });

    const fetched = getHangout(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.people_ids).toEqual(['p1', 'p2']);
    expect(fetched!.activity_tags).toEqual(['dinner', 'drinks']);
    expect(fetched!.photo_ids).toEqual(['photo-1', 'photo-2']);
  });

  it('returns null for non-existent hangout', () => {
    expect(getHangout(db, 'does-not-exist')).toBeNull();
  });
});

// ── CRUD round-trip ──────────────────────────────────────────────────

describe('CRUD round-trip', () => {
  it('creates, reads, updates, and deletes a hangout', () => {
    // Create
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-15T18:00:00.000Z',
      activity_tags: ['coffee'],
      quality_rating: 3,
    });

    // Read
    const fetched = getHangout(db, hangout.id)!;
    expect(fetched.quality_rating).toBe(3);
    expect(fetched.activity_tags).toEqual(['coffee']);

    // Update
    updateHangout(db, hangout.id, {
      quality_rating: 5,
      activity_tags: ['coffee', 'lunch'],
      notes_md: 'Updated notes',
    });

    const updated = getHangout(db, hangout.id)!;
    expect(updated.quality_rating).toBe(5);
    expect(updated.activity_tags).toEqual(['coffee', 'lunch']);
    expect(updated.notes_md).toBe('Updated notes');

    // Delete
    deleteHangout(db, hangout.id);
    expect(getHangout(db, hangout.id)).toBeNull();
  });
});

// ── Multi-person hangout ─────────────────────────────────────────────

describe('multi-person hangout', () => {
  it('stores and retrieves 3 people_ids', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1', 'p2', 'p3'],
      happened_at: '2026-04-15T18:00:00.000Z',
    });

    const fetched = getHangout(db, hangout.id)!;
    expect(fetched.people_ids).toEqual(['p1', 'p2', 'p3']);
    expect(fetched.people_ids).toHaveLength(3);
  });
});

// ── Filter by person_id ──────────────────────────────────────────────

describe('filter by person_id', () => {
  it('returns correct subset via listHangouts', () => {
    createHangout(db, {
      people_ids: ['p1', 'p2'],
      happened_at: '2026-04-10T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p2', 'p3'],
      happened_at: '2026-04-11T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p3'],
      happened_at: '2026-04-12T12:00:00.000Z',
    });

    const p2Hangouts = listHangouts(db, { person_id: 'p2' });
    expect(p2Hangouts).toHaveLength(2);

    const p3Hangouts = listHangouts(db, { person_id: 'p3' });
    expect(p3Hangouts).toHaveLength(2);

    const p1Hangouts = listHangouts(db, { person_id: 'p1' });
    expect(p1Hangouts).toHaveLength(1);
  });

  it('returns correct subset via listHangoutsForPerson', () => {
    createHangout(db, {
      people_ids: ['p1', 'p2'],
      happened_at: '2026-04-10T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p3'],
      happened_at: '2026-04-11T12:00:00.000Z',
    });

    const result = listHangoutsForPerson(db, 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].people_ids).toContain('p1');
  });
});

// ── Filter by activity_tag ───────────────────────────────────────────

describe('filter by activity_tag', () => {
  it('returns hangouts with the given activity tag', () => {
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
      activity_tags: ['coffee', 'lunch'],
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-11T12:00:00.000Z',
      activity_tags: ['dinner'],
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-12T12:00:00.000Z',
      activity_tags: ['coffee'],
    });

    const coffeeHangouts = listHangouts(db, { activity_tag: 'coffee' });
    expect(coffeeHangouts).toHaveLength(2);

    const dinnerHangouts = listHangouts(db, { activity_tag: 'dinner' });
    expect(dinnerHangouts).toHaveLength(1);
  });
});

// ── Filter by date range ─────────────────────────────────────────────

describe('filter by date range', () => {
  it('returns hangouts within the date range', () => {
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-01T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-15T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-30T12:00:00.000Z',
    });

    const result = listHangouts(db, {
      date_from: '2026-04-10T00:00:00.000Z',
      date_to: '2026-04-20T00:00:00.000Z',
    });
    expect(result).toHaveLength(1);
    expect(result[0].happened_at).toBe('2026-04-15T12:00:00.000Z');
  });
});

// ── Quality rating validation ────────────────────────────────────────

describe('quality rating validation', () => {
  it('rejects quality_rating of 0', () => {
    expect(() =>
      createHangout(db, {
        people_ids: ['p1'],
        happened_at: '2026-04-10T12:00:00.000Z',
        quality_rating: 0,
      }),
    ).toThrow();
  });

  it('rejects quality_rating of 6', () => {
    expect(() =>
      createHangout(db, {
        people_ids: ['p1'],
        happened_at: '2026-04-10T12:00:00.000Z',
        quality_rating: 6,
      }),
    ).toThrow();
  });

  it('accepts quality_rating of 1', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
      quality_rating: 1,
    });
    expect(hangout.quality_rating).toBe(1);
  });

  it('accepts quality_rating of 5', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
      quality_rating: 5,
    });
    expect(hangout.quality_rating).toBe(5);
  });
});

// ── getLastHangoutDate ───────────────────────────────────────────────

describe('getLastHangoutDate', () => {
  it('returns the most recent happened_at for a person', () => {
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-01T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-15T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
    });

    const lastDate = getLastHangoutDate(db, 'p1');
    expect(lastDate).toBe('2026-04-15T12:00:00.000Z');
  });

  it('returns null when person has no hangouts', () => {
    const lastDate = getLastHangoutDate(db, 'nobody');
    expect(lastDate).toBeNull();
  });
});

// ── Activity tags serialization ──────────────────────────────────────

describe('activity tags serialize/deserialize', () => {
  it('round-trips multiple activity tags correctly', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
      activity_tags: ['coffee', 'lunch', 'hike'],
    });

    const fetched = getHangout(db, hangout.id)!;
    expect(fetched.activity_tags).toEqual(['coffee', 'lunch', 'hike']);
  });

  it('round-trips empty activity tags', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
    });

    const fetched = getHangout(db, hangout.id)!;
    expect(fetched.activity_tags).toEqual([]);
  });

  it('updates activity_tags via updateHangout', () => {
    const hangout = createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
      activity_tags: ['coffee'],
    });

    updateHangout(db, hangout.id, { activity_tags: ['dinner', 'drinks'] });
    const updated = getHangout(db, hangout.id)!;
    expect(updated.activity_tags).toEqual(['dinner', 'drinks']);
  });
});

// ── List ordering ────────────────────────────────────────────────────

describe('listHangouts ordering', () => {
  it('returns hangouts sorted by happened_at DESC', () => {
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-01T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-20T12:00:00.000Z',
    });
    createHangout(db, {
      people_ids: ['p1'],
      happened_at: '2026-04-10T12:00:00.000Z',
    });

    const all = listHangouts(db);
    expect(all.map((h) => h.happened_at)).toEqual([
      '2026-04-20T12:00:00.000Z',
      '2026-04-10T12:00:00.000Z',
      '2026-04-01T12:00:00.000Z',
    ]);
  });
});
