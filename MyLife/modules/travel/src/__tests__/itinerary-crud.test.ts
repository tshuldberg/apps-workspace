import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  countActivitiesByTrip,
  countDaysByTrip,
  createActivity,
  createDay,
  deleteActivity,
  deleteDay,
  getActivityById,
  getDayById,
  listActivitiesByDay,
  listActivitiesByTrip,
  listDaysByTrip,
  reorderActivities,
  reorderDays,
  updateActivity,
  updateDay,
} from '../db/crud/itinerary';

describe('@mylife/travel itinerary CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;
  let tripId: string;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    tripId = createTrip(adapter, { name: 'Trip Host' }).id;
  });

  afterEach(() => {
    closeDb();
  });

  describe('itinerary days', () => {
    it('creates and retrieves a day', () => {
      const day = createDay(adapter, {
        trip_id: tripId,
        day_number: 1,
        date: '2026-05-01',
        location: 'Paris',
        photo_ids: ['photo_1'],
      });
      expect(day.id).toMatch(/^day_/);
      expect(day.photo_ids).toBe('["photo_1"]');

      const fetched = getDayById(adapter, day.id)!;
      expect(fetched.location).toBe('Paris');
      expect(fetched.date).toBe('2026-05-01');
    });

    it('lists days by trip ordered by day_number', () => {
      createDay(adapter, { trip_id: tripId, day_number: 3, location: 'C' });
      createDay(adapter, { trip_id: tripId, day_number: 1, location: 'A' });
      createDay(adapter, { trip_id: tripId, day_number: 2, location: 'B' });

      const days = listDaysByTrip(adapter, tripId);
      expect(days.map((d) => d.location)).toEqual(['A', 'B', 'C']);
    });

    it('updates a day and bumps updated_at', async () => {
      const day = createDay(adapter, { trip_id: tripId, day_number: 1 });
      const originalUpdated = day.updated_at;
      await new Promise((r) => setTimeout(r, 10));
      updateDay(adapter, day.id, { location: 'New Loc', summary_md: 'Hi' });
      const updated = getDayById(adapter, day.id)!;
      expect(updated.location).toBe('New Loc');
      expect(updated.summary_md).toBe('Hi');
      expect(updated.updated_at).not.toBe(originalUpdated);
    });

    it('serializes photo_ids on update', () => {
      const day = createDay(adapter, { trip_id: tripId, day_number: 1 });
      updateDay(adapter, day.id, { photo_ids: ['p1', 'p2'] });
      expect(getDayById(adapter, day.id)!.photo_ids).toBe('["p1","p2"]');
    });

    it('ignores unknown columns in update', () => {
      const day = createDay(adapter, { trip_id: tripId, day_number: 1 });
      updateDay(adapter, day.id, {
        // @ts-expect-error injection safety
        rogue: "'; DROP TABLE tv_itinerary_days; --",
        location: 'Safe',
      });
      expect(getDayById(adapter, day.id)!.location).toBe('Safe');
    });

    it('reorders days by ID list', () => {
      const a = createDay(adapter, { trip_id: tripId, day_number: 1, location: 'A' });
      const b = createDay(adapter, { trip_id: tripId, day_number: 2, location: 'B' });
      const c = createDay(adapter, { trip_id: tripId, day_number: 3, location: 'C' });

      reorderDays(adapter, tripId, [c.id, a.id, b.id]);
      const reordered = listDaysByTrip(adapter, tripId);
      expect(reordered.map((d) => d.location)).toEqual(['C', 'A', 'B']);
      expect(reordered.map((d) => d.day_number)).toEqual([1, 2, 3]);
    });

    it('deletes a day', () => {
      const day = createDay(adapter, { trip_id: tripId, day_number: 1 });
      deleteDay(adapter, day.id);
      expect(getDayById(adapter, day.id)).toBeNull();
      expect(countDaysByTrip(adapter, tripId)).toBe(0);
    });
  });

  describe('activities', () => {
    let dayId: string;

    beforeEach(() => {
      dayId = createDay(adapter, { trip_id: tripId, day_number: 1 }).id;
    });

    it('creates and retrieves an activity', () => {
      const activity = createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'Louvre',
        type: 'sight',
        time: '10:00',
        end_time: '13:00',
        cost_cents: 2000,
        lat: 48.8606,
        lng: 2.3376,
      });
      expect(activity.id).toMatch(/^act_/);
      const fetched = getActivityById(adapter, activity.id)!;
      expect(fetched.title).toBe('Louvre');
      expect(fetched.type).toBe('sight');
      expect(fetched.cost_cents).toBe(2000);
      expect(fetched.lat).toBeCloseTo(48.8606);
    });

    it('lists activities by day ordered by time', () => {
      createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'Evening',
        time: '20:00',
      });
      createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'Morning',
        time: '08:00',
      });
      createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'Lunch',
        time: '12:00',
      });
      const ordered = listActivitiesByDay(adapter, dayId);
      expect(ordered.map((a) => a.title)).toEqual(['Morning', 'Lunch', 'Evening']);
    });

    it('lists activities by trip', () => {
      const day2 = createDay(adapter, { trip_id: tripId, day_number: 2 }).id;
      createActivity(adapter, { day_id: dayId, trip_id: tripId, title: 'A' });
      createActivity(adapter, { day_id: day2, trip_id: tripId, title: 'B' });
      expect(countActivitiesByTrip(adapter, tripId)).toBe(2);
      expect(listActivitiesByTrip(adapter, tripId)).toHaveLength(2);
    });

    it('updates an activity', () => {
      const activity = createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'Old',
      });
      updateActivity(adapter, activity.id, {
        title: 'New',
        notes_md: 'Remember passport',
        cost_cents: 5000,
      });
      const updated = getActivityById(adapter, activity.id)!;
      expect(updated.title).toBe('New');
      expect(updated.notes_md).toBe('Remember passport');
      expect(updated.cost_cents).toBe(5000);
    });

    it('reorders activities within a day', () => {
      const a = createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'A',
      });
      const b = createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'B',
      });
      const c = createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'C',
      });
      reorderActivities(adapter, dayId, [c.id, a.id, b.id]);
      const ordered = listActivitiesByDay(adapter, dayId);
      expect(ordered.map((x) => x.title)).toEqual(['C', 'A', 'B']);
    });

    it('deletes an activity', () => {
      const activity = createActivity(adapter, {
        day_id: dayId,
        trip_id: tripId,
        title: 'Gone',
      });
      deleteActivity(adapter, activity.id);
      expect(getActivityById(adapter, activity.id)).toBeNull();
    });

    it('cascade: deleting a day removes its activities', () => {
      createActivity(adapter, { day_id: dayId, trip_id: tripId, title: 'One' });
      createActivity(adapter, { day_id: dayId, trip_id: tripId, title: 'Two' });
      deleteDay(adapter, dayId);
      expect(listActivitiesByDay(adapter, dayId)).toHaveLength(0);
    });
  });
});
