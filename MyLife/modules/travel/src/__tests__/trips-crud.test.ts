import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  countTrips,
  createTrip,
  deleteTrip,
  duplicateTrip,
  getTripById,
  listTrips,
  updateTrip,
  updateTripStatus,
} from '../db/crud/trips';
import {
  createActivity,
  createDay,
  listActivitiesByTrip,
  listDaysByTrip,
} from '../db/crud/itinerary';

describe('@mylife/travel trips CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('applies migrations to schema_versions (travel = 7)', () => {
    const rows = adapter.query<{ version: number }>(
      `SELECT MAX(version) as version FROM hub_schema_versions WHERE module_id = 'travel'`,
    );
    expect(rows[0]!.version).toBe(7);
  });

  it('creates a trip with defaults', () => {
    const trip = createTrip(adapter, { name: 'Tokyo 2026' });
    expect(trip.id).toMatch(/^trip_/);
    expect(trip.name).toBe('Tokyo 2026');
    expect(trip.status).toBe('planning');
    expect(trip.budget_actual_cents).toBe(0);
    expect(trip.destination_ids).toBe('[]');
    expect(trip.companion_ids).toBe('[]');
  });

  it('round-trips a trip via getTripById', () => {
    const created = createTrip(adapter, {
      name: 'Portugal Surf',
      trip_type: 'vacation',
      destination_ids: ['dest_1', 'dest_2'],
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      budget_planned_cents: 250_000,
    });
    const fetched = getTripById(adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Portugal Surf');
    expect(fetched!.trip_type).toBe('vacation');
    expect(fetched!.destination_ids).toBe('["dest_1","dest_2"]');
    expect(fetched!.budget_planned_cents).toBe(250_000);
  });

  it('updates allowed fields and bumps updated_at', async () => {
    const trip = createTrip(adapter, { name: 'Old Name' });
    const originalUpdated = trip.updated_at;
    await new Promise((r) => setTimeout(r, 10));
    updateTrip(adapter, trip.id, { name: 'New Name', rating: 5 });
    const fetched = getTripById(adapter, trip.id)!;
    expect(fetched.name).toBe('New Name');
    expect(fetched.rating).toBe(5);
    expect(fetched.updated_at).not.toBe(originalUpdated);
  });

  it('ignores unknown columns in update', () => {
    const trip = createTrip(adapter, { name: 'Safe' });
    updateTrip(adapter, trip.id, {
      // @ts-expect-error testing injection safety
      malicious: "x'; DROP TABLE tv_trips; --",
      name: 'Still Safe',
    });
    expect(getTripById(adapter, trip.id)!.name).toBe('Still Safe');
    expect(countTrips(adapter)).toBe(1);
  });

  it('serializes destination_ids updates', () => {
    const trip = createTrip(adapter, { name: 'Serial' });
    updateTrip(adapter, trip.id, { destination_ids: ['a', 'b', 'c'] });
    expect(getTripById(adapter, trip.id)!.destination_ids).toBe(
      '["a","b","c"]',
    );
  });

  it('transitions status via updateTripStatus', () => {
    const trip = createTrip(adapter, { name: 'Lifecycle' });
    updateTripStatus(adapter, trip.id, 'upcoming');
    expect(getTripById(adapter, trip.id)!.status).toBe('upcoming');
    updateTripStatus(adapter, trip.id, 'active');
    expect(getTripById(adapter, trip.id)!.status).toBe('active');
    updateTripStatus(adapter, trip.id, 'completed');
    expect(getTripById(adapter, trip.id)!.status).toBe('completed');
  });

  it('filters list by status, trip_type, and date range', () => {
    createTrip(adapter, {
      name: 'Past Work',
      status: 'completed',
      trip_type: 'business',
      start_date: '2025-01-01',
    });
    createTrip(adapter, {
      name: 'Summer',
      status: 'upcoming',
      trip_type: 'vacation',
      start_date: '2026-07-01',
    });
    createTrip(adapter, {
      name: 'Fall',
      status: 'planning',
      trip_type: 'vacation',
      start_date: '2026-10-01',
    });

    expect(listTrips(adapter, { status: 'upcoming' })).toHaveLength(1);
    expect(listTrips(adapter, { trip_type: 'vacation' })).toHaveLength(2);
    expect(
      listTrips(adapter, { start_after: '2026-06-01', start_before: '2026-08-01' }),
    ).toHaveLength(1);
  });

  it('deletes a trip', () => {
    const trip = createTrip(adapter, { name: 'Delete Me' });
    deleteTrip(adapter, trip.id);
    expect(getTripById(adapter, trip.id)).toBeNull();
    expect(countTrips(adapter)).toBe(0);
  });

  describe('duplicateTrip', () => {
    function seedTripWithItinerary() {
      const trip = createTrip(adapter, {
        name: 'Italy Template',
        trip_type: 'vacation',
        start_date: '2026-05-01',
        end_date: '2026-05-07',
        budget_planned_cents: 300_000,
        budget_actual_cents: 150_000,
        rating: 5,
      });
      const day1 = createDay(adapter, {
        trip_id: trip.id,
        day_number: 1,
        date: '2026-05-01',
        location: 'Rome',
      });
      const day2 = createDay(adapter, {
        trip_id: trip.id,
        day_number: 2,
        date: '2026-05-02',
        location: 'Florence',
      });
      createActivity(adapter, {
        day_id: day1.id,
        trip_id: trip.id,
        title: 'Colosseum',
        type: 'sight',
        time: '10:00',
      });
      createActivity(adapter, {
        day_id: day2.id,
        trip_id: trip.id,
        title: 'Uffizi',
        type: 'sight',
        time: '11:00',
      });
      return trip;
    }

    it('creates a new trip with new IDs and resets budget_actual and status', () => {
      const source = seedTripWithItinerary();
      const copy = duplicateTrip(adapter, source.id);
      expect(copy.id).not.toBe(source.id);
      expect(copy.name).toBe('Italy Template (Copy)');
      expect(copy.status).toBe('planning');
      expect(copy.budget_actual_cents).toBe(0);
      expect(copy.budget_planned_cents).toBe(300_000);
      expect(copy.template_id).toBe(source.id);
      expect(copy.rating).toBeNull();
    });

    it('clones itinerary days and activities with new IDs', () => {
      const source = seedTripWithItinerary();
      const copy = duplicateTrip(adapter, source.id);

      const sourceDays = listDaysByTrip(adapter, source.id);
      const copyDays = listDaysByTrip(adapter, copy.id);
      expect(copyDays).toHaveLength(sourceDays.length);
      // New IDs
      for (const cd of copyDays) {
        expect(sourceDays.some((sd) => sd.id === cd.id)).toBe(false);
      }
      // Day numbers preserved
      expect(copyDays.map((d) => d.day_number).sort()).toEqual(
        sourceDays.map((d) => d.day_number).sort(),
      );

      const sourceActivities = listActivitiesByTrip(adapter, source.id);
      const copyActivities = listActivitiesByTrip(adapter, copy.id);
      expect(copyActivities).toHaveLength(sourceActivities.length);
      for (const ca of copyActivities) {
        expect(sourceActivities.some((sa) => sa.id === ca.id)).toBe(false);
        expect(ca.trip_id).toBe(copy.id);
        // The activity day_id points into the new trip's days
        expect(copyDays.some((d) => d.id === ca.day_id)).toBe(true);
      }
    });

    it('applies dateOffset to trip + day dates', () => {
      const source = seedTripWithItinerary();
      const copy = duplicateTrip(adapter, source.id, {
        newName: 'Italy 2027',
        dateOffset: { days: 365 },
      });
      expect(copy.name).toBe('Italy 2027');
      expect(copy.start_date).toBe('2027-05-01');
      expect(copy.end_date).toBe('2027-05-07');

      const copyDays = listDaysByTrip(adapter, copy.id);
      expect(copyDays.find((d) => d.day_number === 1)!.date).toBe('2027-05-01');
      expect(copyDays.find((d) => d.day_number === 2)!.date).toBe('2027-05-02');
    });

    it('throws when source trip does not exist', () => {
      expect(() => duplicateTrip(adapter, 'trip_nonexistent')).toThrow(
        /Trip not found/,
      );
    });
  });

  it('cascades delete: removing a trip removes its days and activities', () => {
    const trip = createTrip(adapter, { name: 'Cascade' });
    const day = createDay(adapter, { trip_id: trip.id, day_number: 1 });
    createActivity(adapter, {
      day_id: day.id,
      trip_id: trip.id,
      title: 'Flight',
      type: 'flight',
    });
    expect(listDaysByTrip(adapter, trip.id)).toHaveLength(1);
    expect(listActivitiesByTrip(adapter, trip.id)).toHaveLength(1);

    deleteTrip(adapter, trip.id);
    expect(listDaysByTrip(adapter, trip.id)).toHaveLength(0);
    expect(listActivitiesByTrip(adapter, trip.id)).toHaveLength(0);
  });
});
