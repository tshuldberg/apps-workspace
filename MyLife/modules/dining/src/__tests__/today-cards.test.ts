import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { diningCrossModule } from '../cross-module';

const NOW = new Date('2026-07-04T15:00:00.000Z');

function seedRestaurant(db: DatabaseAdapter): void {
  db.execute(`INSERT INTO dn_restaurants (id, name) VALUES ('r1', 'Lucali')`);
}

describe('dining getTodayCards', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('dining', DINING_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    seedRestaurant(adapter);
  });

  afterEach(() => {
    closeDb();
  });

  it('returns no cards when there is nothing to surface', () => {
    expect(diningCrossModule.getTodayCards!(adapter, { now: NOW })).toEqual([]);
  });

  it("surfaces tonight's upcoming reservation", () => {
    adapter.execute(
      `INSERT INTO dn_reservations (id, restaurant_id, reserved_at, party_size, status)
       VALUES ('res1', 'r1', '2026-07-04T19:30:00.000Z', 2, 'upcoming')`,
    );
    const cards = diningCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('event');
    expect(cards[0]!.title).toBe('Reservation: Lucali');
    expect(cards[0]!.subtitle).toContain('party of 2');
    expect(cards[0]!.cta?.route).toBe('/dining/reservations');
  });

  it('ignores reservations on other days or cancelled', () => {
    adapter.execute(
      `INSERT INTO dn_reservations (id, restaurant_id, reserved_at, party_size, status)
       VALUES ('res1', 'r1', '2026-07-06T19:30:00.000Z', 2, 'upcoming')`,
    );
    adapter.execute(
      `INSERT INTO dn_reservations (id, restaurant_id, reserved_at, party_size, status)
       VALUES ('res2', 'r1', '2026-07-04T19:30:00.000Z', 2, 'cancelled')`,
    );
    expect(diningCrossModule.getTodayCards!(adapter, { now: NOW })).toEqual([]);
  });

  it('surfaces the active wishlist count', () => {
    adapter.execute(
      `INSERT INTO dn_watchlist (id, restaurant_id, party_size, status)
       VALUES ('w1', 'r1', 2, 'active')`,
    );
    const cards = diningCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('insight');
    expect(cards[0]!.title).toBe('1 place on your wishlist');
  });

  it('stacks reservation above wishlist when both exist', () => {
    adapter.execute(
      `INSERT INTO dn_reservations (id, restaurant_id, reserved_at, party_size, status)
       VALUES ('res1', 'r1', '2026-07-04T19:30:00.000Z', 4, 'upcoming')`,
    );
    adapter.execute(
      `INSERT INTO dn_watchlist (id, restaurant_id, party_size, status)
       VALUES ('w1', 'r1', 2, 'active')`,
    );
    const cards = diningCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(2);
    expect(cards[0]!.priority).toBeGreaterThan(cards[1]!.priority);
  });
});
