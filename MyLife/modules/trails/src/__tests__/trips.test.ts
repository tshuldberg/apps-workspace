import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createTrail,
  createTrip,
  getTrip,
  getTrips,
  deleteTrip,
  createTripDay,
  getTripDays,
  deleteTripDay,
  createTripActivity,
  getTripActivities,
  reorderActivities,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});
afterEach(() => { testDb.close(); });

describe('Trip CRUD', () => {
  it('creates a trip', () => {
    const trip = createTrip(testDb.adapter, 'trip1', { name: 'Yosemite Weekend' });
    expect(trip.id).toBe('trip1');
    expect(trip.name).toBe('Yosemite Weekend');
    expect(trip.startDate).toBeNull();
    expect(trip.endDate).toBeNull();
  });

  it('creates a trip with dates', () => {
    const trip = createTrip(testDb.adapter, 'trip1', {
      name: 'Yosemite', startDate: '2026-04-01', endDate: '2026-04-03', notes: 'Pack bear canister',
    });
    expect(trip.startDate).toBe('2026-04-01');
    expect(trip.endDate).toBe('2026-04-03');
    expect(trip.notes).toBe('Pack bear canister');
  });

  it('lists trips', () => {
    createTrip(testDb.adapter, 't1', { name: 'A' });
    createTrip(testDb.adapter, 't2', { name: 'B' });
    expect(getTrips(testDb.adapter)).toHaveLength(2);
  });

  it('deletes a trip and cascades', () => {
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1 });
    createTripActivity(testDb.adapter, 'a1', { dayId: 'd1', type: 'hike', name: 'Hike' });
    deleteTrip(testDb.adapter, 'trip1');
    expect(getTrip(testDb.adapter, 'trip1')).toBeNull();
    expect(getTripDays(testDb.adapter, 'trip1')).toHaveLength(0);
  });
});

describe('Trip Day CRUD', () => {
  it('creates days for a trip', () => {
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    const day = createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1, title: 'Summit Day' });
    expect(day.dayNumber).toBe(1);
    expect(day.title).toBe('Summit Day');
  });

  it('lists days ordered by day_number', () => {
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    createTripDay(testDb.adapter, 'd2', { tripId: 'trip1', dayNumber: 2 });
    createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1 });
    const days = getTripDays(testDb.adapter, 'trip1');
    expect(days[0].dayNumber).toBe(1);
    expect(days[1].dayNumber).toBe(2);
  });

  it('deletes a day and cascades to activities', () => {
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1 });
    createTripActivity(testDb.adapter, 'a1', { dayId: 'd1', type: 'hike', name: 'Hike' });
    deleteTripDay(testDb.adapter, 'd1');
    expect(getTripActivities(testDb.adapter, 'd1')).toHaveLength(0);
  });
});

describe('Trip Activity CRUD', () => {
  it('creates an activity linked to a trail', () => {
    createTrail(testDb.adapter, 't1', {
      name: 'Yosemite Falls', difficulty: 'moderate', distanceMeters: 8000,
      elevationGainMeters: 800, lat: 37.75, lng: -119.60,
    });
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1 });
    const act = createTripActivity(testDb.adapter, 'a1', {
      dayId: 'd1', trailId: 't1', type: 'hike', name: 'Yosemite Falls Hike',
    });
    expect(act.trailId).toBe('t1');
    expect(act.type).toBe('hike');
  });

  it('creates activities with different types', () => {
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1 });
    createTripActivity(testDb.adapter, 'a1', { dayId: 'd1', type: 'hike', name: 'Hike' });
    createTripActivity(testDb.adapter, 'a2', { dayId: 'd1', type: 'drive', name: 'Drive' });
    createTripActivity(testDb.adapter, 'a3', { dayId: 'd1', type: 'camp', name: 'Camp' });
    const acts = getTripActivities(testDb.adapter, 'd1');
    expect(acts).toHaveLength(3);
  });

  it('reorders activities', () => {
    createTrip(testDb.adapter, 'trip1', { name: 'A' });
    createTripDay(testDb.adapter, 'd1', { tripId: 'trip1', dayNumber: 1 });
    createTripActivity(testDb.adapter, 'a1', { dayId: 'd1', type: 'hike', name: 'First', sortOrder: 0 });
    createTripActivity(testDb.adapter, 'a2', { dayId: 'd1', type: 'drive', name: 'Second', sortOrder: 1 });
    reorderActivities(testDb.adapter, 'd1', ['a2', 'a1']);
    const acts = getTripActivities(testDb.adapter, 'd1');
    expect(acts[0].id).toBe('a2');
    expect(acts[1].id).toBe('a1');
  });
});
