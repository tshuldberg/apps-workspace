import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createPlannedRoute,
  getPlannedRoute,
  getPlannedRoutes,
  deletePlannedRoute,
  createRouteWaypoint,
  getRouteWaypoints,
  deleteRouteWaypoint,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});
afterEach(() => { testDb.close(); });

describe('Planned Route CRUD', () => {
  it('creates a planned route', () => {
    const route = createPlannedRoute(testDb.adapter, 'r1', { name: 'Bay Trail Loop' });
    expect(route.id).toBe('r1');
    expect(route.name).toBe('Bay Trail Loop');
    expect(route.distanceMeters).toBe(0);
    expect(route.isLoop).toBe(false);
  });

  it('creates a route with all fields', () => {
    const route = createPlannedRoute(testDb.adapter, 'r1', {
      name: 'Loop', distanceMeters: 10000, elevationGainMeters: 500,
      estimatedMinutes: 180, isLoop: true, routeGeometry: '{"type":"LineString"}',
    });
    expect(route.distanceMeters).toBe(10000);
    expect(route.isLoop).toBe(true);
    expect(route.routeGeometry).toBe('{"type":"LineString"}');
  });

  it('lists all routes', () => {
    createPlannedRoute(testDb.adapter, 'r1', { name: 'A' });
    createPlannedRoute(testDb.adapter, 'r2', { name: 'B' });
    expect(getPlannedRoutes(testDb.adapter)).toHaveLength(2);
  });

  it('gets a single route', () => {
    createPlannedRoute(testDb.adapter, 'r1', { name: 'A' });
    const r = getPlannedRoute(testDb.adapter, 'r1');
    expect(r).not.toBeNull();
    expect(r!.name).toBe('A');
  });

  it('deletes a route and cascades to waypoints', () => {
    createPlannedRoute(testDb.adapter, 'r1', { name: 'A' });
    createRouteWaypoint(testDb.adapter, 'w1', { routeId: 'r1', lat: 37.77, lng: -122.42, sortOrder: 0 });
    deletePlannedRoute(testDb.adapter, 'r1');
    expect(getPlannedRoute(testDb.adapter, 'r1')).toBeNull();
    expect(getRouteWaypoints(testDb.adapter, 'r1')).toHaveLength(0);
  });
});

describe('Route Waypoint CRUD', () => {
  it('creates waypoints with sort order', () => {
    createPlannedRoute(testDb.adapter, 'r1', { name: 'A' });
    createRouteWaypoint(testDb.adapter, 'w1', { routeId: 'r1', lat: 37.77, lng: -122.42, sortOrder: 0 });
    createRouteWaypoint(testDb.adapter, 'w2', { routeId: 'r1', lat: 37.78, lng: -122.41, sortOrder: 1, label: 'Summit' });
    const wps = getRouteWaypoints(testDb.adapter, 'r1');
    expect(wps).toHaveLength(2);
    expect(wps[0].sortOrder).toBe(0);
    expect(wps[1].sortOrder).toBe(1);
    expect(wps[1].label).toBe('Summit');
  });

  it('deletes a single waypoint', () => {
    createPlannedRoute(testDb.adapter, 'r1', { name: 'A' });
    createRouteWaypoint(testDb.adapter, 'w1', { routeId: 'r1', lat: 37.77, lng: -122.42, sortOrder: 0 });
    createRouteWaypoint(testDb.adapter, 'w2', { routeId: 'r1', lat: 37.78, lng: -122.41, sortOrder: 1 });
    deleteRouteWaypoint(testDb.adapter, 'w1');
    expect(getRouteWaypoints(testDb.adapter, 'r1')).toHaveLength(1);
  });
});
