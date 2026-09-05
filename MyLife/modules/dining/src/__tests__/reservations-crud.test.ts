import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createVisit } from '../db/crud/visits';
import {
  createReservation,
  getReservation,
  updateReservation,
  deleteReservation,
  listReservations,
  listUpcomingReservations,
  cancelReservation,
  completeReservation,
  markNoShow,
  getReservationsByDateRange,
} from '../db/crud/reservations';

let db: DatabaseAdapter;
let closeDb: () => void;
let nextId = 0;

function genId(): string {
  nextId += 1;
  return `test-${nextId.toString().padStart(4, '0')}`;
}

function setupRestaurant(name = 'Test Restaurant'): string {
  const id = genId();
  createRestaurant(db, id, { name });
  return id;
}

function setupVisit(restaurantId: string): string {
  const id = genId();
  createVisit(db, id, {
    restaurant_id: restaurantId,
    visited_at: '2026-03-15T19:00:00Z',
    overall_rating: 4,
  });
  return id;
}

beforeEach(() => {
  nextId = 0;
  const testDb = createModuleTestDatabase('dining', DINING_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('createReservation', () => {
  it('creates a basic reservation', () => {
    const restaurantId = setupRestaurant('Bestia');
    const id = genId();
    const reservation = createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:30:00Z',
      party_size: 4,
    });

    expect(reservation.id).toBe(id);
    expect(reservation.restaurant_id).toBe(restaurantId);
    expect(reservation.reserved_at).toBe('2026-04-20T19:30:00Z');
    expect(reservation.party_size).toBe(4);
    expect(reservation.status).toBe('upcoming');
    expect(reservation.confirmation_code).toBeNull();
    expect(reservation.platform).toBeNull();
    expect(reservation.notes).toBeNull();
    expect(reservation.visit_id).toBeNull();
  });

  it('creates a reservation with all fields', () => {
    const restaurantId = setupRestaurant('Felix');
    const id = genId();
    const reservation = createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-05-01T20:00:00Z',
      party_size: 2,
      confirmation_code: 'RESY-ABC123',
      platform: 'resy',
      status: 'upcoming',
      reminder_minutes: 60,
      notes: 'Anniversary dinner',
    });

    expect(reservation.confirmation_code).toBe('RESY-ABC123');
    expect(reservation.platform).toBe('resy');
    expect(reservation.reminder_minutes).toBe(60);
    expect(reservation.notes).toBe('Anniversary dinner');
  });
});

describe('getReservation', () => {
  it('retrieves a reservation by id', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 3,
    });

    const fetched = getReservation(db, id);
    expect(fetched).not.toBeNull();
    expect(fetched!.party_size).toBe(3);
  });

  it('returns null for nonexistent id', () => {
    expect(getReservation(db, 'does-not-exist')).toBeNull();
  });
});

describe('updateReservation', () => {
  it('updates party_size and notes', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });

    updateReservation(db, id, { party_size: 6, notes: 'Larger group now' });

    const updated = getReservation(db, id);
    expect(updated!.party_size).toBe(6);
    expect(updated!.notes).toBe('Larger group now');
  });
});

describe('deleteReservation', () => {
  it('deletes a reservation', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });

    deleteReservation(db, id);
    expect(getReservation(db, id)).toBeNull();
  });
});

describe('listReservations', () => {
  it('filters by status', () => {
    const restaurantId = setupRestaurant();
    const id1 = genId();
    const id2 = genId();

    createReservation(db, id1, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });
    createReservation(db, id2, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-21T19:00:00Z',
      party_size: 4,
    });
    cancelReservation(db, id1, 'Changed plans');

    const upcoming = listReservations(db, { status: 'upcoming' });
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe(id2);

    const cancelled = listReservations(db, { status: 'cancelled' });
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].id).toBe(id1);
  });

  it('filters by date range', () => {
    const restaurantId = setupRestaurant();

    createReservation(db, genId(), {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-15T19:00:00Z',
      party_size: 2,
    });
    createReservation(db, genId(), {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });
    createReservation(db, genId(), {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-25T19:00:00Z',
      party_size: 2,
    });

    const inRange = listReservations(db, {
      date_from: '2026-04-18',
      date_to: '2026-04-22',
    });
    expect(inRange).toHaveLength(1);
  });
});

describe('listUpcomingReservations', () => {
  it('returns only upcoming sorted by date', () => {
    const restaurantId = setupRestaurant();
    const id1 = genId();
    const id2 = genId();
    const id3 = genId();

    createReservation(db, id1, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-25T19:00:00Z',
      party_size: 2,
    });
    createReservation(db, id2, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 4,
    });
    createReservation(db, id3, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-22T19:00:00Z',
      party_size: 3,
    });
    cancelReservation(db, id3);

    const upcoming = listUpcomingReservations(db);
    expect(upcoming).toHaveLength(2);
    // Sorted ascending by reserved_at
    expect(upcoming[0].id).toBe(id2);
    expect(upcoming[1].id).toBe(id1);
  });
});

describe('cancelReservation', () => {
  it('sets status and reason', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });

    cancelReservation(db, id, 'Feeling sick');

    const res = getReservation(db, id);
    expect(res!.status).toBe('cancelled');
    expect(res!.cancel_reason).toBe('Feeling sick');
  });
});

describe('completeReservation', () => {
  it('sets status and links visit', () => {
    const restaurantId = setupRestaurant();
    const visitId = setupVisit(restaurantId);
    const id = genId();
    createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-03-15T19:00:00Z',
      party_size: 2,
    });

    completeReservation(db, id, visitId);

    const res = getReservation(db, id);
    expect(res!.status).toBe('completed');
    expect(res!.visit_id).toBe(visitId);
  });
});

describe('markNoShow', () => {
  it('sets status to no_show', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createReservation(db, id, {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });

    markNoShow(db, id);

    const res = getReservation(db, id);
    expect(res!.status).toBe('no_show');
  });
});

describe('getReservationsByDateRange', () => {
  it('returns reservations within the range', () => {
    const restaurantId = setupRestaurant();

    createReservation(db, genId(), {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-10T19:00:00Z',
      party_size: 2,
    });
    createReservation(db, genId(), {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-20T19:00:00Z',
      party_size: 2,
    });
    createReservation(db, genId(), {
      restaurant_id: restaurantId,
      reserved_at: '2026-04-30T19:00:00Z',
      party_size: 2,
    });

    const results = getReservationsByDateRange(db, '2026-04-15', '2026-04-25');
    expect(results).toHaveLength(1);
    expect(results[0].reserved_at).toBe('2026-04-20T19:00:00Z');
  });
});
