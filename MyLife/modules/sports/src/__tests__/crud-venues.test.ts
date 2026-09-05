import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  createVenue,
  deleteVenue,
  getVenue,
  listVenues,
  markVisited,
  setBucketList,
  updateVenue,
  type CreateVenueInput,
} from '../db/crud';

function baseVenue(
  overrides: Partial<CreateVenueInput> = {},
): CreateVenueInput {
  return {
    name: 'AT&T Stadium',
    city: 'Arlington',
    country: 'USA',
    sport: 'football',
    team: 'Cowboys',
    capacity: 80_000,
    lat: 32.7473,
    lng: -97.0945,
    ...overrides,
  };
}

describe('sports venues CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('createVenue + getVenue round-trip with booleans normalized', () => {
    const created = createVenue(db.adapter, baseVenue());
    expect(created.id.startsWith('vn_')).toBe(true);
    expect(created.visited).toBe(0);
    expect(created.bucket_list).toBe(0);

    const fetched = getVenue(db.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('AT&T Stadium');
    expect(fetched?.capacity).toBe(80_000);
    expect(fetched?.lat).toBe(32.7473);
  });

  it('rating CHECK constraint rejects out-of-range values', () => {
    expect(() =>
      createVenue(db.adapter, baseVenue({ rating: 7 as never })),
    ).toThrow();
    const ok = createVenue(db.adapter, baseVenue({ rating: 5 }));
    expect(ok.rating).toBe(5);
  });

  it('markVisited is idempotent on first_visit_at and advances last_visit_at', () => {
    const created = createVenue(db.adapter, baseVenue());
    const first = markVisited(db.adapter, created.id, 1_000);
    expect(first?.visited).toBe(1);
    expect(first?.first_visit_at).toBe(1_000);
    expect(first?.last_visit_at).toBe(1_000);

    const second = markVisited(db.adapter, created.id, 2_000);
    expect(second?.first_visit_at).toBe(1_000);
    expect(second?.last_visit_at).toBe(2_000);
    expect(second?.visited).toBe(1);

    const third = markVisited(db.adapter, created.id, 500);
    expect(third?.first_visit_at).toBe(1_000);
    expect(third?.last_visit_at).toBe(500);
  });

  it('markVisited returns null when the venue does not exist', () => {
    expect(markVisited(db.adapter, 'vn_missing')).toBeNull();
  });

  it('setBucketList toggles the flag', () => {
    const created = createVenue(db.adapter, baseVenue());
    const on = setBucketList(db.adapter, created.id, true);
    expect(on?.bucket_list).toBe(1);
    const off = setBucketList(db.adapter, created.id, false);
    expect(off?.bucket_list).toBe(0);
  });

  it('listVenues filters by visited, bucketList, and sport', () => {
    const att = createVenue(db.adapter, baseVenue({ name: 'AT&T' }));
    const wrigley = createVenue(
      db.adapter,
      baseVenue({
        name: 'Wrigley Field',
        sport: 'baseball',
        team: 'Cubs',
      }),
    );
    const old = createVenue(
      db.adapter,
      baseVenue({ name: 'Old Trafford', sport: 'soccer', team: 'Man Utd' }),
    );
    markVisited(db.adapter, att.id, 1_000);
    setBucketList(db.adapter, wrigley.id, true);

    expect(listVenues(db.adapter)).toHaveLength(3);
    expect(listVenues(db.adapter, { visited: true })).toHaveLength(1);
    expect(listVenues(db.adapter, { visited: false })).toHaveLength(2);
    expect(listVenues(db.adapter, { bucketList: true })).toHaveLength(1);
    expect(listVenues(db.adapter, { sport: 'soccer' })).toHaveLength(1);
    expect(listVenues(db.adapter, { sport: 'soccer' })[0].id).toBe(old.id);
  });

  it('listVenues returns rows ordered by name ASC', () => {
    createVenue(db.adapter, baseVenue({ name: 'Camden' }));
    createVenue(db.adapter, baseVenue({ name: 'Arrowhead' }));
    createVenue(db.adapter, baseVenue({ name: 'Bronco' }));
    const rows = listVenues(db.adapter);
    expect(rows.map((r) => r.name)).toEqual(['Arrowhead', 'Bronco', 'Camden']);
  });

  it('updateVenue partial bumps updated_at', async () => {
    const created = createVenue(db.adapter, baseVenue());
    await new Promise((r) => setTimeout(r, 2));
    const updated = updateVenue(db.adapter, created.id, {
      notes_md: 'visited with dad',
      rating: 5,
    });
    expect(updated?.notes_md).toBe('visited with dad');
    expect(updated?.rating).toBe(5);
    expect(updated!.updated_at).toBeGreaterThan(created.updated_at);
  });

  it('deleteVenue returns true, then false on missing', () => {
    const created = createVenue(db.adapter, baseVenue());
    expect(deleteVenue(db.adapter, created.id)).toBe(true);
    expect(getVenue(db.adapter, created.id)).toBeNull();
    expect(deleteVenue(db.adapter, 'vn_missing')).toBe(false);
  });
});
