import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createTrail,
  getTrail,
  getTrails,
  updateTrail,
  deleteTrail,
  createRecording,
  getRecording,
  getRecordings,
  getRecordingsByTrail,
  updateRecording,
  deleteRecording,
  exportRecordingAsGPX,
  createWaypoint,
  getWaypointsByRecording,
  createPhoto,
  getPhotosByRecording,
  getTrailStats,
  getSetting,
  setSetting,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Trails CRUD', () => {
  it('creates a trail with all fields', () => {
    const trail = createTrail(testDb.adapter, 't1', {
      name: 'Muir Woods Loop',
      difficulty: 'moderate',
      distanceMeters: 5200,
      elevationGainMeters: 320,
      estimatedMinutes: 90,
      lat: 37.8912,
      lng: -122.5715,
      region: 'Marin County',
      description: 'Beautiful redwood forest loop',
    });

    expect(trail.id).toBe('t1');
    expect(trail.name).toBe('Muir Woods Loop');
    expect(trail.difficulty).toBe('moderate');
    expect(trail.distanceMeters).toBe(5200);
    expect(trail.elevationGainMeters).toBe(320);
    expect(trail.estimatedMinutes).toBe(90);
    expect(trail.lat).toBe(37.8912);
    expect(trail.lng).toBe(-122.5715);
    expect(trail.region).toBe('Marin County');
    expect(trail.description).toBe('Beautiful redwood forest loop');
    expect(trail.isSaved).toBe(false);
    expect(trail.createdAt).toBeTruthy();
  });

  it('creates a trail with minimal fields', () => {
    const trail = createTrail(testDb.adapter, 't2', {
      name: 'Quick Path',
      difficulty: 'easy',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      lat: 37.7,
      lng: -122.4,
    });

    expect(trail.estimatedMinutes).toBeNull();
    expect(trail.region).toBeNull();
    expect(trail.description).toBeNull();
  });

  it('validates trail name is required', () => {
    expect(() =>
      createTrail(testDb.adapter, 'bad', {
        name: '',
        difficulty: 'easy',
        distanceMeters: 100,
        elevationGainMeters: 0,
        lat: 0,
        lng: 0,
      }),
    ).toThrow();
  });

  it('gets a trail by id', () => {
    createTrail(testDb.adapter, 't3', {
      name: 'Coastal Trail',
      difficulty: 'hard',
      distanceMeters: 15000,
      elevationGainMeters: 800,
      lat: 37.8,
      lng: -122.5,
    });

    const found = getTrail(testDb.adapter, 't3');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Coastal Trail');

    const notFound = getTrail(testDb.adapter, 'nope');
    expect(notFound).toBeNull();
  });

  it('lists trails with default ordering', () => {
    createTrail(testDb.adapter, 't4', {
      name: 'Trail A',
      difficulty: 'easy',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      lat: 37.0,
      lng: -122.0,
    });
    createTrail(testDb.adapter, 't5', {
      name: 'Trail B',
      difficulty: 'hard',
      distanceMeters: 5000,
      elevationGainMeters: 500,
      lat: 37.1,
      lng: -122.1,
    });

    const all = getTrails(testDb.adapter);
    expect(all).toHaveLength(2);
  });

  it('filters trails by difficulty', () => {
    createTrail(testDb.adapter, 'f1', {
      name: 'Easy One',
      difficulty: 'easy',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      lat: 37.0,
      lng: -122.0,
    });
    createTrail(testDb.adapter, 'f2', {
      name: 'Hard One',
      difficulty: 'hard',
      distanceMeters: 5000,
      elevationGainMeters: 500,
      lat: 37.1,
      lng: -122.1,
    });

    const easy = getTrails(testDb.adapter, { difficulty: 'easy' });
    expect(easy).toHaveLength(1);
    expect(easy[0].name).toBe('Easy One');
  });

  it('updates a trail', () => {
    createTrail(testDb.adapter, 'u1', {
      name: 'Old Name',
      difficulty: 'easy',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      lat: 37.0,
      lng: -122.0,
    });

    const updated = updateTrail(testDb.adapter, 'u1', { name: 'New Name', isSaved: true });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
    expect(updated!.isSaved).toBe(true);
  });

  it('returns null when updating non-existent trail', () => {
    const result = updateTrail(testDb.adapter, 'nope', { name: 'X' });
    expect(result).toBeNull();
  });

  it('deletes a trail', () => {
    createTrail(testDb.adapter, 'd1', {
      name: 'Doomed',
      difficulty: 'easy',
      distanceMeters: 100,
      elevationGainMeters: 0,
      lat: 0,
      lng: 0,
    });

    deleteTrail(testDb.adapter, 'd1');
    expect(getTrail(testDb.adapter, 'd1')).toBeNull();
  });
});

describe('Recordings CRUD', () => {
  it('creates a recording', () => {
    const rec = createRecording(testDb.adapter, 'r1', {
      name: 'Morning Hike',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 5000,
      elevationGainMeters: 300,
      durationSeconds: 3600,
    });

    expect(rec.id).toBe('r1');
    expect(rec.name).toBe('Morning Hike');
    expect(rec.activityType).toBe('hike');
    expect(rec.trailId).toBeNull();
    expect(rec.durationSeconds).toBe(3600);
  });

  it('creates a recording linked to a trail', () => {
    createTrail(testDb.adapter, 'lt1', {
      name: 'Link Trail',
      difficulty: 'moderate',
      distanceMeters: 8000,
      elevationGainMeters: 400,
      lat: 37.8,
      lng: -122.5,
    });

    const rec = createRecording(testDb.adapter, 'r2', {
      trailId: 'lt1',
      name: 'Afternoon Run',
      activityType: 'run',
      startedAt: '2026-03-08T14:00:00Z',
      distanceMeters: 8000,
      elevationGainMeters: 400,
      durationSeconds: 2700,
    });

    expect(rec.trailId).toBe('lt1');
  });

  it('gets a recording by id', () => {
    createRecording(testDb.adapter, 'r3', {
      name: 'Test Run',
      activityType: 'run',
      startedAt: '2026-03-08T09:00:00Z',
      distanceMeters: 3000,
      elevationGainMeters: 50,
      durationSeconds: 1200,
    });

    const found = getRecording(testDb.adapter, 'r3');
    expect(found).not.toBeNull();
    expect(found!.activityType).toBe('run');

    expect(getRecording(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists recordings and filters by activity type', () => {
    createRecording(testDb.adapter, 'r4', {
      name: 'Hike 1',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 5000,
      elevationGainMeters: 300,
      durationSeconds: 3600,
    });
    createRecording(testDb.adapter, 'r5', {
      name: 'Bike 1',
      activityType: 'bike',
      startedAt: '2026-03-08T10:00:00Z',
      distanceMeters: 20000,
      elevationGainMeters: 200,
      durationSeconds: 3600,
    });

    const all = getRecordings(testDb.adapter);
    expect(all).toHaveLength(2);

    const hikesOnly = getRecordings(testDb.adapter, { activityType: 'hike' });
    expect(hikesOnly).toHaveLength(1);
    expect(hikesOnly[0].name).toBe('Hike 1');
  });

  it('gets recordings by trail', () => {
    createTrail(testDb.adapter, 'bt1', {
      name: 'Bound Trail',
      difficulty: 'easy',
      distanceMeters: 3000,
      elevationGainMeters: 50,
      lat: 37.7,
      lng: -122.4,
    });

    createRecording(testDb.adapter, 'br1', {
      trailId: 'bt1',
      name: 'Rec 1',
      activityType: 'walk',
      startedAt: '2026-03-07T08:00:00Z',
      distanceMeters: 3000,
      elevationGainMeters: 50,
      durationSeconds: 2400,
    });
    createRecording(testDb.adapter, 'br2', {
      trailId: 'bt1',
      name: 'Rec 2',
      activityType: 'walk',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 3000,
      elevationGainMeters: 50,
      durationSeconds: 2200,
    });
    createRecording(testDb.adapter, 'br3', {
      name: 'Unlinked',
      activityType: 'hike',
      startedAt: '2026-03-08T10:00:00Z',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      durationSeconds: 600,
    });

    const byTrail = getRecordingsByTrail(testDb.adapter, 'bt1');
    expect(byTrail).toHaveLength(2);
  });

  it('deletes a recording and cascades waypoints', () => {
    createRecording(testDb.adapter, 'dr1', {
      name: 'To Delete',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      durationSeconds: 600,
    });
    createWaypoint(testDb.adapter, 'w1', {
      recordingId: 'dr1',
      lat: 37.7,
      lng: -122.4,
      timestamp: '2026-03-08T08:00:00Z',
    });

    expect(getWaypointsByRecording(testDb.adapter, 'dr1')).toHaveLength(1);
    deleteRecording(testDb.adapter, 'dr1');
    expect(getRecording(testDb.adapter, 'dr1')).toBeNull();
    expect(getWaypointsByRecording(testDb.adapter, 'dr1')).toHaveLength(0);
  });

  it('updates recording metadata fields', () => {
    createRecording(testDb.adapter, 'meta1', {
      name: 'Meta Hike',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 3200,
      elevationGainMeters: 180,
      durationSeconds: 2400,
    });

    const updated = updateRecording(testDb.adapter, 'meta1', {
      name: 'Sunrise Ridge',
      notes: 'Foggy at the summit',
      isPrivate: true,
      activityRating: 4,
      endedAt: '2026-03-08T08:40:00Z',
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Sunrise Ridge');
    expect(updated?.notes).toBe('Foggy at the summit');
    expect(updated?.isPrivate).toBe(true);
    expect(updated?.activityRating).toBe(4);
    expect(updated?.endedAt).toBe('2026-03-08T08:40:00Z');
  });

  it('exports a recording as GPX with track points', () => {
    createRecording(testDb.adapter, 'gpx1', {
      name: 'GPX Test',
      activityType: 'walk',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 1200,
      elevationGainMeters: 42,
      durationSeconds: 900,
    });
    createWaypoint(testDb.adapter, 'gpx-w1', {
      recordingId: 'gpx1',
      lat: 37.77,
      lng: -122.42,
      elevation: 12,
      timestamp: '2026-03-08T08:00:00Z',
    });
    createWaypoint(testDb.adapter, 'gpx-w2', {
      recordingId: 'gpx1',
      lat: 37.771,
      lng: -122.421,
      elevation: 24,
      timestamp: '2026-03-08T08:05:00Z',
    });

    const gpx = exportRecordingAsGPX(testDb.adapter, 'gpx1');
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('<name>GPX Test</name>');
    expect(gpx).toContain('<trkpt lat="37.770000" lon="-122.420000">');
    expect(gpx).toContain('<time>2026-03-08T08:05:00Z</time>');
  });
});

describe('Waypoints', () => {
  it('creates and retrieves waypoints for a recording', () => {
    createRecording(testDb.adapter, 'wr1', {
      name: 'Waypoint Test',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 5000,
      elevationGainMeters: 300,
      durationSeconds: 3600,
    });

    createWaypoint(testDb.adapter, 'wp1', {
      recordingId: 'wr1',
      lat: 37.7749,
      lng: -122.4194,
      elevation: 50,
      timestamp: '2026-03-08T08:00:00Z',
      accuracy: 5,
    });
    createWaypoint(testDb.adapter, 'wp2', {
      recordingId: 'wr1',
      lat: 37.7750,
      lng: -122.4190,
      elevation: 55,
      timestamp: '2026-03-08T08:01:00Z',
      accuracy: 3,
    });

    const waypoints = getWaypointsByRecording(testDb.adapter, 'wr1');
    expect(waypoints).toHaveLength(2);
    expect(waypoints[0].lat).toBe(37.7749);
    expect(waypoints[0].elevation).toBe(50);
    expect(waypoints[0].accuracy).toBe(5);
    // Ordered by timestamp ascending
    expect(waypoints[0].timestamp).toBe('2026-03-08T08:00:00Z');
    expect(waypoints[1].timestamp).toBe('2026-03-08T08:01:00Z');
  });

  it('creates waypoints with minimal fields', () => {
    createRecording(testDb.adapter, 'wr2', {
      name: 'Minimal WP',
      activityType: 'walk',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 1000,
      elevationGainMeters: 10,
      durationSeconds: 600,
    });

    const wp = createWaypoint(testDb.adapter, 'wp3', {
      recordingId: 'wr2',
      lat: 37.7,
      lng: -122.4,
      timestamp: '2026-03-08T08:00:00Z',
    });

    expect(wp.elevation).toBeNull();
    expect(wp.accuracy).toBeNull();
  });
});

describe('Trail Photos', () => {
  it('creates and retrieves photos by recording', () => {
    createRecording(testDb.adapter, 'photo-rec', {
      name: 'Photo Hike',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 2400,
      elevationGainMeters: 80,
      durationSeconds: 1800,
    });

    const photo = createPhoto(testDb.adapter, 'photo-1', {
      recordingId: 'photo-rec',
      lat: 37.77,
      lng: -122.42,
      uri: 'file:///photo-1.jpg',
      caption: 'Trailhead',
      takenAt: '2026-03-08T08:10:00Z',
    });

    expect(photo.caption).toBe('Trailhead');

    const photos = getPhotosByRecording(testDb.adapter, 'photo-rec');
    expect(photos).toHaveLength(1);
    expect(photos[0].uri).toBe('file:///photo-1.jpg');
    expect(photos[0].recordingId).toBe('photo-rec');
  });
});

describe('Trail Stats', () => {
  it('returns zeroes when no recordings exist', () => {
    const stats = getTrailStats(testDb.adapter);
    expect(stats.totalRecordings).toBe(0);
    expect(stats.totalDistanceMeters).toBe(0);
    expect(stats.totalElevationGainMeters).toBe(0);
    expect(stats.totalDurationSeconds).toBe(0);
    expect(stats.averagePaceMinPerKm).toBeNull();
  });

  it('aggregates stats across recordings', () => {
    createRecording(testDb.adapter, 's1', {
      name: 'Hike A',
      activityType: 'hike',
      startedAt: '2026-03-07T08:00:00Z',
      distanceMeters: 5000,
      elevationGainMeters: 300,
      durationSeconds: 3600,
    });
    createRecording(testDb.adapter, 's2', {
      name: 'Hike B',
      activityType: 'hike',
      startedAt: '2026-03-08T08:00:00Z',
      distanceMeters: 10000,
      elevationGainMeters: 700,
      durationSeconds: 7200,
    });

    const stats = getTrailStats(testDb.adapter);
    expect(stats.totalRecordings).toBe(2);
    expect(stats.totalDistanceMeters).toBe(15000);
    expect(stats.totalElevationGainMeters).toBe(1000);
    expect(stats.totalDurationSeconds).toBe(10800);
    // avg pace = (10800/60) / (15000/1000) = 180/15 = 12 min/km
    expect(stats.averagePaceMinPerKm).toBe(12);
  });
});

describe('Trails Settings', () => {
  it('returns null for missing settings', () => {
    expect(getSetting(testDb.adapter, 'distanceUnit')).toBeNull();
  });

  it('persists and updates settings values', () => {
    setSetting(testDb.adapter, 'distanceUnit', 'miles');
    expect(getSetting(testDb.adapter, 'distanceUnit')).toBe('miles');

    setSetting(testDb.adapter, 'distanceUnit', 'kilometers');
    expect(getSetting(testDb.adapter, 'distanceUnit')).toBe('kilometers');
  });
});
