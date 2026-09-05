import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  createBooking,
  deleteBooking,
  getBooking,
  listBookings,
  listUpcomingBookings,
  updateBooking,
} from '../db/crud/bookings';
import type { BookingInput, BookingType } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let tripId: string;

const ALL_TYPES: BookingType[] = [
  'flight',
  'hotel',
  'car',
  'train',
  'ferry',
  'tour',
  'other',
];

function makeInput(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    trip_id: tripId,
    type: 'flight',
    provider: 'Delta',
    start_ts: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function isoOffset(msOffset: number): string {
  return new Date(Date.now() + msOffset).toISOString();
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  const trip = createTrip(adapter, { name: 'Test Trip' });
  tripId = trip.id;
});

afterEach(() => {
  closeDb();
});

describe('createBooking', () => {
  it('returns a booking with bk_ prefixed id and timestamps', () => {
    const b = createBooking(adapter, makeInput());
    expect(b.id).toMatch(/^bk_/);
    expect(b.trip_id).toBe(tripId);
    expect(b.type).toBe('flight');
    expect(b.provider).toBe('Delta');
    expect(b.start_ts).toBe('2026-06-01T10:00:00.000Z');
    expect(b.created_at).toBeTruthy();
    expect(b.updated_at).toBeTruthy();
  });

  it('persists optional fields', () => {
    const b = createBooking(
      adapter,
      makeInput({
        confirmation_code: 'ABC123',
        end_ts: '2026-06-01T14:00:00.000Z',
        location: 'JFK -> CDG',
        cost_cents: 85000,
        currency: 'USD',
        notes: 'Window seat',
        attachments_ref: '{"receipt":"r1"}',
      }),
    );
    expect(b.confirmation_code).toBe('ABC123');
    expect(b.end_ts).toBe('2026-06-01T14:00:00.000Z');
    expect(b.location).toBe('JFK -> CDG');
    expect(b.cost_cents).toBe(85000);
    expect(b.currency).toBe('USD');
    expect(b.notes).toBe('Window seat');
    expect(b.attachments_ref).toBe('{"receipt":"r1"}');
  });

  it('creates all seven booking types', () => {
    for (const type of ALL_TYPES) {
      const b = createBooking(adapter, makeInput({ type, provider: `${type}-co` }));
      expect(b.type).toBe(type);
      expect(getBooking(adapter, b.id)?.type).toBe(type);
    }
  });

  it('rejects empty provider', () => {
    expect(() => createBooking(adapter, makeInput({ provider: '' }))).toThrow();
  });

  it('rejects currency that is not 3 chars', () => {
    expect(() =>
      createBooking(adapter, makeInput({ currency: 'US' })),
    ).toThrow();
  });

  it('rejects missing trip_id', () => {
    expect(() =>
      createBooking(adapter, makeInput({ trip_id: '' })),
    ).toThrow();
  });
});

describe('getBooking', () => {
  it('returns null for missing id', () => {
    expect(getBooking(adapter, 'nope')).toBeNull();
  });

  it('returns the booking row', () => {
    const b = createBooking(adapter, makeInput({ provider: 'Hilton', type: 'hotel' }));
    const got = getBooking(adapter, b.id);
    expect(got?.provider).toBe('Hilton');
    expect(got?.type).toBe('hotel');
  });
});

describe('updateBooking', () => {
  it('updates specified fields and bumps updated_at', async () => {
    const b = createBooking(adapter, makeInput());
    const before = getBooking(adapter, b.id)!;
    await new Promise((r) => setTimeout(r, 10));
    updateBooking(adapter, b.id, { provider: 'United', cost_cents: 99999 });
    const after = getBooking(adapter, b.id)!;
    expect(after.provider).toBe('United');
    expect(after.cost_cents).toBe(99999);
    expect(after.type).toBe('flight');
    expect(after.updated_at).not.toBe(before.updated_at);
  });

  it('no-ops with empty patch', () => {
    const b = createBooking(adapter, makeInput());
    const before = getBooking(adapter, b.id)!;
    updateBooking(adapter, b.id, {});
    const after = getBooking(adapter, b.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });

  it('ignores unknown columns (injection safety)', () => {
    const b = createBooking(adapter, makeInput({ provider: 'Safe' }));
    updateBooking(adapter, b.id, {
      // @ts-expect-error testing injection safety
      malicious: "x'; DROP TABLE tv_bookings; --",
      provider: 'Still Safe',
    });
    expect(getBooking(adapter, b.id)!.provider).toBe('Still Safe');
  });
});

describe('deleteBooking', () => {
  it('removes a booking', () => {
    const b = createBooking(adapter, makeInput());
    deleteBooking(adapter, b.id);
    expect(getBooking(adapter, b.id)).toBeNull();
  });

  it('cascades from trip delete', () => {
    const b = createBooking(adapter, makeInput());
    adapter.execute(`DELETE FROM tv_trips WHERE id = ?`, [tripId]);
    expect(getBooking(adapter, b.id)).toBeNull();
  });
});

describe('listBookings', () => {
  it('returns empty array when no bookings', () => {
    expect(listBookings(adapter)).toEqual([]);
  });

  it('orders by start_ts ASC', () => {
    createBooking(adapter, makeInput({ start_ts: '2026-07-01T00:00:00.000Z', provider: 'B' }));
    createBooking(adapter, makeInput({ start_ts: '2026-06-01T00:00:00.000Z', provider: 'A' }));
    createBooking(adapter, makeInput({ start_ts: '2026-08-01T00:00:00.000Z', provider: 'C' }));
    const items = listBookings(adapter);
    expect(items.map((x) => x.provider)).toEqual(['A', 'B', 'C']);
  });

  it('filters by tripId', () => {
    const otherTrip = createTrip(adapter, { name: 'Other Trip' });
    createBooking(adapter, makeInput({ provider: 'keep' }));
    createBooking(adapter, makeInput({ trip_id: otherTrip.id, provider: 'skip' }));
    const items = listBookings(adapter, { tripId });
    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('keep');
  });

  it('filters by type', () => {
    createBooking(adapter, makeInput({ type: 'flight', provider: 'air' }));
    createBooking(adapter, makeInput({ type: 'hotel', provider: 'hot' }));
    const items = listBookings(adapter, { type: 'hotel' });
    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('hot');
  });

  it('filters by both tripId and type', () => {
    const otherTrip = createTrip(adapter, { name: 'Other Trip' });
    createBooking(adapter, makeInput({ type: 'flight', provider: 'f1' }));
    createBooking(adapter, makeInput({ type: 'hotel', provider: 'h1' }));
    createBooking(adapter, makeInput({ trip_id: otherTrip.id, type: 'flight', provider: 'f2' }));
    const items = listBookings(adapter, { tripId, type: 'flight' });
    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('f1');
  });
});

describe('listUpcomingBookings', () => {
  it('returns bookings within the future window ordered by start_ts ASC', () => {
    createBooking(adapter, makeInput({ provider: 'past', start_ts: isoOffset(-86_400_000) }));
    createBooking(adapter, makeInput({ provider: 'far', start_ts: isoOffset(90 * 86_400_000) }));
    createBooking(adapter, makeInput({ provider: 'soon', start_ts: isoOffset(2 * 86_400_000) }));
    createBooking(adapter, makeInput({ provider: 'sooner', start_ts: isoOffset(12 * 60 * 60 * 1000) }));
    const items = listUpcomingBookings(adapter, { withinDays: 7 });
    expect(items.map((x) => x.provider)).toEqual(['sooner', 'soon']);
  });

  it('excludes past bookings', () => {
    createBooking(adapter, makeInput({ provider: 'past', start_ts: isoOffset(-7 * 86_400_000) }));
    expect(listUpcomingBookings(adapter, { withinDays: 30 })).toHaveLength(0);
  });

  it('filters upcoming by tripId', () => {
    const otherTrip = createTrip(adapter, { name: 'Other' });
    createBooking(adapter, makeInput({ provider: 'mine', start_ts: isoOffset(2 * 86_400_000) }));
    createBooking(adapter, makeInput({ trip_id: otherTrip.id, provider: 'other', start_ts: isoOffset(3 * 86_400_000) }));
    const items = listUpcomingBookings(adapter, { tripId, withinDays: 30 });
    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('mine');
  });

  it('respects withinDays window boundary', () => {
    createBooking(adapter, makeInput({ provider: 'in', start_ts: isoOffset(5 * 86_400_000) }));
    createBooking(adapter, makeInput({ provider: 'out', start_ts: isoOffset(60 * 86_400_000) }));
    const items = listUpcomingBookings(adapter, { withinDays: 10 });
    expect(items.map((x) => x.provider)).toEqual(['in']);
  });
});
